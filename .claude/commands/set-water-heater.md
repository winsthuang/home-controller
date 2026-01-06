---
name: set-water-heater
description: Control heat pump water heater settings
---

Interactive water heater control using A.O. Smith MCP tools.

First, call `get_devices` to find the water heater and its current settings.

Then ask the user what they want to do:
1. Set temperature (95-140°F)
2. Change mode:
   - HEAT_PUMP - Most energy efficient, slowest recovery
   - HYBRID - Balanced efficiency and recovery
   - ELECTRIC - Fastest recovery, highest energy use
   - VACATION - Minimal energy use when away

Use the appropriate tool:
- `set_temperature` for temperature changes
- `set_mode` for mode changes

Confirm the action was successful and show the new status.
