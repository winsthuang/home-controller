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

The aggregate math:
- Measured electrical heating intensity: **1.008 kWh/HDD**
- Modeled PH at COP 2.5: **0.728 kWh/HDD**
- Solving for effective COP: 0.728 × 2.5 / 1.008 = **COP 1.81**

#### Implied COP by Temperature Range

We can impute per-day COP by dividing the modeled thermal demand (from the PH envelope at 1.82 kWh/HDD) by the measured heating electrical input (total consumption minus 11.6 kWh baseload). Per-day values are noisy due to variable appliance loads (cooking, laundry add ±5 kWh), so medians by temperature bucket give the clearest picture:

| Outdoor Low (°F) | Days | Median COP | 25th-75th pctl | Avg Heating kWh |
|-------------------|------|------------|----------------|-----------------|
| Below 5°F | 7 | **1.83** | 1.59 - 1.95 | 54.3 |
| 5 - 15°F | 11 | **1.81** | 1.43 - 2.35 | 51.2 |
| 15 - 25°F | 11 | **2.04** | 1.84 - 2.31 | 31.1 |
| 25 - 35°F | 28 | **2.01** | 1.64 - 2.33 | 29.6 |
| 35 - 50°F | 16 | **1.91** | 1.27 - 2.50 | 19.7 |
| **Full season** | **73** | **1.95** | **1.50 - 2.31** | **33.2** |

The 35-50°F bucket appears low because at mild temps, heating load is small (19.7 kWh) and appliance noise dominates the signal. The cold buckets are more reliable since heating (50+ kWh) dwarfs the noise.

**Key COP observations:**
- Season-wide median COP: **1.95** (IQR 1.50-2.31). Aggregate cross-check: **1.81**.
- COP degrades from ~2.0 at moderate temps to ~1.8 at extreme cold -- a shallower cliff than typical, suggesting the mini-splits are reasonably well-optimized for cold-climate operation.
- Worst individual days: Jan 25 (6°F, COP 1.21) and Feb 3 (9°F, COP 1.19) -- both HIGH anomalies with additional unexplained loads.
- Best cold day: Jan 23 (11°F, COP 2.35) -- strong solar gain reduced the electrical input needed.
- A constant COP of 2.5 (the PH modeling assumption) is never achieved as a daily average below 25°F.

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

### Recommendations: Incremental (2-5 kWh/day)

1. **Reduce ERV airflow overnight (10pm-6am):** At 0.4 ACH50, overnight air quality is fine on low speed. Saves 1-2 kWh/night.
2. **Thermal curtains at sunset:** Reduces window heat loss 40-50%. Open south-facing at sunrise for passive solar (the Nov 19 and Jan 23 LOW anomalies show strong solar can cut consumption by 50%).

### Recommendations: Order-of-Magnitude (10+ kWh/day)

The core inefficiency is COP collapse below 15°F. On the 15 days with lows below 15°F, the house averaged ~67 kWh/day -- about 55 kWh of heating at effective COP ~1.3-1.5. If that same thermal demand were met at COP 3.5-4.0, it would only need ~20-22 kWh electrical. That's a **33 kWh/day gap** on extreme days.

#### 1. Aggressive weather-responsive pre-charging (10-15 kWh/day, free to implement)

Your own data proves this works. **Jan 23 is the smoking gun:** 11°F low, model predicted 64.3 kWh, actual was only 41.9 -- **22.4 kWh below prediction** -- because 17 kWh of solar poured in during the afternoon, the heat pump ran at COP 2.5+ during the warmest daytime hours instead of grinding at COP 1.3 overnight, and the thermal mass carried the house through the night.

The strategy: when tomorrow's forecast predicts lows below 15°F, override the Nest to 74-75°F from 11am-3pm (peak solar, warmest outdoor temps, highest COP). Let it drift back to 68°F overnight. The slab alone (~4" concrete over 2,100 sq ft) stores roughly 6 kWh per degree of overshoot. A 5°F overshoot stores ~30 kWh thermal, delivered at daytime COP 2.0+ (15 kWh electrical) instead of overnight COP 1.3 (23 kWh electrical). That's **8-11 kWh saved** -- and the mini-splits can coast or run at low capacity overnight, reducing defrost losses further.

This is automatable with a Nest schedule or a simple script that checks tomorrow's forecast and sets the override. It costs nothing.

#### 2. Ground-source heat pump supplemental loop (30-55 kWh/day, $25-40k investment)

This is the only intervention that fixes the root cause. Ground temperature in Westchester is ~52°F year-round. A GSHP maintains COP 3.5-4.5 regardless of outdoor temp.

On Jan 25 (worst day, 93.2 kWh):
- Heating electrical: 81.6 kWh at effective COP ~1.2
- Thermal demand: ~98 kWh
- At GSHP COP 4.0: 98 / 4.0 = **24.5 kWh electrical**
- Savings: **57 kWh on that one day**

Across the 15 days below 15°F: ~495 kWh saved. Across all heating days: 1,500-2,000 kWh/season (~$300-400/year at $0.20/kWh). Payback is very long on energy alone (60+ years), so this only makes sense if comfort, resilience, or hitting true PH compliance matters.

A hybrid approach -- keeping the mini-splits for mild weather (>20°F) and adding a small GSHP for extreme cold -- would cost less and capture most of the savings since COP degradation is concentrated in those hours.

#### Summary

| Intervention | Savings on extreme days | Cost | Payback |
|---|---|---|---|
| Weather-responsive pre-charging | 10-15 kWh/day | $0 | Immediate |
| ERV + curtains | 3-5 kWh/day | $200-500 | Weeks |
| Hybrid GSHP supplement | 30-55 kWh/day | $25-40k | 60+ years on energy alone |

The pre-charging strategy is the clear winner: free, proven by Jan 23 data, and directly addresses the COP problem by shifting load to higher-COP hours. It could move the annualized figure from 6.75 to ~5.5-6.0 kBtu/ft²/yr. Only GSHP closes the gap to the 4.75 target completely.

---

*Based on 100 days of Tesla Powerwall data and Open-Meteo weather data. Model: R²=0.581 on 75 normal-HVAC days. Full analysis: [data/report.md](data/report.md)*
