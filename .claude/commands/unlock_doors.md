---
name: unlock_doors
description: Unlock one or all smart locks (Tedee)
---

Use Tedee MCP tools to unlock doors:

1. Call `sync_all_locks` to get current status of all locks
2. If multiple locks exist, show list and ask user which one(s) to unlock (or "all")
3. For each lock to unlock:
   - Skip if already unlocked
   - Call `unlock_door` with the lock_id
4. Wait briefly, then call `sync_all_locks` to verify the new state

Show confirmation for each lock:
- Lock name
- Previous state -> New state
- Success/failure

Security reminder: Only unlock doors when you are certain it is safe to do so.
