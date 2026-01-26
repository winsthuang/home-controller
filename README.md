# Home Controller - Smart Home MCP Integration

A unified home automation system for controlling Miele, LG ThinQ, HUUM Sauna, Phyn Water Monitor, A.O. Smith Water Heater, and Tedee Smart Lock appliances through Claude Code using the Model Context Protocol (MCP).

## Features

### Miele Integration (Custom Node.js MCP Server)
- Get list of all connected Miele devices
- Get detailed status of any device (oven, refrigerator, freezer, etc.)
- Control devices (start, stop, pause, power on/off)
- Set refrigerator/freezer temperatures with zone support
- Real-time device monitoring

### LG ThinQ Integration (Official Python MCP Server)
- Control LG washers and dryers
- Monitor device status in real-time
- Get device capabilities and available programs
- Subscribe to device events

### HUUM Sauna Integration (Custom Node.js MCP Server)
- Monitor sauna temperature and status
- Start and stop sauna heating remotely
- Set target temperature (40-110°C)
- Control sauna lighting
- Check door state and safety status

### Phyn Water Monitor Integration (Custom Node.js MCP Server)
- Monitor water pressure, temperature, and flow rate
- Get historical water consumption data (daily/monthly/yearly)
- Control main water shutoff valve (Phyn Plus)
- Support for multiple Phyn devices (Plus and Smart Sensors)
- Perfect for building water usage reports

### A.O. Smith Water Heater Integration (Custom Node.js MCP Server)
- Monitor heat pump water heater temperature and status
- Set target water temperature (95-140°F)
- Change operation mode (Heat Pump, Hybrid, Electric, Vacation)
- View energy consumption data
- Check hot water availability status

### Tedee Smart Lock Integration (Custom Node.js MCP Server)
- Monitor lock status (locked/unlocked/semi-locked)
- Check door state (open/closed)
- Lock and unlock doors remotely
- View battery level and charging status
- Access lock activity history
- Support for multiple locks
- Requires Tedee bridge for remote access

### Automated Email Reports
- **Daily reports** at 10pm with usage recap
- **Weekly reports** on Saturday 8am with trends
- Tracks: water usage, laundry cycles, sauna sessions, oven uses
- Historical comparisons: vs yesterday, 7-day avg, 4-week avg, 12-week avg
- 12-week sparkline trends in weekly reports
- Gmail SMTP with macOS launchd scheduling

### Slash Commands
- `/laundry-status` - Quick check on washers and dryers
- `/kitchen-status` - Check all Miele kitchen appliances
- `/set-fridge-temp` - Set refrigerator or freezer temperature
- `/sauna-status` - Check HUUM sauna status
- `/home-status` - Complete overview of all devices
- `/start-washer` - Interactive washer control
- `/start-dryer` - Interactive dryer control
- `/start-sauna` - Interactive sauna control
- `/stop-sauna` - Turn off the sauna
- `/check-alerts` - Check for notifications and alerts
- `/water-status` - Check water system pressure and flow
- `/water-report` - Get water consumption report
- `/water-heater-status` - Check heat pump water heater status
- `/set-water-heater` - Interactive water heater control
- `/get_device_status` - Check smart lock status
- `/lock_doors` - Lock one or all doors
- `/unlock_doors` - Unlock one or all doors
- `/get_activity_logs` - View lock activity history

## Prerequisites

1. **For Miele:**
   - Miele account with connected appliances
   - Miele Developer Portal credentials (Client ID and Client Secret)
   - Node.js v18+ installed

2. **For LG ThinQ:**
   - LG ThinQ account with connected appliances
   - LG ThinQ Personal Access Token (PAT)
   - Python 3.11+ installed

3. **For HUUM Sauna:**
   - HUUM sauna with UKU WiFi controller
   - HUUM mobile app account
   - Node.js v18+ installed

4. **For Phyn Water Monitor:**
   - Phyn Plus and/or Phyn Smart Water Sensors
   - Phyn mobile app account
   - Node.js v18+ installed

5. **For A.O. Smith Water Heater:**
   - A.O. Smith iComm-enabled water heater (Voltex, etc.)
   - iComm mobile app account
   - Node.js v18+ installed

6. **For Tedee Smart Locks:**
   - Tedee smart lock (GO or PRO)
   - Tedee bridge (required for remote API access)
   - Tedee mobile app account
   - Personal Access Key (PAK) from Tedee Portal
   - Node.js v18+ installed

## Setup

### Miele Setup

#### Step 1: Get Miele API Credentials

1. Go to [Miele Developer Portal](https://developer.miele.com/)
2. Create an account or log in
3. Create a new application
4. Add redirect URI: `http://localhost:3000/callback`
5. Note your Client ID and Client Secret

#### Step 2: Configure Miele Environment

1. Edit `.env` and add your credentials:
   ```env
   MIELE_CLIENT_ID=your_client_id_here
   MIELE_CLIENT_SECRET=your_client_secret_here
   ```

#### Step 3: Authenticate with Miele

Run the authentication helper:
```bash
npm run auth
```

**Important for US Users:**
- The auth script uses the legacy OAuth endpoint (`api.mcs3.miele.com`)
- This is required for US Miele accounts
- EU users may need different endpoint configuration

This will:
1. Open your browser to authenticate with Miele
2. Exchange the authorization code for an access token
3. Save the token to your `.env` file (valid for 30 days)

### LG ThinQ Setup

#### Step 1: Get LG ThinQ Personal Access Token

1. Go to [LG ThinQ Developer Portal](https://thinq.developer.lge.com)
2. Create an account or log in
3. Navigate to the PAT (Personal Access Token) section
4. Generate a new token with these permissions:
   - View all devices and statuses
   - Device control and event subscription
   - Device push notifications
   - Energy consumption inquiry

#### Step 2: Configure LG ThinQ Environment

1. Edit `.env` and add your credentials:
   ```env
   THINQ_PAT=your_personal_access_token_here
   THINQ_COUNTRY=US
   ```

#### Step 3: Install LG ThinQ MCP Server

The LG ThinQ MCP server is already installed via pipx:
```bash
# Already installed at ~/.local/bin/thinqconnect-mcp
# Verify installation:
~/.local/bin/thinqconnect-mcp --help
```

### HUUM Sauna Setup

#### Step 1: Get HUUM Account Credentials

1. Download the HUUM mobile app (iOS/Android)
2. Create an account or log in
3. Connect your HUUM sauna with UKU WiFi controller
4. Note your login credentials (email and password)

#### Step 2: Configure HUUM Environment

1. Edit `.env` and add your credentials:
   ```env
   HUUM_USERNAME=your_email@example.com
   HUUM_PASSWORD=your_password_here
   ```

**Note:** The HUUM API uses Basic Authentication with the same credentials you use in the mobile app.

#### Step 3: Install Dependencies

The HUUM MCP server uses the same Node.js dependencies as the Miele server:
```bash
npm install
```

### Phyn Water Monitor Setup

#### Step 1: Get Phyn Account Credentials

1. Download the Phyn mobile app (iOS/Android)
2. Create an account or log in
3. Connect your Phyn devices (Plus or Smart Sensors)
4. Note your login credentials (email and password)

#### Step 2: Configure Phyn Environment

1. Edit `.env` and add your credentials:
   ```env
   PHYN_USERNAME=your_email@example.com
   PHYN_PASSWORD=your_password_here
   PHYN_API_KEY=E7nfOgW6VI64fYpifiZSr6Me5w1Upe155zbu4lq8
   ```

**Note:** The Phyn API uses AWS Cognito authentication with the same credentials you use in the mobile app. The API key is a public key used by the Phyn service.

#### Step 3: Install Dependencies

The Phyn MCP server uses the same Node.js dependencies plus the Cognito library:
```bash
npm install
```

### A.O. Smith Water Heater Setup

#### Step 1: Get iComm Account Credentials

1. Download the A.O. Smith iComm mobile app (iOS/Android)
2. Create an account or log in
3. Connect your iComm-enabled water heater
4. Note your login credentials (email and password)

#### Step 2: Configure A.O. Smith Environment

1. Edit `.env` and add your credentials:
   ```env
   AOSMITH_EMAIL=your_email@example.com
   AOSMITH_PASSWORD=your_password_here
   ```

**Note:** The A.O. Smith API uses the same credentials you use in the iComm mobile app.

#### Step 3: Install Dependencies

The A.O. Smith MCP server uses the same Node.js dependencies:
```bash
npm install
```

### Tedee Smart Lock Setup

#### Step 1: Get Personal Access Key (PAK)

1. Log in to [Tedee Portal](https://portal.tedee.com/)
2. Click your initials in the upper right corner
3. Select "Personal Access Keys"
4. Click "Add Key"
5. Enter a name (e.g., "Home Controller")
6. Set validity period (up to 5 years)
7. Select permissions:
   - Device - Read (required)
   - Lock - Operate (required for lock/unlock)
   - Device Activity - Read (required for activity logs)
8. **Save the key immediately** - it won't be shown again!

#### Step 2: Configure Tedee Environment

1. Edit `.env` and add your PAK:
   ```env
   TEDEE_API_KEY=your_personal_access_key_here
   ```

**Note:** The Tedee API uses Personal Access Keys for authentication. These are different from OAuth - they're simple API keys that work directly with the Tedee cloud API.

#### Step 3: Ensure Bridge Connection

Your Tedee lock must be connected via a Tedee bridge for remote API access. If you only have Bluetooth connection, the API will not be able to communicate with your lock.

#### Step 4: Install Dependencies

The Tedee MCP server uses the same Node.js dependencies:
```bash
npm install
```

### Email Reports Setup

#### Step 1: Configure Gmail SMTP

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account → Security → App passwords
3. Generate an app password for "Mail"
4. Add to `.env`:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   REPORT_RECIPIENT=recipient@email.com
   ```

#### Step 2: Test Email Reports

```bash
# Test daily report
node email-reports/email-report.js daily

# Test weekly report
node email-reports/email-report.js weekly
```

#### Step 3: Schedule with launchd (macOS)

1. Copy and customize the template plist files:
   ```bash
   cp launchd/com.homecontroller.daily-report.plist.example launchd/com.homecontroller.daily-report.plist
   cp launchd/com.homecontroller.weekly-report.plist.example launchd/com.homecontroller.weekly-report.plist
   ```

2. Edit the plist files to replace `/path/to/Home Controller` with your actual path

3. Install the launchd jobs:
   ```bash
   cp launchd/*.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.homecontroller.daily-report.plist
   launchctl load ~/Library/LaunchAgents/com.homecontroller.weekly-report.plist
   ```

4. Verify they're loaded:
   ```bash
   launchctl list | grep homecontroller
   ```

## Testing Your Setup

### Test Miele Integration

```bash
# Test API connection
./test-miele.sh

# Or start the MCP server
npm start
```

### Test LG ThinQ Integration

```bash
# Test with environment variables
export THINQ_PAT=$(grep THINQ_PAT .env | cut -d= -f2)
export THINQ_COUNTRY=$(grep THINQ_COUNTRY .env | cut -d= -f2)
~/.local/bin/thinqconnect-mcp
```

### Test HUUM Sauna Integration

```bash
# Test the HUUM MCP server
node test-huum-sauna.cjs
```

This will:
1. Initialize the HUUM MCP server
2. List available tools
3. Get current sauna status (temperature, door state, etc.)

### Test Phyn Water Monitor Integration

```bash
# Test the Phyn MCP server
node test-phyn-mcp.cjs
```

This will:
1. Initialize the Phyn MCP server
2. List available tools
3. Get all Phyn devices
4. Get current device status (pressure, temperature, flow)
5. Get water consumption data

### Test A.O. Smith Water Heater Integration

```bash
# Test the A.O. Smith MCP server
node test-aosmith-mcp.cjs
```

This will:
1. Initialize the A.O. Smith MCP server
2. List available tools
3. Get all water heaters
4. Get current device status (temperature, mode, hot water status)
5. Get energy usage data

### Test Tedee Smart Lock Integration

```bash
# Test the Tedee MCP server
node test-tedee-mcp.cjs
```

This will:
1. Initialize the Tedee MCP server
2. List available tools
3. Get all locks
4. Sync all lock states
5. Get current device status (lock state, battery, door state)
6. Get recent activity log

## Available Tools

### Miele MCP Server

#### `get_devices`
Get all Miele devices connected to your account.

#### `get_device_status`
Get detailed status for a specific device.
- Parameters: `deviceId` (string)

#### `device_action`
Perform an action on a device.
- Parameters:
  - `deviceId` (string)
  - `action` (string): one of "start", "stop", "pause", "powerOn", "powerOff"

#### `set_temperature`
Set target temperature for a refrigerator or freezer.
- Parameters:
  - `deviceId` (string)
  - `temperature` (number): Target temperature in Celsius
  - `zone` (number, optional): Temperature zone (default: 1)

#### `get_temperature_settings`
Get current temperature settings and valid ranges for a cooling appliance.
- Parameters: `deviceId` (string)
- Returns: current temps, target temps, and valid ranges per zone

### LG ThinQ MCP Server

The official LG ThinQ MCP server provides:
- Device list query
- Device status monitoring
- Device control (start, stop, settings)
- Device capabilities query

See [thinqconnect-mcp documentation](https://github.com/thinq-connect/thinqconnect-mcp) for full details.

### HUUM Sauna MCP Server

#### `get_sauna_status`
Get current status of the HUUM sauna including:
- Current temperature
- Target temperature
- Heater on/off state
- Door state (open/closed)
- Humidity level
- Start/end times

#### `start_sauna`
Start the sauna and set target temperature.
- Parameters:
  - `targetTemperature` (number): Target temperature in Celsius (40-110)
- Safety: Always verifies door is closed before starting

#### `stop_sauna`
Stop/turn off the sauna heater.

#### `toggle_light`
Toggle the sauna light on/off.

### Phyn Water Monitor MCP Server

#### `get_devices`
Get all Phyn devices connected to your account (Phyn Plus and Smart Sensors).

#### `get_device_status`
Get detailed status for a specific device.
- Parameters: `device_id` (string)
- Returns: pressure, temperature, flow rate, valve status, online status

#### `get_consumption`
Get historical water consumption data.
- Parameters:
  - `device_id` (string)
  - `duration` (string): `YYYY/MM/DD` for daily, `YYYY/MM` for monthly, `YYYY` for yearly

#### `shutoff_valve`
Open or close the main water shutoff valve (Phyn Plus only).
- Parameters:
  - `device_id` (string)
  - `action` (string): "open" or "close"

### A.O. Smith Water Heater MCP Server

#### `get_devices`
Get all A.O. Smith water heaters linked to your iComm account.

#### `get_device_status`
Get detailed status for a specific water heater.
- Parameters: `junction_id` (string)
- Returns: temperature setpoint, mode, hot water status, online status

#### `set_temperature`
Set the target water temperature.
- Parameters:
  - `junction_id` (string)
  - `temperature` (number): Target temperature in Fahrenheit (95-140)

#### `set_mode`
Change the water heater operation mode.
- Parameters:
  - `junction_id` (string)
  - `mode` (string): "HEAT_PUMP", "HYBRID", "ELECTRIC", or "VACATION"

#### `get_energy_usage`
Get energy consumption data for a water heater.
- Parameters: `junction_id` (string)
- Returns: lifetime kWh, average daily usage, recent usage history

### Tedee Smart Lock MCP Server

#### `get_devices`
Get all Tedee smart locks linked to your account.

#### `get_device_status`
Get detailed status for a specific lock.
- Parameters: `lock_id` (number)
- Returns: lock state, door state, battery level, connection status

#### `sync_all_locks`
Refresh and get current status of all locks.
- Returns: Array of all locks with current states

#### `lock_door`
Lock a specific door.
- Parameters: `lock_id` (number)
- Returns: operation ID for tracking

#### `unlock_door`
Unlock a specific door.
- Parameters:
  - `lock_id` (number)
  - `mode` (number, optional): 2=force, 3=no auto-pull, 4=unlock or pull

#### `pull_spring`
Pull spring (for locks with auto-pull disabled).
- Parameters: `lock_id` (number)

#### `get_operation_status`
Check the status of an async lock/unlock operation.
- Parameters: `operation_id` (string)
- Returns: status (PENDING/COMPLETED), result code

#### `get_activity_log`
Get recent activity history for a lock.
- Parameters:
  - `lock_id` (number)
  - `count` (number): max 200 events
- Returns: Array of events with timestamps, users, and sources

## Using with Claude Code

### Project-Level Configuration (Recommended)

The `.mcp.json` file in this directory configures all six servers:

```json
{
  "mcpServers": {
    "miele": {
      "type": "stdio",
      "command": "/absolute/path/to/miele-mcp-wrapper.sh",
      "args": []
    },
    "lg-thinq": {
      "type": "stdio",
      "command": "/absolute/path/to/lg-thinq-mcp-wrapper.sh",
      "args": []
    },
    "huum": {
      "type": "stdio",
      "command": "/absolute/path/to/huum-mcp-wrapper.sh",
      "args": []
    },
    "phyn": {
      "type": "stdio",
      "command": "/absolute/path/to/phyn-mcp-wrapper.sh",
      "args": []
    },
    "aosmith": {
      "type": "stdio",
      "command": "/absolute/path/to/aosmith-mcp-wrapper.sh",
      "args": []
    },
    "tedee": {
      "type": "stdio",
      "command": "/absolute/path/to/tedee-mcp-wrapper.sh",
      "args": []
    }
  }
}
```

**Note:** Wrapper scripts automatically load environment variables from `.env`.

### Global Configuration

To use these servers from anywhere, copy the config:

```bash
cp .mcp.json ~/.claude/mcp.json
```

Then restart Claude Code.

## Slash Commands

Slash commands are available in `.claude/commands/`:

- **`/laundry-status`** - Quick status check for washers/dryers
- **`/kitchen-status`** - Check all Miele kitchen appliances
- **`/set-fridge-temp`** - Set refrigerator or freezer temperature
- **`/sauna-status`** - Check HUUM sauna temperature and status
- **`/home-status`** - Dashboard view of all appliances
- **`/start-washer`** - Interactive washer program selection
- **`/start-dryer`** - Interactive dryer program selection
- **`/start-sauna`** - Interactive sauna control with temperature
- **`/stop-sauna`** - Turn off the sauna
- **`/check-alerts`** - View notifications and completed cycles
- **`/water-status`** - Check water pressure and flow
- **`/water-report`** - Get water consumption report
- **`/water-heater-status`** - Check heat pump water heater status
- **`/set-water-heater`** - Interactive water heater control
- **`/get_device_status`** - Check smart lock status
- **`/lock_doors`** - Lock one or all doors
- **`/unlock_doors`** - Unlock one or all doors
- **`/get_activity_logs`** - View lock activity history

## Example Usage

Once configured in Claude Code, you can use natural language:

```
"What appliances do I have?"
""Check my refrigerator temperature"
"Set the freezer to -18 degrees""
"Is my laundry done?"
"Start the washer on delicate cycle"
"Heat the sauna to 80 degrees"
"What's the sauna temperature?"
"Turn off the sauna"
"What's my water pressure?"
"How much water did I use this month?"
"Shut off the water"
"What's my water heater temperature?"
"Set water heater to 120 degrees"
"Put water heater in vacation mode"
"Is my door locked?"
"Lock the front door"
"Who unlocked the door today?"
"/laundry-status"
"/sauna-status"
"/water-status"
"/water-heater-status"
"/get_device_status"
```

## Troubleshooting

### Miele Issues

**"401 Unauthorized" errors**
- Your access token has expired (tokens last 30 days)
- Run `npm run auth` to get a new token

**Device not responding**
- Ensure device is powered on and connected to WiFi
- Verify the device supports Miele@mobile app
- Check that remote control is enabled on the device

**US Region Issues**
- US accounts must use the legacy OAuth endpoint
- The auth script is pre-configured for US accounts
- EU users may need to modify `auth.js` to use the new endpoint

### LG ThinQ Issues

**PAT not working**
- Verify your PAT at https://thinq.developer.lge.com
- Check that all required permissions are granted
- Ensure `THINQ_COUNTRY` matches your account region

**Server not found**
- Verify pipx installation: `which thinqconnect-mcp`
- Check PATH includes `~/.local/bin`
- Run `pipx ensurepath` if needed

### HUUM Sauna Issues

**"401 Unauthorized" or authentication errors**
- Verify your HUUM credentials in `.env`
- Ensure you're using the same email/password as the HUUM mobile app
- Try logging out and back into the HUUM app to verify credentials

**Sauna not responding**
- Check that the UKU WiFi controller is powered on and connected
- Verify the sauna is online in the HUUM mobile app
- Ensure your HUUM account is connected to the sauna

**Cannot start sauna remotely**
- The sauna door must be closed for safety
- Check door state with `/sauna-status` before starting
- Verify remote safety state is not disabled

**Temperature not updating**
- The sauna may be off or cooling down (shows low temperature like 2°C)
- Start the sauna to see temperature changes
- Check that the heater is functioning properly

### Phyn Water Monitor Issues

**"401 Unauthorized" or authentication errors**
- Verify your Phyn credentials in `.env`
- Ensure you're using the same email/password as the Phyn mobile app
- Check that PHYN_API_KEY is set correctly

**Devices not showing**
- Make sure your Phyn devices are online in the Phyn app
- Verify your Phyn account has devices registered
- Check WiFi connectivity on your Phyn devices

**Water consumption not loading**
- The Phyn Plus is required for consumption data
- Smart Water Sensors (PW1) don't provide consumption data
- Try different duration formats: YYYY/MM/DD, YYYY/MM, or YYYY

**Cannot control shutoff valve**
- Only Phyn Plus (PP2) devices have shutoff capability
- Smart Water Sensors (PW1) are monitoring-only
- Ensure the valve is not manually locked

### A.O. Smith Water Heater Issues

**"401 Unauthorized" or authentication errors**
- Verify your iComm credentials in `.env`
- Ensure you're using the same email/password as the iComm mobile app
- Try logging out and back into the iComm app to verify credentials

**Water heater not responding**
- Check that the water heater is powered on and connected to WiFi
- Verify the water heater is online in the iComm mobile app
- Ensure your iComm account is connected to the water heater

**Energy data not available**
- Energy tracking may need to be enabled in the iComm app
- Some older models may not support energy monitoring
- Wait for the water heater to collect usage data

### Tedee Smart Lock Issues

**"401 Unauthorized" or authentication errors**
- Verify your TEDEE_API_KEY is correct in `.env`
- Check that the PAK hasn't expired (max 5 years)
- Ensure the PAK has required permissions (Device.Read, Lock.Operate, DeviceActivity.Read)

**Lock not responding**
- Verify the Tedee bridge is powered on and connected to WiFi
- Check lock connectivity in the Tedee mobile app
- Ensure the lock has battery charge

**Cannot lock/unlock remotely**
- The lock must be connected via Tedee bridge (not Bluetooth only)
- Verify remote access is enabled in Tedee app settings
- Check that your PAK has Lock.Operate permission

**Operation times out**
- Lock/unlock operations take 2-3 seconds
- Use `get_operation_status` to verify completion
- Rate limit: max 1000 requests/hour

### MCP Server Issues

**Servers not loading in Claude Code**
- Verify `.mcp.json` is in the correct location
- Check that all environment variables are set in `.env`
- Restart Claude Code after configuration changes
- Review Claude Code logs for errors

## Token Maintenance

### Miele Token Refresh
Miele access tokens expire after 30 days. When expired:
```bash
npm run auth
```

### LG ThinQ PAT
LG Personal Access Tokens don't expire unless revoked. No maintenance needed.

### HUUM Credentials
HUUM uses your mobile app login credentials. No token refresh needed - credentials remain valid as long as your account is active.

### Phyn Credentials
Phyn uses AWS Cognito authentication with your mobile app login credentials. Tokens are automatically refreshed by the MCP server. No manual maintenance needed.

### A.O. Smith Credentials
A.O. Smith uses JWT authentication with your iComm mobile app login credentials. Tokens are automatically refreshed by the MCP server. No manual maintenance needed.

### Tedee PAK
Tedee Personal Access Keys can last up to 5 years. Check expiration at https://portal.tedee.com/personal-access-keys and regenerate before expiration.

## Project Structure

```
Home Controller/
├── .env                      # Your credentials (DO NOT commit!)
├── .env.example             # Template for credentials
├── .mcp.json                # MCP server configuration
├── .gitignore               # Excludes .env from git
├── index.js                 # Miele MCP server (Node.js)
├── huum-mcp-server.js       # HUUM Sauna MCP server (Node.js)
├── phyn-mcp-server.js       # Phyn Water Monitor MCP server (Node.js)
├── aosmith-mcp-server.js    # A.O. Smith Water Heater MCP server (Node.js)
├── tedee-mcp-server.js      # Tedee Smart Lock MCP server (Node.js)
├── auth.js                  # Miele OAuth helper
├── miele-mcp-wrapper.sh     # Miele MCP server wrapper
├── lg-thinq-mcp-wrapper.sh  # LG ThinQ MCP server wrapper
├── huum-mcp-wrapper.sh      # HUUM MCP server wrapper
├── phyn-mcp-wrapper.sh      # Phyn MCP server wrapper
├── aosmith-mcp-wrapper.sh   # A.O. Smith MCP server wrapper
├── tedee-mcp-wrapper.sh     # Tedee MCP server wrapper
├── test-miele-mcp.cjs       # Miele integration test
├── test-lg-dryer.cjs        # LG ThinQ integration test
├── test-huum-sauna.cjs      # HUUM integration test
├── test-phyn-mcp.cjs        # Phyn integration test
├── test-tedee-mcp.cjs       # Tedee integration test
├── test-aosmith-mcp.cjs     # A.O. Smith integration test
├── package.json             # Node.js dependencies
├── README.md                # This file
├── INSTRUCTIONS.md          # User guide
├── CLAUDE.md                # Quick reference for Claude Code
└── .claude/
    └── commands/            # Slash commands
        ├── laundry-status.md
        ├── kitchen-status.md
        ├── sauna-status.md
        ├── home-status.md
        ├── start-washer.md
        ├── start-dryer.md
        ├── start-sauna.md
        ├── stop-sauna.md
        ├── check-alerts.md
        ├── water-status.md
        ├── water-report.md
        ├── water-heater-status.md
        ├── set-water-heater.md
        └── set-fridge-temp.md
```

## Security Notes

- ✅ Credentials stored in `.env` (not committed to git)
- ✅ `.mcp.json` references environment variables
- ✅ `.gitignore` prevents accidental credential commits
- ✅ Tokens are stored locally, never transmitted to Claude

## Resources

### Miele
- [Miele Developer Portal](https://developer.miele.com/)
- [Miele API Documentation](https://developer.miele.com/docs/get-started)
- [Miele USA Support](https://www.mieleusa.com/support/customer-assistance/system_integration-1332)

### LG ThinQ
- [LG ThinQ Developer Portal](https://thinq.developer.lge.com)
- [LG ThinQ MCP Server](https://github.com/thinq-connect/thinqconnect-mcp)
- [PyPI Package](https://pypi.org/project/thinqconnect-mcp/)

### HUUM Sauna
- [HUUM Mobile App](https://huumsauna.com/product/uku-wifi/) (iOS/Android)
- [HUUM UKU WiFi Controller](https://huumsauna.com/product/uku-wifi/)
- [HUUM Support](https://huumsauna.com/)
- [PyHuum Library](https://github.com/frwickst/pyhuum) (Python API reference)

### Phyn Water Monitor
- [Phyn Mobile App](https://www.phyn.com/) (iOS/Android)
- [Phyn Plus](https://www.phyn.com/products/phyn-plus-smart-water-assistant-shutoff-v2/)
- [Phyn Smart Water Sensor](https://www.phyn.com/products/phyn/)
- [aiophyn Library](https://github.com/jordanruthe/aiophyn) (Python API reference)

### A.O. Smith Water Heater
- [iComm Mobile App](https://www.hotwater.com/resources/mobile-apps.html) (iOS/Android)
- [A.O. Smith Heat Pump Water Heaters](https://www.hotwater.com/products/residential/electric/heat-pump/)
- [py-aosmith Library](https://github.com/bdr99/py-aosmith) (Python API reference)
- [Home Assistant Integration](https://www.home-assistant.io/integrations/aosmith/)

### General
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.claude.ai/claude-code)

## Contributing

This is a personal home automation project. Feel free to fork and customize for your own setup!

## License

ISC

## Support

For issues:
- **Miele API**: Contact partner.developer@miele.com
- **LG ThinQ API**: Check the [LG Developer Portal](https://thinq.developer.lge.com)
- **MCP/Claude Code**: See [Claude Code documentation](https://docs.claude.ai/claude-code)
