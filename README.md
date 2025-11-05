# Ambient Companion (Flask + Podman)

Cozy, minimalist dashboard with ambient soundscapes, Pomodoro timers, and wellness reminders. Material 3 vibes with Pastel, Gruvbox, and Catppuccin themes.

## ✨ Features (11+ Complete)

1. **🎧 Adjustable Ambient Soundscapes** - Ocean, rain, forest, café, white/pink/brown noise, plus user uploads
2. **🔔 Customizable Gentle Reminders** - Hydration, stretch, stand-up, focus alerts with TTS & notifications
3. **⏱️ Intelligent Pomodoro Timer** - Visual progress ring, sound cues, productivity tracking
4. **📊 Wellness Logging** - Tracks hydration, rest, focus events with simple stats & feedback
5. **🔔 Desktop & Browser Notifications** - Optional overlays for scheduled wellness prompts
6. **🎨 Theme & Mood Controls** - 3 themes (Pastel, Gruvbox, Catppuccin) × 3 moods (Focus, Cozy, Zen)
7. **🔇 Silent Mode Toggle** - Instant mute for sounds & reminders (perfect for meetings)
8. **📝 User Feedback Form** - Wellness journaling with mood ratings, exportable as CSV
9. **📈 Daily Summary** - Productivity recap with wellness score (0-100), exportable CSV
10. **♿ Accessibility Features** - Text-to-speech, keyboard shortcuts, font controls, screen reader support
11. **👥 Profile Switching** - Multiple profiles for different users/modes (Study, Relax, Exam, Work, Custom)

## Local Dev

```bash
python3 -m venv venv
source venv/bin/activate ||     .\venv\Scripts\activate (on Windows)
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## Container (Podman)

Build:
```bash
podman build -t ambient-companion -f Containerfile .
```
Run:
```bash
podman run --rm -it -p 5000:5000 -e FLASK_SECRET_KEY=change-me \
  -v $(pwd)/data:/data:z ambient-companion
```

Then open http://localhost:5000

Data is persisted in `./data/` (SQLite DB + CSV logs).

## Pages
- **Sounds**: Select and mix ambient tracks, upload your own
- **Timers**: Pomodoro with pastel progress ring, pause/resume controls
- **Reminders**: Voice nudges at chosen intervals, TTS & notification options
- **Stats**: Daily summary with wellness score, export CSV
- **Settings**: Theme/mood selector, profile management, feedback form, accessibility

## Accessibility
- **Keyboard navigation**: Full keyboard support with shortcuts (press `?` for help)
- **Focus styles**: Clear visual indicators
- **Font-size controls**: A+/A- buttons (0.8x - 1.5x scaling)
- **Text-to-speech**: Optional TTS for reminder cues
- **Screen reader**: ARIA labels and semantic HTML
- **Shortcuts**: `1-5` for navigation, `M` for silent mode, `T` for theme, `Space` for timer

## Themes & Moods
- **Themes**: Pastel (default), Gruvbox, Catppuccin (toggle via floating panel or press `T`)
- **Moods**: Focus, Cozy, Zen (changes color palette dynamically)

## Profile Switching
Create multiple profiles for different contexts:
- **Study Mode**: Focus theme, reminders every 45 min
- **Relax Mode**: Cozy mood, ambient sounds only
- **Exam Mode**: High-focus, minimal distractions
- **Work Mode**: Professional productivity setup
- **Custom**: Your own configuration

Each profile saves theme, mood, and font preferences.

## Wellness Score
Your daily wellness is scored 0-100 based on:
- Focus sessions (Pomodoro completions)
- Hydration events
- Break/stretch reminders
- Total focus time

Aim for 75+ for excellent wellness!

## Export Data
- **All Events CSV**: Complete event history
- **Daily Events CSV**: Last 24 hours
- **Daily Summary CSV**: Stats with wellness score
- **Feedback CSV**: Journal entries and mood ratings

## Keyboard Shortcuts
Press `?` anytime to see the full guide:
- `H` - Home
- `1-5` - Navigate to pages (Sounds, Timers, Reminders, Stats, Settings)
- `Space` - Start/pause timer (on Timers page)
- `M` - Toggle silent mode
- `T` - Cycle theme
- `+/-` - Adjust font size
- `Esc` - Go back
- `Ctrl/Cmd+K` - Focus main content

## Documentation
- **FEATURES_VERIFICATION.md** - Complete feature checklist and technical details
- **QUICK_START.md** - User guide with tips and tricks

## License
MIT



