---
name: check-alerts
description: Quick check for any notifications or alerts
---

Use MCP tools to check for alerts across all appliances:

**Miele devices:**
1. Call `get_devices` then `get_device_status` for each
2. Check for: state.signalInfo, state.signalFailure, state.signalDoor

**LG devices:**
1. Call `get_device_list` then `get_device_status` for each
2. Check for: runState.currentState === "END" (cycle complete), or "ERROR" states

Show only items that need attention:
- ✅ Completed cycles (washer/dryer finished)
- ⚠️ Alerts or warnings
- ❌ Errors or failures
- 🚪 Door open alerts

If everything is fine, just say "All clear! No alerts or notifications."
