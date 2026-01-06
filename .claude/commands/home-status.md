---
description: Quick status of all appliances
---

Use MCP tools to get a complete status of all appliances:

**Miele devices:**
1. Call `get_devices` to list all Miele devices
2. For each device, call `get_device_status` with the deviceId

**LG ThinQ devices:**
1. Call `get_device_list` to list all LG devices
2. For each device, call `get_device_status` with the device_id

**HUUM Sauna:**
1. Call `get_sauna_status` to get current sauna status

**Phyn Water Monitor:**
1. Call `get_devices` to list all Phyn devices
2. Call `get_device_status` for the Phyn Plus (device_id: 28F53743B8D8)

Show for each device:
- Device name and type
- Current status (on/off, running, idle, etc.)
- Important info: temperatures for kitchen appliances, time remaining for washer/dryer, pressure/flow for water
- Any alerts or notifications

Format: Use appropriate icons and keep it concise - just key info:
- 🔥 Oven
- ❄️ Fridge/Freezer
- 🧺 Washer
- 👕 Dryer
- 🧖 Sauna
- 💧 Water Monitor
