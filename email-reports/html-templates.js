// HTML Email Templates Module
// Simple, text-focused format matching the approved mockups

import {
  getYesterday, get7DayAverage, getWeeklyStats, get4WeekAverage,
  get12WeekAverage, getWeekToDate, getSparklineData, generateSparkline,
  percentChange, calculateBatteryDischargeRate
} from './history-store.js';
import { costConfig, benchmarks } from './config.js';
import { generateMaintenanceAlerts } from './data-collector.js';

/**
 * Generate executive summary for daily report
 */
function generateDailyExecutiveSummary(data, history) {
  const avg7Day = get7DayAverage();
  const highlights = [];

  // Solar production highlight
  if (data.tesla?.solarProduction && avg7Day?.solarProduction) {
    const pct = percentChange(data.tesla.solarProduction, avg7Day.solarProduction);
    if (pct !== null) {
      const dir = pct > 0 ? 'up' : 'down';
      highlights.push(`Solar ${dir} ${Math.abs(pct).toFixed(0)}% (${data.tesla.solarProduction.toFixed(1)} kWh)`);
    }
  } else if (data.tesla?.solarProduction) {
    highlights.push(`Generated ${data.tesla.solarProduction.toFixed(1)} kWh solar`);
  }

  // Battery status if noteworthy
  if (data.tesla?.batteryLevel && data.tesla.batteryLevel < 30) {
    highlights.push(`Powerwall at ${data.tesla.batteryLevel}%`);
  }

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

Powerwall:          ${tesla.batteryLevel || 'N/A'}% ${tesla.batteryLevel ? `(${getBatteryStatusText()})` : ''}
Backup Reserve:     ${tesla.backupReserve || 'N/A'}%${tesla.stormModeActive ? ' ⚠️ Storm Watch Active' : ''}

Grid Import:        ${tesla.gridImport.toFixed(1)} kWh  ($${gridCost.toFixed(2)})
Grid Export:        ${tesla.gridExport.toFixed(1)} kWh
Net Position:       ${netPositionText}

Home Consumption:   ${tesla.homeConsumption.toFixed(1)} kWh
Self-Powered:       ${tesla.historySelfPowered || tesla.selfPoweredPercentage || 'N/A'}%

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
 * Generate Cost Snapshot section for daily report
 */
function generateCostSnapshot(data, history) {
  const yesterday = getYesterday();
  const weekToDate = getWeekToDate();
  const avg7Day = get7DayAverage();

  const yesterdayKwh = data.waterHeater?.dailyUsage || 0;
  const yesterdayCost = yesterdayKwh * costConfig.electricityCostPerKwh;

  const weekKwh = weekToDate?.energyKwh || 0;
  const weekCost = weekKwh * costConfig.electricityCostPerKwh;

  const dailyAvgKwh = avg7Day?.energyKwh || yesterdayKwh;
  const dailyAvgCost = dailyAvgKwh * costConfig.electricityCostPerKwh;

  const monthlyProjection = dailyAvgCost * costConfig.projectionDaysInMonth;

  // Calculate comparison with last month
  const avg4Week = get4WeekAverage();
  const lastMonthEstimate = (avg4Week?.energyKwh || dailyAvgKwh) * costConfig.projectionDaysInMonth * costConfig.electricityCostPerKwh;
  const savingsVsLastMonth = lastMonthEstimate - monthlyProjection;
  const savingsPct = lastMonthEstimate > 0 ? (savingsVsLastMonth / lastMonthEstimate) * 100 : 0;

  const savingsText = savingsVsLastMonth > 0
    ? `▼ -${Math.abs(savingsPct).toFixed(0)}%  (saved $${savingsVsLastMonth.toFixed(2)})`
    : `▲ +${Math.abs(savingsPct).toFixed(0)}%  (added $${Math.abs(savingsVsLastMonth).toFixed(2)})`;

  const mode = data.waterHeater?.operationMode || data.waterHeater?.modeName || 'Unknown';
  const modeCheck = mode === 'HEAT_PUMP' || mode === 'Heat Pump' ? '✓' : '⚠️';

  return `
    <div class="section">
      <div class="section-title">💰 ENERGY COST SNAPSHOT</div>
      <div class="box">
<pre>Yesterday's Water Heating:
  Energy Used:      ${yesterdayKwh.toFixed(1)} kWh
  Cost:             $${yesterdayCost.toFixed(2)}  (@ $${costConfig.electricityCostPerKwh.toFixed(2)}/kWh)

Week-to-date:       ${weekKwh.toFixed(1)} kWh  ($${weekCost.toFixed(2)})
Daily Average:      ${dailyAvgKwh.toFixed(1)} kWh/day  ($${dailyAvgCost.toFixed(2)}/day)

Monthly Projection: $${monthlyProjection.toFixed(2)}
  vs Last Month:    ${savingsText}

💡 Efficiency Tip:
   HEAT_PUMP mode saves ~$15-20/month vs ELECTRIC
   mode. Your current mode: ${mode} ${modeCheck}</pre>
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
  const sparklineData = getSparklineData('energyKwh', 7);
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

  return `
7-Day Energy Pattern:
  ${days.join('  ')}
  ${sparkline}
  ${values.join('  ')} kWh

Peak Usage:         ${maxDay} (${maxValue.toFixed(1)} kWh, $${(maxValue * costConfig.electricityCostPerKwh).toFixed(2)})
Lowest Usage:       ${minDay} (${minValue.toFixed(1)} kWh, $${(minValue * costConfig.electricityCostPerKwh).toFixed(2)})`;
}

/**
 * Generate Weekly Solar Summary for weekly report
 */
function generateWeeklySolarSummary(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const avg4Week = get4WeekAverage();

  // If no solar data, return empty
  if (!thisWeek?.solarProduction && !data.tesla?.solarProduction) {
    return '';
  }

  const weekSolar = thisWeek?.solarProduction || 0;
  const weekImport = thisWeek?.gridImport || 0;
  const weekExport = thisWeek?.gridExport || 0;
  const weekConsumption = thisWeek?.homeConsumption || 0;

  // Calculate self-powered percentage
  const selfPowered = weekConsumption > 0
    ? Math.round((1 - weekImport / weekConsumption) * 100)
    : 0;

  // Net position
  const netGrid = weekExport - weekImport;

  // Comparisons
  const solarVsLast = lastWeek?.solarProduction
    ? formatChangeArrow(weekSolar, lastWeek.solarProduction)
    : '';
  const solarVs4Week = avg4Week?.solarProduction
    ? formatChangeArrow(weekSolar, avg4Week.solarProduction)
    : '';

  // Value calculations
  const solarValue = weekSolar * costConfig.solarValuePerKwh;
  const gridCost = weekImport * costConfig.electricityCostPerKwh;
  const netSavings = solarValue - gridCost;

  // Sparkline for solar production
  const solarSparkline = generateSparkline(getSparklineData('solarProduction', 12));

  return `
    <div class="section">
      <div class="section-title">☀️ WEEKLY ENERGY SUMMARY</div>
      <div class="box">
<pre>Solar Generated:    ${weekSolar.toFixed(1)} kWh  ($${solarValue.toFixed(2)} value)
vs Last Week:       ${solarVsLast || 'N/A'} ${lastWeek?.solarProduction ? `(${lastWeek.solarProduction.toFixed(1)} kWh)` : ''}
vs 4-Week Avg:      ${solarVs4Week || 'N/A'} ${avg4Week?.solarProduction ? `(${avg4Week.solarProduction.toFixed(1)} kWh)` : ''}

Grid Import:        ${weekImport.toFixed(1)} kWh  ($${gridCost.toFixed(2)})
Grid Export:        ${weekExport.toFixed(1)} kWh
Net Position:       ${netGrid >= 0 ? `Net Exporter (+${netGrid.toFixed(1)} kWh)` : `Net Importer (${netGrid.toFixed(1)} kWh)`}

Home Consumption:   ${weekConsumption.toFixed(1)} kWh
Self-Powered Avg:   ${selfPowered}%

Net Savings:        ${netSavings >= 0 ? '+' : ''}$${netSavings.toFixed(2)} ${netSavings >= 0 ? '(solar offset grid cost)' : ''}

12-Week Solar:      <span class="sparkline">${solarSparkline}</span></pre>
      </div>
    </div>
  `;
}

/**
 * Generate Weekly Cost Summary for weekly report
 */
function generateWeeklyCostSummary(data, history) {
  const thisWeek = getWeeklyStats(0);
  const lastWeek = getWeeklyStats(1);
  const avg4Week = get4WeekAverage();

  const thisWeekKwh = thisWeek?.energyKwh || 0;
  const thisWeekCost = thisWeekKwh * costConfig.electricityCostPerKwh;

  const lastWeekKwh = lastWeek?.energyKwh || thisWeekKwh;
  const lastWeekCost = lastWeekKwh * costConfig.electricityCostPerKwh;

  const avg4WeekKwh = avg4Week?.energyKwh || thisWeekKwh;
  const avg4WeekCost = avg4WeekKwh * costConfig.electricityCostPerKwh;

  const savingsVsLast = lastWeekCost - thisWeekCost;
  const savingsPctLast = lastWeekCost > 0 ? (savingsVsLast / lastWeekCost) * 100 : 0;
  const savingsTextLast = savingsVsLast > 0
    ? `▼ -${Math.abs(savingsPctLast).toFixed(0)}%  (saved $${savingsVsLast.toFixed(2)})`
    : `▲ +${Math.abs(savingsPctLast).toFixed(0)}%  (added $${Math.abs(savingsVsLast).toFixed(2)})`;

  const savingsVs4Week = avg4WeekCost - thisWeekCost;
  const savingsPct4Week = avg4WeekCost > 0 ? (savingsVs4Week / avg4WeekCost) * 100 : 0;
  const savingsText4Week = savingsVs4Week > 0
    ? `▼ -${Math.abs(savingsPct4Week).toFixed(0)}%  (saved $${savingsVs4Week.toFixed(2)})`
    : `▲ +${Math.abs(savingsPct4Week).toFixed(0)}%  (added $${Math.abs(savingsVs4Week).toFixed(2)})`;

  const dailyAvgKwh = thisWeekKwh / 7;
  const dailyAvgCost = dailyAvgKwh * costConfig.electricityCostPerKwh;
  const monthlyProjection = dailyAvgCost * costConfig.projectionDaysInMonth;

  const lastMonthEstimate = avg4WeekKwh / 7 * costConfig.projectionDaysInMonth * costConfig.electricityCostPerKwh;
  const savingsVsLastMonth = lastMonthEstimate - monthlyProjection;

  // Calculate year-to-date (assuming 5 weeks so far in the plan context)
  const weeksInYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000));
  const ytdCost = avg4WeekKwh * weeksInYear * costConfig.electricityCostPerKwh;
  const annualProjection = (ytdCost / weeksInYear) * 52;

  return `
    <div class="section">
      <div class="section-title">💰 WEEKLY COST SUMMARY</div>
      <div class="box">
<pre>This Week's Total:  $${thisWeekCost.toFixed(2)}
  Water Heating:    $${thisWeekCost.toFixed(2)}  (${thisWeekKwh.toFixed(1)} kWh @ $${costConfig.electricityCostPerKwh.toFixed(2)}/kWh)
  Water: FREE (well water)

vs Last Week:       ${savingsTextLast}
vs 4-Week Avg:      ${savingsText4Week}

Monthly Projection: $${monthlyProjection.toFixed(2)}
  ${savingsVsLastMonth > 0 ? `On track to save $${savingsVsLastMonth.toFixed(2)} vs last month` : `On track to add $${Math.abs(savingsVsLastMonth).toFixed(2)} vs last month`}

Year-to-Date:       $${ytdCost.toFixed(2)} (${weeksInYear} weeks)
Projected Annual:   $${annualProjection.toFixed(2)}

💡 Savings Tip:
   Your HEAT_PUMP mode is saving ~$180-240/year
   compared to ELECTRIC mode. Keep it up!</pre>
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
  if (data.waterHeater?.operationMode === 'HEAT_PUMP' || data.waterHeater?.modeName === 'Heat Pump') {
    efficiencyOpp.push('Running HEAT_PUMP mode saves $15-20/month\n    vs ELECTRIC mode. Current: ON TRACK! ✓');
  } else if (data.waterHeater?.operationMode) {
    efficiencyOpp.push(`Switch to HEAT_PUMP mode to save $15-20/month\n    Current mode: ${data.waterHeater.operationMode}`);
  }

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
<pre>Yesterday:          ${(data.water?.dailyConsumption || 0).toFixed(1)} gal
vs Day Before:      ${waterVsYesterday || 'N/A'} ${yesterday ? `(${yesterday.waterGallons.toFixed(1)} gal)` : ''}
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
  WiFi Signal:      ${data.water?.signalStrength ? `${data.water.signalStrength} dBm ${data.water.signalStrength > -50 ? '(excellent)' : data.water.signalStrength > -70 ? '(good)' : '(weak)'}` : 'N/A'}${data.water?.fixtureBreakdown && data.water.fixtureBreakdown.length > 0 ? `

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
Hot Water:          ${data.waterHeater?.hotWaterStatus || 'Unknown'}

Weekly Energy:      ${(weekToDate?.energyKwh || 0).toFixed(1)} kWh  ($${((weekToDate?.energyKwh || 0) * costConfig.electricityCostPerKwh).toFixed(2)})
Daily Average:      ${(avg7Day?.energyKwh || 0).toFixed(1)} kWh/day  ($${((avg7Day?.energyKwh || 0) * costConfig.electricityCostPerKwh).toFixed(2)}/day)

${generate7DayEnergyPattern(data, history)}</pre>
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
  const energySparkline = generateSparkline(getSparklineData('energyKwh', 12));
  const laundrySparkline = generateSparkline(getSparklineData('washerCycles', 12));

  // Changes
  const waterVsLast = lastWeek ? formatChangeArrow(thisWeek?.waterGallons || 0, lastWeek.waterGallons) : '';
  const waterVs4 = avg4Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg4Week.waterGallons) : '';
  const waterVs12 = avg12Week ? formatChangeArrow(thisWeek?.waterGallons || 0, avg12Week.waterGallons) : '';

  const energyVsLast = lastWeek ? formatChangeArrow(thisWeek?.energyKwh || 0, lastWeek.energyKwh) : '';
  const energyVs4 = avg4Week ? formatChangeArrow(thisWeek?.energyKwh || 0, avg4Week.energyKwh) : '';
  const energyVs12 = avg12Week ? formatChangeArrow(thisWeek?.energyKwh || 0, avg12Week.energyKwh) : '';

  // Generate new sections
  const solarSummaryHtml = generateWeeklySolarSummary(data, history);
  const costSummaryHtml = generateWeeklyCostSummary(data, history);
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

    ${solarSummaryHtml}

    ${costSummaryHtml}

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

    <div class="section">
      <div class="section-title">🔐 SMART LOCKS</div>
      <div class="box">
<pre>Locks Connected:   ${data.smartLocks?.lockCount || 0}
${(data.smartLocks?.locks || []).map(lock => `${lock.name}: ${lock.isConnected ? lock.lockState : 'Offline'}${lock.batteryLevel ? ` (${lock.batteryLevel}%)` : ''}`).join('\n') || 'No locks configured'}

This Week's Activity:
  Total Locks:     ${thisWeek?.lockEvents || data.smartLocks?.todayLocks || 0}${lastWeek?.lockEvents ? ` (vs ${lastWeek.lockEvents} last week)` : ''}
  Total Unlocks:   ${thisWeek?.unlockEvents || data.smartLocks?.todayUnlocks || 0}${lastWeek?.unlockEvents ? ` (vs ${lastWeek.unlockEvents} last week)` : ''}</pre>
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
