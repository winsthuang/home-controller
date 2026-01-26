Set refrigerator or freezer temperature.

First, call Miele `get_temperature_settings` to show current settings:
- Refrigerator (000712269805): Zone 1 (Main: 1-9°C), Zone 2 (PerfectFresh: 0-3°C)
- Freezer (000712335856): Zone 1 (-24 to -16°C)

Ask the user which device and what temperature they want.

Then call Miele `set_temperature` with:
- deviceId: The device ID
- temperature: Target temperature in Celsius
- zone: Zone number (default 1)

Confirm the change was successful.
