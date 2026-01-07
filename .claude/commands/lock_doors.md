---
name: lock_doors
description: Lock one or all smart locks (Tedee)
---

Use Tedee MCP tools to lock doors:

1. Call `sync_all_locks` to get current status of all locks
2. If multiple locks exist, show list and ask user which one(s) to lock (or "all")
3. For each lock to lock:
   - Skip if already locked
   - Call `lock_door` with the lock_id
4. Wait briefly, then call `sync_all_locks` to verify the new state

Show confirmation for each lock:
- Lock name
- Previous state -> New state
- Success/failure

Note: Lock must be in unlocked or semi-locked state to lock.
