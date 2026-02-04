# Solar & Battery Status

Check the current status of the Tesla Powerwall and Solar system.

## Instructions

Use the Tesla MCP server to get the current solar and battery status:

1. Call `get_live_status` to get real-time power flow and battery level
2. Call `get_energy_history` with period "day" to get today's energy totals

## Display Format

Show results in this format:

```
☀️ SOLAR & BATTERY STATUS

Current Power Flow:
  Solar:        X.X kW  (generating/not generating)
  Home Load:    X.X kW
  Powerwall:    X.X kW  (charging/discharging/standby)
  Grid:         X.X kW  (importing/exporting)

Battery:
  Level:        XX%
  Status:       Charging at X.X kW / Discharging at X.X kW / Standby
  Backup Reserve: XX%

Today's Energy:
  Solar Generated:  XX.X kWh  ($X.XX value)
  Grid Import:      XX.X kWh  ($X.XX cost)
  Grid Export:      XX.X kWh
  Home Consumption: XX.X kWh
  Self-Powered:     XX%

Grid Status: Connected/Disconnected
Storm Watch: Active/Inactive
```

## Notes

- Power values are in Watts from the API - convert to kW for display (divide by 1000)
- Negative grid power = exporting, Positive = importing
- Negative battery power = discharging, Positive = charging
- Solar value estimated at $0.20/kWh
- Grid cost estimated at $0.20/kWh
