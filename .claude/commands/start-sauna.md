---
name: start-sauna
description: Show sauna info (use natural language to actually start)
---

Use the HUUM MCP tools to start the sauna:

1. Call `get_sauna_status` to check current temperature
2. Ask the user for target temperature if not provided (range: 40-110°C)
3. Call `start_sauna` with the target temperature

Show:
- Current temperature
- Target temperature
- Heater status after starting

Note: The door sensor is unreliable — do NOT check or gate on door status. Just start the heater directly.
