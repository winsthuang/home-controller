---
name: start-dryer
description: Show dryer info (use natural language to actually start)
---

Use the LG ThinQ MCP tools to help the user start the dryer:

1. Call `get_device_status` for the dryer (device_id: 930ce551cecf46404810aed03560471f42cb50ab86af8378e209aab1d2a4b9a1)
2. Call `get_device_available_controls` with device_type "DEVICE_DRYER" and the device_id to show available programs

Show:
- Current dryer status (is it ready to start?)
- Available drying programs and their parameters
- Remote control status (must be enabled to start remotely)

Note: To actually start the dryer, the user should say what program they want (e.g., "start my dryer on normal") and you'll use `post_device_control` with the appropriate control_method and control_params.
