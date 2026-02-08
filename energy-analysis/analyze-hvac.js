#!/usr/bin/env node

// HVAC Energy Analysis: Nov 2025 - Feb 8, 2026
// Correlates Tesla Powerwall daily energy with weather data to model
// heating consumption, detect anomalies, and benchmark passive house performance.
//
// Usage: node energy-analysis/analyze-hvac.js
//
// Data sources:
//   - Tesla Energy MCP (daily + 5-min granularity via JSON-RPC)
//   - Open-Meteo Archive API (daily weather, free, no key)
//   - data/history.json (sauna cross-validation)

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(__dirname, 'data');
const REPORT_PATH = join(DATA_DIR, 'report.md');
const CACHE_PATH = join(DATA_DIR, 'cached-data.json');

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

// ============================================================
// Configuration
// ============================================================

const HOUSE = {
  sqft: 2600,
  ach50: 0.4,
  thermostatNormal: 68,   // °F (20°C)
  thermostatAway: 50,     // °F (10°C eco mode)
  volume: 2600 * 9,       // cubic feet (assuming ~9ft avg ceiling)
};

// Out-of-town dates (Dec 13 - Jan 2 except Dec 27)
const OUT_OF_TOWN_START = '2025-12-13';
const OUT_OF_TOWN_END = '2026-01-02';
const HOME_DURING_VACATION = '2025-12-27';

// Known sauna days from history.json
const KNOWN_SAUNA_DAYS = ['2026-01-07', '2026-01-27'];

// Analysis date range
const START_DATE = '2025-11-01';
const END_DATE = '2026-02-08';

// ============================================================
// Helpers
// ============================================================

function getNextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ============================================================
// MCP Client (reuses existing tesla-mcp-wrapper.sh)
// ============================================================

function callTeslaMCP(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const server = spawn('./tesla-mcp-wrapper.sh', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: PROJECT_ROOT
    });

    let buffer = '';
    const responses = [];
    let initialized = false;
    const TIMEOUT_MS = 60000;

    server.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            responses.push(response);

            if (response.id === 0 && response.result && !initialized) {
              initialized = true;
              server.stdin.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              }) + '\n');
            }
          } catch (e) { /* ignore non-JSON */ }
        }
      }
    });

    server.on('error', reject);

    // Initialize
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'hvac-analyzer', version: '1.0.0' }
      }
    }) + '\n');

    // Wait for init, then send tool call
    setTimeout(() => {
      server.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }) + '\n');

      // Wait for response
      const startTime = Date.now();
      const interval = setInterval(() => {
        const response = responses.find(r => r.id === 1);
        if (response) {
          clearInterval(interval);
          server.kill();
          if (response.result?.content?.[0]?.text) {
            try {
              resolve(JSON.parse(response.result.content[0].text));
            } catch (e) {
              reject(new Error(`Failed to parse response: ${response.result.content[0].text.substring(0, 200)}`));
            }
          } else {
            reject(new Error('No response content'));
          }
        } else if (Date.now() - startTime > TIMEOUT_MS) {
          clearInterval(interval);
          server.kill();
          reject(new Error(`Timeout waiting for ${toolName}`));
        }
      }, 200);
    }, 2500);
  });
}

// ============================================================
// HTTP helper for Open-Meteo
// ============================================================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

// ============================================================
// Step 1: Collect Tesla Daily Energy Data
// ============================================================

async function collectTeslaDaily() {
  console.log('Step 1: Collecting Tesla daily energy data...');

  // We need 4 queries to cover Nov 1 2025 - Feb 8 2026
  // Tesla MCP server: period="month", end_date="YYYY-MM-DD"
  //   → startDate = endDate - 1 month, endDate = end_date 23:59:59
  //   → Returns daily entries in time_series
  //
  // Query 1: end_date=2025-12-01 → Nov 1 - Dec 1 (November data)
  // Query 2: end_date=2026-01-01 → Dec 1 - Jan 1 (December data)
  // Query 3: end_date=2026-02-01 → Jan 1 - Feb 1 (January data)
  // Query 4: end_date=2026-02-09, period=week → Feb 2 - Feb 9 (first week of Feb)

  const queries = [
    { period: 'month', end_date: '2025-12-01', label: 'November 2025' },
    { period: 'month', end_date: '2026-01-01', label: 'December 2025' },
    { period: 'month', end_date: '2026-02-01', label: 'January 2026' },
    { period: 'day', end_date: '2026-02-02', label: 'February 1 2026' },
    { period: 'week', end_date: '2026-02-09', label: 'February 2-8 2026' },
  ];

  // Tesla API returns sub-daily intervals (30-min) even for month/week periods.
  // We need to aggregate time_series entries by date to get daily totals.
  // Adjacent queries may overlap on boundary dates (e.g., Dec 1 appears in both
  // Nov and Dec queries), so track seen timestamps to avoid double-counting.
  const byDate = new Map();
  const seenTimestamps = new Set();

  for (const query of queries) {
    console.log(`  Fetching ${query.label}...`);
    try {
      const result = await callTeslaMCP('get_energy_history', {
        period: query.period,
        end_date: query.end_date
      });

      if (result.time_series) {
        let added = 0;
        let skipped = 0;

        // Aggregate intervals into daily totals
        for (const entry of result.time_series) {
          const date = entry.timestamp.split('T')[0];
          if (date < START_DATE || date > END_DATE) continue;

          // Skip duplicate timestamps from overlapping queries
          if (seenTimestamps.has(entry.timestamp)) {
            skipped++;
            continue;
          }
          seenTimestamps.add(entry.timestamp);

          if (!byDate.has(date)) {
            byDate.set(date, {
              date,
              homeEnergy: 0,      // Wh
              solarEnergy: 0,     // Wh
              gridImported: 0,    // Wh
              gridExported: 0,    // Wh
              batteryCharged: 0,  // Wh
              batteryDischarged: 0, // Wh
              intervalCount: 0,
            });
          }

          const day = byDate.get(date);
          day.homeEnergy += entry.home_energy || 0;
          day.solarEnergy += entry.solar_energy || 0;
          day.gridImported += entry.grid_energy_imported || 0;
          day.gridExported += entry.grid_energy_exported || 0;
          day.batteryCharged += entry.battery_energy_charged || 0;
          day.batteryDischarged += entry.battery_energy_discharged || 0;
          day.intervalCount++;
          added++;
        }
        console.log(`    Got ${result.time_series.length} intervals (${added} new, ${skipped} duplicate)`);
      }
    } catch (err) {
      console.error(`    ERROR fetching ${query.label}: ${err.message}`);
    }
  }

  const sorted = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  console.log(`  Total: ${sorted.length} unique days collected\n`);
  return sorted;
}

// ============================================================
// Step 2: Collect Weather Data
// ============================================================

async function collectWeatherData() {
  console.log('Step 2: Collecting weather data from Open-Meteo...');

  const url = 'https://archive-api.open-meteo.com/v1/archive' +
    '?latitude=41.07&longitude=-73.71' +
    `&start_date=${START_DATE}&end_date=${END_DATE}` +
    '&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,' +
    'wind_speed_10m_max,wind_gusts_10m_max' +
    '&temperature_unit=fahrenheit' +
    '&wind_speed_unit=mph' +
    '&timezone=America/New_York';

  const data = await httpGet(url);

  if (!data.daily || !data.daily.time) {
    throw new Error('Invalid weather response: ' + JSON.stringify(data).substring(0, 300));
  }

  const weatherDays = data.daily.time.map((date, i) => ({
    date,
    tempMax: data.daily.temperature_2m_max[i],
    tempMin: data.daily.temperature_2m_min[i],
    tempMean: data.daily.temperature_2m_mean[i],
    windMax: data.daily.wind_speed_10m_max[i],
    windGustMax: data.daily.wind_gusts_10m_max[i],
  }));

  console.log(`  Got ${weatherDays.length} days of weather data\n`);
  return weatherDays;
}

// ============================================================
// Step 3: Classify Each Day
// ============================================================

function isOutOfTown(date) {
  if (date === HOME_DURING_VACATION) return false;
  return date >= OUT_OF_TOWN_START && date <= OUT_OF_TOWN_END;
}

function classifyDays(teslaDaily, weatherDaily) {
  console.log('Step 3: Classifying days...');

  // Build weather lookup
  const weatherMap = new Map();
  for (const w of weatherDaily) {
    weatherMap.set(w.date, w);
  }

  // Load history.json for sauna cross-validation
  let historyData = { dailyStats: [] };
  try {
    const histPath = join(PROJECT_ROOT, 'data', 'history.json');
    if (existsSync(histPath)) {
      historyData = JSON.parse(readFileSync(histPath, 'utf8'));
    }
  } catch (e) { /* ignore */ }

  const historySaunaDays = new Set(
    historyData.dailyStats
      .filter(d => d.saunaUsed)
      .map(d => d.date)
  );

  const classified = teslaDaily.map(day => {
    const weather = weatherMap.get(day.date) || {};
    const homeKwh = day.homeEnergy / 1000;
    const hdd = Math.max(0, 65 - (weather.tempMean || 50));

    let type = 'normal';
    let saunaEstimateKwh = 0;

    if (isOutOfTown(day.date)) {
      type = 'out-of-town';
    } else if (historySaunaDays.has(day.date)) {
      type = 'sauna';
      saunaEstimateKwh = 25; // Conservative estimate: ~12kW * 2hr = 24kWh
    }

    return {
      date: day.date,
      type,
      homeKwh,
      solarKwh: day.solarEnergy / 1000,
      gridImportKwh: day.gridImported / 1000,
      gridExportKwh: day.gridExported / 1000,
      batteryChargedKwh: day.batteryCharged / 1000,
      batteryDischargedKwh: day.batteryDischarged / 1000,
      saunaEstimateKwh,
      adjustedKwh: homeKwh - saunaEstimateKwh,
      ...weather,
      hdd,
    };
  });

  const counts = { normal: 0, 'out-of-town': 0, sauna: 0 };
  classified.forEach(d => counts[d.type]++);
  console.log(`  Classified: ${counts.normal} normal, ${counts['out-of-town']} out-of-town, ${counts.sauna} sauna\n`);

  return classified;
}

// ============================================================
// Step 3b: Detect Sauna from 5-minute Tesla Data
// ============================================================

async function detectSaunaFromTesla(classifiedDays) {
  console.log('Step 3b: Detecting sauna usage from Tesla 5-min data...');

  // For days that are "normal" but have unusually high consumption,
  // check 5-minute data for sauna signature (sustained >1000 Wh/interval)
  const normalDays = classifiedDays.filter(d => d.type === 'normal');
  if (normalDays.length === 0) return classifiedDays;

  // Calculate stats for anomaly detection
  const consumptions = normalDays.map(d => d.homeKwh);
  const mean = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;
  const stddev = Math.sqrt(consumptions.reduce((a, b) => a + (b - mean) ** 2, 0) / consumptions.length);
  const threshold = mean + 1.5 * stddev;

  const suspectDays = normalDays.filter(d => d.homeKwh > Math.max(threshold, 50));
  console.log(`  Mean daily consumption: ${mean.toFixed(1)} kWh, StdDev: ${stddev.toFixed(1)} kWh`);
  console.log(`  Threshold: ${threshold.toFixed(1)} kWh (or 50 kWh minimum)`);
  console.log(`  Suspect days for sauna check: ${suspectDays.length}`);

  for (const suspect of suspectDays) {
    console.log(`  Checking ${suspect.date} (${suspect.homeKwh.toFixed(1)} kWh)...`);
    try {
      // Tesla MCP with period="day" returns data for (end_date - 1 day).
      // To get data FOR a specific date, pass end_date = date + 1 day.
      const nextDay = getNextDay(suspect.date);
      const result = await callTeslaMCP('get_energy_history', {
        period: 'day',
        end_date: nextDay
      });

      if (result.time_series) {
        // Look for sauna signature: sustained high power intervals
        const highPowerIntervals = result.time_series.filter(e => e.home_energy > 1000);
        const consecutiveRuns = findConsecutiveRuns(highPowerIntervals, result.time_series);

        if (consecutiveRuns.maxLength >= 10) { // 10 intervals * 5min = 50min minimum (catches shorter sessions like Jan 17)
          const saunaWh = consecutiveRuns.totalWh;
          console.log(`    SAUNA DETECTED: ${consecutiveRuns.maxLength} consecutive high-power intervals, ~${(saunaWh / 1000).toFixed(1)} kWh`);

          // Update classification
          const idx = classifiedDays.findIndex(d => d.date === suspect.date);
          if (idx >= 0) {
            classifiedDays[idx].type = 'sauna';
            classifiedDays[idx].saunaEstimateKwh = saunaWh / 1000;
            classifiedDays[idx].adjustedKwh = classifiedDays[idx].homeKwh - saunaWh / 1000;
            classifiedDays[idx].saunaDetected = true;
          }
        } else {
          console.log(`    No sauna pattern found (max consecutive high-power: ${consecutiveRuns.maxLength})`);
        }
      }
    } catch (err) {
      console.log(`    Skipping 5-min check: ${err.message}`);
    }
  }

  return classifiedDays;
}

function findConsecutiveRuns(highPowerIntervals, allIntervals) {
  // Find the longest consecutive run of high-power intervals
  const highSet = new Set(highPowerIntervals.map(e => e.timestamp));
  let maxLength = 0;
  let currentLength = 0;
  let totalWh = 0;
  let runWh = 0;

  for (const entry of allIntervals) {
    if (highSet.has(entry.timestamp)) {
      currentLength++;
      runWh += entry.home_energy;
      if (currentLength > maxLength) {
        maxLength = currentLength;
        totalWh = runWh;
      }
    } else {
      currentLength = 0;
      runWh = 0;
    }
  }

  return { maxLength, totalWh };
}

// ============================================================
// Step 4: Build Temperature-vs-Consumption Model
// ============================================================

function buildModel(classifiedDays) {
  console.log('Step 4: Building segmented regression model...');

  const normalDays = classifiedDays.filter(d =>
    d.type === 'normal' && d.tempMin !== undefined && d.homeKwh > 0
  );

  if (normalDays.length < 10) {
    console.error('  ERROR: Not enough normal days for modeling');
    return null;
  }

  // Add computed features
  for (let i = 0; i < normalDays.length; i++) {
    const d = normalDays[i];
    d.heatingDegreeDays = Math.max(0, 65 - d.tempMean);

    // Prior-day tempMin as thermal mass proxy (more physical than rolling avg:
    // a cold night depletes thermal mass, raising next-day heating demand)
    if (i >= 1) {
      d.priorDayTempMin = normalDays[i - 1].tempMin;
    } else {
      d.priorDayTempMin = d.tempMin;
    }

    // 3-day rolling average of tempMean (thermal mass lag)
    if (i >= 2) {
      d.thermalMassLag = (normalDays[i].tempMean + normalDays[i - 1].tempMean + normalDays[i - 2].tempMean) / 3;
    } else {
      d.thermalMassLag = d.tempMean;
    }

    // Weekend indicator (Sat=6, Sun=0): higher occupancy → more cooking/appliances
    const dow = new Date(d.date + 'T12:00:00').getDay();
    d.isWeekend = (dow === 0 || dow === 6) ? 1 : 0;
  }

  // Segment by tempMin ranges
  const segments = [
    { name: 'Mild (>32°F)', filter: d => d.tempMin > 32, days: [] },
    { name: 'Moderate (20-32°F)', filter: d => d.tempMin > 20 && d.tempMin <= 32, days: [] },
    { name: 'Cold (5-20°F)', filter: d => d.tempMin > 5 && d.tempMin <= 20, days: [] },
    { name: 'Extreme (<5°F)', filter: d => d.tempMin <= 5, days: [] },
  ];

  for (const d of normalDays) {
    for (const seg of segments) {
      if (seg.filter(d)) {
        seg.days.push(d);
        break;
      }
    }
  }

  // Define feature sets to try
  const basicFeatures = [
    { name: 'tempMin', getter: d => d.tempMin },
    { name: 'windMax', getter: d => d.windMax || 0 },
  ];
  const extendedFeatures = [
    { name: 'tempMin', getter: d => d.tempMin },
    { name: 'windMax', getter: d => d.windMax || 0 },
    { name: 'thermalMassLag', getter: d => d.thermalMassLag },
  ];
  const hddFeatures = [
    { name: 'hdd', getter: d => d.heatingDegreeDays },
    { name: 'windMax', getter: d => d.windMax || 0 },
  ];
  const priorDayFeatures = [
    { name: 'tempMin', getter: d => d.tempMin },
    { name: 'windGustMax', getter: d => d.windGustMax || 0 },
    { name: 'priorDayTempMin', getter: d => d.priorDayTempMin },
  ];
  const weekendFeatures = [
    { name: 'tempMin', getter: d => d.tempMin },
    { name: 'windGustMax', getter: d => d.windGustMax || 0 },
    { name: 'priorDayTempMin', getter: d => d.priorDayTempMin },
    { name: 'isWeekend', getter: d => d.isWeekend },
  ];

  // Fit segment models with basic features
  for (const seg of segments) {
    if (seg.days.length >= 4) {
      seg.model = fitLinearRegression(seg.days, basicFeatures);
      console.log(`  ${seg.name}: ${seg.days.length} days, R²=${seg.model.rSquared.toFixed(3)}, coefficients: tempMin=${seg.model.a.toFixed(3)}, windMax=${seg.model.b.toFixed(3)}, intercept=${seg.model.c.toFixed(2)}`);
    } else {
      console.log(`  ${seg.name}: ${seg.days.length} days (too few for regression, using segment mean)`);
      const mean = seg.days.length > 0
        ? seg.days.reduce((a, d) => a + d.adjustedKwh, 0) / seg.days.length
        : 0;
      seg.model = { a: 0, b: 0, c: mean, rSquared: 0, useMean: true, coefficients: { intercept: mean } };
    }
  }

  // Try multiple global models and pick the best
  const basicModel = fitLinearRegression(normalDays, basicFeatures);
  const extendedModel = fitLinearRegression(normalDays, extendedFeatures);
  const hddModel = fitLinearRegression(normalDays, hddFeatures);
  const priorDayModel = fitLinearRegression(normalDays, priorDayFeatures);
  const weekendModel = fitLinearRegression(normalDays, weekendFeatures);

  console.log(`  Global (tempMin+wind): ${normalDays.length} days, R²=${basicModel.rSquared.toFixed(3)}`);
  console.log(`  Global (tempMin+wind+lag): ${normalDays.length} days, R²=${extendedModel.rSquared.toFixed(3)}`);
  console.log(`  Global (HDD+wind): ${normalDays.length} days, R²=${hddModel.rSquared.toFixed(3)}`);
  console.log(`  Global (tempMin+gust+priorDay): ${normalDays.length} days, R²=${priorDayModel.rSquared.toFixed(3)}`);
  console.log(`  Global (tempMin+gust+priorDay+weekend): ${normalDays.length} days, R²=${weekendModel.rSquared.toFixed(3)}`);

  // Pick the best global model
  const candidates = [
    { model: basicModel, name: 'tempMin+wind' },
    { model: extendedModel, name: 'tempMin+wind+lag' },
    { model: hddModel, name: 'HDD+wind' },
    { model: priorDayModel, name: 'tempMin+gust+priorDay' },
    { model: weekendModel, name: 'tempMin+gust+priorDay+weekend' },
  ];
  candidates.sort((a, b) => b.model.rSquared - a.model.rSquared);
  const globalModel = candidates[0].model;
  console.log(`  Best global model: ${candidates[0].name} (R²=${globalModel.rSquared.toFixed(3)})`);

  console.log();
  return { segments, globalModel, normalDays };
}

function fitLinearRegression(days, features) {
  // General multiple linear regression using normal equations
  // features: array of { name, getter } where getter(day) returns the feature value
  // Default features: tempMin, windMax
  if (!features) {
    features = [
      { name: 'tempMin', getter: d => d.tempMin },
      { name: 'windMax', getter: d => d.windMax || 0 },
    ];
  }

  const n = days.length;
  const p = features.length + 1; // +1 for intercept
  if (n < p + 1) return { coefficients: {}, rSquared: 0, a: 0, b: 0, c: 0 };

  // Build X matrix (features + intercept column)
  const X = days.map(d => [...features.map(f => f.getter(d)), 1]);
  const y = days.map(d => d.adjustedKwh);

  // Normal equations: (X^T X) beta = X^T y
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  const beta = solveLinearSystem(XtX, Xty, p);
  if (!beta) return { coefficients: {}, rSquared: 0, a: 0, b: 0, c: 0 };

  // Calculate R²
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    let predicted = 0;
    for (let j = 0; j < p; j++) predicted += beta[j] * X[i][j];
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Build named coefficients
  const coefficients = {};
  features.forEach((f, i) => { coefficients[f.name] = beta[i]; });
  coefficients.intercept = beta[p - 1];

  // Keep legacy a, b, c for segment models
  return {
    coefficients,
    rSquared,
    a: beta[0] || 0,       // first feature (tempMin)
    b: beta[1] || 0,       // second feature (windMax)
    c: beta[p - 1] || 0,   // intercept
  };
}

function solveLinearSystem(A, b, n) {
  // Gaussian elimination with partial pivoting for n×n system
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    if (Math.abs(M[col][col]) < 1e-10) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }

  return x;
}

function predictConsumption(model, day) {
  // Find the right segment
  for (const seg of model.segments) {
    if (seg.filter(day) && seg.model && seg.model.rSquared > 0) {
      const m = seg.model;
      return m.a * day.tempMin + m.b * (day.windMax || 0) + m.c;
    }
  }
  // Fallback to global model (uses coefficients dict for flexibility)
  const g = model.globalModel;
  const c = g.coefficients;
  let predicted = c.intercept || 0;
  if (c.tempMin !== undefined) predicted += c.tempMin * day.tempMin;
  if (c.hdd !== undefined) predicted += c.hdd * day.heatingDegreeDays;
  if (c.windMax !== undefined) predicted += c.windMax * (day.windMax || 0);
  if (c.windGustMax !== undefined) predicted += c.windGustMax * (day.windGustMax || 0);
  if (c.thermalMassLag !== undefined) predicted += c.thermalMassLag * (day.thermalMassLag || day.tempMean);
  if (c.priorDayTempMin !== undefined) predicted += c.priorDayTempMin * (day.priorDayTempMin || day.tempMin);
  if (c.isWeekend !== undefined) predicted += c.isWeekend * (day.isWeekend || 0);
  return predicted;
}

// ============================================================
// Step 5: Detect Anomalous Days
// ============================================================

function detectAnomalies(classifiedDays, model) {
  console.log('Step 5: Detecting anomalies...');

  const normalDays = classifiedDays.filter(d =>
    d.type === 'normal' && d.tempMin !== undefined && d.homeKwh > 0
  );

  // Calculate residuals
  for (const day of normalDays) {
    day.expectedKwh = predictConsumption(model, day);
    day.residualKwh = day.adjustedKwh - day.expectedKwh;
  }

  // Calculate residual statistics
  const residuals = normalDays.map(d => d.residualKwh);
  const meanRes = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const stdRes = Math.sqrt(residuals.reduce((a, b) => a + (b - meanRes) ** 2, 0) / residuals.length);

  console.log(`  Residual mean: ${meanRes.toFixed(2)} kWh, StdDev: ${stdRes.toFixed(2)} kWh`);

  const anomalies = [];
  for (const day of normalDays) {
    const zScore = stdRes > 0 ? (day.residualKwh - meanRes) / stdRes : 0;
    day.zScore = zScore;

    if (Math.abs(zScore) > 1.5) {
      const direction = zScore > 0 ? 'HIGH' : 'LOW';
      anomalies.push({ ...day, direction });
      console.log(`  ${direction} anomaly: ${day.date} (actual=${day.adjustedKwh.toFixed(1)}, expected=${day.expectedKwh.toFixed(1)}, residual=${day.residualKwh.toFixed(1)}, z=${zScore.toFixed(2)})`);
    }
  }

  console.log(`  Found ${anomalies.length} anomalies\n`);
  return { anomalies, residualStats: { mean: meanRes, stddev: stdRes } };
}

// ============================================================
// Step 5b: Drill Down into Anomalous Days
// ============================================================

async function drillDownAnomalies(anomalies) {
  console.log('Step 5b: Drilling down into anomalous days...');

  const drilldowns = [];

  // Only drill down the top 5 most extreme anomalies to save API calls
  const topAnomalies = anomalies
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 5);

  for (const anomaly of topAnomalies) {
    console.log(`  Fetching 5-min data for ${anomaly.date}...`);
    try {
      // Tesla MCP with period="day" returns data for (end_date - 1 day)
      const nextDay = getNextDay(anomaly.date);
      const result = await callTeslaMCP('get_energy_history', {
        period: 'day',
        end_date: nextDay
      });

      if (result.time_series) {
        const hourly = aggregateToHourly(result.time_series);
        const patterns = analyzeHourlyPatterns(hourly);

        drilldowns.push({
          date: anomaly.date,
          direction: anomaly.direction,
          zScore: anomaly.zScore,
          actualKwh: anomaly.adjustedKwh,
          expectedKwh: anomaly.expectedKwh,
          residualKwh: anomaly.residualKwh,
          hourly,
          patterns,
        });

        console.log(`    Patterns: ${patterns.join(', ') || 'none detected'}`);
      }
    } catch (err) {
      console.log(`    Skipping drill-down: ${err.message}`);
    }
  }

  console.log();
  return drilldowns;
}

function aggregateToHourly(timeSeries) {
  const hourly = {};
  for (const entry of timeSeries) {
    const hour = new Date(entry.timestamp).getHours();
    if (!hourly[hour]) {
      hourly[hour] = { hour, totalWh: 0, solarWh: 0, entries: 0 };
    }
    hourly[hour].totalWh += entry.home_energy || 0;
    hourly[hour].solarWh += entry.solar_energy || 0;
    hourly[hour].entries++;
  }
  return Object.values(hourly).sort((a, b) => a.hour - b.hour);
}

function analyzeHourlyPatterns(hourly) {
  const patterns = [];

  // Overnight ramp: consumption escalating 12am-6am
  const overnight = hourly.filter(h => h.hour >= 0 && h.hour < 6);
  if (overnight.length >= 4) {
    const first = overnight[0]?.totalWh || 0;
    const last = overnight[overnight.length - 1]?.totalWh || 0;
    if (last > first * 1.5 && last > 2000) {
      patterns.push('overnight-ramp');
    }
  }

  // Morning surge: 6-9am spike
  const morning = hourly.filter(h => h.hour >= 6 && h.hour < 9);
  const nightAvg = overnight.length > 0
    ? overnight.reduce((a, h) => a + h.totalWh, 0) / overnight.length
    : 0;
  const morningMax = morning.reduce((a, h) => Math.max(a, h.totalWh), 0);
  if (morningMax > nightAvg * 1.8 && morningMax > 3000) {
    patterns.push('morning-surge');
  }

  // Sustained high: >3 kWh/hr for 6+ hours
  const highHours = hourly.filter(h => h.totalWh > 3000);
  if (highHours.length >= 6) {
    patterns.push('sustained-high');
  }

  // Peak consumption hour
  const peakHour = hourly.reduce((max, h) => h.totalWh > max.totalWh ? h : max, hourly[0]);
  if (peakHour && peakHour.totalWh > 4000) {
    patterns.push(`peak-${peakHour.hour}:00-${(peakHour.totalWh / 1000).toFixed(1)}kWh`);
  }

  return patterns;
}

// ============================================================
// Step 6: Passive House Benchmark
// ============================================================

function benchmarkPassiveHouse(classifiedDays, model) {
  console.log('Step 6: Computing passive house benchmark...');

  // 6a. Establish baseload from out-of-town days
  // Even in eco mode (50°F), the house needs some HVAC on cold days.
  // True non-HVAC baseload = consumption on warmest eco-mode days (minimal heating).
  const outOfTownDays = classifiedDays.filter(d => d.type === 'out-of-town' && d.homeKwh > 0);

  // Detect the eco-mode → 20°C switchover by looking for a consumption jump
  let switchoverDate = null;
  let ecoModeDays = [];
  let heatedVacationDays = [];

  if (outOfTownDays.length > 0) {
    outOfTownDays.sort((a, b) => a.date.localeCompare(b.date));

    // Find the day with the biggest day-over-day jump (thermostat switchover)
    let maxJump = 0;
    let maxJumpIdx = -1;
    for (let i = 1; i < outOfTownDays.length; i++) {
      const jump = outOfTownDays[i].homeKwh - outOfTownDays[i - 1].homeKwh;
      if (jump > maxJump) {
        maxJump = jump;
        maxJumpIdx = i;
      }
    }

    if (maxJump > 10 && maxJumpIdx > 0) {
      switchoverDate = outOfTownDays[maxJumpIdx].date;
      ecoModeDays = outOfTownDays.slice(0, maxJumpIdx);
      heatedVacationDays = outOfTownDays.slice(maxJumpIdx);
      console.log(`  Eco-mode → 20°C switchover detected: ${switchoverDate} (jump of +${maxJump.toFixed(1)} kWh)`);
    } else {
      const mid = Math.floor(outOfTownDays.length / 2);
      ecoModeDays = outOfTownDays.slice(0, mid);
      heatedVacationDays = outOfTownDays.slice(mid);
      console.log('  No clear switchover detected; splitting out-of-town days in half');
    }
  }

  // True baseload: eco-mode days still include some HVAC (maintaining 50°F in cold weather).
  // Use the 2-3 lowest-consumption eco-mode days as the non-HVAC baseline.
  // These correspond to the warmest days when eco-mode HVAC is minimal.
  let baseloadKwh;
  if (ecoModeDays.length >= 2) {
    const sorted = [...ecoModeDays].sort((a, b) => a.homeKwh - b.homeKwh);
    // Use bottom 2 days only (most likely near-zero HVAC).
    // Including 3+ days risks averaging in eco-mode heating (e.g., Dec 31 at 22.1 kWh
    // is clearly still heating to 50°F in 25°F weather, while Dec 29-30 at ~11.6 kWh
    // represent the true non-HVAC floor on warmer days).
    const selectedDays = sorted.slice(0, 2);
    baseloadKwh = selectedDays.reduce((a, d) => a + d.homeKwh, 0) / selectedDays.length;
    console.log(`  Non-HVAC baseload: ${baseloadKwh.toFixed(1)} kWh/day (from ${selectedDays.length} lowest eco-mode days)`);
    console.log(`    Selected days: ${selectedDays.map(d => `${d.date}=${d.homeKwh.toFixed(1)}kWh (mean=${d.tempMean?.toFixed(0)}°F)`).join(', ')}`);
  } else if (ecoModeDays.length > 0) {
    baseloadKwh = Math.min(...ecoModeDays.map(d => d.homeKwh));
    console.log(`  Non-HVAC baseload: ${baseloadKwh.toFixed(1)} kWh/day (minimum of ${ecoModeDays.length} eco-mode days)`);
  } else {
    baseloadKwh = 12;
    console.log(`  Non-HVAC baseload: ${baseloadKwh.toFixed(1)} kWh/day (fallback estimate)`);
  }

  console.log(`  Eco-mode average: ${ecoModeDays.length > 0 ? (ecoModeDays.reduce((a, d) => a + d.homeKwh, 0) / ecoModeDays.length).toFixed(1) : 'N/A'} kWh/day (includes eco-mode HVAC)`);

  // 6b. Calculate actual heating energy for normal days
  const normalDays = classifiedDays.filter(d =>
    d.type === 'normal' && d.tempMin !== undefined && d.homeKwh > 0
  );

  let totalHeatingKwh = 0;
  let totalHDD = 0;
  let heatingDays = [];

  for (const day of normalDays) {
    const heatingKwh = Math.max(0, day.adjustedKwh - baseloadKwh);
    totalHeatingKwh += heatingKwh;
    totalHDD += day.hdd;
    heatingDays.push({ ...day, heatingKwh });
  }

  const heatingKwhPerSqFt = totalHeatingKwh / HOUSE.sqft;
  const heatingKwhPerHDD = totalHDD > 0 ? totalHeatingKwh / totalHDD : 0;
  const analysisDays = normalDays.length;

  // Annualize: scale from our analysis period to full year
  // Heating season is roughly Oct-Apr (180 days). Our data covers ~65-80 normal days.
  // HDD-based annualization is more accurate.
  // Westchester County, NY annual HDD (base 65°F): NOAA 1991-2020 normals for
  // White Plains range 5000-5300; 5100 is a conservative central estimate.
  const annualHDD = 5100;
  const annualHeatingKwh = heatingKwhPerHDD * annualHDD;
  const annualHeatingKwhPerSqFt = annualHeatingKwh / HOUSE.sqft;

  // Convert to kBtu/ft²/year for passive house comparison
  const annualHeatingKBtuPerSqFt = annualHeatingKwhPerSqFt * 3.412;

  console.log(`  Total heating energy: ${totalHeatingKwh.toFixed(1)} kWh over ${analysisDays} normal days`);
  console.log(`  Heating intensity: ${heatingKwhPerHDD.toFixed(2)} kWh/HDD`);
  console.log(`  Annualized: ${annualHeatingKwhPerSqFt.toFixed(2)} kWh/ft²/year (${annualHeatingKBtuPerSqFt.toFixed(2)} kBtu/ft²/year)`);

  // 6c. Model passive house theoretical performance
  // At 0.4 ACH50, N-factor ~20 for 2-story → natural ACH ≈ 0.02
  const naturalACH = HOUSE.ach50 / 20;
  const airChangeRateCFM = naturalACH * HOUSE.volume / 60;

  // ERV provides ~0.3 ACH of mechanical ventilation with 80% recovery
  // Net ventilation heat loss = 0.3 * volume * density * cp * deltaT * (1 - 0.80)
  const ervACH = 0.3;
  const ervRecovery = 0.80;

  // 6d. Model standard new build (~3 ACH50)
  const standardACH50 = 3.5;
  const standardNaturalACH = standardACH50 / 20;

  // Calculate theoretical heating loads per HDD
  // Q = volumetric_flow * air_density * specific_heat * ΔT
  // For 1 HDD (1°F for 24 hours): ΔT = 1°F, time = 24 hours
  // Q_infiltration = naturalACH * volume * 0.075 lb/ft³ * 0.24 BTU/(lb·°F) * 24hr / 3412 BTU/kWh

  const passiveInfiltrationKwhPerHDD = naturalACH * HOUSE.volume * 0.075 * 0.24 * 24 / 3412;
  const passiveVentKwhPerHDD = ervACH * HOUSE.volume * 0.075 * 0.24 * 24 * (1 - ervRecovery) / 3412;
  const passiveEnvelopeKwhPerHDD = estimateEnvelopeLoss(true);

  const standardInfiltrationKwhPerHDD = standardNaturalACH * HOUSE.volume * 0.075 * 0.24 * 24 / 3412;
  const standardVentKwhPerHDD = 0.3 * HOUSE.volume * 0.075 * 0.24 * 24 / 3412; // No heat recovery
  const standardEnvelopeKwhPerHDD = estimateEnvelopeLoss(false);

  // Total heat loss per HDD (before COP adjustment)
  const passiveThermalKwhPerHDD = passiveInfiltrationKwhPerHDD + passiveVentKwhPerHDD + passiveEnvelopeKwhPerHDD;
  const standardThermalKwhPerHDD = standardInfiltrationKwhPerHDD + standardVentKwhPerHDD + standardEnvelopeKwhPerHDD;

  // Adjust for heat pump COP (average ~2.5 for passive house, ~2.0 for standard due to higher loads)
  const passiveCOP = 2.5;
  const standardCOP = 2.0;
  const passiveElecKwhPerHDD = passiveThermalKwhPerHDD / passiveCOP;
  const standardElecKwhPerHDD = standardThermalKwhPerHDD / standardCOP;

  const passiveAnnualKwhPerSqFt = passiveElecKwhPerHDD * annualHDD / HOUSE.sqft;
  const standardAnnualKwhPerSqFt = standardElecKwhPerHDD * annualHDD / HOUSE.sqft;

  // Passive house target: ≤4.75 kBtu/ft²/year = ~1.39 kWh/ft²/year
  const passiveHouseTarget = 1.39;

  // Find coldest day consumption
  const coldestDay = normalDays.reduce((min, d) =>
    (d.tempMin !== undefined && (min === null || d.tempMin < min.tempMin)) ? d : min, null);

  console.log(`\n  --- Benchmark Comparison ---`);
  console.log(`  Your house (measured): ${annualHeatingKwhPerSqFt.toFixed(2)} kWh/ft²/year`);
  console.log(`  Passive house target:  ${passiveHouseTarget.toFixed(2)} kWh/ft²/year`);
  console.log(`  Passive house (model): ${passiveAnnualKwhPerSqFt.toFixed(2)} kWh/ft²/year`);
  console.log(`  Standard build (model): ${standardAnnualKwhPerSqFt.toFixed(2)} kWh/ft²/year`);
  console.log();

  return {
    baseloadKwh,
    ecoModeDays: ecoModeDays.length,
    switchoverDate,
    heatedVacationDays: heatedVacationDays.length,
    totalHeatingKwh,
    totalHDD,
    analysisDays,
    heatingKwhPerSqFt,
    heatingKwhPerHDD,
    annualHeatingKwhPerSqFt,
    annualHeatingKBtuPerSqFt,
    annualHDD,
    passiveHouseTarget,
    passiveAnnualKwhPerSqFt,
    standardAnnualKwhPerSqFt,
    coldestDay,
    heatingDays,
    ecoModeDaysList: ecoModeDays,
    heatedVacationDaysList: heatedVacationDays,
    components: {
      passive: {
        infiltration: passiveInfiltrationKwhPerHDD,
        ventilation: passiveVentKwhPerHDD,
        envelope: passiveEnvelopeKwhPerHDD,
        total: passiveThermalKwhPerHDD,
        cop: passiveCOP,
      },
      standard: {
        infiltration: standardInfiltrationKwhPerHDD,
        ventilation: standardVentKwhPerHDD,
        envelope: standardEnvelopeKwhPerHDD,
        total: standardThermalKwhPerHDD,
        cop: standardCOP,
      }
    }
  };
}

function estimateEnvelopeLoss(isPassiveHouse) {
  // Simplified UA calculation (BTU/hr/°F → kWh/HDD)
  // UA = ΣA/R for each component
  const sqft = HOUSE.sqft;

  if (isPassiveHouse) {
    // Passive house: R-40 walls, R-60 roof, R-5 windows (triple), R-20 slab
    const wallArea = 2800; // sq ft of wall area (estimated)
    const roofArea = 1200;
    const windowArea = 400;
    const slabArea = 1100;

    const UA = wallArea / 40 + roofArea / 60 + windowArea / 5 + slabArea / 20;
    // UA in BTU/hr/°F, convert to kWh per HDD: UA * 24 / 3412
    return UA * 24 / 3412;
  } else {
    // Code minimum: R-20 walls, R-38 roof, R-3 windows (double), R-10 slab
    const wallArea = 2800;
    const roofArea = 1200;
    const windowArea = 400;
    const slabArea = 1100;

    const UA = wallArea / 20 + roofArea / 38 + windowArea / 3 + slabArea / 10;
    return UA * 24 / 3412;
  }
}

// ============================================================
// Step 7: Generate Report
// ============================================================

function generateReport(classifiedDays, model, anomalyResult, drilldowns, benchmark) {
  console.log('Step 7: Generating report...');

  const { anomalies, residualStats } = anomalyResult;
  const normalDays = classifiedDays.filter(d =>
    d.type === 'normal' && d.tempMin !== undefined && d.homeKwh > 0
  );

  let md = '';

  // Header
  md += '# HVAC Energy Analysis: Nov 2025 - Feb 2026\n\n';
  md += `**Generated:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Period:** ${START_DATE} to ${END_DATE} (${classifiedDays.length} days)\n`;
  md += `**Data Sources:** Tesla Powerwall MCP, Open-Meteo Archive API\n\n`;

  // Executive Summary
  md += '## Executive Summary\n\n';

  const totalHome = classifiedDays.reduce((a, d) => a + d.homeKwh, 0);
  const totalSolar = classifiedDays.reduce((a, d) => a + d.solarKwh, 0);
  const totalGridImport = classifiedDays.reduce((a, d) => a + d.gridImportKwh, 0);
  const saunaDays = classifiedDays.filter(d => d.type === 'sauna');
  const totalSaunaKwh = saunaDays.reduce((a, d) => a + d.saunaEstimateKwh, 0);

  md += `Over ${classifiedDays.length} days, the home consumed **${totalHome.toFixed(0)} kWh** total `;
  md += `(avg ${(totalHome / classifiedDays.length).toFixed(1)} kWh/day). `;
  md += `Solar produced ${totalSolar.toFixed(0)} kWh and grid imported ${totalGridImport.toFixed(0)} kWh.\n\n`;

  const gc = model.globalModel.coefficients;
  const tempCoeff = gc.tempMin || gc.hdd || 0;
  const tempLabel = gc.tempMin !== undefined ? 'minimum temperature' : 'heating degree day';

  md += `The regression model explains **${(model.globalModel.rSquared * 100).toFixed(1)}%** of daily consumption variance `;
  md += `using outdoor temperature and wind speed. `;
  if (gc.tempMin !== undefined) {
    md += `Each 1°F drop in daily minimum temperature adds approximately **${Math.abs(gc.tempMin).toFixed(2)} kWh** to daily consumption.\n\n`;
  } else {
    md += `Each additional heating degree day adds approximately **${gc.hdd.toFixed(2)} kWh** to daily consumption.\n\n`;
  }

  if (benchmark.annualHeatingKBtuPerSqFt <= 4.75) {
    md += `The house is performing **within Passive House standards** `;
    md += `(${benchmark.annualHeatingKBtuPerSqFt.toFixed(1)} kBtu/ft²/year vs ≤4.75 target). `;
  } else {
    md += `The house heating intensity is **${benchmark.annualHeatingKBtuPerSqFt.toFixed(1)} kBtu/ft²/year** `;
    md += `(Passive House target: ≤4.75). `;
  }
  md += `A standard code-compliant build would use an estimated **${(benchmark.standardAnnualKwhPerSqFt / benchmark.annualHeatingKwhPerSqFt * 100).toFixed(0)}%** `;
  md += `more heating energy in the same conditions.\n\n`;

  // Day Classification Summary
  md += '## Day Classification\n\n';
  const typeCounts = {};
  classifiedDays.forEach(d => { typeCounts[d.type] = (typeCounts[d.type] || 0) + 1; });
  md += `| Type | Count | Avg kWh/day | Notes |\n`;
  md += `|------|-------|-------------|-------|\n`;
  for (const type of ['normal', 'out-of-town', 'sauna']) {
    const days = classifiedDays.filter(d => d.type === type);
    const avgKwh = days.length > 0 ? days.reduce((a, d) => a + d.homeKwh, 0) / days.length : 0;
    const notes = type === 'out-of-town' ? `Dec 13-Jan 2 (eco mode then 20°C)` :
                  type === 'sauna' ? `~12kW for ~2 hrs each session` : '';
    md += `| ${type} | ${days.length} | ${avgKwh.toFixed(1)} | ${notes} |\n`;
  }
  md += '\n';

  // Out-of-Town Baseline
  md += '## Out-of-Town Baseline Analysis\n\n';
  md += `**Eco-mode baseload:** ${benchmark.baseloadKwh.toFixed(1)} kWh/day (from ${benchmark.ecoModeDays} eco-mode days)\n\n`;
  md += `This represents the non-HVAC load: refrigerator, freezer, ERV fan, standby electronics, Powerwall losses.\n\n`;

  if (benchmark.switchoverDate) {
    md += `**Thermostat switchover detected:** ${benchmark.switchoverDate}\n`;
    md += `The thermostat was switched remotely from eco mode (50°F) back to 20°C during the vacation.\n\n`;
  }

  if (benchmark.ecoModeDaysList.length > 0) {
    md += '### Eco-Mode Days (50°F setpoint)\n\n';
    md += '| Date | Home kWh | Temp Min (°F) | Temp Mean (°F) | Wind Max (mph) |\n';
    md += '|------|----------|---------------|----------------|----------------|\n';
    for (const d of benchmark.ecoModeDaysList) {
      md += `| ${d.date} | ${d.homeKwh.toFixed(1)} | ${d.tempMin?.toFixed(1) || 'N/A'} | ${d.tempMean?.toFixed(1) || 'N/A'} | ${d.windMax?.toFixed(1) || 'N/A'} |\n`;
    }
    md += '\n';
  }

  if (benchmark.heatedVacationDaysList.length > 0) {
    md += '### Heated Vacation Days (20°C setpoint, unoccupied)\n\n';
    md += '| Date | Home kWh | Temp Min (°F) | Temp Mean (°F) | Wind Max (mph) |\n';
    md += '|------|----------|---------------|----------------|----------------|\n';
    for (const d of benchmark.heatedVacationDaysList) {
      md += `| ${d.date} | ${d.homeKwh.toFixed(1)} | ${d.tempMin?.toFixed(1) || 'N/A'} | ${d.tempMean?.toFixed(1) || 'N/A'} | ${d.windMax?.toFixed(1) || 'N/A'} |\n`;
    }
    md += '\n';
  }

  // Model Results
  md += '## Temperature-Consumption Model\n\n';
  md += '### Global Model\n\n';
  md += `- **R²:** ${model.globalModel.rSquared.toFixed(3)}\n`;
  md += `- **Features:** ${Object.keys(gc).filter(k => k !== 'intercept').join(', ')}\n`;
  md += `- **Coefficients:** ${Object.entries(gc).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(', ')}\n`;
  if (gc.tempMin !== undefined) {
    md += `- **Interpretation:** Each 1°F colder minimum → ${Math.abs(gc.tempMin).toFixed(2)} kWh more consumption`;
    if (gc.windMax !== undefined) md += `. Each 1 mph more wind → ${Math.abs(gc.windMax).toFixed(2)} kWh more`;
    md += `.\n\n`;
  } else if (gc.hdd !== undefined) {
    md += `- **Interpretation:** Each additional HDD → ${gc.hdd.toFixed(2)} kWh more consumption`;
    if (gc.windMax !== undefined) md += `. Each 1 mph more wind → ${Math.abs(gc.windMax).toFixed(2)} kWh more`;
    md += `.\n\n`;
  }

  md += '### Segmented Models\n\n';
  md += '| Segment | Days | R² | tempMin Coeff | windMax Coeff | Intercept |\n';
  md += '|---------|------|----|---------------|---------------|----------|\n';
  for (const seg of model.segments) {
    const m = seg.model;
    md += `| ${seg.name} | ${seg.days.length} | ${m.rSquared.toFixed(3)} | ${m.a.toFixed(3)} | ${m.b.toFixed(3)} | ${m.c.toFixed(2)} |\n`;
  }
  md += '\n';

  md += '### Scatter Plot Data (tempMin vs adjustedKwh)\n\n';
  md += 'Regression equation by segment enables plotting. Key data points:\n\n';
  md += '| Temp Min (°F) | Predicted kWh (Global) |\n';
  md += '|---------------|------------------------|\n';
  for (let temp = -5; temp <= 50; temp += 5) {
    // Simulate prediction using the global model
    const mockDay = { tempMin: temp, windMax: 10, windGustMax: 20, heatingDegreeDays: Math.max(0, 65 - temp), thermalMassLag: temp, priorDayTempMin: temp, isWeekend: 0 };
    const predicted = predictConsumption(model, mockDay);
    md += `| ${temp} | ${predicted.toFixed(1)} |\n`;
  }
  md += '\n';

  // Day-by-Day Table
  md += '## Day-by-Day Data\n\n';
  md += '| Date | Type | Home kWh | Adjusted kWh | Temp Min °F | Temp Mean °F | Wind Max | Expected | Residual | Flags |\n';
  md += '|------|------|----------|-------------|-------------|-------------|----------|----------|----------|-------|\n';

  for (const d of classifiedDays) {
    const expected = d.expectedKwh !== undefined ? d.expectedKwh.toFixed(1) : '-';
    const residual = d.residualKwh !== undefined ? d.residualKwh.toFixed(1) : '-';
    const flags = [];
    if (d.type === 'sauna') flags.push('🧖 sauna');
    if (d.type === 'out-of-town') flags.push('✈️ away');
    if (d.zScore !== undefined && Math.abs(d.zScore) > 1.5) {
      flags.push(d.zScore > 0 ? '⚠️ HIGH' : '🔵 LOW');
    }
    if (d.saunaDetected) flags.push('🔍 detected');

    md += `| ${d.date} | ${d.type} | ${d.homeKwh.toFixed(1)} | ${d.adjustedKwh.toFixed(1)} | `;
    md += `${d.tempMin?.toFixed(1) || 'N/A'} | ${d.tempMean?.toFixed(1) || 'N/A'} | `;
    md += `${d.windMax?.toFixed(0) || 'N/A'} | ${expected} | ${residual} | ${flags.join(' ')} |\n`;
  }
  md += '\n';

  // Anomaly Analysis
  md += '## Anomaly Analysis\n\n';
  md += `**Detection threshold:** ±${(1.5 * residualStats.stddev).toFixed(1)} kWh (1.5σ, where σ=${residualStats.stddev.toFixed(1)} kWh)\n\n`;

  if (anomalies.length > 0) {
    md += '### Anomalous Days\n\n';
    md += '| Date | Direction | Actual kWh | Expected kWh | Residual | Z-Score | Suspected Cause |\n';
    md += '|------|-----------|-----------|-------------|----------|---------|------------------|\n';

    for (const a of anomalies.sort((x, y) => x.date.localeCompare(y.date))) {
      let cause = 'Unknown';
      if (a.tempMin <= 5) cause = 'Extreme cold, COP degradation + defrost';
      else if (a.windMax > 30) cause = 'High wind, infiltration + coil efficiency loss';
      else if (a.direction === 'LOW' && a.solarKwh > 10) cause = `High solar (${a.solarKwh.toFixed(0)} kWh) offset HVAC demand; passive solar gain`;
      else if (a.direction === 'LOW' && a.tempMin > 40) cause = 'Mild day, low heating demand';
      else if (a.direction === 'LOW' && a.windMax < 8) cause = 'Calm day, reduced infiltration losses';
      else if (a.direction === 'HIGH' && a.windGustMax > 35) cause = 'High wind gusts, infiltration + coil efficiency loss';
      else if (a.direction === 'HIGH') cause = 'Possible occupancy/cooking/unusual load';

      // Check drilldown for more specific patterns
      const dd = drilldowns.find(d => d.date === a.date);
      if (dd && dd.patterns.length > 0) {
        const drillCause = dd.patterns.join(', ');
        cause = cause === 'Unknown' ? drillCause : `${cause}; ${drillCause}`;
      }

      md += `| ${a.date} | ${a.direction} | ${a.adjustedKwh.toFixed(1)} | ${a.expectedKwh.toFixed(1)} | ${a.residualKwh.toFixed(1)} | ${a.zScore.toFixed(2)} | ${cause} |\n`;
    }
    md += '\n';
  }

  // Drill-down details
  if (drilldowns.length > 0) {
    md += '### Hourly Drill-Downs\n\n';
    for (const dd of drilldowns) {
      md += `#### ${dd.date} (${dd.direction}, z=${dd.zScore.toFixed(2)})\n\n`;
      md += `Actual: ${dd.actualKwh.toFixed(1)} kWh | Expected: ${dd.expectedKwh.toFixed(1)} kWh | Residual: ${dd.residualKwh.toFixed(1)} kWh\n\n`;

      if (dd.patterns.length > 0) {
        md += `**Patterns detected:** ${dd.patterns.join(', ')}\n\n`;
      }

      md += '| Hour | Home Wh | Solar Wh |\n';
      md += '|------|---------|----------|\n';
      for (const h of dd.hourly) {
        md += `| ${String(h.hour).padStart(2, '0')}:00 | ${h.totalWh.toFixed(0)} | ${h.solarWh.toFixed(0)} |\n`;
      }
      md += '\n';
    }
  }

  // Sauna Impact
  md += '## Sauna Impact\n\n';
  if (saunaDays.length > 0) {
    md += `| Date | Total kWh | Est. Sauna kWh | Adjusted kWh | Temp Min °F |\n`;
    md += `|------|-----------|---------------|-------------|-------------|\n`;
    for (const d of saunaDays) {
      md += `| ${d.date} | ${d.homeKwh.toFixed(1)} | ${d.saunaEstimateKwh.toFixed(1)} | ${d.adjustedKwh.toFixed(1)} | ${d.tempMin?.toFixed(1) || 'N/A'} |\n`;
    }
    md += `\n**Total sauna energy:** ${totalSaunaKwh.toFixed(1)} kWh across ${saunaDays.length} sessions\n`;
    md += `**Estimated cost:** $${(totalSaunaKwh * 0.20).toFixed(2)} at $0.20/kWh\n\n`;
  } else {
    md += 'No sauna sessions detected in the analysis period.\n\n';
  }

  // Passive House Benchmark
  md += '## Passive House Benchmark\n\n';
  md += '### Measured vs Theoretical Comparison\n\n';
  md += `| Metric | Your House (measured) | Passive House Target | Passive House (modeled) | Standard Build (modeled) |\n`;
  md += `|--------|---------------------|---------------------|------------------------|-------------------------|\n`;
  md += `| Heating kWh/ft²/year | ${benchmark.annualHeatingKwhPerSqFt.toFixed(2)} | ≤1.39 | ${benchmark.passiveAnnualKwhPerSqFt.toFixed(2)} | ${benchmark.standardAnnualKwhPerSqFt.toFixed(2)} |\n`;
  md += `| Heating kBtu/ft²/year | ${benchmark.annualHeatingKBtuPerSqFt.toFixed(2)} | ≤4.75 | ${(benchmark.passiveAnnualKwhPerSqFt * 3.412).toFixed(2)} | ${(benchmark.standardAnnualKwhPerSqFt * 3.412).toFixed(2)} |\n`;
  md += `| Heating kWh per HDD | ${benchmark.heatingKwhPerHDD.toFixed(3)} | - | ${(benchmark.components.passive.total / benchmark.components.passive.cop).toFixed(3)} | ${(benchmark.components.standard.total / benchmark.components.standard.cop).toFixed(3)} |\n`;
  md += `| Baseload (non-HVAC) kWh/day | ${benchmark.baseloadKwh.toFixed(1)} | - | - | - |\n`;

  if (benchmark.coldestDay) {
    md += `| Coldest day consumption | ${benchmark.coldestDay.homeKwh.toFixed(1)} kWh (${benchmark.coldestDay.date}, ${benchmark.coldestDay.tempMin?.toFixed(0)}°F) | - | - | - |\n`;
  }

  md += '\n';

  md += '### Heat Loss Component Breakdown (kWh per HDD)\n\n';
  md += '| Component | Passive House (0.4 ACH50) | Standard Build (3.5 ACH50) |\n';
  md += '|-----------|--------------------------|---------------------------|\n';
  md += `| Infiltration | ${benchmark.components.passive.infiltration.toFixed(3)} | ${benchmark.components.standard.infiltration.toFixed(3)} |\n`;
  md += `| Ventilation | ${benchmark.components.passive.ventilation.toFixed(3)} | ${benchmark.components.standard.ventilation.toFixed(3)} |\n`;
  md += `| Envelope (conduction) | ${benchmark.components.passive.envelope.toFixed(3)} | ${benchmark.components.standard.envelope.toFixed(3)} |\n`;
  md += `| **Total thermal load** | **${benchmark.components.passive.total.toFixed(3)}** | **${benchmark.components.standard.total.toFixed(3)}** |\n`;
  md += `| Avg COP assumed | ${benchmark.components.passive.cop} | ${benchmark.components.standard.cop} |\n`;
  md += `| **Electrical (after COP)** | **${(benchmark.components.passive.total / benchmark.components.passive.cop).toFixed(3)}** | **${(benchmark.components.standard.total / benchmark.components.standard.cop).toFixed(3)}** |\n`;
  md += '\n';

  const savedVsStandard = (benchmark.standardAnnualKwhPerSqFt - benchmark.annualHeatingKwhPerSqFt) * HOUSE.sqft;
  md += `### Key Findings\n\n`;
  md += `1. **Savings vs standard build:** ${savedVsStandard.toFixed(0)} kWh/year estimated (${(savedVsStandard * 0.20).toFixed(0)}/year at $0.20/kWh)\n`;

  if (benchmark.annualHeatingKBtuPerSqFt <= 4.75) {
    md += `2. **Passive House compliance:** YES -- ${benchmark.annualHeatingKBtuPerSqFt.toFixed(1)} kBtu/ft²/year is within the ≤4.75 target\n`;
  } else {
    const overshoot = ((benchmark.annualHeatingKBtuPerSqFt - 4.75) / 4.75 * 100).toFixed(0);
    md += `2. **Passive House compliance:** Exceeds target by ${overshoot}% -- likely due to a combination of COP degradation in extreme cold and baseload estimation uncertainty (baseload of ${benchmark.baseloadKwh.toFixed(1)} kWh/day may undercount some always-on loads, attributing them to heating)\n`;
  }

  // Assess whether COP degradation explains the gap
  md += `3. **COP impact:** The measured heating intensity of ${benchmark.heatingKwhPerHDD.toFixed(3)} kWh/HDD `;
  md += `vs modeled passive house ${(benchmark.components.passive.total / benchmark.components.passive.cop).toFixed(3)} kWh/HDD. `;
  const copRatio = benchmark.heatingKwhPerHDD / (benchmark.components.passive.total / benchmark.components.passive.cop);
  if (copRatio > 1.3) {
    md += `The ${((copRatio - 1) * 100).toFixed(0)}% excess is consistent with COP degradation during cold snaps (effective COP ~${(benchmark.components.passive.cop / copRatio).toFixed(1)} vs assumed ${benchmark.components.passive.cop}).\n`;
  } else {
    md += `This is close to the theoretical prediction, suggesting the envelope is performing well.\n`;
  }
  md += '\n';

  // Root Cause Ranking
  md += '## Root Cause Ranking\n\n';
  md += 'Factors driving day-to-day HVAC consumption variation, ranked by explanatory power:\n\n';

  // Calculate correlation between features and consumption
  const correlations = [];
  if (normalDays.length > 5) {
    correlations.push({ feature: 'Minimum temperature', corr: calcCorrelation(normalDays.map(d => d.tempMin), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Mean temperature', corr: calcCorrelation(normalDays.map(d => d.tempMean), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Heating degree days', corr: calcCorrelation(normalDays.map(d => d.hdd), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Max wind speed', corr: calcCorrelation(normalDays.map(d => d.windMax || 0), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Max wind gust', corr: calcCorrelation(normalDays.map(d => d.windGustMax || 0), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Prior-day min temp', corr: calcCorrelation(normalDays.map(d => d.priorDayTempMin), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Weekend', corr: calcCorrelation(normalDays.map(d => d.isWeekend), normalDays.map(d => d.adjustedKwh)) });
    correlations.push({ feature: 'Solar production', corr: calcCorrelation(normalDays.map(d => d.solarKwh), normalDays.map(d => d.adjustedKwh)) });
  }

  correlations.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

  md += '| Rank | Factor | Correlation with Consumption | Direction |\n';
  md += '|------|--------|------------------------------|----------|\n';
  correlations.forEach((c, i) => {
    const direction = c.corr < 0 ? 'Colder → more consumption' : 'Higher → more consumption';
    md += `| ${i + 1} | ${c.feature} | ${Math.abs(c.corr).toFixed(3)} | ${direction} |\n`;
  });
  md += '\n';

  md += 'Additional factors not captured by weather alone:\n';
  md += '- **Thermal mass depletion:** Multi-day cold snaps cause cumulative heat loss from slab and walls\n';
  md += '- **COP cliff below 5°F:** Heat pump efficiency drops sharply, requiring 2x electrical input\n';
  md += '- **Defrost cycles:** More frequent below 20°F, consuming energy while providing no heating\n';
  md += '- **Sauna:** ~25 kWh per session, easily mistaken for HVAC demand\n';
  md += '- **Occupancy patterns:** Cooking, laundry, and appliance use add 2-5 kWh/day variance\n\n';

  // Recommendations
  md += '## Recommendations\n\n';
  md += '### High Impact\n\n';
  md += '1. **Pre-heat with solar (2-4pm):** Raise setpoint to 72°F during peak solar. Thermal mass stores heat for overnight. Estimated savings: 2-3 kWh/night during cold snaps.\n\n';
  md += '2. **Reduce ERV airflow overnight:** Switch to low or "away" mode 10pm-6am. In a 0.4 ACH50 house, overnight air quality is fine with reduced ventilation. Savings: 1-2 kWh/night.\n\n';

  md += '### Moderate Impact\n\n';
  md += '3. **Lower thermostat 1-2°F on extreme cold nights:** At COP ~1.3 below 5°F, each degree costs ~0.8 kWh. Wear warmer bedding instead.\n\n';
  md += '4. **Close thermal curtains at sunset:** Reduces window heat loss 40-50%. Open south-facing curtains at sunrise for passive solar gain.\n\n';

  md += '### Maintenance\n\n';
  md += '5. **Verify mini-split cold-climate defrost settings:** Ensure firmware is optimized for cold-climate operation (defrost intervals, backup heat lockout).\n\n';
  md += '6. **Clear snow/ice around outdoor units:** Critical during prolonged cold snaps. Obstructed airflow forces more frequent defrost.\n\n';

  // Footer
  md += '---\n\n';
  md += `*Analysis generated ${new Date().toISOString()} using Tesla Powerwall MCP and Open-Meteo Archive API.*\n`;
  md += `*Model based on ${normalDays.length} normal-HVAC days with R²=${model.globalModel.rSquared.toFixed(3)}.*\n`;

  return md;
}

function calcCorrelation(x, y) {
  const n = x.length;
  if (n < 3) return 0;
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== HVAC Energy Analysis: Nov 2025 - Feb 2026 ===\n');

  // Check for cached data to avoid re-fetching
  let teslaDaily, weatherDaily;

  if (existsSync(CACHE_PATH) && process.argv.includes('--cached')) {
    console.log('Loading cached data...\n');
    const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    teslaDaily = cached.teslaDaily;
    weatherDaily = cached.weatherDaily;
  } else {
    // Step 1: Collect Tesla data
    teslaDaily = await collectTeslaDaily();

    // Step 2: Collect weather data
    weatherDaily = await collectWeatherData();

    // Cache the raw data
    writeFileSync(CACHE_PATH, JSON.stringify({ teslaDaily, weatherDaily }, null, 2));
    console.log(`Cached raw data to ${CACHE_PATH}\n`);
  }

  // Step 3: Classify days
  let classifiedDays = classifyDays(teslaDaily, weatherDaily);

  // Step 3b: Detect sauna from Tesla 5-min data (only for suspect days)
  classifiedDays = await detectSaunaFromTesla(classifiedDays);

  // Step 4: Build model
  const model = buildModel(classifiedDays);
  if (!model) {
    console.error('FATAL: Could not build model. Exiting.');
    process.exit(1);
  }

  // Step 5: Detect anomalies
  const anomalyResult = detectAnomalies(classifiedDays, model);

  // Step 5b: Drill down into anomalies
  const drilldowns = await drillDownAnomalies(anomalyResult.anomalies);

  // Step 6: Benchmark
  const benchmark = benchmarkPassiveHouse(classifiedDays, model);

  // Step 7: Generate report
  const report = generateReport(classifiedDays, model, anomalyResult, drilldowns, benchmark);

  writeFileSync(REPORT_PATH, report);
  console.log(`\nReport written to ${REPORT_PATH}`);

  // Also save structured data for future use
  const structuredData = {
    generatedAt: new Date().toISOString(),
    days: classifiedDays,
    model: {
      globalR2: model.globalModel.rSquared,
      globalCoefficients: model.globalModel.coefficients,
      segments: model.segments.map(s => ({
        name: s.name,
        dayCount: s.days.length,
        r2: s.model.rSquared,
        coefficients: { tempMin: s.model.a, windMax: s.model.b, intercept: s.model.c }
      }))
    },
    anomalies: anomalyResult.anomalies.map(a => ({
      date: a.date, direction: a.direction, zScore: a.zScore,
      actual: a.adjustedKwh, expected: a.expectedKwh, residual: a.residualKwh
    })),
    benchmark: {
      baseloadKwh: benchmark.baseloadKwh,
      heatingKwhPerHDD: benchmark.heatingKwhPerHDD,
      annualHeatingKwhPerSqFt: benchmark.annualHeatingKwhPerSqFt,
      annualHeatingKBtuPerSqFt: benchmark.annualHeatingKBtuPerSqFt,
      passiveHouseTarget: 4.75,
      meetsTarget: benchmark.annualHeatingKBtuPerSqFt <= 4.75,
    }
  };

  writeFileSync(join(DATA_DIR, 'structured-results.json'), JSON.stringify(structuredData, null, 2));
  console.log(`Structured data written to ${join(DATA_DIR, 'structured-results.json')}`);

  // Verification checks
  console.log('\n=== Verification ===');
  const feb7 = classifiedDays.find(d => d.date === '2026-02-07');
  const feb8 = classifiedDays.find(d => d.date === '2026-02-08');
  const jan7 = classifiedDays.find(d => d.date === '2026-01-07');
  const jan27 = classifiedDays.find(d => d.date === '2026-01-27');

  if (feb7) console.log(`Feb 7: ${feb7.homeKwh.toFixed(1)} kWh (expected ~61 kWh)`);
  if (feb8) console.log(`Feb 8: ${feb8.homeKwh.toFixed(1)} kWh (expected ~45+ kWh, may be partial day)`);
  if (jan7) console.log(`Jan 7: type=${jan7.type} (expected: sauna)`);
  if (jan27) console.log(`Jan 27: type=${jan27.type} (expected: sauna)`);
  console.log(`Model R²: ${model.globalModel.rSquared.toFixed(3)} (target ≥0.70)`);
  console.log(`Baseload: ${benchmark.baseloadKwh.toFixed(1)} kWh/day (expected ~10-15)`);
  console.log(`Anomalies found: ${anomalyResult.anomalies.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
