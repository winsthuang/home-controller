---
description: Get water consumption report (daily/weekly/monthly)
---

Use the Phyn MCP tools to generate a water consumption report:

1. Call `get_devices` to list all Phyn devices
2. For the Phyn Plus device (28F53743B8D8), call `get_consumption` with duration parameter

Duration formats:
- Daily: YYYY/MM/DD (e.g., 2026/01/05)
- Monthly: YYYY/MM (e.g., 2026/01)
- Yearly: YYYY (e.g., 2026)

Default to current month if no duration specified by user.

Show in the report:
- Total water consumption (gallons)
- Period covered
- Daily average (if monthly/yearly)
- Fixture breakdown (if available in details)
- Comparison to previous period (if available)

Format output clearly with totals and breakdowns. Include tips for water conservation if usage seems high.
