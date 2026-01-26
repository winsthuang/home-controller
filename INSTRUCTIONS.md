# Home Controller - Simple User Guide

Welcome! This guide will help you control your home appliances (Miele, LG ThinQ, HUUM Sauna, Phyn Water Monitor, A.O. Smith Water Heater, and Tedee Smart Locks) using Claude Code. No technical expertise required!

## What Can I Do?

You can control and monitor your home appliances by talking to Claude Code in natural language. For example:
- "What's the status of my washer?"
- "Is my laundry done?"
- "Check my refrigerator temperature"
- "Set the freezer to -18 degrees"
- "Start the dryer"
- "Heat the sauna to 80 degrees"
- "What's the sauna temperature?"
- "What's my water pressure?"
- "How much water did I use this month?"
- "What's my water heater temperature?"
- "Set water heater to 120 degrees"

You can also use quick slash commands like `/laundry-status`, `/sauna-status`, `/water-status`, or `/water-heater-status` to get instant updates.

## Getting Started from Scratch

### Step 1: Open Your Terminal

**On Mac:**
1. Press `Command (⌘) + Space` to open Spotlight
2. Type "Terminal" and press Enter
3. A black or white window will open - this is your terminal

**On Windows:**
1. Press `Windows Key + R`
2. Type "cmd" and press Enter
3. A black window will open - this is your command prompt

**On Linux:**
1. Press `Ctrl + Alt + T`
2. A terminal window will open

### Step 2: Navigate to the Home Controller Directory

In your terminal, type this command and press Enter:
```bash
cd "/Users/winstonhuang/Documents/Claude Code/Home Controller"
```

**Tip:** If you're not sure where the folder is, you can drag and drop the folder into your terminal window after typing `cd ` (note the space after cd).

### Step 3: Start Claude Code

If you haven't already, make sure Claude Code is installed. Then type:
```bash
claude
```

This will start Claude Code in your Home Controller directory.

## Quick Commands (Slash Commands)

Once Claude Code is running, you can use these quick commands by typing them directly:

### Laundry Commands
- `/laundry-status` - Check if your washer/dryer is running and how much time is left
- `/start-washer` - Get help starting your washer
- `/start-dryer` - Get help starting your dryer

### Kitchen Commands
- `/kitchen-status` - Check all Miele kitchen appliances (oven, fridge, etc.)
- `/fridge-status` - Check refrigerator and freezer temperatures
- `/set-fridge-temp` - Set refrigerator or freezer temperature
- `/freezer-check` - Quick freezer check (especially for alerts)
- `/oven-status` - Quick check on the oven

### Sauna Commands
- `/sauna-status` - Check sauna temperature, door state, and heating status
- `/start-sauna` - Get help starting the sauna
- `/stop-sauna` - Turn off the sauna

### Water Commands
- `/water-status` - Check water pressure, temperature, and flow
- `/water-report` - Get water consumption report (daily/monthly)

### Water Heater Commands
- `/water-heater-status` - Check water heater temperature, mode, and status
- `/set-water-heater` - Get help changing water heater settings

### Smart Lock Commands
- `/get_device_status` - Check all smart lock status, battery, and door state
- `/lock_doors` - Lock one or all doors
- `/unlock_doors` - Unlock one or all doors
- `/get_activity_logs` - View recent lock/unlock activity history

### General Commands
- `/home-status` - See the status of ALL your appliances at once
- `/miele-status` - Check all Miele appliances
- `/check-alerts` - See if any appliances need attention

## Using Natural Language

You don't need to memorize commands! Just talk to Claude naturally:

### Examples for Laundry
- "Is my laundry done?"
- "How much time is left on the dryer?"
- "What's the status of my washer?"
- "Can you check if the dryer is running?"

### Examples for Kitchen
- "What's the temperature in my fridge?"
- "Set the freezer to -18 degrees"
- "Make the fridge a bit colder"
- "Is the oven on?"
- "Check my freezer"
- "Show me all my Miele appliances"

### Examples for Sauna
- "What's the sauna temperature?"
- "Heat the sauna to 80 degrees"
- "Is the sauna ready?"
- "Turn off the sauna"
- "Is the sauna door closed?"

### Examples for Water
- "What's my water pressure?"
- "How much water did I use this month?"
- "Check my water system"
- "Shut off the water" (emergency shutoff)
- "Open the water valve"

### Examples for Water Heater
- "What's my water heater temperature?"
- "Set the water heater to 120 degrees"
- "Put the water heater in heat pump mode"
- "Is there hot water available?"
- "Put water heater in vacation mode"

### Examples for Smart Locks
- "Is my door locked?"
- "Lock the front door"
- "Unlock all doors"
- "Check my lock battery"
- "Who unlocked the door today?"
- "Show me lock activity"

### Examples for General Use
- "What appliances do I have?"
- "Are any of my appliances running right now?"
- "Check everything"
- "Do I have any alerts?"

## Understanding the Output

### Laundry Status
When you check laundry status, you'll see:
- **State:** Is it OFF, RUNNING, or DONE (END)?
- **Time Remaining:** How many hours and minutes left
- **Program:** What cycle is running (Delicate, Normal, etc.)
- **Remote Control:** Can you control it remotely? (Should be ON)

### Kitchen Appliance Status
- **Temperature:** Current temp for fridges/freezers
- **State:** On/Off or current mode
- **Alerts:** Any issues that need attention

### Sauna Status
When you check sauna status, you'll see:
- **Temperature:** Current temperature in Celsius
- **Target Temperature:** What temperature it's heating to
- **Heater:** Is it ON (heating) or OFF
- **Door:** Open or Closed (must be closed to start)
- **Light:** On or Off

### Water Status
When you check water status, you'll see:
- **Pressure:** Current water pressure in PSI
- **Temperature:** Water temperature in Fahrenheit
- **Flow:** Current flow rate (if water is running)
- **Valve:** Open or Closed (Phyn Plus only)
- **Online:** Device connectivity status

### Water Report
When you get a water report, you'll see:
- **Total Consumption:** Gallons used in the period
- **Period:** Time range covered (day/month/year)

### Water Heater Status
When you check water heater status, you'll see:
- **Temperature:** Current setpoint in Fahrenheit
- **Mode:** Current operation mode (Heat Pump, Hybrid, Electric, Vacation)
- **Hot Water Status:** Availability level (High, Medium, Low)
- **Online:** Device connectivity status

### Smart Lock Status
When you check lock status, you'll see:
- **Lock State:** Locked, Unlocked, or Semi-locked
- **Door State:** Open or Closed
- **Battery:** Battery percentage (0-100%)
- **Connected:** Bridge connection status

### Lock Activity
When you view lock activity, you'll see:
- **Event Type:** Lock, Unlock, or Pull Spring
- **Time:** When the event occurred
- **User:** Who performed the action (if available)

## Troubleshooting

### "Command not found: claude"
Claude Code is not installed or not in your PATH. Ask your system administrator or refer to the Claude Code installation guide.

### "401 Unauthorized" or "Token expired"
Your Miele access token has expired (they last 30 days). To refresh:
1. Open terminal in this directory
2. Type: `npm run auth`
3. Follow the instructions to log in again

### "No devices found"
- Make sure your appliances are powered on and connected to WiFi
- Check that remote control is enabled on the device
- Verify your credentials are set up correctly in the `.env` file

### "MCP server not responding"
1. Make sure you're in the Home Controller directory
2. Check that the `.env` file has your credentials
3. Try closing and reopening Claude Code

### Appliance Won't Start
- Ensure the appliance door is properly closed
- Check that remote control is enabled on the appliance itself
- Make sure the appliance is not in a locked state

### Sauna Won't Start
- The sauna door MUST be closed for safety - check `/sauna-status` to verify
- Make sure the UKU WiFi controller is powered on and connected
- Verify the sauna is online in the HUUM mobile app
- Check that your HUUM credentials are correct in the `.env` file

### Water System Not Responding
- Check that your Phyn devices are online in the Phyn app
- Verify your Phyn credentials are correct in the `.env` file
- Ensure your Phyn devices have WiFi connectivity

### Can't Control Water Valve
- Only Phyn Plus devices have shutoff valve control
- Smart Water Sensors (PW1) are monitoring-only
- Check that the valve is not manually locked

### Water Heater Not Responding
- Check that your water heater is connected to WiFi
- Verify the water heater is online in the iComm mobile app
- Ensure your iComm credentials are correct in the `.env` file
- Try logging out and back into the iComm app

### Smart Lock Not Responding
- Check that the Tedee Bridge is powered and connected to WiFi
- Verify the lock shows as connected in the Tedee app
- Ensure your Tedee API key is correct in the `.env` file
- Check lock battery level - low battery can cause connectivity issues

### "Lock operation pending"
- Lock operations are asynchronous - wait a few seconds
- If the operation doesn't complete, check the lock's Bluetooth connection to the bridge
- Make sure no one is manually operating the lock

## Common Scenarios

### Scenario 1: Check if Laundry is Done
1. Open terminal
2. Navigate to Home Controller: `cd "/Users/winstonhuang/Documents/Claude Code/Home Controller"`
3. Start Claude Code: `claude`
4. Type: `/laundry-status` OR "Is my laundry done?"

### Scenario 2: Monitor Kitchen While Cooking
1. Start Claude Code in Home Controller directory
2. Ask: "What's my oven doing?" or use `/oven-status`
3. Check periodically or ask "Are there any alerts?"

### Scenario 2b: Adjust Fridge/Freezer Temperature
1. Start Claude Code
2. Ask: "Set the freezer to -17 degrees" or use `/set-fridge-temp`
3. Claude will confirm the temperature change
4. Valid ranges: Fridge 1-9°C, Freezer -24 to -16°C

### Scenario 3: Morning Appliance Check
1. Start Claude Code
2. Type: `/home-status`
3. You'll see the status of all your appliances at once

### Scenario 4: Start the Washer Remotely
1. Start Claude Code
2. Say: "Start the washer on delicate cycle"
3. Claude will guide you through the process

### Scenario 5: Pre-Heat the Sauna Before Getting Home
1. Start Claude Code
2. Say: "Heat the sauna to 80 degrees"
3. Monitor with `/sauna-status`
4. When you get home, the sauna will be ready!

### Scenario 6: Check Monthly Water Usage
1. Start Claude Code
2. Type: `/water-report`
3. You'll see total water consumption for the month
4. Great for tracking usage and finding leaks!

### Scenario 7: Emergency Water Shutoff
1. Start Claude Code (or use the Phyn app)
2. Say: "Shut off the water" or "Close the water valve"
3. The Phyn Plus will close the main water valve
4. To restore, say: "Open the water valve"

### Scenario 8: Going on Vacation
1. Start Claude Code
2. Say: "Put the water heater in vacation mode"
3. The water heater will switch to energy-saving mode
4. When you return, say: "Set water heater to hybrid mode"

### Scenario 9: Check Water Heater Before Guests Arrive
1. Start Claude Code
2. Type: `/water-heater-status`
3. If hot water is low, say: "Set water heater to electric mode" for fastest recovery
4. Once guests leave, switch back: "Set water heater to heat pump mode"

### Scenario 10: Check if All Doors Are Locked Before Bed
1. Start Claude Code
2. Type: `/get_device_status` or ask "Are all my doors locked?"
3. If any door is unlocked, say: "Lock all doors"
4. Claude will confirm when all doors are secured

### Scenario 11: View Who's Been Coming and Going
1. Start Claude Code
2. Type: `/get_activity_logs`
3. You'll see recent lock/unlock events with timestamps
4. Great for checking if packages were delivered or kids got home

## Tips for Best Results

1. **Be Specific:** Instead of "check that", say "check the washer" or "check the oven"
2. **Use Slash Commands for Speed:** If you just want status, slash commands are fastest
3. **Ask Follow-up Questions:** You can have a conversation! "Is the dryer done?" → "How much time is left?" → "Can you alert me when it's done?"
4. **Keep Claude Code Running:** Leave it open to easily check status anytime

## What Appliances Are Connected?

Based on your setup, you should have access to:

### LG ThinQ Appliances
- Washer
- Dryer

### Miele Appliances
- Oven
- Refrigerator
- Freezer
- (Any other Miele appliances connected to your account)

### HUUM Appliances
- Sauna (with UKU WiFi controller)

### Phyn Water Monitor
- Phyn Plus (main water shutoff valve)
- Smart Water Sensors (HVAC, Hot Water Heater, etc.)

### A.O. Smith Water Heater
- Heat Pump Water Heater (iComm-enabled)

### Tedee Smart Locks
- Smart locks (connected via Tedee Bridge)

To see your complete list, just ask: "What appliances do I have?" or type `/home-status`

## Security & Privacy

- Your credentials are stored locally on your computer (in the `.env` file)
- Nothing is sent to the cloud except standard API calls to Miele, LG, HUUM, Phyn, A.O. Smith, and Tedee
- Your tokens are never shared with anyone
- The `.env` file is excluded from git to prevent accidental sharing

## Need More Help?

- Check the detailed `README.md` file for technical setup
- Visit the Miele Developer Portal: https://developer.miele.com/
- Visit the LG ThinQ Developer Portal: https://thinq.developer.lge.com
- Check the HUUM support: https://huumsauna.com/
- Visit the Tedee Portal: https://portal.tedee.com/
- Contact support for your specific appliance brand if devices aren't responding

## Quick Reference Card

Save this for easy access:

```
QUICK COMMANDS:
/laundry-status       → Washer & Dryer status
/kitchen-status       → All kitchen appliances
/sauna-status         → Sauna temperature & status
/water-status         → Water pressure & flow
/water-report         → Water consumption report
/water-heater-status  → Water heater temp & mode
/set-water-heater     → Change water heater settings
/get_device_status    → Smart lock status
/lock_doors           → Lock doors
/unlock_doors         → Unlock doors
/get_activity_logs    → Lock/unlock history
/home-status          → All appliances
/fridge-status        → Fridge & freezer temps
/set-fridge-temp      → Set fridge/freezer temperature
/oven-status          → Oven status
/start-sauna          → Start sauna heating
/stop-sauna           → Turn off sauna
/check-alerts         → Any alerts or issues

NATURAL LANGUAGE EXAMPLES:
"Is my laundry done?"
"What's my fridge temperature?"
"Set the freezer to -18 degrees"
"Check the oven"
"Heat the sauna to 80 degrees"
"What's the sauna temperature?"
"What's my water pressure?"
"How much water did I use this month?"
"What's my water heater temperature?"
"Set water heater to 120 degrees"
"Is my door locked?"
"Lock all doors"
"Start the washer"
"Show me everything"

TO START:
1. Open Terminal
2. cd "/Users/winstonhuang/Documents/Claude Code/Home Controller"
3. claude
4. Start asking questions or use slash commands!
```

---

**Enjoy controlling your smart home with Claude Code!**
