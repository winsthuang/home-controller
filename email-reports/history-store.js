// History Store Module
// Stores and retrieves historical data for comparisons

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { paths, historySettings } from './config.js';

/**
 * Format a Date as YYYY-MM-DD in local timezone (avoids UTC date shift)
 */
function localDateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Get the Eastern Time date string for a given ISO timestamp.
 * Uses Intl.DateTimeFormat to handle EST/EDT automatically.
 */
function getETDate(timestamp) {
  const ts = new Date(timestamp);
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ts);
  const y = etParts.find(p => p.type === 'year').value;
  const m = etParts.find(p => p.type === 'month').value;
  const d = etParts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

/**
 * Load history from file
 */
export function loadHistory() {
  try {
    if (existsSync(paths.historyFile)) {
      const data = readFileSync(paths.historyFile, 'utf8');
      const history = JSON.parse(data);

      // V1 migration: recompute dates from timestamps using ET timezone.
      // Prior to this fix, dates were stored using UTC (toISOString) which
      // produced wrong dates for 10pm ET runs (where UTC date = next day).
      if (!history._migratedToLocalDates && history.dailyStats?.length > 0) {
        console.error('[Migration v1] Recomputing dates from timestamps (UTC → ET)');
        for (const entry of history.dailyStats) {
          entry.date = getETDate(entry.timestamp);
        }
        // Dedup: if two entries share a date, keep the one with higher solar
        const seen = new Map();
        for (const entry of history.dailyStats) {
          const existing = seen.get(entry.date);
          if (!existing || (entry.solarProduction || 0) > (existing.solarProduction || 0)) {
            seen.set(entry.date, entry);
          }
        }
        history.dailyStats = [...seen.values()];
        history._migratedToLocalDates = true;
        saveHistory(history);
        console.error('[Migration v1] Done. Dates corrected.');
      }

      // V2 migration: idempotent recompute using getETDate.
      // Fixes any entries where v1's blanket -1 shift was wrong (afternoon runs).
      // Safe to re-run: getETDate always produces the correct local date.
      if (history._migratedToLocalDates && !history._migratedToLocalDatesV2 && history.dailyStats?.length > 0) {
        console.error('[Migration v2] Verifying dates via ET timezone');
        let changed = false;
        for (const entry of history.dailyStats) {
          const correct = getETDate(entry.timestamp);
          if (entry.date !== correct) {
            console.error(`[Migration v2] ${entry.date} → ${correct} (ts: ${entry.timestamp})`);
            entry.date = correct;
            changed = true;
          }
        }
        if (changed) {
          // Dedup same-date entries (keep higher solar)
          const seen = new Map();
          for (const entry of history.dailyStats) {
            const existing = seen.get(entry.date);
            if (!existing || (entry.solarProduction || 0) > (existing.solarProduction || 0)) {
              seen.set(entry.date, entry);
            }
          }
          history.dailyStats = [...seen.values()];
        }
        history._migratedToLocalDatesV2 = true;
        saveHistory(history);
        console.error('[Migration v2] Done.');
      }

      return history;
    }
  } catch (error) {
    console.error('Error loading history:', error.message);
  }

  return { dailyStats: [], weeklyStats: [] };
}

/**
 * Save history to file
 */
export function saveHistory(history) {
  try {
    // Ensure data directory exists
    const dir = dirname(paths.historyFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(paths.historyFile, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving history:', error.message);
    return false;
  }
}

/**
 * Add today's stats to history
 */
export function addDailyStats(data) {
  const history = loadHistory();

  const today = localDateStr();

  // Check if we already have stats for today
  const existingIndex = history.dailyStats.findIndex(s => s.date === today);
  const existing = existingIndex >= 0 ? history.dailyStats[existingIndex] : null;

  // Get YESTERDAY's stats specifically (not just any previous day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);
  const yesterdayStats = history.dailyStats.find(s => s.date === yesterdayStr);

  // Washer: calculate delta from yesterday's total
  const currentWasherTotal = data.laundry?.washer?.cycleCount || 0;
  const yesterdayWasherTotal = yesterdayStats?.washerCycleTotal || 0;

  // Only calculate delta if we have yesterday's baseline AND current is higher
  // Note: NO "keep max" logic here - delta is always calculated fresh from lifetime counts
  let washerLoadsToday = 0;
  if (yesterdayWasherTotal > 0 && currentWasherTotal >= yesterdayWasherTotal) {
    washerLoadsToday = currentWasherTotal - yesterdayWasherTotal;
  }
  // Edge case: if no yesterday baseline exists, we can't calculate delta - show 0

  // Sauna/Oven: accumulate "used" flag - once true for the day, stays true
  const saunaUsedNow = data.sauna?.heaterOn || false;
  const saunaUsed = existing?.saunaUsed || saunaUsedNow;

  // Oven: detect usage via elapsedTime change (not just point-in-time "In use")
  // elapsedTime persists after oven turns off, so compare with yesterday's value
  const ovenUsedNow = data.kitchen?.oven?.inUse || false;
  const currentElapsed = data.kitchen?.oven?.elapsedTime || [0, 0];
  const currentElapsedMinutes = (currentElapsed[0] || 0) * 60 + (currentElapsed[1] || 0);
  const yesterdayElapsedMinutes = (yesterdayStats?.ovenElapsedTime?.[0] || 0) * 60 + (yesterdayStats?.ovenElapsedTime?.[1] || 0);
  const elapsedChanged = currentElapsedMinutes !== yesterdayElapsedMinutes && currentElapsedMinutes > 0;
  const ovenUsed = existing?.ovenUsed || ovenUsedNow || elapsedChanged;

  // Water: use today's consumption (nearly complete at 10pm), fall back to yesterday's
  const waterGallons = Math.max(
    existing?.waterGallons || 0,
    data.water?.todayConsumption || data.water?.dailyConsumption || 0
  );

  // Energy: keep the max value seen today
  const energyKwh = Math.max(
    existing?.energyKwh || 0,
    data.waterHeater?.dailyUsage || 0
  );

  // Smart Locks: keep max values seen today (accumulate through the day)
  const lockEvents = Math.max(
    existing?.lockEvents || 0,
    data.smartLocks?.todayLocks || 0
  );
  const unlockEvents = Math.max(
    existing?.unlockEvents || 0,
    data.smartLocks?.todayUnlocks || 0
  );

  const dailyEntry = {
    date: today,
    timestamp: new Date().toISOString(),
    waterGallons,
    energyKwh,
    washerCycleTotal: currentWasherTotal,
    washerCycles: washerLoadsToday,
    ovenUsed,
    ovenElapsedTime: data.kitchen?.oven?.elapsedTime || [0, 0],
    saunaUsed,
    fridgeTemp: parseFloat(data.kitchen?.refrigerator?.temperature) || null,
    freezerTemp: parseFloat(data.kitchen?.freezer?.temperature) || null,
    lockEvents,
    unlockEvents,

    // NEW FIELDS for enhanced tracking:

    // Water system health
    waterPressure: data.water?.pressure || null,
    waterTemperature: data.water?.temperature || null,
    waterFlowRate: data.water?.flow || null,
    waterSignalStrength: data.water?.signalStrength || null,

    // Water heater
    waterHeaterMode: data.waterHeater?.operationMode || null,
    waterHeaterSetpoint: data.waterHeater?.temperatureSetpoint || null,
    waterHeaterOnline: data.waterHeater?.isOnline || false,

    // Smart locks (detailed battery tracking)
    lockBatteryLevels: (data.smartLocks?.locks || []).map(l => ({
      id: l.id,
      name: l.name,
      battery: l.batteryLevel,
      charging: l.isCharging,
      connected: l.isConnected
    })),

    // Lock activity sources
    lockActivitySources: data.smartLocks?.activityBreakdown?.locksBySource || null,
    unlockActivitySources: data.smartLocks?.activityBreakdown?.unlocksBySource || null,

    // Tesla Solar & Battery
    solarProduction: Math.max(
      existing?.solarProduction || 0,
      data.tesla?.solarProduction || 0
    ),
    batteryLevel: data.tesla?.batteryLevel || null,
    gridImport: Math.max(
      existing?.gridImport || 0,
      data.tesla?.gridImport || 0
    ),
    gridExport: Math.max(
      existing?.gridExport || 0,
      data.tesla?.gridExport || 0
    ),
    homeConsumption: Math.max(
      existing?.homeConsumption || 0,
      data.tesla?.homeConsumption || 0
    ),
    selfPoweredPercentage: data.tesla?.historySelfPowered || null
  };

  if (existingIndex >= 0) {
    history.dailyStats[existingIndex] = dailyEntry;
  } else {
    history.dailyStats.push(dailyEntry);
  }

  // Prune old data (keep last 84 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historySettings.maxDays);
  history.dailyStats = history.dailyStats.filter(s =>
    new Date(s.date) >= cutoffDate
  );

  // Sort by date
  history.dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));

  saveHistory(history);

  return dailyEntry;
}

/**
 * Get today's stats
 */
export function getToday() {
  const history = loadHistory();
  const today = localDateStr();
  return history.dailyStats.find(s => s.date === today) || null;
}

/**
 * Get yesterday's stats
 */
export function getYesterday() {
  const history = loadHistory();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);

  return history.dailyStats.find(s => s.date === yesterdayStr) || null;
}

/**
 * Get rolling average for last N days
 */
export function getAverageForDays(days) {
  const history = loadHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentStats = history.dailyStats.filter(s =>
    new Date(s.date) >= cutoffDate
  );

  if (recentStats.length === 0) {
    return null;
  }

  const sum = recentStats.reduce((acc, s) => ({
    waterGallons: acc.waterGallons + (s.waterGallons || 0),
    energyKwh: acc.energyKwh + (s.energyKwh || 0),
    washerCycles: acc.washerCycles + (s.washerCycles || 0),
    ovenUses: acc.ovenUses + (s.ovenUsed ? 1 : 0),
    saunaSessions: acc.saunaSessions + (s.saunaUsed ? 1 : 0),
    fridgeTemp: acc.fridgeTemp + (s.fridgeTemp || 0),
    freezerTemp: acc.freezerTemp + (s.freezerTemp || 0),
    fridgeTempCount: acc.fridgeTempCount + (s.fridgeTemp ? 1 : 0),
    freezerTempCount: acc.freezerTempCount + (s.freezerTemp ? 1 : 0),
    // Solar/battery fields
    solarProduction: acc.solarProduction + (s.solarProduction || 0),
    gridImport: acc.gridImport + (s.gridImport || 0),
    gridExport: acc.gridExport + (s.gridExport || 0),
    homeConsumption: acc.homeConsumption + (s.homeConsumption || 0),
    solarCount: acc.solarCount + (s.solarProduction > 0 ? 1 : 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0,
    fridgeTemp: 0, freezerTemp: 0,
    fridgeTempCount: 0, freezerTempCount: 0,
    solarProduction: 0, gridImport: 0, gridExport: 0,
    homeConsumption: 0, solarCount: 0
  });

  const count = recentStats.length;

  return {
    days: count,
    waterGallons: sum.waterGallons / count,
    energyKwh: sum.energyKwh / count,
    washerCycles: sum.washerCycles / count,
    ovenUses: sum.ovenUses / count,
    saunaSessions: sum.saunaSessions / count,
    fridgeTemp: sum.fridgeTempCount > 0 ? sum.fridgeTemp / sum.fridgeTempCount : null,
    freezerTemp: sum.freezerTempCount > 0 ? sum.freezerTemp / sum.freezerTempCount : null,
    // Solar averages
    solarProduction: sum.solarCount > 0 ? sum.solarProduction / sum.solarCount : 0,
    gridImport: sum.solarCount > 0 ? sum.gridImport / sum.solarCount : 0,
    gridExport: sum.solarCount > 0 ? sum.gridExport / sum.solarCount : 0,
    homeConsumption: sum.solarCount > 0 ? sum.homeConsumption / sum.solarCount : 0
  };
}

/**
 * Get 7-day average
 */
export function get7DayAverage() {
  return getAverageForDays(7);
}

/**
 * Get stats for a specific week (0 = current week, 1 = last week, etc.)
 */
export function getWeeklyStats(weeksAgo = 0) {
  const history = loadHistory();

  // Get the start of the target week (Sunday)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() - (weeksAgo * 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const weekStats = history.dailyStats.filter(s => {
    const date = new Date(s.date + 'T00:00:00');
    return date >= startOfWeek && date < endOfWeek;
  });

  if (weekStats.length === 0) {
    return null;
  }

  const sum = weekStats.reduce((acc, s) => ({
    waterGallons: acc.waterGallons + (s.waterGallons || 0),
    energyKwh: acc.energyKwh + (s.energyKwh || 0),
    washerCycles: acc.washerCycles + (s.washerCycles || 0),
    ovenUses: acc.ovenUses + (s.ovenUsed ? 1 : 0),
    saunaSessions: acc.saunaSessions + (s.saunaUsed ? 1 : 0),
    lockEvents: acc.lockEvents + (s.lockEvents || 0),
    unlockEvents: acc.unlockEvents + (s.unlockEvents || 0),
    // Solar/battery fields
    solarProduction: acc.solarProduction + (s.solarProduction || 0),
    gridImport: acc.gridImport + (s.gridImport || 0),
    gridExport: acc.gridExport + (s.gridExport || 0),
    homeConsumption: acc.homeConsumption + (s.homeConsumption || 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0, lockEvents: 0, unlockEvents: 0,
    solarProduction: 0, gridImport: 0, gridExport: 0, homeConsumption: 0
  });

  return {
    weekStart: localDateStr(startOfWeek),
    weekEnd: localDateStr(new Date(endOfWeek.getTime() - 1)),
    daysRecorded: weekStats.length,
    ...sum
  };
}

/**
 * Get average of last N weeks
 */
export function getWeeklyAverage(weeks) {
  const weeklyData = [];

  for (let i = 1; i <= weeks; i++) {
    const week = getWeeklyStats(i);
    if (week && week.daysRecorded >= 5) {  // Only include weeks with at least 5 days
      weeklyData.push(week);
    }
  }

  if (weeklyData.length === 0) {
    return null;
  }

  const sum = weeklyData.reduce((acc, w) => ({
    waterGallons: acc.waterGallons + w.waterGallons,
    energyKwh: acc.energyKwh + w.energyKwh,
    washerCycles: acc.washerCycles + w.washerCycles,
    ovenUses: acc.ovenUses + w.ovenUses,
    saunaSessions: acc.saunaSessions + w.saunaSessions,
    lockEvents: acc.lockEvents + (w.lockEvents || 0),
    unlockEvents: acc.unlockEvents + (w.unlockEvents || 0),
    // Solar/battery fields
    solarProduction: acc.solarProduction + (w.solarProduction || 0),
    gridImport: acc.gridImport + (w.gridImport || 0),
    gridExport: acc.gridExport + (w.gridExport || 0),
    homeConsumption: acc.homeConsumption + (w.homeConsumption || 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0, lockEvents: 0, unlockEvents: 0,
    solarProduction: 0, gridImport: 0, gridExport: 0, homeConsumption: 0
  });

  const count = weeklyData.length;

  return {
    weeksIncluded: count,
    waterGallons: sum.waterGallons / count,
    energyKwh: sum.energyKwh / count,
    washerCycles: sum.washerCycles / count,
    ovenUses: sum.ovenUses / count,
    saunaSessions: sum.saunaSessions / count,
    lockEvents: sum.lockEvents / count,
    unlockEvents: sum.unlockEvents / count,
    solarProduction: sum.solarProduction / count,
    gridImport: sum.gridImport / count,
    gridExport: sum.gridExport / count,
    homeConsumption: sum.homeConsumption / count
  };
}

/**
 * Get 4-week average
 */
export function get4WeekAverage() {
  return getWeeklyAverage(4);
}

/**
 * Get 12-week average
 */
export function get12WeekAverage() {
  return getWeeklyAverage(12);
}

/**
 * Get week-to-date totals
 */
export function getWeekToDate() {
  return getWeeklyStats(0);
}

/**
 * Get sparkline data for a metric over last N days
 */
export function getDailySparklineData(metric, days = 14) {
  const history = loadHistory();
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = localDateStr(date);
    const dayStat = history.dailyStats.find(s => s.date === dateStr);

    if (dayStat) {
      // Handle boolean metrics (saunaUsed, ovenUsed) as 0/1
      const value = dayStat[metric];
      data.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value || 0));
    } else {
      data.push(0);
    }
  }

  return data;
}

/**
 * Get sparkline data for a metric over last N weeks
 */
export function getSparklineData(metric, weeks = 12) {
  const data = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const week = getWeeklyStats(i);
    if (week) {
      data.push(week[metric] || 0);
    } else {
      data.push(0);
    }
  }

  return data;
}

/**
 * Generate sparkline string from data
 */
export function generateSparkline(data) {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  if (data.length === 0 || data.every(d => d === 0)) {
    return '─'.repeat(12);
  }

  const min = Math.min(...data.filter(d => d > 0));
  const max = Math.max(...data);
  const range = max - min || 1;

  return data.map(value => {
    if (value === 0) return '·';
    const index = Math.floor(((value - min) / range) * (chars.length - 1));
    return chars[Math.min(index, chars.length - 1)];
  }).join('');
}

/**
 * Calculate percentage change
 */
export function percentChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change for display
 */
export function formatChange(current, previous, unit = '') {
  const pct = percentChange(current, previous);
  if (pct === null) return 'N/A';

  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '─';
  const sign = pct > 0 ? '+' : '';
  const absPct = Math.abs(pct).toFixed(1);

  const diff = current - previous;
  const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

  return `${arrow} ${sign}${absPct}% (${diffStr}${unit})`;
}

/**
 * Calculate battery discharge rate from historical data
 * @param {string} lockId - Lock device ID
 * @param {Object} history - History object with dailyStats array
 * @returns {number} - Discharge rate in % per week
 */
export function calculateBatteryDischargeRate(lockId, history) {
  // Get battery readings from past 4 weeks
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);
  const recentHistory = history.dailyStats.filter(day =>
    new Date(day.date) >= fourWeeksAgo &&
    day.lockBatteryLevels?.some(l => l.id === lockId)
  );

  if (recentHistory.length < 2) return 5; // Default estimate

  const oldest = recentHistory[0].lockBatteryLevels.find(l => l.id === lockId);
  const newest = recentHistory[recentHistory.length - 1].lockBatteryLevels.find(l => l.id === lockId);

  if (!oldest || !newest) return 5;

  const batteryDrop = oldest.battery - newest.battery;
  const daysElapsed = recentHistory.length;
  const ratePerWeek = (batteryDrop / daysElapsed) * 7;

  return Math.max(ratePerWeek, 1); // At least 1% per week
}
