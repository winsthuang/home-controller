---
name: water-heater-status
description: Check heat pump water heater status
---

Use A.O. Smith MCP tools to check the water heater status:

1. Call `get_devices` to get all water heaters
2. For each device, show its status

Display:
- Current temperature setpoint
- Operation mode (Heat Pump, Hybrid, Electric, Vacation)
- Online status
- Hot water availability status
- Any pending changes

Format with water heater icon and keep it brief but informative.
