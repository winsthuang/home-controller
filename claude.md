# Home Controller - Claude Code Quick Reference

> This file provides quick context for Claude Code to efficiently work with this project.

## Project Overview

This is a smart home automation system that integrates **Miele**, **LG ThinQ**, **HUUM Sauna**, and **Phyn Water Monitor** appliances through MCP (Model Context Protocol) servers. Users can check status and control appliances using natural language or slash commands.

## MCP Servers

Four MCP servers are configured in `.mcp.json`:

### 1. Miele MCP Server
- **Command:** `./miele-mcp-wrapper.sh` → `node index.js`
- **Server Name:** `miele-home-controller` v1.0.0
- **Tools:**
  - `get_devices` - Get all Miele devices
  - `get_device_status` - Get device status by deviceId
  - `device_action` - Control device (start, stop, pause, powerOn, powerOff)

### 2. LG ThinQ MCP Server
- **Command:** `./lg-thinq-mcp-wrapper.sh` → `~/.local/bin/thinqconnect-mcp`
- **Server Name:** `thinqconnect-mcp` v1.12.3
- **Tools:**
  - `get_device_list` - Get all LG devices
  - `get_device_status` - Get device status by device_id
  - `get_device_available_controls` - Get available controls for a device
  - `post_device_control` - Send control commands to device

### 3. HUUM Sauna MCP Server
- **Command:** `./huum-mcp-wrapper.sh` → `node huum-mcp-server.js`
- **Server Name:** `huum-sauna-controller` v1.0.0
- **Tools:**
  - `get_sauna_status` - Get current sauna status (temp, door, heater)
  - `start_sauna` - Start sauna with target temperature (40-110°C)
  - `stop_sauna` - Stop/turn off the sauna
  - `toggle_light` - Toggle sauna light on/off

### 4. Phyn Water Monitor MCP Server
- **Command:** `./phyn-mcp-wrapper.sh` → `node phyn-mcp-server.js`
- **Server Name:** `phyn-water-controller` v1.0.0
- **Tools:**
  - `get_devices` - Get all Phyn devices (Phyn Plus + Smart Water Sensors)
  - `get_device_status` - Get device status (pressure, flow, temperature)
  - `get_consumption` - Get historical water usage (daily/monthly/yearly)
  - `shutoff_valve` - Open/close water shutoff valve (Phyn Plus only)

## How to Query MCP Servers

**IMPORTANT:** MCP servers use JSON-RPC over stdio, NOT CLI arguments.

```bash
# WRONG - This will fail:
~/.local/bin/thinqconnect-mcp get_device_status --device_id "..."

# RIGHT - Use the test scripts:
node test-lg-dryer.cjs      # LG washer/dryer status
node test-miele-mcp.cjs     # Miele appliances status
node test-huum-sauna.cjs    # HUUM sauna status
node test-phyn-mcp.cjs      # Phyn water monitor status
```

The test scripts implement proper JSON-RPC protocol and output device status. Use these for quick status checks instead of trying to call MCP binaries directly.

## Connected Devices

### LG ThinQ Devices
| Device | ID | Model | Type |
|--------|----|----|------|
| Washer | `211e423487fc7b59e4b2aa8eecd763f09365f92db4137992496a776f17cb5112` | FAFXU22027 | DEVICE_WASHER |
| Dryer | `930ce551cecf46404810aed03560471f42cb50ab86af8378e209aab1d2a4b9a1` | BDH_D30007_US | DEVICE_DRYER |

**Status Fields (LG):**
- `runState.currentState` - POWER_OFF, RUNNING, END, etc.
- `timer.remainHour` / `timer.remainMinute` - Time remaining
- `remoteControlEnable.remoteControlEnabled` - Remote control status

### Miele Devices
| Device | ID | Model | Type |
|--------|----|----|------|
| Oven | `000192190778` | H7263BP | Oven |
| Refrigerator | `000712269805` | KS 7793 D | Refrigerator |
| Freezer | `000712335856` | FNS 7794 E | Freezer |

**Status Fields (Miele):**
- `state.status.value_localized` - "Off", "In use", etc.
- `state.temperature[0].value_localized` - Current temperature
- `state.targetTemperature[0].value_localized` - Target temperature
- `state.remainingTime` - [hours, minutes]
- `state.remoteEnable.fullRemoteControl` - Remote control status

### HUUM Sauna
| Device | API | Access |
|--------|-----|--------|
| Sauna | api.huum.eu | Basic Auth (username/password) |

**Status Fields (HUUM):**
- `temperature` - Current temperature (°C)
- `targetTemperature` - Target temperature if heating
- `heaterOn` - Boolean, true if heating
- `door` - "Open" or "Closed" (must be closed to start)
- `humidity` - Humidity level if available
- `startDate` / `endDate` - Heating schedule times
- `light` - Light state (0 = off)

**Notes:**
- Temperature range: 40-110°C
- Door must be closed for safety before starting
- Uses same credentials as HUUM mobile app

### Phyn Water Monitor
| Device | ID | Type |
|--------|----|----|
| Phyn Plus | `28F53743B8D8` | PP2 (main shutoff valve) |
| HVAC #1 | `28F53746B987` | PW1 (smart sensor) |
| Hot Water Heater | `28F537468645` | PW1 (smart sensor) |
| HVAC #2 | `28F53746B9A6` | PW1 (smart sensor) |

**Status Fields (Phyn):**
- `pressure.mean` - Average water pressure (PSI)
- `temperature.mean` - Average water temperature (°F)
- `flow.mean` - Average flow rate (GPM)
- `sov_status.v` - Valve status ("Open" or "Closed")
- `online_status.v` - Device connectivity ("online")
- `signal_strength` - WiFi signal (dBm)
- `auto_shutoff_enable` - Auto shutoff enabled (boolean)

**Consumption Data:**
- `water_consumption` - Total gallons for period
- Duration formats: `YYYY/MM/DD` (daily), `YYYY/MM` (monthly), `YYYY` (yearly)

**Notes:**
- Uses AWS Cognito authentication (same credentials as Phyn app)
- Phyn Plus (PP2) can control water shutoff valve
- PW1 sensors monitor but cannot control water flow

## Common Operations

### Check Laundry Status
1. Call LG `get_device_status` with washer ID
2. Call LG `get_device_status` with dryer ID
3. Show: state, time remaining, program, remote control status

### Check Kitchen Status
1. Call Miele `get_devices` or use device IDs directly
2. Call Miele `get_device_status` for each device
3. Show: status, temperature (if applicable), alerts

### Check Oven Status
- Device ID: `000192190778`
- Call Miele `get_device_status` with oven ID
- Show: status, temperature, program, remaining time

### Check Fridge/Freezer Status
- Fridge ID: `000712269805`
- Freezer ID: `000712335856`
- Call Miele `get_device_status` for each
- Show: current temp, target temp, status, door/failure signals

### Check Sauna Status
1. Call HUUM `get_sauna_status`
2. Show: current temp, target temp, heater status, door state, light

### Start Sauna
1. Check door is closed with `get_sauna_status`
2. Call HUUM `start_sauna` with targetTemperature (40-110°C)
3. Confirm heating started

### Stop Sauna
1. Call HUUM `stop_sauna`
2. Confirm heater stopped

### Check Water Status
1. Call Phyn `get_devices` to list all water monitors
2. Call Phyn `get_device_status` for each device (especially Phyn Plus: `28F53743B8D8`)
3. Show: pressure, temperature, flow, valve status, online status

### Get Water Consumption Report
1. Call Phyn `get_consumption` with device_id and duration
2. Duration formats: `2026/01/05` (daily), `2026/01` (monthly), `2026` (yearly)
3. Show: total gallons, fixture breakdown if available

### Control Water Shutoff (Emergency)
1. Call Phyn `shutoff_valve` with device_id `28F53743B8D8` and action `close`
2. To restore water, call with action `open`

## Slash Commands

Available in `.claude/commands/`:
- `/laundry-status` - Washer and dryer status
- `/home-status` - All appliances overview
- `/kitchen-status` - All Miele kitchen appliances
- `/sauna-status` - Sauna temperature and status
- `/fridge-status` - Refrigerator and freezer temps
- `/freezer-check` - Quick freezer check
- `/oven-status` - Quick oven check
- `/miele-status` - All Miele appliances
- `/start-washer` - Interactive washer control
- `/start-dryer` - Interactive dryer control
- `/start-sauna` - Interactive sauna control
- `/stop-sauna` - Turn off the sauna
- `/check-alerts` - Check for alerts/notifications
- `/water-status` - Water system pressure and flow
- `/water-report` - Water consumption report

## Quick Status Check Pattern

When user asks "check status" or similar:

1. **For laundry:** Use LG MCP `get_device_status` for both washer and dryer IDs
2. **For kitchen:** Use Miele MCP `get_device_status` for oven, fridge, freezer IDs
3. **For sauna:** Use HUUM MCP `get_sauna_status`
4. **For water:** Use Phyn MCP `get_device_status` for Phyn Plus
5. **For everything:** Call all four servers and query all devices

Format output with icons:
- 🧺 Washer
- 👕 Dryer
- 🔥 Oven
- ❄️ Refrigerator/Freezer
- 🧖 Sauna
- 💧 Water Monitor

## File Structure

```
.
├── claude.md              # This file (quick reference)
├── INSTRUCTIONS.md        # User guide for non-technical users
├── README.md              # Complete setup documentation
├── .env                   # Credentials (DO NOT commit)
├── .mcp.json             # MCP server configuration
├── index.js              # Miele MCP server implementation
├── auth.js               # Miele OAuth helper
├── lg-thinq-mcp-wrapper.sh    # LG MCP wrapper script
├── miele-mcp-wrapper.sh       # Miele MCP wrapper script
├── test-lg-dryer.cjs         # LG integration test
├── test-miele-mcp.cjs        # Miele integration test
├── test-huum-sauna.cjs       # HUUM sauna integration test
├── phyn-mcp-server.js        # Phyn MCP server implementation
├── phyn-mcp-wrapper.sh       # Phyn MCP wrapper script
├── test-phyn-mcp.cjs         # Phyn integration test
└── .claude/
    ├── commands/         # Slash command definitions
    └── settings.local.json    # Local settings
```

## Environment Variables

From `.env`:
- `MIELE_ACCESS_TOKEN` - Miele OAuth token (expires in 30 days)
- `MIELE_API_BASE_URL` - https://api.mcs3.miele.com/v1
- `THINQ_PAT` - LG ThinQ Personal Access Token
- `THINQ_COUNTRY` - US
- `HUUM_USERNAME` / `HUUM_PASSWORD` - HUUM app credentials
- `PHYN_USERNAME` / `PHYN_PASSWORD` - Phyn app credentials

## Tips for Efficient Status Checks

1. **Use device IDs directly** - No need to call get_devices first if checking specific devices
2. **Call MCP tools in parallel** - Both servers can be queried simultaneously
3. **Cache device list** - Device IDs don't change
4. **Format output immediately** - Don't wait to parse JSON, format as you receive it

## Troubleshooting Quick Reference

- **401 Unauthorized (Miele):** Token expired, run `npm run auth`
- **Remote control disabled:** User needs to enable on physical device
- **Device not found:** Check device ID, verify device is online
- **MCP server not responding:** Check `.mcp.json` paths and wrapper scripts

## Testing

All four MCP servers have been tested and are confirmed working:
- `node test-lg-dryer.cjs` - Test LG ThinQ integration (washer + dryer)
- `node test-miele-mcp.cjs` - Test Miele integration (oven, fridge, freezer)
- `node test-huum-sauna.cjs` - Test HUUM sauna integration
- `node test-phyn-mcp.cjs` - Test Phyn water monitor integration
