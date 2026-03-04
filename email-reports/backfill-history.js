#!/usr/bin/env node

// Backfill Missing Historical Data
// One-time script to fill gaps in history.json using API historical queries.
//
// What can be backfilled:
//   - waterGallons: Phyn daily consumption per day
//   - solarProduction, gridImport, gridExport, homeConsumption, selfPoweredPercentage: Tesla daily history
//   - energyKwh: A.O. Smith recent usage (~7 days)
//   - lockEvents, unlockEvents, lockActivitySources, unlockActivitySources: Tedee activity logs
//
// What cannot be backfilled (point-in-time only):
//   - washerCycles, ovenUsed, saunaUsed, fridgeTemp, freezerTemp, waterPressure/Temperature/FlowRate

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

const HISTORY_FILE = join(projectRoot, 'data', 'history.json');

// Tedee event codes (from data-collector.js)
const LOCK_CODES = [32, 34, 36, 38, 56, 59, 65, 66, 90, 226, 227];
const UNLOCK_CODES = [33, 35, 37, 39, 57, 61, 67, 77, 88, 228, 229];
const MANUAL_LOCK_CODES = [38, 47];
const MANUAL_UNLOCK_CODES = [39];
const APP_LOCK_CODES = [32];
const APP_UNLOCK_CODES = [33];
const AUTO_LOCK_CODES = [36, 49];
const AUTO_UNLOCK_CODES = [37, 55];

// ─── MCP Communication Helpers ──────────────────────────────────────────────

function createMCPClient(wrapperScript) {
  return new Promise((resolve, reject) => {
    const server = spawn(wrapperScript, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectRoot
    });

    const responses = [];
    let buffer = '';
    let initialized = false;

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
          } catch (e) {
            // Ignore non-JSON output
          }
        }
      }
    });

    server.on('error', reject);
    resolve({ server, responses });
  });
}

async function initializeMCP(server) {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'backfill-script', version: '1.0.0' }
    }
  }) + '\n');
  await sleep(2000);
}

async function callTool(server, responses, toolName, args = {}, requestId, timeout = 15000) {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }) + '\n');

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const response = responses.find(r => r.id === requestId);
    if (response) return response;
    await sleep(100);
  }
  return null;
}

function parseResponse(response) {
  if (!response?.result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(response.result.content[0].text);
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Gap Detection ──────────────────────────────────────────────────────────

function findGapDates(history) {
  const existingDates = new Set(history.dailyStats.map(s => s.date));

  // Find date range
  const dates = history.dailyStats.map(s => new Date(s.date));
  const oldest = new Date(Math.min(...dates));
  const newest = new Date(Math.max(...dates));

  const gaps = [];
  const current = new Date(oldest);
  current.setDate(current.getDate() + 1); // Start from day after oldest

  while (current < newest) {
    const dateStr = current.toISOString().split('T')[0];
    if (!existingDates.has(dateStr)) {
      gaps.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return gaps;
}

// ─── Phyn Backfill ──────────────────────────────────────────────────────────

async function backfillPhyn(gapDates) {
  console.log('\n📊 Backfilling water data from Phyn...');
  const results = {};

  try {
    const { server, responses } = await createMCPClient('./phyn-mcp-wrapper.sh');
    await initializeMCP(server);

    let requestId = 100;

    for (const date of gapDates) {
      // Convert YYYY-MM-DD to YYYY/MM/DD for Phyn API
      const duration = date.replace(/-/g, '/');

      const response = await callTool(server, responses, 'get_consumption',
        { device_id: '28F53743B8D8', duration }, requestId++);

      const data = parseResponse(response);
      if (data && data.water_consumption !== undefined) {
        results[date] = data.water_consumption;
        console.log(`  💧 ${date}: ${data.water_consumption.toFixed(2)} gal`);
      } else {
        console.log(`  ⚠️  ${date}: No data`);
      }

      await sleep(500); // Rate limit
    }

    server.kill();
  } catch (error) {
    console.error(`  ❌ Phyn error: ${error.message}`);
  }

  console.log(`  ✅ Got water data for ${Object.keys(results).length}/${gapDates.length} days`);
  return results;
}

// ─── Tesla Backfill ─────────────────────────────────────────────────────────

async function backfillTesla(gapDates) {
  console.log('\n☀️  Backfilling solar/energy data from Tesla...');
  const results = {};

  try {
    const { server, responses } = await createMCPClient('./tesla-mcp-wrapper.sh');
    await initializeMCP(server);

    let requestId = 200;

    for (const date of gapDates) {
      const response = await callTool(server, responses, 'get_energy_history',
        { period: 'day', end_date: date }, requestId++, 30000);

      const data = parseResponse(response);
      if (data?.totals) {
        results[date] = {
          solarProduction: data.totals.solar_production || 0,
          gridImport: data.totals.grid_import || 0,
          gridExport: data.totals.grid_export || 0,
          homeConsumption: data.totals.home_consumption || 0,
          selfPoweredPercentage: data.totals.self_powered_percentage || 0
        };
        console.log(`  ☀️  ${date}: solar=${results[date].solarProduction}kWh, grid=${results[date].gridImport}kWh, home=${results[date].homeConsumption}kWh`);
      } else {
        console.log(`  ⚠️  ${date}: No data`);
      }

      await sleep(1000); // Rate limit (Tesla is stricter)
    }

    server.kill();
  } catch (error) {
    console.error(`  ❌ Tesla error: ${error.message}`);
  }

  console.log(`  ✅ Got solar data for ${Object.keys(results).length}/${gapDates.length} days`);
  return results;
}

// ─── A.O. Smith Backfill ────────────────────────────────────────────────────

async function backfillAOSmith() {
  console.log('\n🚿 Backfilling energy data from A.O. Smith...');
  const results = {};

  try {
    const { server, responses } = await createMCPClient('./aosmith-mcp-wrapper.sh');
    await initializeMCP(server);

    // First get device list to find junction_id
    const devicesResponse = await callTool(server, responses, 'get_devices', {}, 300, 20000);
    const devicesData = parseResponse(devicesResponse);

    const junctionId = devicesData?.devices?.[0]?.junction_id || devicesData?.devices?.[0]?.junctionId;
    if (!junctionId) {
      console.log('  ⚠️  Could not find water heater junction_id');
      server.kill();
      return results;
    }

    console.log(`  Found junction_id: ${junctionId}`);

    // Get energy usage (returns ~7 days of recent data)
    const energyResponse = await callTool(server, responses, 'get_energy_usage',
      { junction_id: junctionId }, 301, 20000);

    const energyData = parseResponse(energyResponse);
    const recentUsage = energyData?.recent_usage || energyData?.graphData || [];

    for (const entry of recentUsage) {
      if (entry.date && entry.kwh !== undefined) {
        // Extract YYYY-MM-DD from ISO timestamp or plain date
        const dateKey = entry.date.split('T')[0];
        results[dateKey] = entry.kwh;
        console.log(`  ⚡ ${dateKey}: ${entry.kwh} kWh`);
      }
    }

    server.kill();
  } catch (error) {
    console.error(`  ❌ A.O. Smith error: ${error.message}`);
  }

  console.log(`  ✅ Got energy data for ${Object.keys(results).length} days`);
  return results;
}

// ─── Tedee Backfill ─────────────────────────────────────────────────────────

async function backfillTedee(gapDates) {
  console.log('\n🔐 Backfilling lock activity from Tedee...');
  const results = {};

  // Initialize results for all gap dates
  for (const date of gapDates) {
    results[date] = {
      lockEvents: 0,
      unlockEvents: 0,
      lockActivitySources: { manual: 0, app: 0, autoLock: 0 },
      unlockActivitySources: { manual: 0, app: 0, autoUnlock: 0 }
    };
  }

  const gapDateSet = new Set(gapDates);

  try {
    const { server, responses } = await createMCPClient('./tedee-mcp-wrapper.sh');
    await initializeMCP(server);

    // Get device list to find lock IDs
    const devicesResponse = await callTool(server, responses, 'get_devices', {}, 400);
    const devicesData = parseResponse(devicesResponse);
    const locks = devicesData?.locks || [];

    if (locks.length === 0) {
      console.log('  ⚠️  No locks found');
      server.kill();
      return results;
    }

    console.log(`  Found ${locks.length} locks: ${locks.map(l => `${l.name} (${l.id})`).join(', ')}`);

    let requestId = 410;

    for (const lock of locks) {
      console.log(`  Fetching activity for ${lock.name}...`);
      const activityResponse = await callTool(server, responses, 'get_activity_log',
        { lock_id: lock.id, count: 200 }, requestId++);

      const activityData = parseResponse(activityResponse);
      const activities = activityData?.activities || [];

      let matchedCount = 0;

      for (const activity of activities) {
        const activityDate = activity.date?.split('T')[0];
        if (!activityDate || !gapDateSet.has(activityDate)) continue;

        matchedCount++;
        const ec = activity.event_code;
        const dayResult = results[activityDate];

        if (LOCK_CODES.includes(ec)) {
          dayResult.lockEvents++;
          if (MANUAL_LOCK_CODES.includes(ec)) dayResult.lockActivitySources.manual++;
          else if (APP_LOCK_CODES.includes(ec)) dayResult.lockActivitySources.app++;
          else if (AUTO_LOCK_CODES.includes(ec)) dayResult.lockActivitySources.autoLock++;
        } else if (UNLOCK_CODES.includes(ec)) {
          dayResult.unlockEvents++;
          if (MANUAL_UNLOCK_CODES.includes(ec)) dayResult.unlockActivitySources.manual++;
          else if (APP_UNLOCK_CODES.includes(ec)) dayResult.unlockActivitySources.app++;
          else if (AUTO_UNLOCK_CODES.includes(ec)) dayResult.unlockActivitySources.autoUnlock++;
        }
      }

      console.log(`    ${lock.name}: ${activities.length} total events, ${matchedCount} in gap period`);
      await sleep(500);
    }

    server.kill();
  } catch (error) {
    console.error(`  ❌ Tedee error: ${error.message}`);
  }

  // Report non-zero days
  const activeDays = Object.entries(results).filter(([, v]) => v.lockEvents > 0 || v.unlockEvents > 0);
  console.log(`  ✅ Found lock activity on ${activeDays.length}/${gapDates.length} days`);
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  History Backfill Script');
  console.log('═══════════════════════════════════════════════');

  // Load history
  if (!existsSync(HISTORY_FILE)) {
    console.error('❌ history.json not found at:', HISTORY_FILE);
    process.exit(1);
  }

  const history = JSON.parse(readFileSync(HISTORY_FILE, 'utf8'));
  console.log(`\nLoaded ${history.dailyStats.length} existing entries`);

  // Find gaps
  const gapDates = findGapDates(history);

  if (gapDates.length === 0) {
    console.log('\n✅ No gaps found in history! Nothing to backfill.');
    process.exit(0);
  }

  console.log(`\nFound ${gapDates.length} gap dates:`);
  console.log(`  First: ${gapDates[0]}`);
  console.log(`  Last:  ${gapDates[gapDates.length - 1]}`);
  console.log(`  Dates: ${gapDates.join(', ')}`);

  // Run backfill queries sequentially (one MCP server at a time)
  const phynData = await backfillPhyn(gapDates);
  const teslaData = await backfillTesla(gapDates);
  const aosmithData = await backfillAOSmith();
  const tedeeData = await backfillTedee(gapDates);

  // Merge results into history entries
  console.log('\n📝 Merging backfilled data into history...');
  let created = 0;

  for (const date of gapDates) {
    const entry = {
      date,
      timestamp: `${date}T12:00:00.000Z`, // Synthetic noon timestamp
      waterGallons: phynData[date] || 0,
      energyKwh: aosmithData[date] || 0,
      washerCycleTotal: 0,
      washerCycles: 0,
      ovenUsed: false,
      saunaUsed: false,
      fridgeTemp: null,
      freezerTemp: null,
      lockEvents: tedeeData[date]?.lockEvents || 0,
      unlockEvents: tedeeData[date]?.unlockEvents || 0,
      lockActivitySources: tedeeData[date]?.lockActivitySources || { manual: 0, app: 0, autoLock: 0 },
      unlockActivitySources: tedeeData[date]?.unlockActivitySources || { manual: 0, app: 0, autoUnlock: 0 },
      solarProduction: teslaData[date]?.solarProduction || 0,
      batteryLevel: null,
      gridImport: teslaData[date]?.gridImport || 0,
      gridExport: teslaData[date]?.gridExport || 0,
      homeConsumption: teslaData[date]?.homeConsumption || 0,
      selfPoweredPercentage: teslaData[date]?.selfPoweredPercentage || null
    };

    history.dailyStats.push(entry);
    created++;
  }

  // Sort by date (newest first, matching existing convention)
  history.dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Save
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  ✅ Backfill complete!`);
  console.log(`  Created ${created} new entries`);
  console.log(`  Total entries: ${history.dailyStats.length}`);
  console.log(`  Water data: ${Object.keys(phynData).length} days`);
  console.log(`  Solar data: ${Object.keys(teslaData).length} days`);
  console.log(`  Energy data: ${Object.keys(aosmithData).length} days`);
  console.log(`  Lock data: ${Object.values(tedeeData).filter(v => v.lockEvents > 0 || v.unlockEvents > 0).length} days with activity`);
  console.log(`═══════════════════════════════════════════════`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
