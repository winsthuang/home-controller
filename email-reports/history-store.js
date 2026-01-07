// History Store Module
// Stores and retrieves historical data for comparisons

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { paths, historySettings } from './config.js';

/**
 * Load history from file
 */
export function loadHistory() {
  try {
    if (existsSync(paths.historyFile)) {
      const data = readFileSync(paths.historyFile, 'utf8');
      return JSON.parse(data);
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

  const today = new Date().toISOString().split('T')[0];

  // Check if we already have stats for today
  const existingIndex = history.dailyStats.findIndex(s => s.date === today);
  const existing = existingIndex >= 0 ? history.dailyStats[existingIndex] : null;

  // Get YESTERDAY's stats specifically (not just any previous day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
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
  // These are point-in-time checks, so OR with existing value
  const ovenUsedNow = data.kitchen?.oven?.inUse || false;
  const saunaUsedNow = data.sauna?.heaterOn || false;
  const ovenUsed = existing?.ovenUsed || ovenUsedNow;
  const saunaUsed = existing?.saunaUsed || saunaUsedNow;

  // Water: keep the max value seen today (API might return 0 early, then real value later)
  const waterGallons = Math.max(
    existing?.waterGallons || 0,
    data.water?.dailyConsumption || 0
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
    saunaUsed,
    fridgeTemp: parseFloat(data.kitchen?.refrigerator?.temperature) || null,
    freezerTemp: parseFloat(data.kitchen?.freezer?.temperature) || null,
    lockEvents,
    unlockEvents
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
 * Get yesterday's stats
 */
export function getYesterday() {
  const history = loadHistory();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

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
    freezerTempCount: acc.freezerTempCount + (s.freezerTemp ? 1 : 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0,
    fridgeTemp: 0, freezerTemp: 0,
    fridgeTempCount: 0, freezerTempCount: 0
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
    freezerTemp: sum.freezerTempCount > 0 ? sum.freezerTemp / sum.freezerTempCount : null
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
    const date = new Date(s.date);
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
    unlockEvents: acc.unlockEvents + (s.unlockEvents || 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0, lockEvents: 0, unlockEvents: 0
  });

  return {
    weekStart: startOfWeek.toISOString().split('T')[0],
    weekEnd: new Date(endOfWeek.getTime() - 1).toISOString().split('T')[0],
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
    unlockEvents: acc.unlockEvents + (w.unlockEvents || 0)
  }), {
    waterGallons: 0, energyKwh: 0, washerCycles: 0,
    ovenUses: 0, saunaSessions: 0, lockEvents: 0, unlockEvents: 0
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
    unlockEvents: sum.unlockEvents / count
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
    if (value === 0) return '▁';
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
