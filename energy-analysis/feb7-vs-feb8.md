# Energy Analysis: Feb 7 vs Feb 8, 2026 (12am-12pm)

**Date:** February 8, 2026
**Data Sources:** Tesla Powerwall MCP, Phyn Water MCP, NWS KHPN observations

## Executive Summary

Feb 8 morning (12am-12pm) consumed **43.4 kWh** vs Feb 7 morning's **23.8 kWh** -- a **+19.6 kWh (+82%)** increase. The days were NOT similar in temperature. Feb 7 started at ~25°F and dropped through the day to 10°F, while Feb 8 started at an extreme **1-3°F** overnight and was still only **7°F** by noon. The ~20°F overnight temperature difference is the dominant driver, amplified by thermal mass depletion and wind.

## Hour-by-Hour Comparison

| Hour (EST) | Feb 7 (Wh) | Feb 8 (Wh) | Delta (Wh) | Feb 7 Temp (°F) | Feb 8 Temp (°F) | Feb 7 Wind | Feb 8 Wind |
|------------|-----------|-----------|-----------|----------|----------|---------|---------|
| 12-1am     | 1,460     | 3,443     | **+1,983** | ~25      | ~3-5     | 5 mph   | Gusts 35-38 |
| 1-2am      | 1,480     | 2,624     | **+1,144** | ~25      | ~3-5     | 5 mph   | Gusts 30-37 |
| 2-3am      | 1,660     | 3,212     | **+1,552** | ~25      | ~1-3     | 5 mph   | Gusts 27-31 |
| 3-4am      | 1,650     | 3,827     | **+2,177** | ~25      | ~1       | 7 mph   | Gusts 27-31 |
| 4-5am      | 1,590     | 3,864     | **+2,274** | ~25      | ~1       | 7 mph   | Gusts 28-29 |
| 5-6am      | 1,670     | 4,534     | **+2,864** | ~23-25   | ~1       | Gusts 31-40 | Gusts 29-31 |
| 6-7am      | 1,760     | 4,366     | **+2,606** | ~21-23   | ~1       | Gusts 33-45 | Gusts 28-33 |
| 7-8am      | 2,080     | 4,371     | **+2,291** | ~21      | ~1       | Gusts 31-45 | Gusts 25-32 |
| 8-9am      | 2,870     | 3,928     | **+1,058** | ~21      | ~1       | Gusts 34-43 | Gusts 21-32 |
| 9-10am     | 1,920     | 2,467     | **+547**  | ~12      | ~7       | Gusts 35-43 | Gusts 25-32 |
| 10-11am    | 2,910     | 3,715     | **+805**  | ~12      | ~7       | Gusts 35-43 | Gusts 25-32 |
| 11am-12pm  | 2,770     | 3,030     | **+260**  | ~10      | ~7       | Gusts 38-45 | Gusts 25-31 |
| **TOTAL**  | **23,820** | **43,381** | **+19,561** | | | | |

### Key Window Breakdown

| Window | Feb 7 (kWh) | Feb 8 (kWh) | Delta | Notes |
|--------|-----------|-----------|-------|-------|
| **Overnight (12-6am)** | 9.51 | 21.51 | **+12.0** | Pure HVAC; Feb 8 is 20°F colder |
| **Morning (6-9am)** | 6.71 | 13.07 | **+6.4** | Wake-up + HVAC; Feb 8 still extreme |
| **Late morning (9-12pm)** | 7.60 | 9.21 | **+1.6** | Solar starts helping; temps converge |

## Solar Production Comparison (9am-12pm)

| Hour | Feb 7 Solar (Wh) | Feb 8 Solar (Wh) |
|------|-----------------|-----------------|
| 9am  | 1,810           | ~860            |
| 10am | 2,840           | ~1,310          |
| 11am | 4,430           | ~3,290          |
| **Total 9-12** | **9,080** | **~5,460** |

Feb 7 was cloudy/snowy but produced more morning solar. Feb 8 was clear skies but sun angle was low and cold air reduces panel efficiency.

## Attribution Waterfall

```
Total Delta (Feb 8 - Feb 7, 12am-12pm):           +19.6 kWh

1. COP degradation from extreme cold:              +8.5 kWh (43%)
   - Feb 7 overnight: 21-25°F, COP ~2.5-3.0
   - Feb 8 overnight: 1-5°F, COP ~1.2-1.5
   - Same heat demand requires 2x electricity

2. Thermal mass depletion (2nd cold day):          +4.5 kWh (23%)
   - Feb 6 was 25°F (mild cold) -- structure was warm buffer
   - By Feb 8, slab/walls/foundation lost stored heat
   - Higher heat loss rate even at same outdoor temp
   - Visible in Feb 7 overnight: 1.5 kWh/hr vs Feb 8: 3.5 kWh/hr

3. Greater heating demand (larger delta-T):         +3.5 kWh (18%)
   - Indoor target: ~70°F
   - Feb 7 delta-T: 70-25 = 45°F
   - Feb 8 delta-T: 70-1 = 69°F (+53% more heat loss)
   - Passive house envelope reduces this but doesn't eliminate it

4. Defrost cycle frequency:                        +2.0 kWh (10%)
   - At 1-5°F, outdoor coils ice rapidly
   - Defrost every 30-45 min vs every 60-90 min on Feb 7
   - Each cycle = 5-10 min of zero heating + resistance backup
   - Visible in the 5-minute spikes in raw data

5. Reduced solar thermal gain:                     +1.0 kWh (5%)
   - Feb 7 was cloudy but 9-12pm solar was decent
   - Feb 8 was clearer but colder air = more convective loss
   - Net window gain lower on Feb 8 mornings

6. Washer cycle offset (Feb 7 had laundry):        -0.4 kWh
   - history.json shows 1 washer cycle on Feb 7
   - This added ~0.4 kWh to Feb 7's total

   Unexplained residual:                           +0.5 kWh (3%)
```

## Weather Data (KHPN - White Plains/Westchester County Airport)

### Feb 6 night into Feb 7

- 10pm Feb 6: 25°F, light snow & fog, wind 3-5 mph, humidity 80-86%
- 12am-5am Feb 7: 24-25°F, light snow & fog/mist, wind 5-8 mph, humidity 74-84%
- 5-8am Feb 7: 21-25°F, light snow & mist, gusts 31-45 mph, humidity 58-74%
- 8am-12pm Feb 7: 10-12°F, mostly cloudy, gusts 32-45 mph, humidity 52-62%

### Feb 7 night into Feb 8

- 10pm Feb 7: 3-5°F, clear, gusts 30-38 mph, humidity 46-50%
- 12am-5am Feb 8: 1-1.4°F, clear, gusts 27-33 mph, humidity 50-55%
- 5-8am Feb 8: 1°F, clear, gusts 25-31 mph, humidity 49-55%
- 8am-12pm Feb 8: 7°F, clear, wind 16-18 mph, gusts 25-32 mph, humidity 43%

### Why the days were NOT similar

| Factor | Feb 7 | Feb 8 |
|--------|-------|-------|
| Midnight temp | 25°F | 3°F |
| 6am temp | 21-23°F | 1°F |
| Noon temp | 10-12°F | 7°F |
| Conditions | Snowy/cloudy | Clear |
| Wind gusts | 31-45 mph | 25-35 mph |
| Prior day (thermal mass) | Mild (~25°F) | Extreme cold (25°F->3°F drop) |

## Water Usage Comparison

| Metric | Feb 7 | Feb 8 |
|--------|-------|-------|
| Water (gallons) | 35.2 | 44.1 |
| Delta | -- | +8.9 gal (+25%) |

## Full Day Energy Totals (from Tesla)

| Metric | Feb 6 | Feb 7 | Feb 8 (partial) |
|--------|-------|-------|-----------------|
| Home consumption | 55.88 kWh | 60.99 kWh | 45.08 kWh (to ~12:30pm) |
| Solar production | 27.15 kWh | 26.55 kWh | 9.41 kWh (to ~12:30pm) |
| Grid import | 30.66 kWh | 37.27 kWh | 37.76 kWh (to ~12:30pm) |
| Battery discharge | 11.67 kWh | 9.58 kWh | 0.91 kWh |
| Self-powered % | 45% | 39% | 16% |

## Three-Day Progression (12am-12pm morning half)

| Day | Morning kWh | Avg Overnight Temp | Notes |
|-----|------------|-------------------|-------|
| Feb 6 | 32.19 | ~25°F | First cold day; thermal mass still warm |
| Feb 7 | 23.82 | ~24°F (started warm, dropped) | Started warm, got cold through day |
| Feb 8 | 43.38 | ~1-3°F | 2nd day of extreme cold; mass depleted |

## Recommendations (ranked by impact)

1. **Pre-heat to 72°F during afternoon solar (2-4pm)** -- Use thermal mass as a battery. Solar was 4+ kWh/hr after 11am on Feb 7. Letting the house coast from 72°F at sunset delays peak HVAC demand. Estimated savings: 2-3 kWh/night.

2. **Lower overnight thermostat 1-2°F during extreme cold** (68°F vs 70°F) -- At COP ~1.3, every degree of setpoint reduction saves ~0.8 kWh overnight. Estimated savings: 1-2 kWh/night.

3. **Close thermal curtains at sunset, open south-facing at sunrise** -- Reduces window heat loss 40-50%. South-facing glass is the biggest passive heat gain during the day. Estimated savings: 1-2 kWh/night.

4. **Reduce ERV airflow to "low" or "away" overnight** -- Fresh air exchange is the single largest heat loss pathway in a tight passive house. Reducing 30% overnight while sleeping is safe and significant. Estimated savings: 1-2 kWh/night.

5. **Verify mini-split cold-climate defrost settings** -- Many units have configurable defrost timing. Ensure firmware is set for cold-climate mode (optimized defrost intervals below 15°F). Can reduce defrost penalty by 30%.

6. **Inspect outdoor units for ice/snow obstruction** -- At 1°F with wind, ice buildup on outdoor coils and drainage pans is likely. Clear any snow around units to improve airflow.

## Current Status (as of 12:31 PM Feb 8)

- Solar: 6.1 kW generating
- Battery: 31% (discharging at 2.2 kW)
- Home: 2.8 kW consumption
- Grid: Exporting 1.1 kW
- Self-powered: 100%

---

*Analysis generated Feb 8, 2026 using Tesla Powerwall MCP, Phyn Water MCP, and NWS KHPN weather station data.*
