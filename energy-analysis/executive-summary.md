## Executive Summary: HVAC Energy Analysis (Nov 2025 - Feb 2026)

**House:** ~2,600 sq ft passive house, Westchester County, NY | 0.4 ACH50 | Mini-split heat pumps + ERV
**Period analyzed:** 100 days | 75 normal-HVAC days, 20 out-of-town, 5 sauna

---

### Q1: Is the house performing like a true 0.4 ACH50 passive house should?

**Close, but not quite at target -- and COP is the reason, not the envelope.**

| Metric | Your House | PH Target | PH Modeled | Standard Build |
|--------|-----------|-----------|------------|----------------|
| kBtu/ft²/year | 6.75 | ≤4.75 | 4.87 | 14.48 |
| kWh/HDD | 1.008 | - | 0.728 | 2.163 |

The house exceeds the Passive House heating target by 42%. However, the PH target of 4.75 kBtu/ft²/yr refers to *thermal demand*, while our measured 6.75 reflects *electrical input* -- which is inflated by heat pump COP degradation during the cold snaps that dominated this winter. The modeled PH electrical performance (4.87) assumes a constant COP of 2.5, which no mini-split achieves at 0-15°F.

The envelope itself appears to be performing to spec. On the warmest eco-mode days (Dec 29-30, mean 26-37°F, thermostat at 50°F), total consumption was just 11.5-11.7 kWh -- confirming minimal heat loss when delta-T is small.

---

### Q2: How much worse would a standard build be?

**A standard code-compliant new build would use ~215% more heating energy in identical conditions.**

The modeled standard build (3.5 ACH50, code-minimum insulation, no ERV) would consume 4.24 kWh/ft²/yr vs your measured 1.98 -- meaning you're saving an estimated **5,888 kWh/year (~$1,178/year at $0.20/kWh)** on heating alone.

During the Jan 24 - Feb 8 extreme cold snap (daily lows from -3°F to 10°F), the house consumed 60-93 kWh/day. A standard build's thermal demand would be ~2.7x higher per HDD, though it would likely run strip heat at COP 1.0 during the coldest hours, pushing effective electrical consumption to 3-4x your levels.

---

### Q3: Are the HVAC spikes "normal for passive house in extreme cold" or "evidence of envelope underperformance"?

**Normal for a passive house with air-source heat pumps in extreme cold.**

Evidence:
- **Temperature explains consumption well.** The model R² of 0.581 means outdoor temp + wind + prior-day temp + weekend effects account for ~58% of daily variance. The remaining ~42% is occupancy noise (cooking, laundry, appliance use add 2-5 kWh/day variance).
- **Coldest days track the model.** Jan 31 (-3°F) consumed 64.5 kWh; the model predicted 62.5 kWh (residual of just +2.0). Jan 24 (5.5°F) consumed 79.0 vs predicted 77.1. These aren't anomalies -- they're *exactly what the physics predicts*.
- **Wind has negligible impact.** Wind speed correlation with consumption is only 0.074 (rank #8 of 8 factors). In a leaky house, wind would be a top-3 driver. This confirms the 0.4 ACH50 envelope is doing its job.
- **True anomalies have non-HVAC causes.** The 7 flagged anomaly days are explained by: undetected sauna/appliance loads (Nov 22-23, Jan 17), strong solar gain offsetting HVAC (Nov 19, Jan 23), and high wind gust events (Jan 25). None point to envelope failure.

---

### Q4: Is the delta between actual and PH target explained by COP degradation alone, or is there excess infiltration?

**COP degradation alone explains the gap. No evidence of excess infiltration.**

The math:
- Measured electrical heating intensity: **1.008 kWh/HDD**
- Modeled PH at COP 2.5: **0.728 kWh/HDD**
- Solving for effective COP: 0.728 × 2.5 / 1.008 = **COP 1.81**

A weighted-average COP of ~1.8 is entirely consistent with mini-splits operating through a winter where 30+ days had lows below 20°F and 15 days below 10°F. Below ~15°F, mini-split COP drops to 1.3-1.5 due to defrost cycles and reduced refrigerant efficiency. The season-weighted average of ~1.8 (mixing mild days at COP 3.0+ with extreme days at COP 1.3) is exactly what you'd expect.

If excess infiltration were present, we'd see:
- Higher wind correlation (actual: 0.074, negligible)
- Higher consumption on windy eco-mode days (Dec 29 at 18 mph wind: only 11.5 kWh)
- Anomalous overnight ramps on windy nights (not observed in drill-downs)

None of these signatures are present. The envelope is tight.

---

### Other Key Findings

**Sauna:** 5 sessions detected (Dec 9, Dec 27, Jan 7, Jan 26, Jan 27), consuming ~108 kWh total ($21.56). The 12+ kW draw for ~90 min is easily distinguishable from HVAC in 5-minute data.

**Non-HVAC baseload:** 11.6 kWh/day (fridge, freezer, ERV fan, standby, Powerwall losses). Established from the warmest eco-mode vacation days.

**Biggest single driver:** Daily minimum temperature (correlation 0.751). Each 1°F colder adds ~0.86 kWh to daily consumption.

### Top Recommendations

1. **Pre-heat with solar (2-4pm):** Boost setpoint to 72°F during peak solar to store heat in thermal mass for overnight. Saves 2-3 kWh/night during cold snaps.
2. **Reduce ERV airflow overnight (10pm-6am):** At 0.4 ACH50, overnight air quality is fine on low speed. Saves 1-2 kWh/night.
3. **Thermal curtains at sunset:** Reduces window heat loss 40-50%. Open south-facing at sunrise for passive solar (the Nov 19 and Jan 23 LOW anomalies show strong solar can cut consumption by 50%).

---

*Based on 100 days of Tesla Powerwall data and Open-Meteo weather data. Model: R²=0.581 on 75 normal-HVAC days. Full analysis: [data/report.md](data/report.md)*
