---
name: start-sauna
description: Show sauna info (use natural language to actually start)
---

Use the HUUM MCP tools to help the user start the sauna:

1. Call `get_sauna_status` to check current sauna state
2. Show door status (door must be closed to start safely)

Show:
- Current sauna status (is it ready to start?)
- Door state (MUST be closed before starting)
- Current temperature
- Safety reminders

Note: To actually start the sauna, the user should specify temperature (e.g., "start my sauna at 80°C") and you'll use `start_sauna` with the targetTemperature parameter (40-110°C).

**Safety reminder:** Always verify the door is closed before starting the sauna remotely.
