---
name: kitchen-status
description: Check all Miele kitchen appliances
---

Use Miele MCP tools to check kitchen appliances:

1. Call `get_devices` to get all Miele devices
2. Filter for kitchen appliances (oven, refrigerator, freezer)
3. Call `get_device_status` for each with their deviceId

Show for each:
- **Oven**: On/off status, current temperature, program (if running)
- **Refrigerator**: Current temp (state.temperature[0].value_localized), target temp
- **Freezer**: Current temp, target temp, any alerts (state.signalInfo)

Format with icons (🔥 🌡️ 🧊) and keep it brief.
