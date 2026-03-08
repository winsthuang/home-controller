// HTML Email Templates Module
// Simple, text-focused format matching the approved mockups

import {
  getYesterday, get7DayAverage, getWeeklyStats, get4WeekAverage,
  get12WeekAverage, getWeekToDate, getDailySparklineData, getSparklineData,
  generateSparkline, percentChange, calculateBatteryDischargeRate
} from './history-store.js';
import { costConfig, benchmarks } from './config.js';
import { generateMaintenanceAlerts } from './data-collector.js';

/**
 * Generate executive summary for daily report
 */
function generateDailyExecutiveSummary(data, history) {
  const avg12Week = get12WeekAverage();
  const lines = [];
  const anomalies = [];

  // Only flag data collection errors
  if (data.errors?.length > 0) {
    anomalies.push(`⚠️ ${data.errors.length} data collection error(s)`);
  }

  // Flag dramatic outliers vs 12-week average (>2x normal)
  if (data.water?.dailyConsumption && avg12Week?.waterGallons && avg12Week.waterGallons > 0) {
    const ratio = data.water.dailyConsumption / avg12Week.waterGallons;
    if (ratio > 2) {
      anomalies.push(`⚠️ Water usage ${ratio.toFixed(1)}x above normal (${data.water.dailyConsumption.toFixed(0)} vs avg ${avg12Week.waterGallons.toFixed(0)} gal)`);
    }
  }

  if (data.waterHeater?.dailyUsage && avg12Week?.energyKwh && avg12Week.energyKwh > 0) {
    const ratio = data.waterHeater.dailyUsage / avg12Week.energyKwh;
    if (ratio > 2) {
      anomalies.push(`⚠️ Water heater energy ${ratio.toFixed(1)}x above normal (${data.waterHeater.dailyUsage.toFixed(1)} vs avg ${avg12Week.energyKwh.toFixed(1)} kWh)`);
    }
  }

  if (anomalies.length > 0) {
    lines.push(anomalies.join('. '));
  }

  // Headline numbers
  const parts = [];
  if (data.tesla?.solarProduction != null) {
    parts.push(`${data.tesla.solarProduction.toFixed(1)} kWh solar`);
  }
  if (data.tesla?.batteryLevel != null) {
    parts.push(`Powerwall ${Math.round(data.tesla.batteryLevel)}%`);
  }
  if (data.water?.dailyConsumption) {
    parts.push(`${data.water.dailyConsumption.toFixed(0)} gal water`);
  }
  if (data.waterHeater?.dailyUsage) {
    parts.push(`${data.waterHeater.dailyUsage.toFixed(1)} kWh heating`);
  }

  if (parts.length > 0) {
    lines.push(parts.join(' · '));
  }

  return lines.join('\n');
}

/**
 * Generate executive summary for weekly report
 */
function generateWeeklyExecutiveSummary(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const highlights = [];

  // Solar highlight
  if (thisWeek?.solarProduction && lastWeek?.solarProduction) {
    const solarPct = percentChange(thisWeek.solarProduction, lastWeek.solarProduction);
    const dir = solarPct > 0 ? '▲' : '▼';
    highlights.push(`Generated ${thisWeek.solarProduction.toFixed(0)} kWh solar (${dir}${Math.abs(solarPct).toFixed(0)}%)`);
  } else if (thisWeek?.solarProduction) {
    highlights.push(`Generated ${thisWeek.solarProduction.toFixed(0)} kWh solar`);
  }

  // Net grid position
  if (thisWeek?.gridExport && thisWeek?.gridImport) {
    const netGrid = thisWeek.gridExport - thisWeek.gridImport;
    if (netGrid > 0) {
      highlights.push(`Net exporter (+${netGrid.toFixed(0)} kWh)`);
    }
  }

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
 * Generate Solar & Battery section for daily report
 */
function generateSolarBatterySection(data, history) {
  const tesla = data.tesla;

  // If no Tesla data, return empty
  if (!tesla || tesla.solarProduction === undefined) {
    return '';
  }

  const avg7Day = get7DayAverage();

  // Format current power (Watts to kW)
  const formatPower = (watts) => {
    if (!watts && watts !== 0) return 'N/A';
    return (watts / 1000).toFixed(1) + ' kW';
  };

  // Battery status text
  const getBatteryStatusText = () => {
    if (!tesla.batteryLevel) return 'Unknown';
    const status = tesla.batteryStatus || 'standby';
    const power = formatPower(Math.abs(tesla.batteryPower || 0));
    if (status === 'charging') return `Charging at ${power}`;
    if (status === 'discharging') return `Discharging at ${power}`;
    return 'Standby';
  };

  // Calculate solar value
  const solarValue = tesla.solarProduction * costConfig.solarValuePerKwh;
  const gridCost = tesla.gridImport * costConfig.electricityCostPerKwh;

  // Compare to 7-day average
  const solarVsAvg = avg7Day?.solarProduction
    ? formatChangeArrow(tesla.solarProduction, avg7Day.solarProduction)
    : '';

  // Net position
  const netGrid = tesla.gridExport - tesla.gridImport;
  const netPositionText = netGrid >= 0
    ? `Net Exporter! (+${netGrid.toFixed(1)} kWh to grid)`
    : `Net Importer (${Math.abs(netGrid).toFixed(1)} kWh from grid)`;

  return `
    <div class="section">
      <div class="section-title">☀️ SOLAR & BATTERY</div>
      <div class="box">
<pre>Solar Production:   ${tesla.solarProduction.toFixed(1)} kWh  ($${solarValue.toFixed(2)} value)
vs 7-Day Avg:       ${solarVsAvg || 'N/A'} ${avg7Day?.solarProduction ? `(${avg7Day.solarProduction.toFixed(1)} kWh)` : ''}

Powerwall:          ${tesla.batteryLevel != null ? Math.round(tesla.batteryLevel) : 'N/A'}% ${tesla.batteryLevel ? `(${getBatteryStatusText()})` : ''}
Backup Reserve:     ${tesla.backupReserve || 'N/A'}%${tesla.stormModeActive ? ' ⚠️ Storm Watch Active' : ''}

Grid Import:        ${tesla.gridImport.toFixed(1)} kWh  ($${gridCost.toFixed(2)})
Grid Export:        ${tesla.gridExport.toFixed(1)} kWh
Net Position:       ${netPositionText}

Home Consumption:   ${tesla.homeConsumption.toFixed(1)} kWh
Self-Powered:       ${tesla.historySelfPowered || tesla.selfPoweredPercentage || 'N/A'}%

14-Day Solar:       <span class="sparkline">${generateSparkline(getDailySparklineData('solarProduction', 14))}</span>

Current Status:
  Solar:            ${formatPower(tesla.solarPower)} ${tesla.solarPower > 0 ? '☀️' : '🌙'}
  Home Load:        ${formatPower(tesla.homePower)}
  Grid:             ${formatPower(Math.abs(tesla.gridPower))} ${tesla.exportingToGrid ? '(exporting ↗)' : tesla.importingFromGrid ? '(importing ↙)' : ''}
  Grid Status:      ${tesla.gridConnected ? 'Connected ✓' : 'Disconnected ⚠️'}</pre>
      </div>
    </div>
  `;
}

/**
 * Format cost value, showing credit for negative amounts
 */
function formatCost(val) {
  if (val < 0) return `+$${Math.abs(val).toFixed(2)} credit`;
  return `$${val.toFixed(2)}`;
}

/**
 * Generate Cost Snapshot section for daily report
 * Shows whole-home electricity with water heater breakout when Tesla data available
 */
function generateCostSnapshot(data, history) {
  const weekToDate = getWeekToDate();
  const avg7Day = get7DayAverage();
  const avg4Week = get4WeekAverage();

  const tesla = data.tesla;
  const hasTesla = tesla && tesla.homeConsumption != null && tesla.homeConsumption > 0;

  // Water heater data
  const whKwh = data.waterHeater?.dailyUsage || 0;
  const whMode = data.waterHeater?.operationMode || data.waterHeater?.modeName || 'Unknown';
  const whModeCheck = (whMode === 'HEAT_PUMP' || whMode === 'Heat Pump') ? '✓' : '⚠️';

  if (!hasTesla) {
    // Fallback: water-heater-only view (Tesla offline)
    const yesterdayCost = whKwh * costConfig.electricityCostPerKwh;
    const weekKwh = weekToDate?.energyKwh || 0;
    const weekCost = weekKwh * costConfig.electricityCostPerKwh;
    const dailyAvgKwh = avg7Day?.energyKwh || whKwh;
    const dailyAvgCost = dailyAvgKwh * costConfig.electricityCostPerKwh;
    const monthlyProjection = dailyAvgCost * costConfig.projectionDaysInMonth;

    return `
    <div class="section">
      <div class="section-title">💰 ENERGY COST SNAPSHOT</div>
      <div class="box">
<pre>⚠️ No whole-home data (Tesla offline)

Yesterday's Water Heating:
  Energy Used:      ${whKwh.toFixed(1)} kWh
  Cost:             $${yesterdayCost.toFixed(2)}  (@ $${costConfig.electricityCostPerKwh.toFixed(2)}/kWh)
  Mode:             ${whMode} ${whModeCheck}

Week-to-date:       ${weekKwh.toFixed(1)} kWh  ($${weekCost.toFixed(2)})
Daily Average:      ${dailyAvgKwh.toFixed(1)} kWh/day  ($${dailyAvgCost.toFixed(2)}/day)
Monthly Projection: $${monthlyProjection.toFixed(2)}</pre>
      </div>
    </div>
  `;
  }

  // Whole-home electricity calculations
  const homeConsumption = tesla.homeConsumption;
  const gridImport = tesla.gridImport;
  const gridExport = tesla.gridExport;
  const solarOffset = homeConsumption - gridImport;

  const gridCost = gridImport * costConfig.electricityCostPerKwh;
  const exportCredit = gridExport * costConfig.electricityCostPerKwh;
  const solarAvoided = solarOffset * costConfig.electricityCostPerKwh;
  const netCost = gridCost - exportCredit;

  // Water heater breakout (cap at 100% for timing mismatches)
  const whPct = homeConsumption > 0 ? Math.min(whKwh / homeConsumption * 100, 100) : 0;
  const restOfHouseKwh = Math.max(homeConsumption - whKwh, 0);
  const restOfHousePct = 100 - whPct;

  // 14-day sparkline
  const homeSparkline = generateSparkline(getDailySparklineData('homeConsumption', 14));
  const homeAvgLabel = avg7Day?.homeConsumption ? `avg ${avg7Day.homeConsumption.toFixed(1)} kWh` : '';

  // Week-to-date net cost
  const weekGridImport = weekToDate?.gridImport || 0;
  const weekGridExport = weekToDate?.gridExport || 0;
  const weekHomeKwh = weekToDate?.homeConsumption || 0;
  const weekNetCost = (weekGridImport - weekGridExport) * costConfig.electricityCostPerKwh;

  // Daily average net cost (7-day)
  const avg7DayGridImport = avg7Day?.gridImport || 0;
  const avg7DayGridExport = avg7Day?.gridExport || 0;
  const avg7DayNetCost = (avg7DayGridImport - avg7DayGridExport) * costConfig.electricityCostPerKwh;
  const dailyAvgHomeKwh = avg7Day?.homeConsumption || homeConsumption;

  // Monthly projection from 7-day average
  const monthlyProjection = avg7DayNetCost * costConfig.projectionDaysInMonth;

  // vs last month (4-week average)
  const avg4WeekGridImport = avg4Week?.gridImport || 0;
  const avg4WeekGridExport = avg4Week?.gridExport || 0;
  const avg4WeekNetCost = (avg4WeekGridImport - avg4WeekGridExport) * costConfig.electricityCostPerKwh;
  const lastMonthProj = (avg4WeekNetCost / 7) * costConfig.projectionDaysInMonth;
  const savingsVsLastMonth = lastMonthProj - monthlyProjection;
  const savingsPct = lastMonthProj !== 0 ? (savingsVsLastMonth / Math.abs(lastMonthProj)) * 100 : 0;

  const savingsText = savingsVsLastMonth > 0
    ? `▼ -${Math.abs(savingsPct).toFixed(0)}%  (saved $${savingsVsLastMonth.toFixed(2)})`
    : savingsVsLastMonth < 0
      ? `▲ +${Math.abs(savingsPct).toFixed(0)}%  (added $${Math.abs(savingsVsLastMonth).toFixed(2)})`
      : '─ no change';

  // Water heater breakout section (only if we have water heater data)
  const whBreakout = whKwh > 0 ? `
Water Heater Breakout:
  Water Heater:     ${whKwh.toFixed(1)} kWh  (${whPct.toFixed(0)}% of home)
  Rest of House:    ${restOfHouseKwh.toFixed(1)} kWh  (${restOfHousePct.toFixed(0)}% of home)` : '';

  return `
    <div class="section">
      <div class="section-title">💰 ENERGY COST SNAPSHOT</div>
      <div class="box">
<pre>Yesterday's Whole-Home Electricity:
  Home Consumption: ${homeConsumption.toFixed(1)} kWh
  Grid Import:      ${gridImport.toFixed(1)} kWh  ($${gridCost.toFixed(2)})
  Solar Offset:     ${solarOffset.toFixed(1)} kWh  ($${solarAvoided.toFixed(2)} avoided)
  Grid Export:      ${gridExport.toFixed(1)} kWh  ($${exportCredit.toFixed(2)} credit)
  Net Cost:         ${formatCost(netCost)}
${whBreakout}

14-Day Trend:   <span class="sparkline">${homeSparkline}</span>  ${homeAvgLabel}

Week-to-date:       ${weekHomeKwh.toFixed(1)} kWh  (${formatCost(weekNetCost)} net)
Daily Avg (7d):     ${dailyAvgHomeKwh.toFixed(1)} kWh/day  (${formatCost(avg7DayNetCost)}/day)
Monthly Projection: ${formatCost(monthlyProjection)} net
  vs Last Month:    ${savingsText}</pre>
      </div>
    </div>
  `;
}

/**
 * Generate Maintenance Alerts section for daily report
 */
function generateMaintenanceAlertsSection(alerts) {
  if (!alerts || alerts.length === 0) {
    return '';  // Don't show section if no alerts
  }

  const alertsByPriority = {
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info')
  };

  let alertsHtml = '';

  if (alertsByPriority.critical.length > 0) {
    alertsHtml += alertsByPriority.critical.map(alert => `
🔴 ${alert.device}: ${alert.message}
    ${alert.detail ? `${alert.detail}\n    ` : ''}${alert.action ? `Action: ${alert.action}` : ''}
    ${alert.estimate ? `${alert.estimate}` : ''}`).join('\n\n');
  }

  if (alertsByPriority.warning.length > 0) {
    if (alertsHtml) alertsHtml += '\n\n';
    alertsHtml += alertsByPriority.warning.map(alert => `
⚠️  ${alert.device}: ${alert.message}
    ${alert.change ? `${alert.change}\n    ` : ''}${alert.detail ? `${alert.detail}\n    ` : ''}${alert.possible ? `Possible: ${alert.possible}\n    ` : ''}${alert.action ? `Action: ${alert.action}` : ''}`).join('\n\n');
  }

  if (alertsByPriority.info.length > 0) {
    if (alertsHtml) alertsHtml += '\n\n';
    alertsHtml += alertsByPriority.info.map(alert => `
🟡 ${alert.device}: ${alert.message}
    ${alert.action ? `Action: ${alert.action}` : ''}`).join('\n\n');
  }

  return `
    <div class="section">
      <div class="section-title">🔧 MAINTENANCE ALERTS</div>
      <div class="box alert">
<pre>${alertsHtml}</pre>
      </div>
    </div>
  `;
}

/**
 * Generate 7-day energy pattern visualization
 */
function generate7DayEnergyPattern(data, history) {
  const sparklineData = getDailySparklineData('energyKwh', 7);
  const sparkline = generateSparkline(sparklineData);

  // Get day labels (Mon, Tue, etc.)
  const days = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3));
    values.push(sparklineData[6 - i]?.toFixed(1) || '0.0');
  }

  const maxValue = Math.max(...sparklineData);
  const minValue = Math.min(...sparklineData.filter(v => v > 0));
  const maxDay = days[sparklineData.indexOf(maxValue)];
  const minDay = days[sparklineData.indexOf(minValue)];

  // Space sparkline chars to align with day labels and values (5-char columns)
  const spacedSparkline = sparkline.split('').map(c => ` ${c} `).join('  ');

  return `
7-Day Energy Pattern:
  ${days.join('  ')}
  ${spacedSparkline}
  ${values.join('  ')} kWh

Peak Usage:         ${maxDay} (${maxValue.toFixed(1)} kWh, $${(maxValue * costConfig.electricityCostPerKwh).toFixed(2)})
Lowest Usage:       ${minDay} (${minValue.toFixed(1)} kWh, $${(minValue * costConfig.electricityCostPerKwh).toFixed(2)})`;
}

/**
 * Generate unified Weekly Energy & Cost section for weekly report
 * Replaces separate generateWeeklySolarSummary + generateWeeklyCostSummary
 */
function generateWeeklyEnergyCost(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const avg4Week = get4WeekAverage();
  const avg12Week = get12WeekAverage();

  const hasTesla = (thisWeek?.homeConsumption > 0) || (data.tesla?.homeConsumption > 0);

  // Water heater data
  const whKwh = thisWeek?.energyKwh || 0;
  const whMode = data.waterHeater?.operationMode || data.waterHeater?.modeName || 'Unknown';
  const whModeCheck = (whMode === 'HEAT_PUMP' || whMode === 'Heat Pump') ? '✓' : '⚠️';

  if (!hasTesla) {
    // Fallback: water-heater-only view (Tesla offline)
    const whCost = whKwh * costConfig.electricityCostPerKwh;
    const lastWeekKwh = lastWeek?.energyKwh || 0;
    const lastWeekCost = lastWeekKwh * costConfig.electricityCostPerKwh;
    const savingsVsLast = lastWeekCost - whCost;
    const savingsPctLast = lastWeekCost > 0 ? (savingsVsLast / lastWeekCost) * 100 : 0;
    const savingsTextLast = savingsVsLast > 0
      ? `▼ -${Math.abs(savingsPctLast).toFixed(0)}%  (saved $${savingsVsLast.toFixed(2)})`
      : `▲ +${Math.abs(savingsPctLast).toFixed(0)}%  (added $${Math.abs(savingsVsLast).toFixed(2)})`;

    return `
    <div class="section">
      <div class="section-title">💰 WEEKLY ENERGY & COST</div>
      <div class="box">
<pre>⚠️ No whole-home data (Tesla offline)

Water Heater This Week: ${whKwh.toFixed(1)} kWh  ($${whCost.toFixed(2)})
  Mode: ${whMode} ${whModeCheck}

vs Last Week:       ${savingsTextLast}</pre>
      </div>
    </div>
  `;
  }

  // Whole-home data
  const weekConsumption = thisWeek?.homeConsumption || 0;
  const weekImport = thisWeek?.gridImport || 0;
  const weekExport = thisWeek?.gridExport || 0;
  const weekSolar = thisWeek?.solarProduction || 0;

  const gridCost = weekImport * costConfig.electricityCostPerKwh;
  const solarValue = weekSolar * costConfig.electricityCostPerKwh;
  const exportCredit = weekExport * costConfig.electricityCostPerKwh;
  const netCost = gridCost - exportCredit;

  // Self-powered percentage
  const selfPowered = weekConsumption > 0
    ? Math.round((1 - weekImport / weekConsumption) * 100)
    : 0;

  // Water heater breakout (cap at 100% for timing mismatches)
  const whPct = weekConsumption > 0 ? Math.min(whKwh / weekConsumption * 100, 100) : 0;
  const restOfHouseKwh = Math.max(weekConsumption - whKwh, 0);
  const restOfHousePct = 100 - whPct;

  // vs Last Week (net cost based)
  const lastWeekNetCost = lastWeek
    ? ((lastWeek.gridImport || 0) - (lastWeek.gridExport || 0)) * costConfig.electricityCostPerKwh
    : null;
  let vsLastWeekText = 'N/A';
  if (lastWeekNetCost !== null && Math.abs(lastWeekNetCost) > 0) {
    const diff = lastWeekNetCost - netCost;
    const pct = (diff / Math.abs(lastWeekNetCost)) * 100;
    vsLastWeekText = diff > 0
      ? `▼ -${Math.abs(pct).toFixed(0)}%  (saved $${diff.toFixed(2)})`
      : `▲ +${Math.abs(pct).toFixed(0)}%  (added $${Math.abs(diff).toFixed(2)})`;
  }

  // vs 4-Week Avg (net cost based)
  const avg4WeekNetCost = avg4Week
    ? ((avg4Week.gridImport || 0) - (avg4Week.gridExport || 0)) * costConfig.electricityCostPerKwh
    : null;
  let vs4WeekText = 'N/A';
  if (avg4WeekNetCost !== null && Math.abs(avg4WeekNetCost) > 0) {
    const diff = avg4WeekNetCost - netCost;
    const pct = (diff / Math.abs(avg4WeekNetCost)) * 100;
    vs4WeekText = diff > 0
      ? `▼ -${Math.abs(pct).toFixed(0)}%  (saved $${diff.toFixed(2)})`
      : `▲ +${Math.abs(pct).toFixed(0)}%  (added $${Math.abs(diff).toFixed(2)})`;
  }

  // 12-week sparkline
  const homeSparkline = generateSparkline(getSparklineData('homeConsumption', 12));
  const homeAvgLabel = avg12Week?.homeConsumption ? `avg ${avg12Week.homeConsumption.toFixed(0)} kWh` : '';

  // Monthly projection
  const daysRecorded = Math.max(thisWeek?.daysRecorded || 7, 1);
  const dailyNetCost = netCost / daysRecorded;
  const monthlyProjection = dailyNetCost * costConfig.projectionDaysInMonth;

  // Year-to-date
  const weeksInYear = Math.max(1, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000)));
  const representativeWeeklyNetCost = avg4WeekNetCost !== null ? avg4WeekNetCost : netCost;
  const ytdCost = representativeWeeklyNetCost * weeksInYear;
  const annualProjection = representativeWeeklyNetCost * 52;

  // Water heater breakout section (only if we have water heater data)
  const whBreakout = whKwh > 0 ? `
Water Heater Breakout:
  Water Heater:     ${whKwh.toFixed(1)} kWh  (${whPct.toFixed(0)}% of home)
  Rest of House:    ${restOfHouseKwh.toFixed(1)} kWh  (${restOfHousePct.toFixed(0)}% of home)
  Mode: ${whMode} ${(whMode === 'HEAT_PUMP' || whMode === 'Heat Pump') ? '(most efficient) ✓' : whModeCheck}` : '';

  return `
    <div class="section">
      <div class="section-title">💰 WEEKLY ENERGY & COST</div>
      <div class="box">
<pre>This Week's Whole-Home Electricity:
  Home Consumption: ${weekConsumption.toFixed(1)} kWh
  Grid Import:      ${weekImport.toFixed(1)} kWh  ($${gridCost.toFixed(2)})
  Solar Generated:  ${weekSolar.toFixed(1)} kWh  ($${solarValue.toFixed(2)} value)
  Grid Export:      ${weekExport.toFixed(1)} kWh  ($${exportCredit.toFixed(2)} credit)
  Net Cost:         ${formatCost(netCost)}
  Self-Powered:     ${selfPowered}%
${whBreakout}

vs Last Week:       ${vsLastWeekText}
vs 4-Week Avg:      ${vs4WeekText}

12-Week Trend:  <span class="sparkline">${homeSparkline}</span>  ${homeAvgLabel}

Monthly Projection: ${formatCost(monthlyProjection)} net
Year-to-Date:       ${formatCost(ytdCost)} (${weeksInYear} weeks)
Projected Annual:   ${formatCost(annualProjection)}</pre>
      </div>
    </div>
  `;
}

/**
 * Generate Maintenance Forecast for weekly report
 */
function generateMaintenanceForecast(data, history) {
  const urgentItems = [];
  const planAheadItems = [];
  const noIssues = [];

  // Battery predictions
  if (data.smartLocks?.locks) {
    for (const lock of data.smartLocks.locks) {
      const dischargeRate = calculateBatteryDischargeRate(lock.id, history);
      const weeksRemaining = lock.batteryLevel / dischargeRate;
      const daysRemaining = Math.floor(weeksRemaining * 7);
      const depletionDate = new Date(Date.now() + daysRemaining * 86400000);

      if (daysRemaining <= 7) {
        urgentItems.push({
          icon: '🔋',
          message: `${lock.name}: Replace batteries by ${depletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          detail: `Current: ${lock.batteryLevel}% | Discharge: ${dischargeRate.toFixed(1)}%/week`
        });
      } else if (daysRemaining <= 30) {
        planAheadItems.push({
          icon: '📅',
          message: `${lock.name}: Battery at ${lock.batteryLevel}%`,
          detail: `Plan replacement around ${depletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        });
      }
    }
  }

  // System health checks
  const yesterday = getYesterday();
  if (data.water?.pressure && yesterday?.waterPressure) {
    const pressureDiff = Math.abs(data.water.pressure - yesterday.waterPressure);
    if (pressureDiff < 5) {
      noIssues.push(`Water pressure stable (${data.water.pressure.toFixed(0)} PSI avg)`);
    }
  }

  if (data.kitchen?.refrigerator?.temperature && data.kitchen?.freezer?.temperature) {
    const fridgeTemp = parseFloat(data.kitchen.refrigerator.temperature);
    const freezerTemp = parseFloat(data.kitchen.freezer.temperature);
    if (fridgeTemp >= 1 && fridgeTemp <= 5 && freezerTemp >= -20 && freezerTemp <= -16) {
      noIssues.push('Appliance temperatures within normal range');
    }
  }

  if (data.smartLocks?.locks && data.smartLocks.locks.every(l => l.isConnected)) {
    noIssues.push('All devices connected and online');
  }

  // Efficiency opportunities
  const efficiencyOpp = [];

  const avg7Day = get7DayAverage();
  if (avg7Day?.waterGallons) {
    const expectedDaily = benchmarks.dailyWaterPerPerson * benchmarks.householdSize;
    const savingsPct = ((expectedDaily - avg7Day.waterGallons) / expectedDaily) * 100;
    if (savingsPct > 0) {
      efficiencyOpp.push(`Water usage is ${savingsPct.toFixed(0)}% below typical household\n    Annual savings: N/A (well water is free)`);
    }
  }

  let forecastHtml = '';

  if (urgentItems.length > 0) {
    forecastHtml += `${urgentItems.map(item => `  ${item.icon} ${item.message}\n    ${item.detail}`).join('\n\n')}\n\n`;
  }

  if (planAheadItems.length > 0) {
    forecastHtml += `📅 PLAN AHEAD - Next 2-4 Weeks:\n${planAheadItems.map(item => `  • ${item.message}\n    ${item.detail}`).join('\n\n')}\n\n`;
  }

  if (noIssues.length > 0) {
    forecastHtml += `✓ NO IMMEDIATE CONCERNS:\n${noIssues.map(item => `  • ${item}`).join('\n')}\n\n`;
  }

  if (efficiencyOpp.length > 0) {
    forecastHtml += `💡 EFFICIENCY OPPORTUNITIES:\n${efficiencyOpp.map(item => `  • ${item}`).join('\n\n')}`;
  }

  return `
    <div class="section">
      <div class="section-title">🔧 MAINTENANCE FORECAST (Next 30 Days)</div>
      <div class="box">
<pre>${urgentItems.length > 0 ? '🔋 URGENT - Within 1 Week:\n' : ''}${forecastHtml}</pre>
      </div>
    </div>
  `;
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

  // Generate maintenance alerts
  const maintenanceAlerts = generateMaintenanceAlerts(data, history);

  // Calculate changes
  const waterVsYesterday = yesterday ? formatChangeArrow(data.water?.dailyConsumption || 0, yesterday.waterGallons) : '';
  const waterVs7Day = avg7Day ? formatChangeArrow(data.water?.dailyConsumption || 0, avg7Day.waterGallons) : '';
  const energyVsYesterday = yesterday ? formatChangeArrow(data.waterHeater?.dailyUsage || 0, yesterday.energyKwh) : '';
  const energyVs7Day = avg7Day ? formatChangeArrow(data.waterHeater?.dailyUsage || 0, avg7Day.energyKwh) : '';

  // System errors (integration failures)
  const alertsHtml = data.errors?.length > 0 ? `
    <div class="alert">⚠️ Data collection completed with ${data.errors.length} error(s): ${data.errors.join(', ')}</div>
  ` : '';

  // Cost snapshot
  const costSnapshotHtml = generateCostSnapshot(data, history);

  // Solar & Battery section
  const solarBatteryHtml = generateSolarBatterySection(data, history);

  // Maintenance alerts section
  const maintenanceAlertsHtml = generateMaintenanceAlertsSection(maintenanceAlerts);

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

    ${solarBatteryHtml}

    ${costSnapshotHtml}

    ${maintenanceAlertsHtml}

    <div class="section">
      <div class="section-title">💧 WATER USAGE</div>
      <div class="box">
<pre>Today:              ${(data.water?.todayConsumption || 0).toFixed(1)} gal
vs Yesterday:       ${data.water?.dailyConsumption ? formatChangeArrow(data.water?.todayConsumption || 0, data.water.dailyConsumption) : 'N/A'} ${data.water?.dailyConsumption ? `(${data.water.dailyConsumption.toFixed(1)} gal)` : ''}
vs 7-Day Avg:       ${waterVs7Day || 'N/A'} ${avg7Day ? `(${avg7Day.waterGallons.toFixed(1)} gal)` : ''}

Week-to-date:       ${(weekToDate?.waterGallons || 0).toFixed(0)} gal
Daily Average:      ${(avg7Day?.waterGallons || 0).toFixed(1)} gal/day
Household Avg:      ${benchmarks.dailyWaterPerPerson * benchmarks.householdSize} gal/day (${benchmarks.householdSize} people)
Your Efficiency:    ${avg7Day?.waterGallons ? (((benchmarks.dailyWaterPerPerson * benchmarks.householdSize - avg7Day.waterGallons) / (benchmarks.dailyWaterPerPerson * benchmarks.householdSize)) * 100).toFixed(0) : '0'}% below typical household

System Status:
  Pressure:         ${data.water?.pressure?.toFixed(1) || 'N/A'} PSI  (normal: 50-70)
  Temperature:      ${data.water?.temperature?.toFixed(0) || 'N/A'}°F
  Flow Rate:        ${data.water?.flow?.toFixed(1) || '0.0'} GPM  ${data.water?.flow > 0 ? '(active usage)' : '(no active usage)'}
  Main Valve:       ${data.water?.valveStatus || 'Unknown'}
  Auto-Shutoff:     ${data.water?.autoShutoff ? 'Enabled ✓' : 'Disabled'}

14-Day Trend:       <span class="sparkline">${generateSparkline(getDailySparklineData('waterGallons', 14))}</span>${data.water?.fixtureBreakdown && data.water.fixtureBreakdown.length > 0 ? `

Fixture Breakdown (Yesterday):${data.water.fixtureBreakdown.map(f => `
  ${f.name}:${' '.repeat(Math.max(1, 18 - f.name.length))}${f.gallons.toFixed(1)} gal  (${f.percentage}%)  ${'▂'.repeat(Math.max(1, Math.floor(f.percentage / 5)))}`).join('')}` : ''}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🚿 WATER HEATER ENERGY</div>
      <div class="box">
<pre>Yesterday:          ${(data.waterHeater?.dailyUsage || 0).toFixed(1)} kWh  ($${((data.waterHeater?.dailyUsage || 0) * costConfig.electricityCostPerKwh).toFixed(2)})
Mode:               ${data.waterHeater?.modeName || data.waterHeater?.operationMode || 'Unknown'} ${(data.waterHeater?.modeName === 'HEAT_PUMP' || data.waterHeater?.modeName === 'Heat Pump') ? '(most efficient) ✓' : ''}
Set Point:          ${data.waterHeater?.temperatureSetpoint || 'N/A'}°F
Status:             ${data.waterHeater?.isOnline ? 'Online' : 'Offline'}

Weekly Energy:      ${(weekToDate?.energyKwh || 0).toFixed(1)} kWh  ($${((weekToDate?.energyKwh || 0) * costConfig.electricityCostPerKwh).toFixed(2)})
Daily Average:      ${(avg7Day?.energyKwh || 0).toFixed(1)} kWh/day  ($${((avg7Day?.energyKwh || 0) * costConfig.electricityCostPerKwh).toFixed(2)}/day)

14-Day Trend:       <span class="sparkline">${generateSparkline(getDailySparklineData('energyKwh', 14))}</span>

${generate7DayEnergyPattern(data, history)}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧺 LAUNDRY</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.washerCycles || 0} wash cycles
Yesterday:         ${yesterday ? (yesterday.washerCycles || 0) + ' cycles' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.washerCycles).toFixed(1) + ' cycles/day' : 'N/A'}

14-Day Trend:      <span class="sparkline">${generateSparkline(getDailySparklineData('washerCycles', 14))}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🧖 SAUNA</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.saunaSessions || 0} sessions
Yesterday:         ${yesterday ? (yesterday.saunaUsed ? '1' : '0') + ' session' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.saunaSessions).toFixed(1) + ' sessions/day' : 'N/A'}

14-Day Trend:      <span class="sparkline">${generateSparkline(getDailySparklineData('saunaUsed', 14))}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🍳 KITCHEN</div>
      <div class="box">
<pre>Week-to-date:      ${weekToDate?.ovenUses || 0} uses
Yesterday:         ${yesterday ? (yesterday.ovenUsed ? '1' : '0') + ' use' : 'N/A'}
7-Day Avg:         ${avg7Day ? (avg7Day.ovenUses).toFixed(1) + ' uses/day' : 'N/A'}

14-Day Trend:      <span class="sparkline">${generateSparkline(getDailySparklineData('ovenUsed', 14))}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🔐 SECURITY STATUS</div>
      <div class="box">
<pre>${(data.smartLocks?.locks || []).map(lock => {
  const stateText = lock.lockState === 6 ? 'Locked ✓' : lock.lockState === 2 ? 'Unlocked' : 'Semi-locked';
  const batteryWarning = lock.batteryLevel <= 20 ? ' ⚠️ Battery: Plan replacement within 2 weeks' : '';
  return `${lock.name}:         ${stateText}  (Battery: ${lock.batteryLevel}%)
  Last Activity:    ${lock.lastActivity ? new Date(lock.lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown'}
  Connection:       ${lock.isConnected ? 'Online ✓' : 'Offline ⚠️'}${batteryWarning}`;
}).join('\n\n') || 'No locks configured'}

Today's Activity (Past 24h):
  Total Unlocks:    ${data.smartLocks?.todayUnlocks || 0} events${data.smartLocks?.activityBreakdown ? `
    • Manual:       ${data.smartLocks.activityBreakdown.unlocksBySource.manual || 0}
    • App:          ${data.smartLocks.activityBreakdown.unlocksBySource.app || 0}
    • Auto-unlock:  ${data.smartLocks.activityBreakdown.unlocksBySource.autoUnlock || 0}` : ''}

  Total Locks:      ${data.smartLocks?.todayLocks || 0} events${data.smartLocks?.activityBreakdown ? `
    • Manual:       ${data.smartLocks.activityBreakdown.locksBySource.manual || 0}
    • Auto-lock:    ${data.smartLocks.activityBreakdown.locksBySource.autoLock || 0}` : ''}${data.smartLocks?.todayLocks > 0 ? `

Security Score:     ${Math.round((data.smartLocks.activityBreakdown?.locksBySource?.autoLock || 0) / data.smartLocks.todayLocks * 100)}% auto-lock rate ${(data.smartLocks.activityBreakdown?.locksBySource?.autoLock || 0) / data.smartLocks.todayLocks >= 0.8 ? '(good practice)' : '(consider enabling auto-lock)'}` : ''}

Unusual Activity:   None detected</pre>
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
  const laundrySparkline = generateSparkline(getSparklineData('washerCycles', 12));

  // Changes
  const waterVsLast = lastWeek ? formatChangeArrow(thisWeek?.waterGallons || 0, lastWeek.waterGallons) : '';
  const waterVs4 = avg4Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg4Week.waterGallons) : '';
  const waterVs12 = avg12Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg12Week.waterGallons) : '';

  // Generate sections
  const energyCostHtml = generateWeeklyEnergyCost(data, history);
  const maintenanceForecastHtml = generateMaintenanceForecast(data, history);

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

    ${energyCostHtml}

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
vs 12-Week Avg:    ${avg12Week ? formatChangeArrow(thisWeek?.saunaSessions || 0, avg12Week.saunaSessions) : 'N/A'} ${avg12Week ? `(${avg12Week.saunaSessions.toFixed(1)} sessions)` : ''}

12-Week Trend:     <span class="sparkline">${generateSparkline(getSparklineData('saunaSessions', 12))}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🍳 OVEN</div>
      <div class="box">
<pre>This Week:         ${thisWeek?.ovenUses || 0} uses
vs Last Week:      ${lastWeek ? formatChangeArrow(thisWeek?.ovenUses || 0, lastWeek.ovenUses) : 'N/A'} ${lastWeek ? `(${lastWeek.ovenUses} uses)` : ''}
vs 4-Week Avg:     ${avg4Week ? formatChangeArrow(thisWeek?.ovenUses || 0, avg4Week.ovenUses) : 'N/A'} ${avg4Week ? `(${avg4Week.ovenUses.toFixed(1)} uses)` : ''}
vs 12-Week Avg:    ${avg12Week ? formatChangeArrow(thisWeek?.ovenUses || 0, avg12Week.ovenUses) : 'N/A'} ${avg12Week ? `(${avg12Week.ovenUses.toFixed(1)} uses)` : ''}

12-Week Trend:     <span class="sparkline">${generateSparkline(getSparklineData('ovenUses', 12))}</span></pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🔐 SMART LOCKS</div>
      <div class="box">
<pre>Locks Connected:   ${data.smartLocks?.lockCount || 0}
${(data.smartLocks?.locks || []).map(lock => `${lock.name}: ${lock.isConnected ? lock.lockState : 'Offline'}${lock.batteryLevel ? ` (${lock.batteryLevel}%)` : ''}`).join('\n') || 'No locks configured'}

This Week's Activity:
  Total Locks:     ${thisWeek?.lockEvents || data.smartLocks?.todayLocks || 0}${lastWeek?.lockEvents ? ` (vs ${lastWeek.lockEvents} last week)` : ''}
  Total Unlocks:   ${thisWeek?.unlockEvents || data.smartLocks?.todayUnlocks || 0}${lastWeek?.unlockEvents ? ` (vs ${lastWeek.unlockEvents} last week)` : ''}

12-Week Unlocks:   <span class="sparkline">${generateSparkline(getSparklineData('unlockEvents', 12))}</span></pre>
      </div>
    </div>

    ${maintenanceForecastHtml}

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

  lines.push('🔐 SMART LOCKS');
  lines.push(`   Connected: ${data.smartLocks?.lockCount || 0}`);
  lines.push(`   Today's Locks: ${data.smartLocks?.todayLocks || 0}`);
  lines.push(`   Today's Unlocks: ${data.smartLocks?.todayUnlocks || 0}`);

  if (data.errors?.length > 0) {
    lines.push('');
    lines.push('⚠️ ALERTS');
    data.errors.forEach(e => lines.push(`   - ${e}`));
  }

  return lines.join('\n');
}
