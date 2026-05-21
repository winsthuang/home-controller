---
description: Check current Rachio sprinkler controller status (zones, schedules, what's watering)
---

Use the Rachio MCP tools to give a quick overview of the sprinkler system:

1. Call `get_devices` to list all Rachio controllers and their zones/schedules.
2. For each controller, call `get_device_status` and `get_current_schedule`.

Show for each controller:
- Name and model
- Online status, on/standby, paused
- Active rain delay (if any) with hours remaining
- Currently watering zone (name + minutes left) — or "Idle"
- Zone count and any disabled zones
- Active schedule rules (name + total duration)

If no Rachio controllers are linked, say so clearly — the integration is wired up, just waiting for a device to be added in the Rachio app.

Format the output compactly and easy to scan.
