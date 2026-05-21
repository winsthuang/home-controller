---
description: Check current water system status (Phyn devices)
---

Use the Phyn MCP tools to check the status of all water monitoring devices:

1. Call `get_devices` to list all Phyn devices
2. For each device, call `get_device_status` with the device_id

Device IDs (for reference):
- Phyn Plus (PP2): <PHYN-PP2-ID>
- HVAC #1 (PW1): <PHYN-HVAC1-ID>
- Hot Water Heater (PW1): <PHYN-WATER-HEATER-ID>
- HVAC #2 (PW1): <PHYN-HVAC2-ID>

Show for each device:
- Device name and type
- Online status
- Current pressure (PSI)
- Temperature (if available)
- Flow rate (if available)
- Valve status (for Phyn Plus: Open/Closed)
- Signal strength

Format output with the icon and make it easy to read.
