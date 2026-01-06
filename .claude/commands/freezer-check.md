---
name: freezer-check
description: Quick freezer check (especially for alerts)
---

Use Miele MCP tools for a quick freezer check:

1. Call `get_devices` to find the freezer (FNS 7794 E)
2. Call `get_device_status` with the freezer's deviceId

Check:
- Current temperature (state.temperature[0].value_localized)
- Alerts or notifications (state.signalInfo, state.signalFailure)
- Door status (state.signalDoor if available)

Quick summary: Either "All good!" or what needs attention.
