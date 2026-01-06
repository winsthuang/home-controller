# Home Controller Slash Commands

Quick access commands for managing your Miele, LG, and HUUM Sauna appliances through Claude Code.

## 🏠 All Devices

### `/home-status`
Complete overview of ALL appliances (Miele + LG + HUUM)
- Shows every device with current status
- Temperatures, running programs, alerts
- Your daily "everything at a glance" command

### `/check-alerts`
Check for notifications across all devices
- Completed cycles
- Error messages or alerts
- Things that need attention
- Shows "All clear!" if nothing needs action

---

## 🧺 LG Appliances (Laundry)

### `/laundry-status`
Quick check on washers and dryers
- Current state (running, idle, finished)
- Time remaining if running
- Current cycle/program
- Any alerts or issues

### `/start-washer`
Show washer information
- Which washers you have
- Current status of each
- Available programs/cycles
- **Note:** Use natural language to actually start: "start washer on delicate"

### `/start-dryer`
Show dryer information
- Which dryers you have
- Current status of each
- Available programs/settings
- **Note:** Use natural language to actually start: "start dryer on normal"

---

## 🔥 Miele Appliances (Kitchen)

### `/miele-status`
Quick status of all Miele devices
- Oven (H7263BP)
- Refrigerator (KS 7793 D)
- Freezer (FNS 7794 E)
- Brief summary of each

### `/kitchen-status`
Check all kitchen appliances
- Oven: On/off, temperature, program
- Refrigerator: Current & target temps
- Freezer: Temperature, alerts
- Perfect for morning/evening checks

### `/oven-status`
Quick oven check
- Is it on or off?
- Current temperature
- Running program
- Remote control status

### `/fridge-status`
Refrigerator and freezer temperatures
- Fridge: Current temp, target temp, status
- Freezer: Current temp, target temp, alerts
- Quick temp check

### `/freezer-check`
Focused freezer check (especially alerts)
- Current temperature
- Any alerts or notifications
- Door status
- Quick "is everything OK?" check

---

## 🧖 HUUM Sauna

### `/sauna-status`
Check sauna temperature and status
- Current temperature (°C)
- Target temperature if heating
- Heater on/off status
- Door state (open/closed)
- Light status
- Perfect before heading to the sauna!

### `/start-sauna`
Show sauna information and guide
- Current sauna state
- Door status (must be closed to start)
- Safety reminders
- **Note:** Use natural language to actually start: "heat sauna to 80 degrees"

### `/stop-sauna`
Turn off the sauna
- Stops the heater
- Confirms sauna is powering down
- Use when you're done or to cancel heating

---

## 📋 Command Categories

### Morning Routine
```
/home-status        → Everything at once
/check-alerts       → Any overnight issues?
/kitchen-status     → Kitchen appliances check
```

### Before Cooking
```
/oven-status        → Is oven ready?
/kitchen-status     → Overall kitchen check
```

### Laundry Day
```
/laundry-status     → Check washer/dryer
/start-washer       → See washer info
/start-dryer        → See dryer info
```

### Temperature Monitoring
```
/fridge-status      → Temps for fridge & freezer
/freezer-check      → Quick freezer check
```

### Sauna Time
```
/sauna-status       → Check temperature & status
/start-sauna        → See sauna info & guide
/stop-sauna         → Turn off sauna
```

### Complete Overview
```
/home-status        → Absolutely everything
/miele-status       → Just Miele devices
/laundry-status     → Just LG devices
```

---

## 💡 Usage Tips

### Commands Are Quick Checks
All slash commands are designed for **fast, read-only information**. They require minimal approvals.

### Use Natural Language for Control
For actually controlling devices:
- ❌ Don't use: `/start-washer` then navigate menus
- ✅ Do use: "start washer on delicate cycle"

### Combine for Efficiency
Instead of multiple commands:
- ❌ Slow: `/laundry-status` then `/kitchen-status`
- ✅ Fast: `/home-status` (gets both)

### Create Your Own Routines
You can ask naturally:
- "Morning check" → Claude will check everything
- "Kitchen ready?" → Check kitchen appliances
- "Laundry update" → Check laundry status

---

## 🎯 Quick Reference

**Most Used Commands:**
```
/home-status        → Everything
/laundry-status     → Washer & dryer
/kitchen-status     → Kitchen appliances
/sauna-status       → Sauna temperature & status
/check-alerts       → Notifications
```

**Specific Devices:**
```
/oven-status        → Oven only
/fridge-status      → Fridge & freezer temps
/freezer-check      → Freezer + alerts
/sauna-status       → Sauna check
```

**Device Info (for starting):**
```
/start-washer       → Show washer options
/start-dryer        → Show dryer options
/start-sauna        → Show sauna info & guide
```

**Device Control:**
```
/stop-sauna         → Turn off sauna
```

---

## 🔧 Adding More Commands

To create a new command:

1. Create a new `.md` file in this directory
2. Add frontmatter with `name` and `description`
3. Write the prompt/instructions
4. Restart Claude Code to load it

**Example:**
```markdown
---
name: my-command
description: What this command does
---

Your command instructions here...
```

---

## 📞 Need Help?

- **Full Guide:** See `INSTRUCTIONS.md`
- **Quick Start:** See `QUICK-START.md`
- **Setup Info:** Check `README.md`

Just ask: "Help me with slash commands"
