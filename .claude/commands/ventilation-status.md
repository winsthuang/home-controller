# Ventilation Status

Check the current status of the Zehnder ComfoAir Q ventilation system.

## Instructions

Use the Zehnder MCP server to get the current ventilation status:

1. Call `get_ventilation_status` to get sensor data (airflow, temperatures, humidities, filter)
2. Call `get_ventilation_mode` to get current settings (fan speed, temp profile, setpoint)

## Display Format

Show results in this format:

```
🌬️ VENTILATION STATUS

Mode:
  Fan Speed:        Medium (2)
  Temp Profile:     Comfort
  Temp Setpoint:    21.0°C
  Profile Mode:     Manual

Airflow:            268 m³/h

Temperatures:
  Supply:           17.1°C
  Extract:          19.6°C
  Outdoor:          4.5°C
  Exhaust:          8.7°C

Humidity:
  Supply:           39%
  Extract:          39%
  Outdoor:          63%
  Exhaust:          61%

Filter:             180 days remaining ✓
```

Omit room temperature, room humidity, and CO2 readings (no sensors installed).
If filter days is 0 or null, show "N/A" for filter status.

## Notes

- Temperatures from API are in °C x10 (already converted by MCP server)
- Filter warning at < 14 days, critical at < 7 days
- Fan speeds: 0=Away, 1=Low, 2=Medium, 3=High
- Temp profiles: 0=Comfort, 1=Eco, 2=Warm
- Connection goes through localhost:10502 proxy (nc relay to 192.168.4.28:502)
