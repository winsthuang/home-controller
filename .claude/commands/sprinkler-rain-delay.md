---
description: Set or clear a Rachio rain delay (pauses all schedules)
---

Use the Rachio MCP tools to set or clear a rain delay:

1. Call `get_devices` to find the controller `device_id`.
2. If the user said "for N hours/days", convert to seconds and call `set_rain_delay` with `duration_seconds`.
3. If the user said "cancel" or "clear", call `set_rain_delay` with `duration_seconds: 0`.
4. Maximum delay is 604800 seconds (7 days).

Confirm what was applied (or "rain delay cleared"), and mention when schedules will resume.
