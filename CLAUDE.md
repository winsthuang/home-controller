# Home Controller - Claude Code Quick Reference

> This file provides quick context for Claude Code to efficiently work with this project.

## Project Overview

This is a smart home automation system that integrates **Miele**, **LG ThinQ**, **HUUM Sauna**, **Phyn Water Monitor**, **A.O. Smith Water Heater**, and **Tedee Smart Locks** through MCP (Model Context Protocol) servers. Users can check status and control appliances using natural language or slash commands.

**Automated Email Reports:** Daily (10pm) and weekly (Saturday 8am) email reports with usage stats, historical comparisons, and trends.

## MCP Servers

Six MCP servers are configured in `.mcp.json`:

### 1. Miele MCP Server
- **Command:** `./miele-mcp-wrapper.sh` → `node index.js`
- **Server Name:** `miele-home-controller` v1.0.0
- **Tools:**
  - `get_devices` - Get all Miele devices
  - `get_device_status` - Get device status by deviceId
  - `device_action` - Control device (start, stop, pause, powerOn, powerOff)
  - `set_temperature` - Set target temperature for fridge/freezer (deviceId, temperature, zone)
  - `get_temperature_settings` - Get current temps and valid ranges per zone

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

### 5. A.O. Smith Water Heater MCP Server
- **Command:** `./aosmith-mcp-wrapper.sh` → `node aosmith-mcp-server.js`
- **Server Name:** `aosmith-water-heater` v1.0.0
- **Tools:**
  - `get_devices` - Get all A.O. Smith water heaters on account
  - `get_device_status` - Get detailed status (temp, mode, online status)
  - `set_temperature` - Set target water temperature (95-140°F)
  - `set_mode` - Change operation mode (HEAT_PUMP, HYBRID, ELECTRIC, VACATION)
  - `get_energy_usage` - Get energy consumption data (lifetime kWh, daily usage)

### 6. Tedee Smart Lock MCP Server
- **Command:** `./tedee-mcp-wrapper.sh` → `node tedee-mcp-server.js`
- **Server Name:** `tedee-smart-lock` v1.0.0
- **Tools:**
  - `get_devices` - Get all Tedee locks on account
  - `get_device_status` - Get lock status by lock_id (state, battery, door)
  - `sync_all_locks` - Sync and get current status of all locks
  - `lock_door` - Lock a specific door
  - `unlock_door` - Unlock a specific door
  - `pull_spring` - Pull spring (for locks with auto-pull disabled)
  - `get_operation_status` - Check async operation result
  - `get_activity_log` - Get lock activity history

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
node test-aosmith-mcp.cjs   # A.O. Smith water heater status
node test-tedee-mcp.cjs     # Tedee smart lock status
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

### A.O. Smith Water Heater
| Device | API | Access |
|--------|-----|--------|
| Heat Pump Water Heater | r2.wh8.co/graphql | iComm app credentials |

**Status Fields (A.O. Smith):**
- `temperatureSetpoint` - Current target temperature (°F)
- `temperatureSetpointPending` - Pending temperature change
- `temperatureSetpointMaximum` - Max allowed temperature
- `operationMode` - Current mode (HEAT_PUMP, HYBRID, ELECTRIC, VACATION)
- `operationModePending` - Pending mode change
- `hotWaterStatus` - Hot water availability
- `isOnline` - Device connectivity
- `modeName` - Human-readable mode name

**Notes:**
- Temperature range: 95-140°F
- Uses GraphQL API with JWT authentication
- Same credentials as iComm mobile app
- Modes: HEAT_PUMP (efficient), HYBRID (balanced), ELECTRIC (fast), VACATION (away)

### Tedee Smart Locks
| Device | API | Access |
|--------|-----|--------|
| Smart Lock | api.tedee.com/api/v1.32 | Personal Access Key (PAK) |

**Status Fields (Tedee):**
- `lockState` - Lock state: Locked (6), Unlocked (2), SemiLocked (3)
- `doorState` - Door: Closed (1), Open (2)
- `batteryLevel` - Battery percentage (0-100)
- `isCharging` - Battery charging status
- `isConnected` - Bridge connectivity
- `stateChangeDate` - Last activity timestamp

**Activity Log Fields:**
- `event` - Event type: Lock (1), Unlock (2), Pull (3)
- `source` - Source: App (9), Button (2), AutoLock (6), AutoUnlock (5)
- `date` - Timestamp
- `username` - User who performed action

**Notes:**
- Requires Tedee bridge for remote API access
- Create PAK at: https://portal.tedee.com/personal-access-keys
- Lock operations are async (use get_operation_status to verify)
- Rate limit: 1000 requests/hour

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

### Set Fridge/Freezer Temperature
1. Call Miele `get_temperature_settings` with deviceId to see current temps and valid ranges
2. Call Miele `set_temperature` with deviceId, temperature (°C), and optional zone
3. Confirm temperature change was applied

**Temperature Ranges:**
- Refrigerator Zone 1 (Main): 1-9°C
- Refrigerator Zone 2 (PerfectFresh): 0-3°C
- Freezer Zone 1: -24 to -16°C

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

### Check Water Heater Status
1. Call A.O. Smith `get_devices` to list water heaters
2. Call A.O. Smith `get_device_status` with junction_id
3. Show: current setpoint, mode, online status, hot water status

### Set Water Heater Temperature
1. Call A.O. Smith `set_temperature` with junction_id and temperature (95-140°F)
2. Confirm the pending change

### Change Water Heater Mode
1. Call A.O. Smith `set_mode` with junction_id and mode
2. Modes: HEAT_PUMP, HYBRID, ELECTRIC, VACATION
3. Confirm the pending change

### Get Water Heater Energy Usage
1. Call A.O. Smith `get_energy_usage` with junction_id
2. Show: lifetime kWh, average daily usage, recent usage graph

### Check Lock Status
1. Call Tedee `sync_all_locks` to refresh all lock states
2. Show: lock state, door state, battery level, connection status

### Lock/Unlock Door
1. Call Tedee `lock_door` or `unlock_door` with lock_id
2. Call Tedee `get_operation_status` with operationId to verify completion
3. Confirm operation success

### View Lock History
1. Call Tedee `get_activity_log` with lock_id and count
2. Show: recent events with timestamps and users

## Slash Commands

Available in `.claude/commands/`:
- `/laundry-status` - Washer and dryer status
- `/home-status` - All appliances overview
- `/kitchen-status` - All Miele kitchen appliances
- `/sauna-status` - Sauna temperature and status
- `/fridge-status` - Refrigerator and freezer temps
- `/set-fridge-temp` - Set refrigerator or freezer temperature
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
- `/water-heater-status` - Heat pump water heater status
- `/set-water-heater` - Interactive water heater control
- `/get_device_status` - Smart lock status
- `/lock_doors` - Lock one or all doors
- `/unlock_doors` - Unlock one or all doors
- `/get_activity_logs` - Lock activity history

## Quick Status Check Pattern

When user asks "check status" or similar:

1. **For laundry:** Use LG MCP `get_device_status` for both washer and dryer IDs
2. **For kitchen:** Use Miele MCP `get_device_status` for oven, fridge, freezer IDs
3. **For sauna:** Use HUUM MCP `get_sauna_status`
4. **For water:** Use Phyn MCP `get_device_status` for Phyn Plus
5. **For water heater:** Use A.O. Smith MCP `get_devices` or `get_device_status`
6. **For locks:** Use Tedee MCP `sync_all_locks`
7. **For everything:** Call all six servers and query all devices

Format output with icons:
- 🧺 Washer
- 👕 Dryer
- 🔥 Oven
- ❄️ Refrigerator/Freezer
- 🧖 Sauna
- 💧 Water Monitor
- 🚿 Water Heater
- 🔐 Smart Lock

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
├── aosmith-mcp-server.js     # A.O. Smith MCP server implementation
├── aosmith-mcp-wrapper.sh    # A.O. Smith MCP wrapper script
├── test-aosmith-mcp.cjs      # A.O. Smith integration test
├── tedee-mcp-server.js       # Tedee Smart Lock MCP server implementation
├── tedee-mcp-wrapper.sh      # Tedee MCP wrapper script
├── test-tedee-mcp.cjs        # Tedee integration test
├── email-reports/            # Automated email reporting system
│   ├── email-report.js       # Main entry point
│   ├── data-collector.js     # Collects data from all MCP servers
│   ├── history-store.js      # Historical data storage (12 weeks)
│   ├── html-templates.js     # Email HTML templates
│   ├── email-sender.js       # Gmail SMTP sender
│   └── config.js             # Configuration
├── launchd/                  # macOS scheduler templates
│   ├── *.plist.example       # Template plist files
├── data/                     # Runtime data (gitignored)
│   └── history.json          # Usage history
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
- `AOSMITH_EMAIL` / `AOSMITH_PASSWORD` - iComm app credentials
- `TEDEE_API_KEY` - Tedee Personal Access Key (PAK)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` - Gmail SMTP for email reports
- `REPORT_RECIPIENT` - Email address for reports

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

All six MCP servers have been tested and are confirmed working:
- `node test-lg-dryer.cjs` - Test LG ThinQ integration (washer + dryer)
- `node test-miele-mcp.cjs` - Test Miele integration (oven, fridge, freezer)
- `node test-huum-sauna.cjs` - Test HUUM sauna integration
- `node test-phyn-mcp.cjs` - Test Phyn water monitor integration
- `node test-aosmith-mcp.cjs` - Test A.O. Smith water heater integration
- `node test-tedee-mcp.cjs` - Test Tedee smart lock integration
