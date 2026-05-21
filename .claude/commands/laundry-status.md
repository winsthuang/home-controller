---
name: laundry-status
description: Check the status of all washers and dryers
---

Use the LG ThinQ MCP tools to check the status of all washers and dryers:

1. Call `get_device_list` to find washer and dryer devices
2. For each laundry device, call `get_device_status` with the device_id

Device IDs (for reference):
- Washer: <LG-WASHER-ID>
- Dryer: <LG-DRYER-ID>

Show for each device:
- Current state (runState.currentState: POWER_OFF, RUNNING, END, etc.)
- Time remaining (timer.remainHour and timer.remainMinute)
- Current program/course if running
- Remote control status (remoteControlEnable.remoteControlEnabled)
- Any alerts or issues

Format the output with icons (🧺 for washer, 👕 for dryer) and make it easy to read.
