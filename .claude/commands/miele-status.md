---
name: miele-status
description: Check all Miele appliances
---

Use Miele MCP tools to check all Miele appliances:

1. Call `get_devices` to list all devices
2. For each device, call `get_device_status` with the deviceId

Expected devices:
- Oven (H7263BP)
- Refrigerator (KS 7793 D)
- Freezer (FNS 7794 E)

Show for each:
- Device name and type
- Current status (state.status, state.ProgramID if running)
- Temperatures (state.targetTemperature, state.temperature)
- Any alerts (state.signalInfo, state.signalFailure, state.signalDoor)

Format with icons (🔥 oven, ❄️ fridge, 🧊 freezer) and keep it brief.
