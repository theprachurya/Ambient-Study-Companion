# Quick Start Guide - Ambient Companion

## Getting Started

### 1. Run the Application

```bash
cd /home/zen/LINUX_PROJECT
source venv/bin/activate
python app.py
```

Open your browser to: **http://localhost:5000**

---

## 🎯 Key Features Overview

### 🎧 Ambient Sounds
- Navigate to **Sounds** page (press `1`)
- Click sound buttons to play/stop
- Adjust individual volume sliders
- Use master mix volume control
- Upload your own audio files (max 15MB)

### ⏱️ Pomodoro Timer
- Navigate to **Timers** page (press `2`)
- Set duration (default 25 minutes)
- Press **Start** or hit `Space`
- Use Pause/Resume/Stop as needed
- Timer follows you to other pages (floating widget)

### 🔔 Wellness Reminders
- Navigate to **Reminders** page (press `3`)
- Create custom reminders (e.g., "Hydrate", "Stretch")
- Set interval in minutes
- Toggle on/off, enable TTS/notifications
- Test reminders before scheduling

### 📊 Stats & Daily Summary
- Navigate to **Stats** page (press `4`)
- View focus sessions, time, and wellness score
- See reminder and sound counts
- Export data as CSV files

### ⚙️ Settings & Profiles
- Navigate to **Settings** page (press `5`)
- **Create Profiles**: Click "Manage Profiles"
  - Name your profile
  - Choose mode: Study, Relax, Exam, Work, Custom
  - Switch profiles anytime
- **Submit Feedback/Journal**: Mood rating + notes
- **Test Notifications**: Grant browser permissions

---

## ⌨️ Keyboard Shortcuts

Press `?` anytime to see the full shortcuts guide

### Navigation
- `H` - Home
- `1` - Sounds
- `2` - Timers
- `3` - Reminders
- `4` - Stats
- `5` - Settings
- `Esc` - Go Back

### Controls
- `Space` - Start/Pause Timer (on Timers page)
- `M` - Toggle Silent Mode
- `T` - Cycle Theme
- `+` or `-` - Adjust Font Size
- `Ctrl+K` or `Cmd+K` - Focus Main Content
- `?` - Show Keyboard Shortcuts

---

## 🎨 Themes & Moods

### Themes (Cycle with `T`)
1. **Pastel** - Light, soft, gentle colors
2. **Gruvbox** - Warm, retro aesthetics
3. **Catppuccin** - Dark, modern design

### Moods (Use Mood button in floating panel)
1. **Focus** - Productivity-oriented colors
2. **Cozy** - Warm, relaxing palette
3. **Zen** - Calm, meditative tones

---

## 👥 Profile Switching

Create different profiles for different contexts:

### Example Profiles
- **Deep Study** - Study mode, focus theme, reminders every 45 min
- **Exam Prep** - Exam mode, catppuccin theme, no sound reminders
- **Relaxation** - Relax mode, cozy mood, ambient sounds focus
- **Work Day** - Work mode, gruvbox theme, break reminders every 25 min

### How to Use
1. Go to Settings (`5`)
2. Click "Manage Profiles"
3. Create new profile with name and mode
4. Switch between profiles by clicking "Activate"
5. Each profile remembers its theme, mood, and font size

---

## 📈 Wellness Score

Your daily wellness score (0-100) is calculated based on:
- **Focus Sessions** (up to 30 points) - Completing Pomodoro timers
- **Hydration** (up to 25 points) - Responding to hydration reminders
- **Breaks** (up to 25 points) - Taking stretch/stand breaks
- **Focus Time** (up to 20 points) - Total productive minutes

**Aim for 75+ for excellent wellness!**

---

## 🔇 Silent Mode

Perfect for meetings or deep work:
- Press `M` or click "Silent" button
- Mutes all ambient sounds
- Pauses reminder notifications
- Visual indicator shows "Silent: ON"
- Press `M` again to resume

---

## 📤 Export Your Data

All data is exportable as CSV:

### From Stats Page
- **Export All CSV** - Complete event history
- **Export 24h** - Last 24 hours of events
- **Export Summary** - Daily summary with wellness metrics

### From Settings
- **Feedback Export** - Your journal entries and mood ratings

---

## 🎵 Ambient Sounds Available

### Built-in Soundscapes
1. Ocean - Gentle waves
2. Rain - Soothing rainfall
3. Forest - Nature ambience
4. Café - Coffee shop atmosphere
5. White Noise - Pure static
6. Pink Noise - Balanced frequencies
7. Brown Noise - Deep rumble

### Upload Your Own
- Click upload form on Sounds page
- Supported: MP3, WAV, OGG, WebM
- Max size: 15MB
- Loops automatically

---

## 🔔 Setting Up Notifications

1. Go to Settings
2. Click "Test Notifications"
3. Grant permission when prompted
4. Enable notifications on reminders
5. Configure per-reminder in Reminders page

---

## ♿ Accessibility Features

### For Screen Readers
- Full ARIA label support
- Semantic HTML structure
- Live region updates for stats

### For Keyboard Users
- Complete keyboard navigation
- Focus indicators on all elements
- Shortcuts for all major actions

### For Low Vision
- Font size controls (A+ / A-)
- High contrast themes available
- Large, clear interface elements

### For Hearing Impairment
- Visual notifications available
- Timer progress ring
- Silent mode for TTS-free experience

---

## 💡 Tips & Tricks

1. **Create Mode-Specific Profiles**: Study, Relax, Exam each with custom settings
2. **Combine Sounds**: Mix ocean + rain for deeper relaxation
3. **Use Keyboard Shortcuts**: Navigate faster with `1-5` keys
4. **Track Wellness**: Check daily summary to see your productivity trends
5. **Custom Reminders**: Create specific reminders for your workflow
6. **Export Regularly**: Download CSV summaries for long-term tracking
7. **Silent Mode for Meetings**: Quick `M` press to mute everything
8. **Floating Timer**: Start timer and navigate away - it follows you

---

## 🐛 Troubleshooting

### Sounds not playing?
- Check browser sound permissions
- Verify volume sliders are up
- Disable silent mode (`M`)

### Notifications not showing?
- Click "Test Notifications" in Settings
- Check browser notification permissions
- Ensure notifications enabled on reminder

### Timer not accurate?
- Browser may throttle background tabs
- Keep tab active during timer sessions
- Modern browsers support Web Workers for accuracy

### Profile not saving theme?
- Activate the profile first
- Changes save automatically
- Check browser localStorage is enabled

---

## 📞 Need Help?

- Press `?` for keyboard shortcuts
- All features documented in FEATURES_VERIFICATION.md
- Check README.md for technical details

---

Enjoy your productive and relaxing ambient companion! 🌟
