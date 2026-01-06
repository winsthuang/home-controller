---
name: start-washer
description: Show washer info (use natural language to actually start)
---

Use the LG ThinQ MCP tools to help the user start the washer:

1. Call `get_device_status` for the washer (device_id: 211e423487fc7b59e4b2aa8eecd763f09365f92db4137992496a776f17cb5112)
2. Call `get_device_available_controls` with device_type "DEVICE_WASHER" and the device_id to show available programs

Show:
- Current washer status (is it ready to start?)
- Available wash programs and their parameters
- Remote control status (must be enabled to start remotely)

Note: To actually start the washer, the user should say what program they want (e.g., "start my washer on normal cycle") and you'll use `post_device_control` with the appropriate control_method and control_params.
