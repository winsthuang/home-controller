---
name: get_activity_logs
description: View recent lock activity history (Tedee)
---

Use Tedee MCP tools to view lock activity:

1. Call `get_devices` to list available locks
2. If multiple locks, show list and ask user which one (or "all")
3. For each lock, call `get_activity_log` with lock_id and count (default 20)

Show recent activity including:
- Date/time
- Event type (Lock, Unlock, Pull, etc.)
- User who performed the action
- Source (App, Button, Auto, etc.)

Also show summary:
- Total locks in period
- Total unlocks in period

Format with timestamps and user-friendly event names.
