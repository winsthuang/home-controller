---
name: oven-status
description: Quick check on the oven
---

Use Miele MCP tools to check the oven:

1. Call `get_devices` to find the oven (H7263BP)
2. Call `get_device_status` with the oven's deviceId

Show:
- On/off status (state.status)
- Current temperature (state.temperature[0].value_localized if available)
- Running program (state.ProgramID if any)
- Remote control status (state.remoteEnable)

Quick summary - just the key info.
