// HTML Email Templates Module
// Simple, text-focused format matching the approved mockups

import {
  getYesterday, get7DayAverage, getWeeklyStats, get4WeekAverage,
  get12WeekAverage, getWeekToDate, getSparklineData, generateSparkline,
  percentChange
} from './history-store.js';

/**
 * Generate executive summary for daily report
 */
function generateDailyExecutiveSummary(data, history) {
  const avg7Day = get7DayAverage();
  const highlights = [];

  // Water usage comparison
  if (data.water?.dailyConsumption && avg7Day?.waterGallons) {
    const pct = percentChange(data.water.dailyConsumption, avg7Day.waterGallons);
    if (pct !== null) {
      const dir = pct > 0 ? 'up' : 'down';
      highlights.push(`Water usage ${dir} ${Math.abs(pct).toFixed(0)}% from 7-day avg`);
    }
  }

  // Energy usage comparison
  if (data.waterHeater?.dailyUsage && avg7Day?.energyKwh) {
    const pct = percentChange(data.waterHeater.dailyUsage, avg7Day.energyKwh);
    if (pct !== null) {
      const dir = pct > 0 ? 'up' : 'down';
      highlights.push(`Energy ${dir} ${Math.abs(pct).toFixed(0)}%`);
    }
  }

  // Alerts
  if (data.errors?.length > 0) {
    highlights.unshift(`${data.errors.length} system alert(s)`);
  }

  if (highlights.length === 0) {
    highlights.push('All systems normal');
  }

  return highlights.join('. ') + '.';
}

/**
 * Generate executive summary for weekly report
 */
function generateWeeklyExecutiveSummary(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const highlights = [];

  if (thisWeek && lastWeek) {
    const waterPct = percentChange(thisWeek.waterGallons, lastWeek.waterGallons);
    if (waterPct !== null) {
      const dir = waterPct > 0 ? '▲' : '▼';
      highlights.push(`Used ${thisWeek.waterGallons.toFixed(0)} gal water (${dir}${Math.abs(waterPct).toFixed(0)}% vs last week)`);
    }

    const energyPct = percentChange(thisWeek.energyKwh, lastWeek.energyKwh);
    if (energyPct !== null) {
      const dir = energyPct > 0 ? '▲' : '▼';
      highlights.push(`${thisWeek.energyKwh.toFixed(1)} kWh heating (${dir}${Math.abs(energyPct).toFixed(0)}%)`);
    }
  }

  if (thisWeek?.washerCycles) {
    highlights.push(`${thisWeek.washerCycles} laundry loads`);
  }

  if (thisWeek?.saunaSessions) {
    highlights.push(`${thisWeek.saunaSessions} sauna session(s)`);
  }

  if (data.errors?.length > 0) {
    highlights.push(`${data.errors.length} alert(s)`);
  } else {
    highlights.push('No alerts');
  }

  return highlights.join('. ') + '.';
}

/**
 * Format change arrow
 */
function formatChangeArrow(current, previous) {
  if (!previous || previous === 0) return '';
  const pct = ((current - previous) / previous) * 100;
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '─';
  return `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

/**
 * Simple monospace email styles
 */
const STYLES = `
  <style>
    body {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 24px;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: normal;
    }
    .header .date {
      color: #666;
      font-size: 13px;
    }
    .summary {
      background: #f0f0f0;
      padding: 12px 16px;
      margin-bottom: 24px;
      border-left: 3px solid #333;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 8px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }
    .box {
      border: 1px solid #ddd;
      padding: 12px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .label { color: #666; }
    .value { font-weight: bold; }
    .change-up { color: #c00; }
    .change-down { color: #080; }
    .big-stat {
      text-align: center;
      padding: 16px;
      background: #f8f8f8;
      margin-bottom: 12px;
    }
    .big-number {
      font-size: 32px;
      font-weight: bold;
    }
    .sparkline {
      letter-spacing: -1px;
      color: #666;
    }
    .alert {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 8px 12px;
      margin-bottom: 16px;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
    }
  </style>
`;

/**
 * Generate daily report HTML - simple, usage-focused format
 */
export function generateDailyReport(data, history) {
  const yesterday = getYesterday();
  const avg7Day = get7DayAverage();
  const weekToDate = getWeekToDate();

  const date = new Date();
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const summary = generateDailyExecutiveSummary(data, history);

  // Calculate changes
  const waterVsYesterday = yesterday ? formatChangeArrow(data.water?.dailyConsumption || 0, yesterday.waterGallons) : '';
  const waterVs7Day = avg7Day ? formatChangeArrow(data.water?.dailyConsumption || 0, avg7Day.waterGallons) : '';
  const energyVsYesterday = yesterday ? formatChangeArrow(data.waterHeater?.dailyUsage || 0, yesterday.energyKwh) : '';
  const energyVs7Day = avg7Day ? formatChangeArrow(data.waterHeater?.dailyUsage || 0, avg7Day.energyKwh) : '';

  const alertsHtml = data.errors?.length > 0 ? `
    <div class="alert">⚠️ ${data.errors.join(', ')}</div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HOME STATUS REPORT</h1>
      <div class="date">${dateStr}</div>
    </div>

    <div class="summary">
      📋 ${summary}
    </div>

    ${alertsHtml}

    <div class="section">
      <div class="section-title">💧 WATER USAGE</div>
      <div class="box">
<pre>YESTERDAY:         ${(data.water?.dailyConsumption || 0).toFixed(1)} gallons
vs Day Before:     ${waterVsYesterday || 'N/A'} ${yesterday ? `(${yesterday.waterGallons.toFixed(1)} gal)` : ''}
vs 7-Day Avg:      ${waterVs7Day || 'N/A'} ${avg7Day ? `(${avg7Day.waterGallons.toFixed(1)} gal)` : ''}

Week-to-date:      ${(weekToDate?.waterGallons || 0).toFixed(0)} gallons</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🚿 WATER HEATER</div>
      <div class="box">
<pre>Mode:              ${data.waterHeater?.modeName || 'Unknown'}
Set Point:         ${data.waterHeater?.temperatureSetpoint || 'N/A'}°F
Status:            ${data.waterHeater?.isOnline ? 'Online' : 'Offline'}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧺 LAUNDRY</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.washerCycles || 0} wash cycles
Yesterday:         ${yesterday ? (yesterday.washerCycles || 0) + ' cycles' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.washerCycles).toFixed(1) + ' cycles/day' : 'N/A'}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧖 SAUNA</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.saunaSessions || 0} sessions
Yesterday:         ${yesterday ? (yesterday.saunaUsed ? '1' : '0') + ' session' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.saunaSessions).toFixed(1) + ' sessions/day' : 'N/A'}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🍳 KITCHEN</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.ovenUses || 0} uses
Yesterday:         ${yesterday ? (yesterday.ovenUsed ? '1' : '0') + ' use' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.ovenUses).toFixed(1) + ' uses/day' : 'N/A'}</pre>
      </div>
    </div>

    <div class="footer">
      ✓ Report generated at ${new Date().toLocaleTimeString()}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate weekly report HTML - simple, usage-focused format
 */
export function generateWeeklyReport(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const avg4Week = get4WeekAverage();
  const avg12Week = get12WeekAverage();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const summary = generateWeeklyExecutiveSummary(data, history);

  // Sparklines
  const waterSparkline = generateSparkline(getSparklineData('waterGallons', 12));
  const energySparkline = generateSparkline(getSparklineData('energyKwh', 12));
  const laundrySparkline = generateSparkline(getSparklineData('washerCycles', 12));

  // Changes
  const waterVsLast = lastWeek ? formatChangeArrow(thisWeek?.waterGallons || 0, lastWeek.waterGallons) : '';
  const waterVs4 = avg4Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg4Week.waterGallons) : '';
  const waterVs12 = avg12Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg12Week.waterGallons) : '';

  const energyVsLast = lastWeek ? formatChangeArrow(thisWeek?.energyKwh || 0, lastWeek.energyKwh) : '';
  const energyVs4 = avg4Week ? formatChangeArrow(thisWeek?.energyKwh || 0, avg4Week.energyKwh) : '';
  const energyVs12 = avg12Week ? formatChangeArrow(thisWeek?.energyKwh || 0, avg12Week.energyKwh) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WEEKLY HOME SUMMARY</h1>
      <div class="date">${dateRange}</div>
    </div>

    <div class="summary">
      📋 ${summary}
    </div>

    <div class="section">
      <div class="section-title">💧 WATER USAGE</div>
      <div class="box">
<pre>This Week:         ${(thisWeek?.waterGallons || 0).toFixed(0)} gallons
Daily Average:     ${thisWeek ? (thisWeek.waterGallons / Math.max(thisWeek.daysRecorded, 1)).toFixed(1) : 'N/A'} gal/day

vs Last Week:      ${waterVsLast || 'N/A'} ${lastWeek ? `(${lastWeek.waterGallons.toFixed(0)} gal)` : ''}
vs 4-Week Avg:     ${waterVs4 || 'N/A'} ${avg4Week ? `(${avg4Week.waterGallons.toFixed(0)} gal)` : ''}
vs 12-Week Avg:    ${waterVs12 || 'N/A'} ${avg12Week ? `(${avg12Week.waterGallons.toFixed(0)} gal)` : ''}

12-Week Trend:     <span class="sparkline">${waterSparkline}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🚿 WATER HEATER</div>
      <div class="box">
<pre>Current Mode:      ${data.waterHeater?.modeName || 'Unknown'}
Set Point:         ${data.waterHeater?.temperatureSetpoint || 'N/A'}°F
Status:            ${data.waterHeater?.isOnline ? 'Online' : 'Offline'}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧺 LAUNDRY</div>
      <div class="box">
<pre>This Week:         ${thisWeek?.washerCycles || 0} loads
vs Last Week:      ${lastWeek ? formatChangeArrow(thisWeek?.washerCycles || 0, lastWeek.washerCycles) : 'N/A'} ${lastWeek ? `(${lastWeek.washerCycles} loads)` : ''}
vs 4-Week Avg:     ${avg4Week ? formatChangeArrow(thisWeek?.washerCycles || 0, avg4Week.washerCycles) : 'N/A'} ${avg4Week ? `(${avg4Week.washerCycles.toFixed(1)} loads)` : ''}
vs 12-Week Avg:    ${avg12Week ? formatChangeArrow(thisWeek?.washerCycles || 0, avg12Week.washerCycles) : 'N/A'} ${avg12Week ? `(${avg12Week.washerCycles.toFixed(1)} loads)` : ''}

12-Week Trend:     <span class="sparkline">${laundrySparkline}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧖 SAUNA</div>
      <div class="box">
<pre>This Week:         ${thisWeek?.saunaSessions || 0} sessions
vs Last Week:      ${lastWeek ? formatChangeArrow(thisWeek?.saunaSessions || 0, lastWeek.saunaSessions) : 'N/A'} ${lastWeek ? `(${lastWeek.saunaSessions} sessions)` : ''}
vs 4-Week Avg:     ${avg4Week ? formatChangeArrow(thisWeek?.saunaSessions || 0, avg4Week.saunaSessions) : 'N/A'} ${avg4Week ? `(${avg4Week.saunaSessions.toFixed(1)} sessions)` : ''}
vs 12-Week Avg:    ${avg12Week ? formatChangeArrow(thisWeek?.saunaSessions || 0, avg12Week.saunaSessions) : 'N/A'} ${avg12Week ? `(${avg12Week.saunaSessions.toFixed(1)} sessions)` : ''}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🍳 OVEN</div>
      <div class="box">
<pre>This Week:         ${thisWeek?.ovenUses || 0} uses
vs Last Week:      ${lastWeek ? formatChangeArrow(thisWeek?.ovenUses || 0, lastWeek.ovenUses) : 'N/A'} ${lastWeek ? `(${lastWeek.ovenUses} uses)` : ''}
vs 4-Week Avg:     ${avg4Week ? formatChangeArrow(thisWeek?.ovenUses || 0, avg4Week.ovenUses) : 'N/A'} ${avg4Week ? `(${avg4Week.ovenUses.toFixed(1)} uses)` : ''}
vs 12-Week Avg:    ${avg12Week ? formatChangeArrow(thisWeek?.ovenUses || 0, avg12Week.ovenUses) : 'N/A'} ${avg12Week ? `(${avg12Week.ovenUses.toFixed(1)} uses)` : ''}</pre>
      </div>
    </div>

    <div class="footer">
      ✓ Weekly report generated at ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text version for email fallback
 */
export function generatePlainText(data, reportType) {
  const lines = [];
  const weekToDate = getWeekToDate();
  const yesterday = getYesterday();
  const avg7Day = get7DayAverage();

  if (reportType === 'weekly') {
    lines.push('WEEKLY HOME SUMMARY');
    lines.push('═'.repeat(40));
  } else {
    lines.push('HOME STATUS REPORT');
    lines.push('═'.repeat(40));
  }

  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  lines.push('💧 WATER USAGE');
  lines.push(`   Today: ${(data.water?.dailyConsumption || 0).toFixed(1)} gallons`);
  if (yesterday) lines.push(`   vs Yesterday: ${yesterday.waterGallons.toFixed(1)} gal`);
  if (avg7Day) lines.push(`   vs 7-Day Avg: ${avg7Day.waterGallons.toFixed(1)} gal`);
  lines.push('');

  lines.push('🚿 WATER HEATER');
  lines.push(`   Today: ${(data.waterHeater?.dailyUsage || 0).toFixed(1)} kWh`);
  if (yesterday) lines.push(`   vs Yesterday: ${yesterday.energyKwh.toFixed(1)} kWh`);
  lines.push('');

  lines.push('🧺 LAUNDRY');
  lines.push(`   Week-to-date: ${weekToDate?.washerCycles || 0} loads`);
  lines.push('');

  lines.push('🧖 SAUNA');
  lines.push(`   Week-to-date: ${weekToDate?.saunaSessions || 0} sessions`);

  if (data.errors?.length > 0) {
    lines.push('');
    lines.push('⚠️ ALERTS');
    data.errors.forEach(e => lines.push(`   - ${e}`));
  }

  return lines.join('\n');
}
