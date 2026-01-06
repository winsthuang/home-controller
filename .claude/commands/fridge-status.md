---
name: fridge-status
description: Check refrigerator and freezer temperatures
---

Use Miele MCP tools to check fridge and freezer:

1. Call `get_devices` to find refrigerator and freezer
2. Call `get_device_status` for each device

Show:
- **Refrigerator**: Current temp (state.temperature[0].value_localized), target temp (state.targetTemperature[0].value_localized)
- **Freezer**: Current temp, target temp, any alerts (state.signalInfo)

Keep it quick - just temps and any issues.
