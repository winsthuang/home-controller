---
description: Manually water a Rachio sprinkler zone for N minutes
---

Use the Rachio MCP tools to start watering a single zone:

1. If the user did not name a zone, call `get_devices` first and present available zones by name + zone number, then ask which one and for how long.
2. Once you have the `zone_id` and minutes (1–180), call `start_zone`.
3. Confirm by calling `get_current_schedule` for the controller and reporting what's running.

If something is already watering, mention it before starting a new zone.
