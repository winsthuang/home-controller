---
name: laundry-status
description: Check the status of all washers and dryers
---

Use the LG ThinQ MCP tools to check the status of all washers and dryers:

1. Call `get_device_list` to find washer and dryer devices
2. For each laundry device, call `get_device_status` with the device_id

Device IDs (for reference):
- Washer: 211e423487fc7b59e4b2aa8eecd763f09365f92db4137992496a776f17cb5112
- Dryer: 930ce551cecf46404810aed03560471f42cb50ab86af8378e209aab1d2a4b9a1

Show for each device:
- Current state (runState.currentState: POWER_OFF, RUNNING, END, etc.)
- Time remaining (timer.remainHour and timer.remainMinute)
- Current program/course if running
- Remote control status (remoteControlEnable.remoteControlEnabled)
- Any alerts or issues

Format the output with icons (🧺 for washer, 👕 for dryer) and make it easy to read.
