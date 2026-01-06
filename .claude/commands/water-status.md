---
description: Check current water system status (Phyn devices)
---

Use the Phyn MCP tools to check the status of all water monitoring devices:

1. Call `get_devices` to list all Phyn devices
2. For each device, call `get_device_status` with the device_id

Device IDs (for reference):
- Phyn Plus (PP2): 28F53743B8D8
- HVAC #1 (PW1): 28F53746B987
- Hot Water Heater (PW1): 28F537468645
- HVAC #2 (PW1): 28F53746B9A6

Show for each device:
- Device name and type
- Online status
- Current pressure (PSI)
- Temperature (if available)
- Flow rate (if available)
- Valve status (for Phyn Plus: Open/Closed)
- Signal strength

Format output with the icon and make it easy to read.
