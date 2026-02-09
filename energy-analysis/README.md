# HVAC Energy Analysis

Correlates Tesla Powerwall daily energy data with weather to model heating consumption, detect anomalies (including sauna sessions), and benchmark against Passive House standards.

## Files

- `analyze-hvac.js` -- Main analysis script (ES module)
- `feb7-vs-feb8.md` -- Detailed Feb 7 vs Feb 8 morning comparison
- `data/` -- Generated at runtime (gitignored)
  - `cached-data.json` -- Raw Tesla + weather data cache
  - `report.md` -- Full markdown report
  - `structured-results.json` -- Machine-readable results

## Usage

Run from the project root:

```bash
# Full run (fetches live data from Tesla MCP + Open-Meteo)
node energy-analysis/analyze-hvac.js

# Use cached data (skips API calls, much faster)
node energy-analysis/analyze-hvac.js --cached
```

## Data Sources

- **Tesla Powerwall MCP** -- Daily and 5-minute energy data via JSON-RPC
- **Open-Meteo Archive API** -- Daily weather (temperature, wind) for Westchester County, NY
- **data/history.json** -- Cross-validates sauna days from email report history

## Analysis Pipeline

1. Collect daily energy totals from Tesla (aggregated from 5-min intervals)
2. Collect weather data from Open-Meteo
3. Classify days: normal, out-of-town, sauna
4. Detect additional sauna sessions from 5-min power signatures
5. Build temperature-vs-consumption regression model
6. Detect anomalous days (residual > 1.5 sigma)
7. Drill down into anomalies with hourly patterns
8. Benchmark against Passive House target (4.75 kBtu/ft2/year)
9. Generate markdown report and structured JSON
