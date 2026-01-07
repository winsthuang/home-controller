---
name: get_device_status
description: Check smart lock status (Tedee)
---

Use Tedee MCP tools to check the status of all smart locks:

1. Call `sync_all_locks` to get current status of all locks

Show for each lock:
- Lock name
- Lock state (Locked/Unlocked/Semi-locked)
- Door state (Open/Closed)
- Battery level and charging status
- Connection status (Online/Offline)
- Last state change time

Format output with the lock icon and make it easy to read.
