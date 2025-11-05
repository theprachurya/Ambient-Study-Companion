from __future__ import annotations

import csv
import io
import os
import sqlite3
from datetime import datetime
from pathlib import Path
import subprocess
import json
from typing import Any, Dict, List

from flask import Flask, jsonify, render_template, request, send_file, url_for, g, abort, send_from_directory


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-secret")
    app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100MB for audio uploads

    # Data directories (default to project-local ./data for easy `flask run`)
    default_data_dir = Path(__file__).parent / "data"
    data_dir = Path(os.environ.get("AC_DATA_DIR", str(default_data_dir)))
    data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir = data_dir / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    videos_dir = data_dir / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    sounds_dir = data_dir / "sounds"
    sounds_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "ac.db"
    log_file = data_dir / "logs.csv"

    if not log_file.exists():
        with log_file.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "type", "event", "value"])  # header

    def append_log(event_type: str, event: str, value: str = "") -> None:
        """Persist an event to both the CSV log and the SQLite events table."""
        timestamp = datetime.utcnow().isoformat()

        # Always append to the CSV file for easy inspection
        try:
            with log_file.open("a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([timestamp, event_type, event, value])
        except Exception:
            # CSV logging failures should not prevent database persistence
            pass

        # Mirror the event into the SQLite events table for durable stats
        conn: sqlite3.Connection | None = None
        try:
            conn = sqlite3.connect(str(db_path))
            conn.execute(
                "INSERT INTO events(ts, type, event, value) VALUES(?,?,?,?)",
                (timestamp, event_type or "info", event or "", value or ""),
            )
            conn.commit()
        except Exception:
            # Avoid crashing the request handler if logging fails
            pass
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    # ---- SQLite helpers ----
    def get_db() -> sqlite3.Connection:
        if "db" not in g:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            g.db = conn
        return g.db  # type: ignore[return-value]

    @app.teardown_appcontext
    def close_db(exception: Exception | None):  # type: ignore[no-redef]
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def init_db() -> None:
        conn = sqlite3.connect(str(db_path))
        try:
            cur = conn.cursor()
            # events table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ts TEXT NOT NULL,
                  type TEXT NOT NULL,
                  event TEXT NOT NULL,
                  value TEXT
                );
                """
            )
            # reminders table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS reminders (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  text TEXT NOT NULL,
                  interval_min INTEGER NOT NULL,
                  active INTEGER NOT NULL DEFAULT 1,
                  use_tts INTEGER NOT NULL DEFAULT 1,
                  use_notif INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL
                );
                """
            )
            # feedback table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  mood INTEGER,
                  text TEXT,
                  created_at TEXT NOT NULL
                );
                """
            )
            # settings table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  value TEXT
                );
                """
            )
            # uploads table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS uploads (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  filename TEXT NOT NULL,
                  original_name TEXT,
                  mime TEXT,
                  size INTEGER,
                  created_at TEXT NOT NULL
                );
                """
            )
            # profiles table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS profiles (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  mode TEXT NOT NULL,
                  theme TEXT,
                  mood TEXT,
                  font_scale REAL,
                  is_active INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL
                );
                """
            )
            # timers table (persistent state)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS timers (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  kind TEXT NOT NULL,                 -- pomodoro | stopwatch | custom
                  label TEXT,                         -- optional display label
                  duration_ms INTEGER,                -- for countdown timers (nullable for stopwatch)
                  status TEXT NOT NULL,               -- running | paused | stopped | completed
                  started_at TEXT,                    -- iso timestamp when last started
                  paused_at TEXT,                     -- iso timestamp when paused
                  accumulated_ms INTEGER NOT NULL,    -- elapsed for stopwatch or used_ms for countdown
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                """
            )
            # journals table (long-form notes)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS journals (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT,
                  content TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                """
            )
            # watched_videos table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS watched_videos (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  video_path TEXT NOT NULL UNIQUE,
                  watched INTEGER NOT NULL DEFAULT 1,
                  watched_at TEXT NOT NULL
                );
                """
            )
            conn.commit()
            # Create default profile if none exists
            count = cur.execute("SELECT COUNT(*) FROM profiles").fetchone()[0]
            if count == 0:
                cur.execute(
                    "INSERT INTO profiles(name, mode, theme, mood, font_scale, is_active, created_at) VALUES(?,?,?,?,?,?,?)",
                    ("Default", "study", "pastel", "focus", 1.0, 1, datetime.utcnow().isoformat()),
                )
                conn.commit()
        finally:
            conn.close()

    # Move known ambient sounds into data/sounds for serving
    def init_sounds() -> None:
        project_root = Path(__file__).parent
        known_names = [
            "coffee", "coffee-shop", "rain", "rainfall",
            "forest", "forest-ambience", "white", "white-noise",
        ]
        exts = [".mp3", ".wav", ".ogg", ".webm", ".m4a"]
        for base in known_names:
            for ext in exts:
                cand = project_root / f"{base}{ext}"
                if cand.exists():
                    dest = sounds_dir / cand.name
                    try:
                        if not dest.exists():
                            cand.replace(dest)
                    except Exception:
                        pass
        # Also check uploads directory for matching files
        try:
            for p in uploads_dir.glob("*"):
                nm = p.stem.lower()
                if any(k in nm for k in known_names):
                    dest = sounds_dir / p.name
                    if not dest.exists():
                        try:
                            p.replace(dest)
                        except Exception:
                            pass
        except Exception:
            pass

    # Initialize database schema on startup
    init_db()
    init_sounds()

    @app.route("/")
    def index() -> str:
        return render_template("index.html")

    @app.route("/sounds")
    def sounds() -> str:
        return render_template("sounds.html")

    @app.route("/timers")
    def timers() -> str:
        return render_template("timers.html")

    @app.route("/reminders")
    def reminders() -> str:
        return render_template("reminders.html")

    @app.route("/stats")
    def stats() -> str:
        return render_template("stats.html")

    @app.route("/settings")
    def settings() -> str:
        return render_template("settings.html")

    # Simple APIs for logging and exporting
    @app.post("/api/log")
    def api_log():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        event_type = str(payload.get("type", "info"))
        event = str(payload.get("event", ""))
        value = str(payload.get("value", ""))
        append_log(event_type, event, value)
        return jsonify({"ok": True})

    @app.get("/api/stats")
    def api_stats():  # type: ignore[no-redef]
        # Aggregation from SQLite events
        rng = request.args.get("range", "today")
        db = get_db()
        if rng == "7d":
            since = (datetime.utcnow().timestamp() - 7 * 24 * 3600)
        else:
            # start of today UTC
            now = datetime.utcnow()
            since = datetime(now.year, now.month, now.day).timestamp()

        rows = db.execute("SELECT type, event, value, ts FROM events").fetchall()
        totals: Dict[str, int] = {}
        focus_minutes = 0
        focus_sessions = 0
        pomodoro_count = 0
        stopwatch_count = 0
        reminder_count = 0
        sound_count = 0
        hydration_count = 0
        break_count = 0
        
        import time
        for r in rows:
            try:
                t = datetime.fromisoformat(r["ts"])  # type: ignore[index]
                if t.timestamp() < since:
                    continue
            except Exception:
                continue
            et = r["type"]; ev = r["event"]; val = r["value"]
            if et:
                totals[et] = totals.get(et, 0) + 1
            if ev == "focus_minutes" and val:
                try:
                    focus_minutes += int(float(val))
                except Exception:
                    pass
            if ev == "pomodoro_count" and val:
                try:
                    pomodoro_count += int(float(val))
                except Exception:
                    pass
            if ev == "stopwatch_count" and val:
                try:
                    stopwatch_count += int(float(val))
                except Exception:
                    pass
            if et == "timer" and (ev == "pomodoro_start" or ev == "stopwatch_start" or ev == "start"):
                focus_sessions += 1
            if et == "timer" and ev == "pomodoro_complete":
                # Don't double count if already counted via pomodoro_count
                pass
            if et == "reminder":
                reminder_count += 1
                # Check for hydration reminders
                if val and "hydrat" in val.lower():
                    hydration_count += 1
                # Check for break reminders
                if val and ("break" in val.lower() or "stretch" in val.lower() or "stand" in val.lower()):
                    break_count += 1
            if et == "sound" and ev == "play":
                sound_count += 1
        
        # Calculate wellness score (0-100)
        wellness_score = 0
        if focus_sessions > 0:
            wellness_score += min(30, focus_sessions * 10)
        if hydration_count > 0:
            wellness_score += min(25, hydration_count * 5)
        if break_count > 0:
            wellness_score += min(25, break_count * 5)
        if focus_minutes >= 25:
            wellness_score += min(20, (focus_minutes // 25) * 10)
        
        return jsonify({
            "totals": totals,
            "focus_minutes": focus_minutes,
            "focus_sessions": focus_sessions,
            "pomodoro_count": pomodoro_count,
            "stopwatch_count": stopwatch_count,
            "reminder_count": reminder_count,
            "sound_count": sound_count,
            "hydration_count": hydration_count,
            "break_count": break_count,
            "wellness_score": min(100, wellness_score)
        })

    @app.get("/export.csv")
    def export_csv():  # type: ignore[no-redef]
        with log_file.open("r") as f:
            csv_bytes = f.read().encode("utf-8")
        buf = io.BytesIO(csv_bytes)
        buf.seek(0)
        return send_file(buf, mimetype="text/csv", as_attachment=True, download_name="ambient_logs.csv")

    @app.get("/export_daily.csv")
    def export_daily_csv():  # type: ignore[no-redef]
        # Export last 24h from SQLite events
        db = get_db()
        cutoff = datetime.utcnow().timestamp() - 24 * 3600
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(["timestamp", "type", "event", "value"])  # header
        rows = db.execute("SELECT ts, type, event, value FROM events").fetchall()
        for r in rows:
            try:
                t = datetime.fromisoformat(r["ts"])  # type: ignore[index]
                if t.timestamp() < cutoff:
                    continue
            except Exception:
                continue
            w.writerow([r["ts"], r["type"], r["event"], r["value"]])
        data = output.getvalue().encode("utf-8")
        buf = io.BytesIO(data); buf.seek(0)
        return send_file(buf, mimetype="text/csv", as_attachment=True, download_name="daily_events.csv")

    @app.get("/export_summary.csv")
    def export_summary_csv():  # type: ignore[no-redef]
        # Export daily summary with calculated stats
        db = get_db()
        now = datetime.utcnow()
        since = datetime(now.year, now.month, now.day).timestamp()
        
        rows = db.execute("SELECT type, event, value, ts FROM events").fetchall()
        focus_minutes = 0
        focus_sessions = 0
        pomodoro_count = 0
        stopwatch_count = 0
        reminder_count = 0
        sound_count = 0
        hydration_count = 0
        break_count = 0
        
        for r in rows:
            try:
                t = datetime.fromisoformat(r["ts"])  # type: ignore[index]
                if t.timestamp() < since:
                    continue
            except Exception:
                continue
            et = r["type"]; ev = r["event"]; val = r["value"]
            if ev == "focus_minutes" and val:
                try:
                    focus_minutes += int(float(val))
                except Exception:
                    pass
            if ev == "pomodoro_count" and val:
                try:
                    pomodoro_count += int(float(val))
                except Exception:
                    pass
            if ev == "stopwatch_count" and val:
                try:
                    stopwatch_count += int(float(val))
                except Exception:
                    pass
            if et == "timer" and (ev == "pomodoro_start" or ev == "stopwatch_start" or ev == "start"):
                focus_sessions += 1
            if et == "reminder":
                reminder_count += 1
                if val and "hydrat" in val.lower():
                    hydration_count += 1
                if val and ("break" in val.lower() or "stretch" in val.lower() or "stand" in val.lower()):
                    break_count += 1
            if et == "sound" and ev == "play":
                sound_count += 1
        
        wellness_score = 0
        if focus_sessions > 0:
            wellness_score += min(30, focus_sessions * 10)
        if hydration_count > 0:
            wellness_score += min(25, hydration_count * 5)
        if break_count > 0:
            wellness_score += min(25, break_count * 5)
        if focus_minutes >= 25:
            wellness_score += min(20, (focus_minutes // 25) * 10)
        
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(["Date", "Pomodoros", "Stopwatch Sessions", "Total Focus Sessions", "Focus Minutes", "Reminders", "Sounds", "Hydration", "Breaks", "Wellness Score"])
        w.writerow([now.strftime("%Y-%m-%d"), pomodoro_count, stopwatch_count, focus_sessions, focus_minutes, reminder_count, sound_count, hydration_count, break_count, min(100, wellness_score)])
        
        data = output.getvalue().encode("utf-8")
        buf = io.BytesIO(data); buf.seek(0)
        return send_file(buf, mimetype="text/csv", as_attachment=True, download_name="daily_summary.csv")


    # ---- Uploads ----
    ALLOWED_MIME = {
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/webm",
    }
    MAX_SIZE = 100 * 1024 * 1024  # 100MB

    @app.post("/api/upload")
    def upload_audio():  # type: ignore[no-redef]
        if "audio" not in request.files:
            return jsonify({"ok": False, "error": "No file"}), 400
        f = request.files["audio"]
        if not f.filename:
            return jsonify({"ok": False, "error": "No filename"}), 400
        mime = f.mimetype or ""
        if mime not in ALLOWED_MIME:
            return jsonify({"ok": False, "error": "Unsupported type"}), 400
        # enforce size
        f.stream.seek(0, os.SEEK_END)
        size = f.stream.tell()
        f.stream.seek(0)
        if size > MAX_SIZE:
            return jsonify({"ok": False, "error": "File too large"}), 400

        # safe random filename
        ext = os.path.splitext(f.filename)[1].lower()[:10]
        name = f"aud_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}{ext}"
        save_path = uploads_dir / name
        f.save(save_path)

        db = get_db()
        db.execute(
            "INSERT INTO uploads(filename, original_name, mime, size, created_at) VALUES(?,?,?,?,?)",
            (name, f.filename, mime, size, datetime.utcnow().isoformat()),
        )
        db.commit()
        url = url_for("serve_upload", filename=name)
        return jsonify({"ok": True, "id": name, "url": url})

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename: str):  # type: ignore[no-redef]
        # prevent path traversal
        if ".." in filename or filename.startswith("/"):
            abort(400)
        return send_from_directory(uploads_dir, filename, as_attachment=False)

    # ---- Reminders CRUD ----
    def _validate_bool(v: Any) -> int:
        return 1 if str(v).lower() in {"1", "true", "yes", "on"} else 0

    @app.post("/api/reminders")
    def create_reminder():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        text = (payload.get("text") or "").strip()
        try:
            interval_min = int(payload.get("interval_min", 30))
        except Exception:
            interval_min = 30
        active = _validate_bool(payload.get("active", 1))
        use_tts = _validate_bool(payload.get("use_tts", 1))
        use_notif = _validate_bool(payload.get("use_notif", 0))

        if not text or len(text) > 120:
            return jsonify({"ok": False, "error": "Invalid text"}), 400
        if not (1 <= interval_min <= 1440):
            return jsonify({"ok": False, "error": "Invalid interval"}), 400

        db = get_db()
        cur = db.execute(
            "INSERT INTO reminders(text, interval_min, active, use_tts, use_notif, created_at) VALUES(?,?,?,?,?,?)",
            (text, interval_min, active, use_tts, use_notif, datetime.utcnow().isoformat()),
        )
        db.commit()
        rid = cur.lastrowid
        row = db.execute("SELECT * FROM reminders WHERE id=?", (rid,)).fetchone()
        return jsonify({"ok": True, "reminder": dict(row) if row else None})

    @app.get("/api/reminders")
    def list_reminders():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT * FROM reminders ORDER BY id DESC").fetchall()
        return jsonify({"ok": True, "reminders": [dict(r) for r in rows]})

    @app.patch("/api/reminders/<int:rid>")
    def update_reminder(rid: int):  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        sets = []
        vals: List[Any] = []
        if "text" in payload:
            text = (payload.get("text") or "").strip()
            if not text or len(text) > 120:
                return jsonify({"ok": False, "error": "Invalid text"}), 400
            sets.append("text=?"); vals.append(text)
        if "interval_min" in payload:
            try:
                interval_min = int(payload.get("interval_min", 30))
            except Exception:
                return jsonify({"ok": False, "error": "Invalid interval"}), 400
            if not (1 <= interval_min <= 1440):
                return jsonify({"ok": False, "error": "Invalid interval"}), 400
            sets.append("interval_min=?"); vals.append(interval_min)
        if "active" in payload:
            sets.append("active=?"); vals.append(_validate_bool(payload.get("active")))
        if "use_tts" in payload:
            sets.append("use_tts=?"); vals.append(_validate_bool(payload.get("use_tts")))
        if "use_notif" in payload:
            sets.append("use_notif=?"); vals.append(_validate_bool(payload.get("use_notif")))

        if not sets:
            return jsonify({"ok": False, "error": "No fields"}), 400
        db = get_db()
        vals.append(rid)
        db.execute(f"UPDATE reminders SET {', '.join(sets)} WHERE id=?", tuple(vals))
        db.commit()
        row = db.execute("SELECT * FROM reminders WHERE id=?", (rid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True, "reminder": dict(row)})

    @app.delete("/api/reminders/<int:rid>")
    def delete_reminder(rid: int):  # type: ignore[no-redef]
        db = get_db()
        cur = db.execute("DELETE FROM reminders WHERE id=?", (rid,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    # ---- Feedback ----
    @app.post("/api/feedback")
    def submit_feedback():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        mood = payload.get("mood")
        try:
            mood_i = int(mood) if mood is not None else None
        except Exception:
            mood_i = None
        text = (payload.get("text") or "").strip()
        if text and len(text) > 2000:
            return jsonify({"ok": False, "error": "Text too long"}), 400
        db = get_db()
        db.execute(
            "INSERT INTO feedback(mood, text, created_at) VALUES(?,?,?)",
            (mood_i, text, datetime.utcnow().isoformat()),
        )
        db.commit()
        return jsonify({"ok": True})

    @app.get("/api/feedback/export.csv")
    def export_feedback_csv():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT created_at, mood, text FROM feedback ORDER BY id DESC").fetchall()
        sio = io.StringIO()
        w = csv.writer(sio)
        w.writerow(["created_at", "mood", "text"])
        for r in rows:
            w.writerow([r["created_at"], r["mood"], r["text"]])
        buf = io.BytesIO(sio.getvalue().encode("utf-8")); buf.seek(0)
        return send_file(buf, mimetype="text/csv", as_attachment=True, download_name="feedback.csv")

    # ---- Profiles ----
    @app.post("/api/profiles")
    def create_profile():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        name = (payload.get("name") or "").strip()
        mode = (payload.get("mode") or "study").strip()
        theme = (payload.get("theme") or "pastel").strip()
        mood = (payload.get("mood") or "focus").strip()
        try:
            font_scale = float(payload.get("font_scale", 1.0))
        except Exception:
            font_scale = 1.0

        if not name or len(name) > 50:
            return jsonify({"ok": False, "error": "Invalid name"}), 400
        if mode not in ["study", "relax", "exam", "work", "custom"]:
            mode = "study"
        if theme not in ["pastel", "gruvbox", "catppuccin"]:
            theme = "pastel"
        if mood not in ["focus", "cozy", "zen"]:
            mood = "focus"

        db = get_db()
        cur = db.execute(
            "INSERT INTO profiles(name, mode, theme, mood, font_scale, is_active, created_at) VALUES(?,?,?,?,?,?,?)",
            (name, mode, theme, mood, font_scale, 0, datetime.utcnow().isoformat()),
        )
        db.commit()
        pid = cur.lastrowid
        row = db.execute("SELECT * FROM profiles WHERE id=?", (pid,)).fetchone()
        return jsonify({"ok": True, "profile": dict(row) if row else None})

    @app.get("/api/profiles")
    def list_profiles():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT * FROM profiles ORDER BY is_active DESC, id DESC").fetchall()
        return jsonify({"ok": True, "profiles": [dict(r) for r in rows]})

    @app.get("/api/profiles/active")
    def get_active_profile():  # type: ignore[no-redef]
        db = get_db()
        row = db.execute("SELECT * FROM profiles WHERE is_active=1 LIMIT 1").fetchone()
        if not row:
            return jsonify({"ok": False, "error": "No active profile"}), 404
        return jsonify({"ok": True, "profile": dict(row)})

    @app.post("/api/profiles/<int:pid>/activate")
    def activate_profile(pid: int):  # type: ignore[no-redef]
        db = get_db()
        # Deactivate all profiles
        db.execute("UPDATE profiles SET is_active=0")
        # Activate the selected one
        db.execute("UPDATE profiles SET is_active=1 WHERE id=?", (pid,))
        db.commit()
        row = db.execute("SELECT * FROM profiles WHERE id=?", (pid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True, "profile": dict(row)})

    @app.patch("/api/profiles/<int:pid>")
    def update_profile(pid: int):  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        sets = []
        vals: List[Any] = []
        if "name" in payload:
            name = (payload.get("name") or "").strip()
            if not name or len(name) > 50:
                return jsonify({"ok": False, "error": "Invalid name"}), 400
            sets.append("name=?"); vals.append(name)
        if "mode" in payload:
            mode = (payload.get("mode") or "study").strip()
            if mode not in ["study", "relax", "exam", "work", "custom"]:
                mode = "study"
            sets.append("mode=?"); vals.append(mode)
        if "theme" in payload:
            theme = (payload.get("theme") or "pastel").strip()
            if theme not in ["pastel", "gruvbox", "catppuccin"]:
                theme = "pastel"
            sets.append("theme=?"); vals.append(theme)
        if "mood" in payload:
            mood = (payload.get("mood") or "focus").strip()
            if mood not in ["focus", "cozy", "zen"]:
                mood = "focus"
            sets.append("mood=?"); vals.append(mood)
        if "font_scale" in payload:
            try:
                font_scale = float(payload.get("font_scale", 1.0))
                sets.append("font_scale=?"); vals.append(font_scale)
            except Exception:
                pass

        if not sets:
            return jsonify({"ok": False, "error": "No fields"}), 400
        db = get_db()
        vals.append(pid)
        db.execute(f"UPDATE profiles SET {', '.join(sets)} WHERE id=?", tuple(vals))
        db.commit()
        row = db.execute("SELECT * FROM profiles WHERE id=?", (pid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True, "profile": dict(row)})

    @app.delete("/api/profiles/<int:pid>")
    def delete_profile(pid: int):  # type: ignore[no-redef]
        db = get_db()
        # Prevent deleting the last profile or active profile
        count = db.execute("SELECT COUNT(*) FROM profiles").fetchone()[0]
        if count <= 1:
            return jsonify({"ok": False, "error": "Cannot delete last profile"}), 400
        row = db.execute("SELECT is_active FROM profiles WHERE id=?", (pid,)).fetchone()
        if row and row["is_active"]:
            return jsonify({"ok": False, "error": "Cannot delete active profile"}), 400
        
        cur = db.execute("DELETE FROM profiles WHERE id=?", (pid,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    # ---- Persistent Timers ----
    def _now_iso() -> str:
        return datetime.utcnow().isoformat()

    def _timer_live_fields(row: sqlite3.Row) -> Dict[str, Any]:
        kind = row["kind"]
        status = row["status"]
        duration_ms = row["duration_ms"]
        accumulated_ms = int(row["accumulated_ms"] or 0)
        started_at = row["started_at"]
        live_elapsed = accumulated_ms
        live_remaining = duration_ms if duration_ms is not None else None
        if status == "running" and started_at:
            try:
                started = datetime.fromisoformat(started_at)
                delta_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
                live_elapsed = accumulated_ms + max(0, delta_ms)
            except Exception:
                pass
        if duration_ms is not None:
            used = live_elapsed
            rem = max(0, int(duration_ms) - used)
            live_remaining = rem
        return {
            "live_elapsed_ms": live_elapsed,
            "live_remaining_ms": live_remaining,
        }

    @app.post("/api/timers")
    def create_timer():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        kind = (payload.get("kind") or "pomodoro").strip()
        label = (payload.get("label") or "").strip()
        duration_ms_val = payload.get("duration_ms")
        duration_ms = None
        if duration_ms_val is not None:
            try:
                duration_ms = int(duration_ms_val)
            except Exception:
                return jsonify({"ok": False, "error": "invalid duration_ms"}), 400
        if kind not in ["pomodoro", "stopwatch", "custom"]:
            kind = "custom"
        status = "running"
        now = _now_iso()
        db = get_db()
        cur = db.execute(
            """
            INSERT INTO timers(kind, label, duration_ms, status, started_at, paused_at, accumulated_ms, created_at, updated_at)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (kind, label, duration_ms, status, now, None, 0, now, now),
        )
        db.commit()
        tid = cur.lastrowid
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        data = dict(row) if row else {}
        data.update(_timer_live_fields(row))  # type: ignore[arg-type]
        return jsonify({"ok": True, "timer": data})

    @app.get("/api/timers")
    def list_timers():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT * FROM timers ORDER BY id DESC").fetchall()
        timers = []
        for r in rows:
            d = dict(r)
            d.update(_timer_live_fields(r))
            timers.append(d)
        return jsonify({"ok": True, "timers": timers})

    @app.get("/api/timers/active")
    def active_timers():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT * FROM timers WHERE status IN ('running','paused') ORDER BY id DESC").fetchall()
        timers = []
        for r in rows:
            d = dict(r)
            d.update(_timer_live_fields(r))
            timers.append(d)
        return jsonify({"ok": True, "timers": timers})

    @app.post("/api/timers/<int:tid>/pause")
    def pause_timer(tid: int):  # type: ignore[no-redef]
        db = get_db()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        if row["status"] != "running":
            return jsonify({"ok": False, "error": "Timer not running"}), 400
        try:
            started = datetime.fromisoformat(row["started_at"]) if row["started_at"] else None
        except Exception:
            started = None
        accumulated_ms = int(row["accumulated_ms"] or 0)
        if started:
            delta_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
            accumulated_ms += max(0, delta_ms)
        db.execute(
            "UPDATE timers SET status=?, paused_at=?, accumulated_ms=?, updated_at=? WHERE id=?",
            ("paused", _now_iso(), accumulated_ms, _now_iso(), tid),
        )
        db.commit()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        d = dict(row)
        d.update(_timer_live_fields(row))  # type: ignore[arg-type]
        return jsonify({"ok": True, "timer": d})

    @app.post("/api/timers/<int:tid>/resume")
    def resume_timer(tid: int):  # type: ignore[no-redef]
        db = get_db()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        if row["status"] != "paused":
            return jsonify({"ok": False, "error": "Timer not paused"}), 400
        db.execute(
            "UPDATE timers SET status=?, started_at=?, updated_at=? WHERE id=?",
            ("running", _now_iso(), _now_iso(), tid),
        )
        db.commit()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        d = dict(row)
        d.update(_timer_live_fields(row))  # type: ignore[arg-type]
        return jsonify({"ok": True, "timer": d})

    @app.post("/api/timers/<int:tid>/stop")
    def stop_timer(tid: int):  # type: ignore[no-redef]
        db = get_db()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        accumulated_ms = int(row["accumulated_ms"] or 0)
        if row["status"] == "running" and row["started_at"]:
            try:
                started = datetime.fromisoformat(row["started_at"])  # type: ignore[arg-type]
                delta_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
                accumulated_ms += max(0, delta_ms)
            except Exception:
                pass
        status = "completed" if (row["duration_ms"] is not None and accumulated_ms >= int(row["duration_ms"])) else "stopped"
        db.execute(
            "UPDATE timers SET status=?, paused_at=?, accumulated_ms=?, updated_at=? WHERE id=?",
            (status, _now_iso(), accumulated_ms, _now_iso(), tid),
        )
        db.commit()
        row = db.execute("SELECT * FROM timers WHERE id=?", (tid,)).fetchone()
        d = dict(row)
        d.update(_timer_live_fields(row))  # type: ignore[arg-type]
        return jsonify({"ok": True, "timer": d})

    # ---- Journals CRUD ----
    @app.post("/api/journals")
    def create_journal():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        title = (payload.get("title") or "").strip()
        content = (payload.get("content") or "").strip()
        if not content:
            return jsonify({"ok": False, "error": "content required"}), 400
        now = _now_iso()
        db = get_db()
        cur = db.execute(
            "INSERT INTO journals(title, content, created_at, updated_at) VALUES(?,?,?,?)",
            (title, content, now, now),
        )
        db.commit()
        jid = cur.lastrowid
        row = db.execute("SELECT * FROM journals WHERE id=?", (jid,)).fetchone()
        return jsonify({"ok": True, "journal": dict(row) if row else None})

    @app.get("/api/journals")
    def list_journals():  # type: ignore[no-redef]
        db = get_db()
        rows = db.execute("SELECT * FROM journals ORDER BY id DESC").fetchall()
        return jsonify({"ok": True, "journals": [dict(r) for r in rows]})

    @app.get("/api/journals/<int:jid>")
    def get_journal(jid: int):  # type: ignore[no-redef]
        db = get_db()
        row = db.execute("SELECT * FROM journals WHERE id=?", (jid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True, "journal": dict(row)})

    @app.patch("/api/journals/<int:jid>")
    def update_journal(jid: int):  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        title = payload.get("title")
        content = payload.get("content")
        sets = []
        vals: List[Any] = []
        if title is not None:
            sets.append("title=?"); vals.append((title or "").strip())
        if content is not None:
            c = (content or "").strip()
            if not c:
                return jsonify({"ok": False, "error": "content required"}), 400
            sets.append("content=?"); vals.append(c)
        if not sets:
            return jsonify({"ok": False, "error": "No fields"}), 400
        sets.append("updated_at=?"); vals.append(_now_iso())
        vals.append(jid)
        db = get_db()
        cur = db.execute(f"UPDATE journals SET {', '.join(sets)} WHERE id=?", tuple(vals))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        row = db.execute("SELECT * FROM journals WHERE id=?", (jid,)).fetchone()
        return jsonify({"ok": True, "journal": dict(row) if row else None})

    @app.delete("/api/journals/<int:jid>")
    def delete_journal(jid: int):  # type: ignore[no-redef]
        db = get_db()
        cur = db.execute("DELETE FROM journals WHERE id=?", (jid,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    # ---- Safe Linux Utilities ----
    def _ensure_within(base: Path, target: Path) -> bool:
        try:
            base_r = base.resolve()
            target_r = target.resolve()
            return str(target_r).startswith(str(base_r))
        except Exception:
            return False

    @app.post("/api/utils/mkdir")
    def api_utils_mkdir():  # type: ignore[no-redef]
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        rel = (payload.get("path") or "").strip().lstrip("/")
        if not rel:
            return jsonify({"ok": False, "error": "path required"}), 400
        target = data_dir / rel
        if not _ensure_within(data_dir, target):
            return jsonify({"ok": False, "error": "invalid path"}), 400
        try:
            target.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500
        return jsonify({"ok": True, "path": str(target)})

    @app.get("/api/utils/ls")
    def api_utils_ls():  # type: ignore[no-redef]
        rel = (request.args.get("path") or ".").strip().lstrip("/")
        target = data_dir / rel
        if not _ensure_within(data_dir, target):
            return jsonify({"ok": False, "error": "invalid path"}), 400
        entries = []
        try:
            for p in target.iterdir():
                entries.append({
                    "name": p.name,
                    "is_dir": p.is_dir(),
                    "size": (p.stat().st_size if p.is_file() else None),
                })
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500
        return jsonify({"ok": True, "entries": entries})

    # ---- Ambient Sounds ----
    @app.get("/api/ambient/sounds")
    def list_ambient_sounds():  # type: ignore[no-redef]
        files = []
        try:
            for p in sounds_dir.glob("*"):
                if p.suffix.lower() in {".mp3", ".wav", ".ogg", ".webm", ".m4a"}:
                    files.append({
                        "name": p.stem,
                        "filename": p.name,
                        "url": url_for("serve_ambient", filename=p.name),
                        "size": p.stat().st_size,
                    })
        except Exception:
            pass
        # Prefer stable ordering
        files.sort(key=lambda x: x["name"])  # type: ignore[index]
        return jsonify({"ok": True, "sounds": files})

    @app.get("/ambient/<path:filename>")
    def serve_ambient(filename: str):  # type: ignore[no-redef]
        if ".." in filename or filename.startswith("/"):
            abort(400)
        return send_from_directory(sounds_dir, filename, as_attachment=False)

    # ---- YouTube Video Search & Download ----
    @app.get("/api/videos/search")
    def search_videos():  # type: ignore[no-redef]
        """Search YouTube videos using yt-dlp"""
        query = (request.args.get("query") or "").strip()
        if not query:
            return jsonify({"ok": False, "error": "query required"}), 400
        
        try:
            # Search for up to 20 results
            search_query = f"ytsearch20:{query}"
            result = subprocess.run(
                ["yt-dlp", "--flat-playlist", "--dump-json", "--no-warnings", search_query],
                capture_output=True,
                text=True,
                check=True,
                timeout=30
            )
            
            videos = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    videos.append({
                        "id": data.get("id"),
                        "title": data.get("title"),
                        "url": data.get("url") or f"https://www.youtube.com/watch?v={data.get('id')}",
                        "duration": data.get("duration"),
                        "channel": data.get("channel") or data.get("uploader"),
                        "thumbnail": data.get("thumbnail"),
                        "description": data.get("description", "")[:200] if data.get("description") else ""
                    })
                except json.JSONDecodeError:
                    continue
            
            return jsonify({"ok": True, "videos": videos})
        except subprocess.TimeoutExpired:
            return jsonify({"ok": False, "error": "Search timeout"}), 408
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.post("/api/videos/download")
    def download_video():  # type: ignore[no-redef]
        """Download a YouTube video or playlist"""
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        url = (payload.get("url") or "").strip()
        is_playlist = payload.get("is_playlist", False)
        quality = payload.get("quality", "best")
        
        if not url:
            return jsonify({"ok": False, "error": "url required"}), 400
        
        try:
            # Build quality format string
            if quality == 'best':
                format_str = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            elif quality == 'audio':
                format_str = 'bestaudio[ext=m4a]/bestaudio/best'
            else:
                # For specific resolutions like 720, 1080, etc.
                format_str = f'bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best'
            
            # Determine download location
            if is_playlist:
                # Extract playlist info first
                info_result = subprocess.run(
                    ["yt-dlp", "--flat-playlist", "--dump-json", "--no-warnings", url],
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=30
                )
                
                # Get playlist title from first entry
                first_line = info_result.stdout.strip().split('\n')[0] if info_result.stdout.strip() else None
                playlist_title = "playlist"
                if first_line:
                    try:
                        first_data = json.loads(first_line)
                        playlist_title = first_data.get("playlist_title") or first_data.get("playlist") or "playlist"
                    except:
                        pass
                
                # Sanitize playlist name
                playlist_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in playlist_title)
                playlist_dir = videos_dir / playlist_name
                playlist_dir.mkdir(parents=True, exist_ok=True)
                output_template = str(playlist_dir / "%(title)s.%(ext)s")
            else:
                output_template = str(videos_dir / "%(title)s.%(ext)s")
            
            # Download video(s)
            download_result = subprocess.run(
                [
                    "yt-dlp",
                    "-f", format_str,
                    "--merge-output-format", "mp4",
                    "-o", output_template,
                    "--no-warnings",
                    url
                ],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes max
            )
            
            if download_result.returncode != 0:
                return jsonify({"ok": False, "error": f"Download failed: {download_result.stderr}"}), 500
            
            return jsonify({
                "ok": True,
                "message": "Download complete",
                "is_playlist": is_playlist,
                "location": str(playlist_dir if is_playlist else videos_dir)
            })
            
        except subprocess.TimeoutExpired:
            return jsonify({"ok": False, "error": "Download timeout"}), 408
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.get("/api/videos/library")
    def get_video_library():  # type: ignore[no-redef]
        """List all downloaded videos and playlists"""
        try:
            library = {
                "videos": [],
                "playlists": []
            }
            
            # Get watched status from database
            db = get_db()
            watched_paths = {}
            rows = db.execute("SELECT video_path, watched FROM watched_videos").fetchall()
            for row in rows:
                watched_paths[row[0]] = bool(row[1])
            
            # Scan videos directory
            for item in videos_dir.iterdir():
                if item.is_file() and item.suffix.lower() in {".mp4", ".mkv", ".webm", ".avi"}:
                    video_path = str(item.relative_to(videos_dir))
                    library["videos"].append({
                        "name": item.stem,
                        "filename": item.name,
                        "size": item.stat().st_size,
                        "path": video_path,
                        "watched": watched_paths.get(video_path, False)
                    })
                elif item.is_dir():
                    # It's a playlist directory
                    videos_in_playlist = []
                    for video in item.iterdir():
                        if video.is_file() and video.suffix.lower() in {".mp4", ".mkv", ".webm", ".avi"}:
                            video_path = str(video.relative_to(videos_dir))
                            videos_in_playlist.append({
                                "name": video.stem,
                                "filename": video.name,
                                "size": video.stat().st_size,
                                "path": video_path,
                                "watched": watched_paths.get(video_path, False)
                            })
                    
                    if videos_in_playlist:
                        library["playlists"].append({
                            "name": item.name,
                            "video_count": len(videos_in_playlist),
                            "videos": videos_in_playlist
                        })
            
            # Sort for consistent ordering
            library["videos"].sort(key=lambda x: x["name"].lower())
            library["playlists"].sort(key=lambda x: x["name"].lower())
            
            return jsonify({"ok": True, "library": library})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.post("/api/videos/toggle-watched")
    def toggle_watched_status():  # type: ignore[no-redef]
        """Toggle watched status of a video"""
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        path = (payload.get("path") or "").strip()
        
        if not path:
            return jsonify({"ok": False, "error": "path required"}), 400
        
        try:
            db = get_db()
            # Check if video exists in watched_videos
            row = db.execute("SELECT id, watched FROM watched_videos WHERE video_path = ?", (path,)).fetchone()
            
            if row:
                # Toggle the watched status
                new_watched = 0 if row[1] else 1
                db.execute(
                    "UPDATE watched_videos SET watched = ?, watched_at = ? WHERE video_path = ?",
                    (new_watched, datetime.utcnow().isoformat(), path)
                )
                db.commit()
                return jsonify({"ok": True, "watched": bool(new_watched)})
            else:
                # Add new entry as watched
                db.execute(
                    "INSERT INTO watched_videos(video_path, watched, watched_at) VALUES(?, 1, ?)",
                    (path, datetime.utcnow().isoformat())
                )
                db.commit()
                return jsonify({"ok": True, "watched": True})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.delete("/api/videos/delete")
    def delete_video():  # type: ignore[no-redef]
        """Delete a video or playlist"""
        payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
        path = (payload.get("path") or "").strip()
        is_playlist = payload.get("is_playlist", False)
        
        if not path:
            return jsonify({"ok": False, "error": "path required"}), 400
        
        try:
            target = videos_dir / path
            
            # Security check: ensure path is within videos_dir
            if not str(target.resolve()).startswith(str(videos_dir.resolve())):
                return jsonify({"ok": False, "error": "Invalid path"}), 400
            
            if is_playlist:
                if target.is_dir():
                    import shutil
                    shutil.rmtree(target)
                    return jsonify({"ok": True, "message": "Playlist deleted"})
                else:
                    return jsonify({"ok": False, "error": "Playlist not found"}), 404
            else:
                if target.is_file():
                    target.unlink()
                    return jsonify({"ok": True, "message": "Video deleted"})
                else:
                    return jsonify({"ok": False, "error": "Video not found"}), 404
                    
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.get("/data/videos/<path:filename>")
    def serve_video(filename):  # type: ignore[no-redef]
        """Serve video files for playback"""
        try:
            # Security: ensure path is within videos_dir
            video_path = videos_dir / filename
            if not str(video_path.resolve()).startswith(str(videos_dir.resolve())):
                abort(403)
            
            if not video_path.exists():
                abort(404)
            
            # Get the directory and filename
            directory = video_path.parent
            file_name = video_path.name
            
            return send_from_directory(directory, file_name)
        except Exception as e:
            abort(404)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)


