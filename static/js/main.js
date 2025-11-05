(function () {
  const root = document.documentElement;
  const themeBtn = document.getElementById('toggleTheme');
  const incFont = document.getElementById('increaseFont');
  const decFont = document.getElementById('decreaseFont');
  const silentBtn = document.getElementById('toggleSilent');
  const moodBtn = document.getElementById('toggleMood');

  const THEMES = ['pastel', 'gruvbox', 'catppuccin'];
  let themeIndex = 0;

  function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('ac-theme', name);
  }

  function loadTheme() {
    const saved = localStorage.getItem('ac-theme');
    if (saved && THEMES.includes(saved)) return setTheme(saved);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'catppuccin' : 'pastel');
  }

  function cycleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'pastel';
    themeIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
    setTheme(THEMES[themeIndex]);
  }

  function log(type, eventName, value = '') {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, event: eventName, value }),
      });
    } catch {}
  }

  // Play completion sound (clock chime)
  function playCompletionSound() {
    try {
      const audio = new Audio('/static/sounds/clock.mp3');
      audio.volume = 0.6; // Set to 60% volume so it's not too loud
      audio.play().catch(err => {
        console.log('Could not play completion sound:', err);
      });
    } catch (err) {
      console.log('Completion sound error:', err);
    }
  }

  let fontScale = parseFloat(localStorage.getItem('ac-font-scale') || '1');
  function applyFontScale() {
    root.style.fontSize = `${Math.max(0.8, Math.min(1.5, fontScale))}rem`;
    localStorage.setItem('ac-font-scale', String(fontScale));
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      const main = document.querySelector('main');
      if (main) main.focus();
      e.preventDefault();
    }
    // Enhanced keyboard shortcuts
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't interfere with input fields
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const k = e.key.toLowerCase();
      // M: Toggle silent mode
      if (k === 'm') { 
        silent = !silent; 
        localStorage.setItem('ac-silent', silent ? '1':'0'); 
        applySilent(); 
        e.preventDefault();
      }
      // T: Toggle theme
      else if (k === 't') {
        cycleTheme();
        e.preventDefault();
      }
      // Space: Start/pause timer if on timers panel
      else if (k === ' ') {
        const p = document.querySelector('[data-panel="timers"]');
        if (p && !p.hidden) {
          const btn = document.getElementById('start-pomodoro');
          if (btn) btn.click();
          e.preventDefault();
        }
      }
      // 1-5: Navigate to different pages
      else if (k === '1') {
        showPanel('sounds');
        e.preventDefault();
      }
      else if (k === '2') {
        showPanel('timers');
        e.preventDefault();
      }
      else if (k === '3') {
        showPanel('reminders');
        e.preventDefault();
      }
      else if (k === '4') {
        showPanel('videos');
        e.preventDefault();
      }
      else if (k === '5') {
        showPanel('journal');
        e.preventDefault();
      }
      else if (k === '6') {
        showPanel('stats');
        e.preventDefault();
      }
      else if (k === '7') {
        showPanel('settings');
        e.preventDefault();
      }
      // H: Go home
      else if (k === 'h') {
        showPanel('home');
        e.preventDefault();
      }
      // Escape: Go back or home
      else if (k === 'escape') {
        backOrHome();
        e.preventDefault();
      }
      // +/-: Font size
      else if (k === '+' || k === '=') {
        fontScale += 0.05;
        applyFontScale();
        e.preventDefault();
      }
      else if (k === '-' || k === '_') {
        fontScale -= 0.05;
        applyFontScale();
        e.preventDefault();
      }
      // ?: Show keyboard shortcuts help
      else if (k === '?' || (e.shiftKey && k === '/')) {
        showKeyboardHelp();
        e.preventDefault();
      }
    }
  });

  if (themeBtn) themeBtn.addEventListener('click', () => { cycleTheme(); log('ui', 'theme_toggle'); });
  if (incFont) incFont.addEventListener('click', () => { fontScale += 0.05; applyFontScale(); });
  if (decFont) decFont.addEventListener('click', () => { fontScale -= 0.05; applyFontScale(); });
  let silent = localStorage.getItem('ac-silent') === '1';
  function applySilent() {
    const active = window.__ac_active_sounds || new Map();
    active.forEach((a) => { a.muted = silent; });
    if (silentBtn) silentBtn.textContent = silent ? 'Silent: ON' : 'Silent';
  }
  if (silentBtn) silentBtn.addEventListener('click', () => { silent = !silent; localStorage.setItem('ac-silent', silent ? '1':'0'); applySilent(); });

  const MOODS = ['focus','cozy','zen'];
  function setMood(m) { document.documentElement.setAttribute('data-mood', m); localStorage.setItem('ac-mood', m); }
  function loadMood() { const m = localStorage.getItem('ac-mood') || 'focus'; setMood(m); }
  if (moodBtn) moodBtn.addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-mood') || 'focus'; const next = MOODS[(MOODS.indexOf(cur)+1)%MOODS.length]; setMood(next); });

  // SPA Router
  const panels = () => Array.from(document.querySelectorAll('[data-panel]'));
  function showPanel(id, push = true) {
    panels().forEach(p => p.hidden = p.getAttribute('data-panel') !== id);
    if (push) history.pushState({ panel: id }, '', `#${id}`);
    const main = document.getElementById('app-main');
    if (main) main.focus();
    // init hooks on first show
    if (id === 'sounds') ensureInit(initSounds);
    if (id === 'timers') ensureInit(initTimers);
    if (id === 'reminders') ensureInit(initReminders);
    if (id === 'videos') ensureInit(initVideos);
    if (id === 'journal') ensureInit(initJournal);
    if (id === 'stats') ensureInit(initStats);
  }
  function ensureInit(fn) { try { fn.__inited = fn.__inited || (fn(), true); } catch {} }
  function backOrHome() { if (history.state && history.length > 1) history.back(); else showPanel('home'); }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-nav]');
    if (t) {
      e.preventDefault();
      const id = t.getAttribute('data-nav');
      showPanel(id);
    }
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); backOrHome(); }
  });

  window.addEventListener('popstate', (e) => {
    const id = (e.state && e.state.panel) || (location.hash ? location.hash.substring(1) : 'home');
    showPanel(id, false);
  });

  // Page-specific hooks
  document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    applyFontScale();
    applySilent();

    // Initial panel
    loadMood();
    // Start reminder daemon globally
    initReminderDaemon();
    const initial = location.hash ? location.hash.substring(1) : 'home';
    showPanel(initial, false);
  });

  function speak(text) {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {}
  }

  // Sounds
  function initSounds() {
    if (initSounds.__inited) return; // guard
    
    const container = document.getElementById('sound-grid');
    const mixVolume = document.getElementById('mix-volume');
    const active = window.__ac_active_sounds || new Map();
    window.__ac_active_sounds = active;
    
    // Store slider references for each sound
    const sliders = new Map();

    // Load sounds from backend
    fetch('/api/ambient/sounds')
      .then(res => res.json())
      .then(data => {
        if (!data.ok || !data.sounds || data.sounds.length === 0) {
          // Fallback to hardcoded sounds if API fails or returns empty
          const fallbackSounds = [
            { id: 'ocean', label: 'Ocean', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_2c73b81c71.mp3?filename=ocean-waves-ambient-6111.mp3' },
            { id: 'rain', label: 'Rain', url: 'https://cdn.pixabay.com/download/audio/2021/08/08/audio_2c6d1b263c.mp3?filename=rain-ambient-7250.mp3' },
            { id: 'forest', label: 'Forest', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_3a6f50d6e4.mp3?filename=forest-ambience-110624.mp3' },
            { id: 'cafe', label: 'Café', url: 'https://cdn.pixabay.com/download/audio/2022/01/03/audio_1d4f92e5c8.mp3?filename=coffee-shop-ambient-ambient-98920.mp3' },
          ];
          renderSounds(fallbackSounds);
        } else {
          // Use local sounds from backend
          const sounds = data.sounds.map(s => ({
            id: s.filename.replace(/\.[^.]+$/, ''), // Remove extension for ID
            label: s.name,
            url: s.url
          }));
          renderSounds(sounds);
        }
      })
      .catch(err => {
        console.error('Failed to load sounds:', err);
        container.innerHTML = '<p class="muted">Failed to load sounds. Please refresh the page.</p>';
      });

    function normalizeLabel(rawLabel, fallbackId) {
      const base = (rawLabel && rawLabel.trim()) ? rawLabel : (fallbackId || '').replace(/[_-]+/g, ' ');
      return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
    }

    function guessMime(url) {
      try {
        const clean = url.split('?')[0];
        const ext = (clean.split('.').pop() || '').toLowerCase();
        if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') return 'audio/mp4';
        if (ext === 'mp3') return 'audio/mpeg';
        if (ext === 'ogg') return 'audio/ogg';
        if (ext === 'wav') return 'audio/wav';
      } catch {}
      return 'audio/mpeg';
    }

    function renderSounds(sounds) {
      if (!container) return;
      container.innerHTML = '';
      sounds.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'card fade-in';
        const btn = document.createElement('button');
        btn.className = 'btn';
        const displayLabel = normalizeLabel(s.label, s.id);
        btn.textContent = displayLabel;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.value = '0.7';
        
        // Store slider reference
        sliders.set(s.id, slider);

        // Create audio element for this sound
        let audio = active.get(s.id);
        const mime = guessMime(s.url);
        if (!audio) {
          audio = new Audio();
          audio.loop = true;
          audio.preload = 'metadata';
          
          // Add error handler
          audio.addEventListener('error', (e) => {
            console.error('Audio error for', displayLabel, ':', e);
            btn.textContent = displayLabel + ' (Failed to load)';
            btn.disabled = true;
          });
          
          // Add loaded handler
          audio.addEventListener('canplaythrough', () => {
            console.log('Audio ready:', displayLabel);
          });
        }
        if (audio.src !== s.url) {
          audio.src = s.url;
        }
        if (mime && audio.canPlayType && !audio.canPlayType(mime)) {
          console.warn('Browser may not support this format:', mime, s.url);
        }
        audio.volume = parseFloat(slider.value) * parseFloat(mixVolume.value || '1');

        btn.addEventListener('click', async () => {
          if (active.has(s.id)) {
            const currentAudio = active.get(s.id);
            currentAudio.pause();
            currentAudio.currentTime = 0; // Reset to beginning
            active.delete(s.id);
            btn.textContent = displayLabel;
            log('sound', 'stop', s.id);
          } else {
            try {
              // Ensure audio is loaded before playing
              if (audio.readyState < 2) {
                btn.textContent = 'Loading...';
                await new Promise((resolve, reject) => {
                  audio.addEventListener('canplay', resolve, { once: true });
                  audio.addEventListener('error', reject, { once: true });
                  audio.load();
                });
              }
              
              await audio.play();
              active.set(s.id, audio);
              btn.textContent = `Stop ${displayLabel}`;
              log('sound', 'play', s.id);
            } catch (err) {
              console.error('Failed to play audio:', displayLabel, err);
              btn.textContent = displayLabel + ' (Error - click to retry)';
              // Don't disable button, allow retry
            }
          }
        });
        slider.addEventListener('input', () => {
          audio.volume = parseFloat(slider.value) * parseFloat(mixVolume.value || '1');
        });

        card.appendChild(btn);
        card.appendChild(slider);
        container.appendChild(card);
      });

      mixVolume.addEventListener('input', () => {
        const mv = parseFloat(mixVolume.value || '1');
        active.forEach((audio, soundId) => {
          const slider = sliders.get(soundId);
          if (slider) {
            audio.volume = parseFloat(slider.value) * mv;
          }
        });
      });
    }

    // Upload handling
    const form = document.getElementById('upload-audio-form');
    const file = document.getElementById('upload-audio');
    const msg = document.getElementById('upload-audio-msg');
    if (form && file) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!file.files || !file.files[0]) return;
        const fd = new FormData();
        fd.append('audio', file.files[0]);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (!j.ok) { msg.textContent = j.error || 'Upload failed'; return; }
        msg.textContent = 'Uploaded ✓';
        // add card for uploaded
        const id = `upl:${j.id}`; const url = j.url;
        const card = document.createElement('div'); card.className='card fade-in';
        const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Play Upload';
        const slider = document.createElement('input'); slider.type='range'; slider.min='0'; slider.max='1'; slider.step='0.01'; slider.value='0.7';
        
          const uploadMime = guessMime(url);
          const audio = new Audio(); 
          audio.loop = true; 
          audio.preload = 'metadata';
          audio.src = url;
          if (uploadMime && audio.canPlayType && !audio.canPlayType(uploadMime)) {
            console.warn('Browser may not support uploaded audio format:', uploadMime, url);
          }
        audio.volume = parseFloat(slider.value) * parseFloat(mixVolume.value || '1');
        
        sliders.set(id, slider); // Store slider reference
        
        btn.addEventListener('click', async () => {
          if (active.has(id)) { 
            const currentAudio = active.get(id);
            currentAudio.pause(); 
            currentAudio.currentTime = 0;
            active.delete(id); 
            btn.textContent = 'Play Upload'; 
            log('sound', 'stop', id); 
          } else { 
            try {
              await audio.play(); 
              active.set(id, audio); 
              btn.textContent = 'Stop Upload'; 
              log('sound', 'play', id);
            } catch (err) {
              console.error('Failed to play uploaded audio:', err);
              btn.textContent = 'Play Upload (Error)';
            }
          }
        });
        slider.addEventListener('input', () => { 
          audio.volume = parseFloat(slider.value) * parseFloat(mixVolume.value || '1'); 
        });
        card.appendChild(btn); card.appendChild(slider); container.appendChild(card);
      });
    }
    
    initSounds.__inited = true;
  }

  // Timers
  function initTimers() {
    if (initTimers.__inited) return;
    
    // Mode switching
    const modePomodoro = document.getElementById('mode-pomodoro');
    const modeStopwatch = document.getElementById('mode-stopwatch');
    const pomodoroContainer = document.getElementById('pomodoro-container');
    const stopwatchContainer = document.getElementById('stopwatch-container');
    
    let currentMode = 'pomodoro'; // 'pomodoro' or 'stopwatch'
    
    if (modePomodoro && modeStopwatch) {
      modePomodoro.addEventListener('click', () => {
        currentMode = 'pomodoro';
        modePomodoro.className = 'btn';
        modeStopwatch.className = 'btn ghost';
        pomodoroContainer.style.display = 'flex';
        stopwatchContainer.style.display = 'none';
      });
      
      modeStopwatch.addEventListener('click', () => {
        currentMode = 'stopwatch';
        modePomodoro.className = 'btn ghost';
        modeStopwatch.className = 'btn';
        pomodoroContainer.style.display = 'none';
        stopwatchContainer.style.display = 'flex';
      });
    }
    
    // Pomodoro Timer
    const startBtn = document.getElementById('start-pomodoro');
    const pauseBtn = document.getElementById('pause-pomodoro');
    const resumeBtn = document.getElementById('resume-pomodoro');
    const skipBtn = document.getElementById('skip-pomodoro');
    const stopBtn = document.getElementById('stop-pomodoro');
    const ring = document.getElementById('pomodoro-ring');
    const label = document.getElementById('pomodoro-label');
    const statusLabel = document.getElementById('pomodoro-status');
    const sessionsInput = document.getElementById('pomodoro-sessions');
    const workMinsInput = document.getElementById('pomodoro-work-mins');
    const breakMinsInput = document.getElementById('pomodoro-break-mins');

    let timerWorker = window.__ac_timer_worker || null;
    let pomodoroState = {
      totalSessions: 4,
      currentSession: 0,
      workMins: 25,
      breakMins: 5,
      isBreak: false,
      isRunning: false,
      isPaused: false
    };
    
    function setRing(p) {
      ring.style.setProperty('--p', `${p * 100}%`);
    }

    function updateStatus() {
      if (!statusLabel) return;
      if (!pomodoroState.isRunning) {
        statusLabel.textContent = 'Ready';
      } else if (pomodoroState.isPaused) {
        statusLabel.textContent = 'Paused';
      } else if (pomodoroState.isBreak) {
        statusLabel.textContent = `Break ${pomodoroState.currentSession}/${pomodoroState.totalSessions}`;
      } else {
        statusLabel.textContent = `Session ${pomodoroState.currentSession}/${pomodoroState.totalSessions}`;
      }
    }

    function updateButtons(state) {
      if (state === 'running') {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'inline-block';
      } else if (state === 'paused') {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'inline-block';
        if (skipBtn) skipBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'inline-block';
      } else {
        if (startBtn) startBtn.style.display = 'inline-block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
      }
    }

    function startNextPhase() {
      if (!timerWorker) {
        timerWorker = new Worker('/static/js/timerWorker.js');
        window.__ac_timer_worker = timerWorker;
        timerWorker.onmessage = (ev) => {
          if (ev.data.type === 'tick') {
            const p = ev.data.progress || 0;
            setRing(p);
            const remaining = ev.data.remaining || 0;
            const mm = Math.floor(remaining / 60000);
            const ss = Math.floor((remaining % 60000) / 1000);
            if (label) label.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
          } else if (ev.data.type === 'done') {
            playCompletionSound(); // Play clock chime
            
            if (pomodoroState.isBreak) {
              // Break finished
              speak('Break is over. Ready for the next session?');
              log('timer', 'pomodoro_break_complete', String(pomodoroState.breakMins));
              
              // Check if all sessions are complete
              if (pomodoroState.currentSession >= pomodoroState.totalSessions) {
                // All sessions complete
                if (label) label.textContent = 'All Done!';
                if (statusLabel) statusLabel.textContent = 'Completed';
                log('timer', 'pomodoro_all_complete', String(pomodoroState.totalSessions));
                pomodoroState.isRunning = false;
                updateButtons('stopped');
              } else {
                // Start next work session
                pomodoroState.isBreak = false;
                pomodoroState.currentSession++;
                updateStatus();
                const mins = pomodoroState.workMins;
                if (label) label.textContent = `${mins}:00`;
                setRing(0);
                timerWorker.postMessage({ type: 'start', minutes: mins });
                log('timer', 'pomodoro_work_start', `session_${pomodoroState.currentSession}`);
              }
            } else {
              // Work session finished
              speak('Time for a break. Great focus!');
              log('timer', 'pomodoro_work_complete', String(pomodoroState.workMins));
              log('stats', 'focus_minutes', String(pomodoroState.workMins));
              log('stats', 'pomodoro_count', '1');
              
              // Start break
              pomodoroState.isBreak = true;
              updateStatus();
              const mins = pomodoroState.breakMins;
              if (label) label.textContent = `${mins}:00`;
              setRing(0);
              timerWorker.postMessage({ type: 'start', minutes: mins });
              log('timer', 'pomodoro_break_start', String(mins));
            }
          } else if (ev.data.type === 'state') {
            const remaining = ev.data.remaining || 0;
            const total = ev.data.total || 1;
            const p = Math.max(0, Math.min(1, 1 - (remaining / total)));
            const mm = Math.floor(remaining / 60000);
            const ss = Math.floor((remaining % 60000) / 1000);
          }
        };
      }

      const mins = pomodoroState.isBreak ? pomodoroState.breakMins : pomodoroState.workMins;
      if (label) label.textContent = `${mins}:00`;
      setRing(0);
      timerWorker.postMessage({ type: 'start', minutes: mins });
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const sessions = Math.max(1, Math.min(10, parseInt(sessionsInput?.value || '4', 10)));
        const workMins = Math.max(1, Math.min(60, parseInt(workMinsInput?.value || '25', 10)));
        const breakMins = Math.max(1, Math.min(30, parseInt(breakMinsInput?.value || '5', 10)));
        
        pomodoroState = {
          totalSessions: sessions,
          currentSession: 1,
          workMins: workMins,
          breakMins: breakMins,
          isBreak: false,
          isRunning: true,
          isPaused: false
        };
        
        updateStatus();
        updateButtons('running');
        startNextPhase();
        log('timer', 'pomodoro_start', `${sessions}x${workMins}min`);
      });
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (timerWorker) {
          timerWorker.postMessage({ type: 'pause' });
          pomodoroState.isPaused = true;
          updateStatus();
          updateButtons('paused');
        }
      });
    }
    
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        if (timerWorker) {
          timerWorker.postMessage({ type: 'resume' });
          pomodoroState.isPaused = false;
          updateStatus();
          updateButtons('running');
        }
      });
    }
    
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (timerWorker) {
          // Stop the current timer
          timerWorker.postMessage({ type: 'stop' });
          
          // Play completion sound and trigger the same logic as 'done'
          playCompletionSound();
          
          if (pomodoroState.isBreak) {
            // Skipping a break
            speak('Break skipped. Starting next session.');
            log('timer', 'pomodoro_break_skipped', String(pomodoroState.breakMins));
            
            // Check if all sessions are complete
            if (pomodoroState.currentSession >= pomodoroState.totalSessions) {
              // All sessions complete
              if (label) label.textContent = 'All Done!';
              if (statusLabel) statusLabel.textContent = 'Completed';
              log('timer', 'pomodoro_all_complete', String(pomodoroState.totalSessions));
              pomodoroState.isRunning = false;
              updateButtons('stopped');
            } else {
              // Start next work session
              pomodoroState.isBreak = false;
              pomodoroState.currentSession++;
              updateStatus();
              const mins = pomodoroState.workMins;
              if (label) label.textContent = `${mins}:00`;
              setRing(0);
              timerWorker.postMessage({ type: 'start', minutes: mins });
              log('timer', 'pomodoro_work_start', `session_${pomodoroState.currentSession}`);
            }
          } else {
            // Skipping a work session
            speak('Session skipped. Starting break.');
            log('timer', 'pomodoro_work_skipped', String(pomodoroState.workMins));
            log('stats', 'focus_minutes', String(pomodoroState.workMins));
            log('stats', 'pomodoro_count', '1');
            
            // Start break
            pomodoroState.isBreak = true;
            updateStatus();
            const mins = pomodoroState.breakMins;
            if (label) label.textContent = `${mins}:00`;
            setRing(0);
            timerWorker.postMessage({ type: 'start', minutes: mins });
            log('timer', 'pomodoro_break_start', String(mins));
          }
        }
      });
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (timerWorker) {
          timerWorker.postMessage({ type: 'stop' });
          const defaultMins = parseInt(workMinsInput?.value || '25', 10);
          if (label) label.textContent = `${defaultMins}:00`;
          setRing(0);
          pomodoroState.isRunning = false;
          pomodoroState.isPaused = false;
          updateStatus();
          updateButtons('stopped');
        }
      });
    }
    
    // Stopwatch
    const startStopwatch = document.getElementById('start-stopwatch');
    const pauseStopwatch = document.getElementById('pause-stopwatch');
    const resumeStopwatch = document.getElementById('resume-stopwatch');
    const stopStopwatch = document.getElementById('stop-stopwatch');
    const stopwatchRing = document.getElementById('stopwatch-ring');
    const stopwatchLabel = document.getElementById('stopwatch-label');
    
    let stopwatchWorker = window.__ac_stopwatch_worker || null;
    let stopwatchStartTime = 0;
    
    function initStopwatchWorker() {
      if (!stopwatchWorker) {
        stopwatchWorker = new Worker('/static/js/stopwatchWorker.js');
        window.__ac_stopwatch_worker = stopwatchWorker;
        stopwatchWorker.onmessage = (ev) => {
          if (ev.data.type === 'tick') {
            const elapsed = ev.data.elapsed || 0;
            const mm = Math.floor(elapsed / 60000);
            const ss = Math.floor((elapsed % 60000) / 1000);
            stopwatchLabel.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
          } else if (ev.data.type === 'stopped') {
            const elapsed = ev.data.elapsed || 0;
            const minutes = Math.floor(elapsed / 60000);
            if (minutes > 0) {
              log('timer', 'stopwatch_complete', String(minutes));
              log('stats', 'focus_minutes', String(minutes));
              log('stats', 'stopwatch_count', '1'); // Track stopwatch sessions separately
            }
            stopwatchStartTime = 0;
          } else if (ev.data.type === 'state') {
            const elapsed = ev.data.elapsed || 0;
            const mm = Math.floor(elapsed / 60000);
            const ss = Math.floor((elapsed % 60000) / 1000);
          }
        };
      }
    }
    
    if (startStopwatch) {
      startStopwatch.addEventListener('click', () => {
        initStopwatchWorker();
        stopwatchStartTime = Date.now();
        stopwatchLabel.textContent = '00:00';
        stopwatchWorker.postMessage({ type: 'start' });
        log('timer', 'stopwatch_start');
      });
    }
    if (pauseStopwatch) pauseStopwatch.addEventListener('click', () => { if (stopwatchWorker) stopwatchWorker.postMessage({ type: 'pause' }); });
    if (resumeStopwatch) resumeStopwatch.addEventListener('click', () => { if (stopwatchWorker) stopwatchWorker.postMessage({ type: 'resume' }); });
    if (stopStopwatch) stopStopwatch.addEventListener('click', () => { 
      if (stopwatchWorker) { 
        stopwatchWorker.postMessage({ type: 'stop' }); 
        stopwatchLabel.textContent = '00:00';
      } 
    });
  }

  // Reminders
  function initReminders() {
    if (initReminders.__inited) return;
    const list = document.getElementById('reminder-list');
    const addBtn = document.getElementById('add-reminder');
    const text = document.getElementById('reminder-text');
    const mins = document.getElementById('reminder-mins');
    const worker = ensureReminderWorker();

    function render(reminders) {
      list.innerHTML = '';
      reminders.forEach((r) => {
        const li = document.createElement('div');
        li.className = 'card fade-in';
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center'; row.style.flexWrap = 'wrap';
        const label = document.createElement('div');
        label.textContent = `${r.text} • every ${r.interval_min} min`;
        const status = document.createElement('span'); status.className='muted'; status.textContent = r.active ? 'Status: Active' : 'Status: Inactive';
        const toggle = document.createElement('button'); toggle.className='btn ghost'; toggle.textContent = r.active ? 'Deactivate' : 'Activate';
        const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit';
        const del = document.createElement('button'); del.className='btn ghost'; del.textContent='Delete';
        const test = document.createElement('button'); test.className='btn ghost'; test.textContent='Test';
        toggle.addEventListener('click', async ()=>{ await apiPatch(`/api/reminders/${r.id}`, { active: r.active ? 0 : 1 }); load(); });
        edit.addEventListener('click', async ()=>{
          const newText = prompt('Reminder text', r.text) ?? r.text;
          const newInterval = parseInt(prompt('Interval (minutes)', String(r.interval_min)) || String(r.interval_min), 10);
          if (!newText || !newInterval) return;
          await apiPatch(`/api/reminders/${r.id}`, { text: newText, interval_min: newInterval });
          load();
        });
        del.addEventListener('click', async ()=>{ if (!confirm('Delete reminder?')) return; await fetch(`/api/reminders/${r.id}`, { method:'DELETE' }); load(); });
        test.addEventListener('click', async ()=>{
          try {
            if (typeof Notification !== 'undefined') {
              if (Notification.permission === 'default') await Notification.requestPermission();
              if (Notification.permission === 'granted') new Notification('Ambient Companion', { body: r.text });
            }
            speak(r.text);
            log('reminder', String(r.id || r.text), 'test');
          } catch {}
        });
        row.appendChild(label); row.appendChild(status); row.appendChild(toggle); row.appendChild(edit); row.appendChild(del); row.appendChild(test);
        li.appendChild(row);
        list.appendChild(li);
      });
      worker.postMessage({ type: 'set', reminders });
    }

    addBtn.addEventListener('click', () => {
      if (!text.value) return;
      const payload = { text: text.value, interval_min: parseInt(mins.value||'30',10), active: 1, use_tts: 1, use_notif: 1 };
      fetch('/api/reminders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        .then(r=>r.json()).then(()=> load());
      text.value='';
    });
    function load() {
      fetch('/api/reminders').then(r=>r.json()).then(j=>{ if (j.ok) render(j.reminders || []); });
    }
    load();

    applyReminderPause();
  }

  // Reminder Daemon: global worker, notification helpers, pause on silent
  function ensureReminderWorker() {
    let worker = window.__ac_reminder_worker || null;
    if (!worker) {
      worker = new Worker('/static/js/reminderWorker.js');
      window.__ac_reminder_worker = worker;
      worker.onmessage = async (ev) => {
        if (ev.data.type === 'fire') {
          const { text, id, use_notif, use_tts } = ev.data;
          if (use_notif) notify(text);
          if (use_tts) speak(text);
          log('reminder', String(id || text), '1');
          try { await fetch('/api/log', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reminder', event: String(id||text), value:'1' }) }); } catch {}
        }
      };
    }
    return worker;
  }
  function notify(body) {
    try {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') Notification.requestPermission();
        if (Notification.permission === 'granted') new Notification('Ambient Companion', { body });
      }
    } catch {}
  }
  async function initReminderDaemon() {
    const w = ensureReminderWorker();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch {}
      }
      const r = await fetch('/api/reminders');
      const j = await r.json();
      if (j.ok) w.postMessage({ type: 'set', reminders: j.reminders || [] });
    } catch {}
    applyReminderPause();
  }
  function applyReminderPause() {
    const w = window.__ac_reminder_worker;
    if (w) w.postMessage({ type: silent ? 'pause' : 'resume' });
  }

  async function apiPatch(url, body) {
    const r = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    return r.json();
  }

  // Videos
  function initVideos() {
    console.log('initVideos called, __inited:', initVideos.__inited);
    if (initVideos.__inited) return;

    // Tab elements
    const videosTabBtn = document.getElementById('videos-tab-btn');
    const playlistsTabBtn = document.getElementById('playlists-tab-btn');
    const videosTabContent = document.getElementById('videos-tab-content');
    const playlistsTabContent = document.getElementById('playlists-tab-content');

    // Videos tab elements
    const searchInput = document.getElementById('video-search-input');
    const searchBtn = document.getElementById('video-search-btn');
    const searchStatus = document.getElementById('video-search-status');
    const searchResultsSection = document.getElementById('video-search-results');
    const resultsList = document.getElementById('video-results-list');
    const refreshVideosLibraryBtn = document.getElementById('refresh-videos-library-btn');
    const libraryVideosList = document.getElementById('library-videos-list');

    // Playlists tab elements
    const playlistUrlInput = document.getElementById('playlist-url-input');
    const playlistDownloadBtn = document.getElementById('playlist-download-btn');
    const playlistDownloadStatus = document.getElementById('playlist-download-status');
    const refreshPlaylistsLibraryBtn = document.getElementById('refresh-playlists-library-btn');
    const libraryPlaylistsList = document.getElementById('library-playlists-list');

    // Filter elements
    const filterAllVideos = document.getElementById('filter-all-videos');
    const filterWatchedVideos = document.getElementById('filter-watched-videos');
    const filterUnwatchedVideos = document.getElementById('filter-unwatched-videos');
    const filterAllPlaylists = document.getElementById('filter-all-playlists');
    const filterWatchedPlaylists = document.getElementById('filter-watched-playlists');
    const filterUnwatchedPlaylists = document.getElementById('filter-unwatched-playlists');

    // State variables for filters
    let currentVideoFilter = 'all'; // 'all', 'watched', 'unwatched'
    let currentPlaylistFilter = 'all';
    let allVideosData = [];
    let allPlaylistsData = [];

    // Tab switching
    function switchToVideos() {
      videosTabBtn.className = 'btn';
      playlistsTabBtn.className = 'btn ghost';
      videosTabContent.style.display = 'block';
      playlistsTabContent.style.display = 'none';
    }

    function switchToPlaylists() {
      videosTabBtn.className = 'btn ghost';
      playlistsTabBtn.className = 'btn';
      videosTabContent.style.display = 'none';
      playlistsTabContent.style.display = 'block';
    }

    videosTabBtn.addEventListener('click', switchToVideos);
    playlistsTabBtn.addEventListener('click', switchToPlaylists);

    // Filter functions
    function setVideoFilter(filter) {
      currentVideoFilter = filter;
      
      // Update button styles
      filterAllVideos.className = filter === 'all' ? 'btn' : 'btn ghost';
      filterWatchedVideos.className = filter === 'watched' ? 'btn' : 'btn ghost';
      filterUnwatchedVideos.className = filter === 'unwatched' ? 'btn' : 'btn ghost';
      
      // Filter and display
      const filteredVideos = filterVideosData(allVideosData, filter);
      displayVideosLibrary(filteredVideos);
    }

    function setPlaylistFilter(filter) {
      currentPlaylistFilter = filter;
      
      // Update button styles
      filterAllPlaylists.className = filter === 'all' ? 'btn' : 'btn ghost';
      filterWatchedPlaylists.className = filter === 'watched' ? 'btn' : 'btn ghost';
      filterUnwatchedPlaylists.className = filter === 'unwatched' ? 'btn' : 'btn ghost';
      
      // Filter and display
      const filteredPlaylists = filterPlaylistsData(allPlaylistsData, filter);
      displayPlaylistsLibrary(filteredPlaylists);
    }

    function filterVideosData(videos, filter) {
      if (filter === 'all') return videos;
      if (filter === 'watched') return videos.filter(v => v.watched);
      if (filter === 'unwatched') return videos.filter(v => !v.watched);
      return videos;
    }

    function filterPlaylistsData(playlists, filter) {
      if (filter === 'all') return playlists;
      
      return playlists.map(playlist => {
        const filteredVideos = playlist.videos.filter(v => {
          if (filter === 'watched') return v.watched;
          if (filter === 'unwatched') return !v.watched;
          return true;
        });
        
        // Only return playlist if it has videos matching the filter
        if (filteredVideos.length > 0) {
          return {
            ...playlist,
            videos: filteredVideos,
            video_count: filteredVideos.length
          };
        }
        return null;
      }).filter(p => p !== null);
    }

    // Add filter event listeners
    filterAllVideos.addEventListener('click', () => setVideoFilter('all'));
    filterWatchedVideos.addEventListener('click', () => setVideoFilter('watched'));
    filterUnwatchedVideos.addEventListener('click', () => setVideoFilter('unwatched'));
    filterAllPlaylists.addEventListener('click', () => setPlaylistFilter('all'));
    filterWatchedPlaylists.addEventListener('click', () => setPlaylistFilter('watched'));
    filterUnwatchedPlaylists.addEventListener('click', () => setPlaylistFilter('unwatched'));

    // Elements
    async function searchVideos() {
      const query = searchInput.value.trim();
      if (!query) {
        searchStatus.textContent = 'Please enter a search query';
        return;
      }

      searchStatus.textContent = 'Searching...';
      searchBtn.disabled = true;

      try {
        const response = await fetch(`/api/videos/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.ok && data.videos) {
          displaySearchResults(data.videos);
          searchStatus.textContent = `Found ${data.videos.length} result(s)`;
        } else {
          searchStatus.textContent = data.error || 'Search failed';
          searchResultsSection.style.display = 'none';
        }
      } catch (error) {
        searchStatus.textContent = 'Search error: ' + error.message;
        searchResultsSection.style.display = 'none';
      } finally {
        searchBtn.disabled = false;
      }
    }

    // Display search results
    function displaySearchResults(videos) {
      resultsList.innerHTML = '';
      searchResultsSection.style.display = 'block';

      if (videos.length === 0) {
        resultsList.innerHTML = '<p class="muted">No results found.</p>';
        return;
      }

      videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.gap = '12px';
        card.style.alignItems = 'flex-start';

        const duration = video.duration ? `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}` : 'N/A';
        
        card.innerHTML = `
          ${video.thumbnail ? `<img src="${video.thumbnail}" alt="thumbnail" style="width:120px; height:90px; object-fit:cover; border-radius:4px; flex-shrink:0;">` : ''}
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis;">${video.title || 'Untitled'}</div>
            <div class="muted" style="font-size:0.85em; margin-bottom:4px;">${video.channel || 'Unknown'} · ${duration}</div>
            ${video.description ? `<div class="muted" style="font-size:0.8em;">${video.description}</div>` : ''}
          </div>
          <div style="display:flex; gap:4px; flex-direction:column;">
            <button class="btn" data-url="${video.url}" data-single>Download</button>
            ${video.url.includes('playlist?list=') || video.url.includes('&list=') ? '<button class="btn ghost" data-url="' + video.url + '" data-playlist>As Playlist</button>' : ''}
          </div>
        `;

        card.querySelector('[data-single]').addEventListener('click', () => showQualitySelection(video.url, false, video.title, event.target));
        const playlistBtn = card.querySelector('[data-playlist]');
        if (playlistBtn) {
          playlistBtn.addEventListener('click', () => showQualitySelection(video.url, true, video.title, event.target));
        }

        resultsList.appendChild(card);
      });
    }

    // Download playlist from URL
    async function downloadPlaylist() {
      const url = playlistUrlInput.value.trim();
      if (!url) {
        playlistDownloadStatus.textContent = 'Please paste a playlist URL';
        return;
      }

      // Validate it's a playlist URL
      if (!url.includes('playlist?list=') && !url.includes('&list=')) {
        playlistDownloadStatus.textContent = 'Invalid playlist URL. Please paste a valid YouTube playlist link.';
        return;
      }

      // Show quality selection
      showPlaylistQualitySelection(url);
    }

    // Show quality selection for playlist
    function showPlaylistQualitySelection(url) {
      const qualities = [
        { label: 'Best Quality', value: 'best' },
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
        { label: '480p', value: '480' },
        { label: '360p', value: '360' },
        { label: 'Audio Only (Best)', value: 'audio' }
      ];

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;';
      
      const modal = document.createElement('div');
      modal.className = 'card';
      modal.style.cssText = 'max-width:400px; width:90%; padding:20px;';
      
      modal.innerHTML = `
        <h3 style="margin-top:0;">Select Quality for Playlist</h3>
        <div style="display:flex; flex-direction:column; gap:8px; margin:16px 0;">
          ${qualities.map(q => `
            <button class="btn ghost" data-quality="${q.value}" style="justify-content:flex-start;">
              ${q.label}
            </button>
          `).join('')}
        </div>
        <button class="btn ghost" data-cancel style="width:100%; margin-top:8px;">Cancel</button>
      `;

      modal.querySelectorAll('[data-quality]').forEach(btn => {
        btn.addEventListener('click', () => {
          const quality = btn.dataset.quality;
          overlay.remove();
          executePlaylistDownload(url, quality);
        });
      });

      modal.querySelector('[data-cancel]').addEventListener('click', () => {
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }

    // Execute playlist download
    async function executePlaylistDownload(url, quality) {
      playlistDownloadStatus.textContent = 'Downloading playlist...';
      playlistDownloadBtn.disabled = true;

      try {
        const response = await fetch('/api/videos/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, is_playlist: true, quality })
        });

        const data = await response.json();

        if (data.ok) {
          playlistDownloadStatus.textContent = '✓ Playlist downloaded successfully!';
          playlistUrlInput.value = '';
          log('video', 'playlist_download_complete', url);
          setTimeout(() => {
            loadPlaylistsLibrary();
            playlistDownloadStatus.textContent = '';
          }, 2000);
        } else {
          playlistDownloadStatus.textContent = '✗ Download failed: ' + (data.error || 'Unknown error');
        }
      } catch (error) {
        playlistDownloadStatus.textContent = '✗ Error: ' + error.message;
      } finally {
        playlistDownloadBtn.disabled = false;
      }
    }

    // Load videos library
    async function loadVideosLibrary() {
      try {
        const response = await fetch('/api/videos/library');
        const data = await response.json();

        if (data.ok && data.library) {
          allVideosData = data.library.videos;
          const filteredVideos = filterVideosData(allVideosData, currentVideoFilter);
          displayVideosLibrary(filteredVideos);
        }
      } catch (error) {
        console.error('Failed to load videos library:', error);
      }
    }

    // Load playlists library
    async function loadPlaylistsLibrary() {
      try {
        const response = await fetch('/api/videos/library');
        const data = await response.json();

        if (data.ok && data.library) {
          allPlaylistsData = data.library.playlists;
          const filteredPlaylists = filterPlaylistsData(allPlaylistsData, currentPlaylistFilter);
          displayPlaylistsLibrary(filteredPlaylists);
        }
      } catch (error) {
        console.error('Failed to load playlists library:', error);
      }
    }

    // Display videos library
    function displayVideosLibrary(videos) {
      if (videos && videos.length > 0) {
        libraryVideosList.innerHTML = '';
        videos.forEach(video => {
          const item = document.createElement('div');
          item.className = 'card';
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.gap = '8px';

          const sizeInMB = (video.size / (1024 * 1024)).toFixed(1);
          const watchedClass = video.watched ? 'watched' : '';
          const watchedIcon = video.watched ? '✓' : '○';
          const watchedTitle = video.watched ? 'Mark as unwatched' : 'Mark as watched';
          
          item.innerHTML = `
            <div style="flex:1; min-width:0; display:flex; align-items:center; gap:8px;">
              <button class="btn ghost" style="font-size:1.2em; padding:4px 8px; min-width:36px;" data-toggle-watched="${video.path}" title="${watchedTitle}">${watchedIcon}</button>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; ${video.watched ? 'opacity:0.6;' : ''}">${video.name}</div>
                <div class="muted" style="font-size:0.85em;">${sizeInMB} MB</div>
              </div>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn" data-play-video="${video.path}">Play</button>
              <button class="btn ghost" data-delete-video="${video.path}">Delete</button>
            </div>
          `;

          item.querySelector('[data-toggle-watched]').addEventListener('click', () => toggleWatched(video.path));
          item.querySelector('[data-play-video]').addEventListener('click', () => playVideo(video.path, video.name));
          item.querySelector('[data-delete-video]').addEventListener('click', () => deleteItem(video.path, false));
          libraryVideosList.appendChild(item);
        });
      } else {
        libraryVideosList.innerHTML = '<p class="muted">No videos downloaded yet.</p>';
      }
    }

    // Display playlists library
    function displayPlaylistsLibrary(playlists) {
      if (playlists && playlists.length > 0) {
        libraryPlaylistsList.innerHTML = '';
        playlists.forEach(playlist => {
          const item = document.createElement('div');
          item.className = 'card';
          
          item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-weight:600;">${playlist.name}</div>
              <button class="btn ghost" data-delete-playlist="${playlist.name}">Delete Playlist</button>
            </div>
            <div class="muted" style="font-size:0.85em; margin-bottom:8px;">${playlist.video_count} video(s)</div>
            <div style="display:flex; flex-direction:column; gap:4px; padding-left:12px;">
              ${playlist.videos.map(v => {
                const sizeInMB = (v.size / (1024 * 1024)).toFixed(1);
                const watchedIcon = v.watched ? '✓' : '○';
                const watchedTitle = v.watched ? 'Mark as unwatched' : 'Mark as watched';
                const videoPath = v.path || `${playlist.name}/${v.filename}`;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; gap:8px;">
                    <button class="btn ghost" style="font-size:1em; padding:2px 6px; min-width:28px;" data-toggle-watched="${videoPath}" title="${watchedTitle}">${watchedIcon}</button>
                    <div class="muted" style="font-size:0.8em; flex:1; ${v.watched ? 'opacity:0.6;' : ''}">• ${v.name} (${sizeInMB} MB)</div>
                    <button class="btn ghost" style="font-size:0.75em; padding:4px 8px;" data-play-playlist-video="${videoPath}">Play</button>
                  </div>
                `;
              }).join('')}
            </div>
          `;

          item.querySelector('[data-delete-playlist]').addEventListener('click', () => deleteItem(playlist.name, true));
          
          // Add play buttons for each video in playlist
          item.querySelectorAll('[data-play-playlist-video]').forEach(btn => {
            const videoPath = btn.dataset.playPlaylistVideo;
            const videoName = videoPath.split('/').pop();
            btn.addEventListener('click', () => playVideo(videoPath, videoName));
          });

          // Add toggle watched buttons for each video in playlist
          item.querySelectorAll('[data-toggle-watched]').forEach(btn => {
            const videoPath = btn.dataset.toggleWatched;
            btn.addEventListener('click', () => toggleWatched(videoPath));
          });

          libraryPlaylistsList.appendChild(item);
        });
      } else {
        libraryPlaylistsList.innerHTML = '<p class="muted">No playlists downloaded yet.</p>';
      }
    }

    // Show quality selection dialog
    function showQualitySelection(url, isPlaylist, title, buttonElement) {
      const qualities = [
        { label: 'Best Quality', value: 'best' },
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
        { label: '480p', value: '480' },
        { label: '360p', value: '360' },
        { label: 'Audio Only (Best)', value: 'audio' }
      ];

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;';
      
      const modal = document.createElement('div');
      modal.className = 'card';
      modal.style.cssText = 'max-width:400px; width:90%; padding:20px;';
      
      modal.innerHTML = `
        <h3 style="margin-top:0;">Select Quality</h3>
        <div style="display:flex; flex-direction:column; gap:8px; margin:16px 0;">
          ${qualities.map(q => `
            <button class="btn ghost" data-quality="${q.value}" style="justify-content:flex-start;">
              ${q.label}
            </button>
          `).join('')}
        </div>
        <button class="btn ghost" data-cancel style="width:100%; margin-top:8px;">Cancel</button>
      `;

      modal.querySelectorAll('[data-quality]').forEach(btn => {
        btn.addEventListener('click', () => {
          const quality = btn.dataset.quality;
          overlay.remove();
          downloadVideo(url, isPlaylist, title, buttonElement, quality);
        });
      });

      modal.querySelector('[data-cancel]').addEventListener('click', () => {
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }

    // Download video
    async function downloadVideo(url, isPlaylist, title, buttonElement, quality = 'best') {
      const originalText = buttonElement.textContent;
      buttonElement.textContent = 'Downloading...';
      buttonElement.disabled = true;

      try {
        const response = await fetch('/api/videos/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, is_playlist: isPlaylist, quality })
        });

        const data = await response.json();

        if (data.ok) {
          buttonElement.textContent = '✓ Downloaded';
          log('video', 'download_complete', title || url);
          setTimeout(() => loadLibrary(), 1000);
        } else {
          buttonElement.textContent = '✗ Failed';
          alert('Download failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        buttonElement.textContent = '✗ Error';
        alert('Download error: ' + error.message);
      } finally {
        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.disabled = false;
        }, 2000);
      }
    }

    // Load library
    async function loadLibrary() {
      console.log('Loading video library...');
      try {
        const response = await fetch('/api/videos/library');
        const data = await response.json();
        console.log('Library data received:', data);

        if (data.ok && data.library) {
          console.log('Videos:', data.library.videos.length, 'Playlists:', data.library.playlists.length);
          displayLibrary(data.library);
        }
      } catch (error) {
        console.error('Failed to load library:', error);
      }
    }

    // Display library
    function displayLibrary(library) {
      console.log('displayLibrary called with:', library);
      // Individual videos
      if (library.videos && library.videos.length > 0) {
        libraryVideosList.innerHTML = '';
        library.videos.forEach(video => {
          const item = document.createElement('div');
          item.className = 'card';
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.gap = '8px';

          const sizeInMB = (video.size / (1024 * 1024)).toFixed(1);
          
          item.innerHTML = `
            <div style="flex:1; min-width:0;">
              <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis;">${video.name}</div>
              <div class="muted" style="font-size:0.85em;">${sizeInMB} MB</div>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn" data-play-video="${video.path}">Play</button>
              <button class="btn ghost" data-delete-video="${video.path}">Delete</button>
            </div>
          `;

          item.querySelector('[data-play-video]').addEventListener('click', () => playVideo(video.path, video.name));
          item.querySelector('[data-delete-video]').addEventListener('click', () => deleteItem(video.path, false));
          libraryVideosList.appendChild(item);
        });
      } else {
        libraryVideosList.innerHTML = '<p class="muted">No videos downloaded yet.</p>';
      }

      // Playlists
      if (library.playlists && library.playlists.length > 0) {
        libraryPlaylistsList.innerHTML = '';
        library.playlists.forEach(playlist => {
          const item = document.createElement('div');
          item.className = 'card';
          
          item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-weight:600;">${playlist.name}</div>
              <button class="btn ghost" data-delete-playlist="${playlist.name}">Delete Playlist</button>
            </div>
            <div class="muted" style="font-size:0.85em; margin-bottom:8px;">${playlist.video_count} video(s)</div>
            <div style="display:flex; flex-direction:column; gap:4px; padding-left:12px;">
              ${playlist.videos.map(v => {
                const sizeInMB = (v.size / (1024 * 1024)).toFixed(1);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0;">
                    <div class="muted" style="font-size:0.8em; flex:1;">• ${v.name} (${sizeInMB} MB)</div>
                    <button class="btn ghost" style="font-size:0.75em; padding:4px 8px;" data-play-playlist-video="${playlist.name}/${v.filename}">Play</button>
                  </div>
                `;
              }).join('')}
            </div>
          `;

          item.querySelector('[data-delete-playlist]').addEventListener('click', () => deleteItem(playlist.name, true));
          
          // Add play buttons for each video in playlist
          item.querySelectorAll('[data-play-playlist-video]').forEach(btn => {
            const videoPath = btn.dataset.playPlaylistVideo;
            const videoName = videoPath.split('/').pop();
            btn.addEventListener('click', () => playVideo(videoPath, videoName));
          });

          libraryPlaylistsList.appendChild(item);
        });
      } else {
        libraryPlaylistsList.innerHTML = '<p class="muted">No playlists downloaded yet.</p>';
      }
    }

    // Play video in modal
    function playVideo(videoPath, videoName) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px;';
      
      const container = document.createElement('div');
      container.style.cssText = 'max-width:1200px; width:100%; display:flex; flex-direction:column; gap:12px;';
      
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; color:white;">
          <h3 style="margin:0;">${videoName}</h3>
          <button class="btn ghost" data-close-player style="color:white;">Close ✕</button>
        </div>
        <video 
          controls 
          autoplay 
          style="width:100%; max-height:80vh; background:black; border-radius:8px;"
          src="/data/videos/${encodeURIComponent(videoPath)}"
        >
          Your browser does not support video playback.
        </video>
      `;

      const video = container.querySelector('video');
      const closeBtn = container.querySelector('[data-close-player]');
      
      closeBtn.addEventListener('click', () => {
        video.pause();
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          video.pause();
          overlay.remove();
        }
      });

      // Keyboard shortcuts
      const handleKeyPress = (e) => {
        if (e.key === 'Escape') {
          video.pause();
          overlay.remove();
          document.removeEventListener('keydown', handleKeyPress);
        } else if (e.key === ' ' || e.key === 'k') {
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
        } else if (e.key === 'ArrowLeft') {
          video.currentTime = Math.max(0, video.currentTime - 5);
        } else if (e.key === 'ArrowRight') {
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
        } else if (e.key === 'f') {
          if (video.requestFullscreen) video.requestFullscreen();
        }
      };
      document.addEventListener('keydown', handleKeyPress);

      overlay.appendChild(container);
      document.body.appendChild(overlay);
    }

    // Delete video or playlist
    async function deleteItem(path, isPlaylist) {
      if (!confirm(`Delete this ${isPlaylist ? 'playlist' : 'video'}?`)) return;

      try {
        const response = await fetch('/api/videos/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, is_playlist: isPlaylist })
        });

        const data = await response.json();

        if (data.ok) {
          if (isPlaylist) {
            loadPlaylistsLibrary();
          } else {
            loadVideosLibrary();
          }
        } else {
          alert('Delete failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Delete error: ' + error.message);
      }
    }

    // Toggle watched status
    async function toggleWatched(path) {
      try {
        const response = await fetch('/api/videos/toggle-watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        });

        const data = await response.json();

        if (data.ok) {
          // Refresh both libraries since the video could be in either
          loadVideosLibrary();
          loadPlaylistsLibrary();
        } else {
          alert('Toggle watched failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Toggle watched error: ' + error.message);
      }
    }

    // Event listeners
    searchBtn.addEventListener('click', searchVideos);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchVideos();
    });
    
    playlistDownloadBtn.addEventListener('click', downloadPlaylist);
    playlistUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') downloadPlaylist();
    });
    
    refreshVideosLibraryBtn.addEventListener('click', loadVideosLibrary);
    refreshPlaylistsLibraryBtn.addEventListener('click', loadPlaylistsLibrary);

    // Initial load
    loadVideosLibrary();
    loadPlaylistsLibrary();
    initVideos.__inited = true;
  }

  // Journal
  function initJournal() {
    if (initJournal.__inited) return;
    
    const form = document.getElementById('journal-form');
    const titleInput = document.getElementById('journal-title');
    const contentInput = document.getElementById('journal-content');
    const statusEl = document.getElementById('journal-status');
    const entriesContainer = document.getElementById('journal-entries');
    const clearBtn = document.getElementById('clear-journal');
    const refreshBtn = document.getElementById('refresh-journal');

    // Load existing entries
    async function loadEntries() {
      try {
        const res = await fetch('/api/journals');
        const data = await res.json();
        
        if (!data.ok || !data.journals || data.journals.length === 0) {
          entriesContainer.innerHTML = '<p class="muted">No journal entries yet. Start writing!</p>';
          return;
        }

        // Render entries
        entriesContainer.innerHTML = data.journals.map(entry => {
          const createdDate = new Date(entry.created_at);
          const updatedDate = new Date(entry.updated_at);
          const isEdited = entry.created_at !== entry.updated_at;
          
          return `
            <div class="card" data-entry-id="${entry.id}">
              ${entry.title ? `<div class="section-title">${escapeHtml(entry.title)}</div>` : ''}
              <div style="white-space: pre-wrap; margin: ${entry.title ? '12px 0' : '0'};">${escapeHtml(entry.content)}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.05);">
                <small class="muted">
                  ${formatDate(createdDate)}
                  ${isEdited ? `<br/><em>Edited: ${formatDate(updatedDate)}</em>` : ''}
                </small>
                <button class="btn ghost" onclick="deleteJournalEntry(${entry.id})" style="padding:4px 12px; font-size:0.9em;">Delete</button>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.error('Failed to load journal entries:', err);
        entriesContainer.innerHTML = '<p class="muted" style="color:red;">Failed to load entries. Please try again.</p>';
      }
    }

    // Format date for display
    function formatDate(date) {
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return date.toLocaleDateString('en-US', options);
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Save new entry
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      
      if (!content) {
        statusEl.textContent = 'Please write something before saving.';
        statusEl.style.color = 'red';
        return;
      }

      try {
        statusEl.textContent = 'Saving...';
        statusEl.style.color = '';
        
        const res = await fetch('/api/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content })
        });
        
        const data = await res.json();
        
        if (data.ok) {
          statusEl.textContent = 'Entry saved successfully! ✓';
          statusEl.style.color = 'green';
          
          // Clear form
          titleInput.value = '';
          contentInput.value = '';
          
          // Reload entries
          await loadEntries();
          
          // Clear status after 3 seconds
          setTimeout(() => {
            statusEl.textContent = '';
          }, 3000);
          
          // Log the action
          log('journal', 'create', title || 'Untitled');
        } else {
          statusEl.textContent = 'Failed to save: ' + (data.error || 'Unknown error');
          statusEl.style.color = 'red';
        }
      } catch (err) {
        console.error('Failed to save journal entry:', err);
        statusEl.textContent = 'Failed to save. Please try again.';
        statusEl.style.color = 'red';
      }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      titleInput.value = '';
      contentInput.value = '';
      statusEl.textContent = '';
    });

    // Refresh button
    refreshBtn.addEventListener('click', loadEntries);

    // Initial load
    loadEntries();
    
    initJournal.__inited = true;
  }

  // Make deleteJournalEntry global so it can be called from HTML
  window.deleteJournalEntry = async function(entryId) {
    if (!confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }

    try {
      const res = await fetch(`/api/journals/${entryId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Reload entries
        const initFunc = window.initJournal || initJournal;
        if (initFunc.__inited) {
          const entriesContainer = document.getElementById('journal-entries');
          const statusEl = document.getElementById('journal-status');
          
          // Reload function
          const res = await fetch('/api/journals');
          const listData = await res.json();
          
          if (!listData.ok || !listData.journals || listData.journals.length === 0) {
            entriesContainer.innerHTML = '<p class="muted">No journal entries yet. Start writing!</p>';
          } else {
            // Re-render (call loadEntries indirectly by triggering refresh)
            document.getElementById('refresh-journal').click();
          }
        }
        
        log('journal', 'delete', entryId);
      } else {
        alert('Failed to delete entry: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to delete journal entry:', err);
      alert('Failed to delete entry. Please try again.');
    }
  };

  // Stats
  function initStats() {
    if (initStats.__inited) return;
    const totalsEl = document.getElementById('totals');
    const focusEl = document.getElementById('focus-minutes');
    const focusSessionsEl = document.getElementById('focus-sessions');
    const pomodoroCountEl = document.getElementById('pomodoro-count');
    const stopwatchCountEl = document.getElementById('stopwatch-count');
    const reminderCountEl = document.getElementById('reminder-count');
    const soundCountEl = document.getElementById('sound-count');
    const wellnessEl = document.getElementById('wellness-score');
    const exportBtn = document.getElementById('export-csv');
    const exportDaily = document.getElementById('export-daily');
    const exportSummary = document.getElementById('export-summary');

    async function load() {
      const r = await fetch('/api/stats');
      const j = await r.json();
      if (totalsEl) totalsEl.textContent = JSON.stringify(j.totals || {}, null, 2);
      if (focusEl) focusEl.textContent = (j.focus_minutes || 0) + ' min';
      if (focusSessionsEl) focusSessionsEl.textContent = j.focus_sessions || 0;
      if (pomodoroCountEl) pomodoroCountEl.textContent = j.pomodoro_count || 0;
      if (stopwatchCountEl) stopwatchCountEl.textContent = j.stopwatch_count || 0;
      if (reminderCountEl) reminderCountEl.textContent = j.reminder_count || 0;
      if (soundCountEl) soundCountEl.textContent = j.sound_count || 0;
      if (wellnessEl) {
        const score = j.wellness_score || 0;
        wellnessEl.textContent = score;
        // Color code the wellness score
        if (score >= 75) wellnessEl.style.color = 'var(--accent)';
        else if (score >= 50) wellnessEl.style.color = 'var(--primary)';
        else wellnessEl.style.color = 'var(--secondary)';
      }
    }
    load();
    if (exportBtn) exportBtn.addEventListener('click', () => { window.location.href = '/export.csv'; });
    if (exportDaily) exportDaily.addEventListener('click', () => { window.location.href = '/export_daily.csv'; });
    if (exportSummary) exportSummary.addEventListener('click', () => { window.location.href = '/export_summary.csv'; });
  }

  // Feedback form
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('feedback-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mood = document.getElementById('feedback-mood').value;
        const text = document.getElementById('feedback-text').value;
        const status = document.getElementById('feedback-status');
        const r = await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mood, text }) });
        const j = await r.json();
        status.textContent = j.ok ? 'Saved ✓' : (j.error || 'Failed');
      });
    }
    const testBtn = document.getElementById('test-notifications');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        try {
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') await Notification.requestPermission();
            if (Notification.permission === 'granted') new Notification('Ambient Companion', { body: 'This is a test notification.' });
          }
          speak('This is a test reminder.');
          log('ui', 'test_notification');
        } catch {}
      });
    }

    // Profile management
    loadActiveProfile();
    const manageBtn = document.getElementById('manage-profiles');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('close-profile-modal');
    const createBtn = document.getElementById('create-profile-btn');
    const nameInput = document.getElementById('new-profile-name');
    const modeSelect = document.getElementById('new-profile-mode');

    if (manageBtn && modal) {
      manageBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        loadProfiles();
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const mode = modeSelect.value;
        if (!name) return;
        const r = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, mode, theme: 'pastel', mood: 'focus' })
        });
        const j = await r.json();
        if (j.ok) {
          nameInput.value = '';
          loadProfiles();
        }
      });
    }
  });

  async function loadActiveProfile() {
    try {
      const r = await fetch('/api/profiles/active');
      const j = await r.json();
      if (j.ok && j.profile) {
        const el = document.getElementById('active-profile-name');
        if (el) el.textContent = j.profile.name;
        // Apply profile settings
        if (j.profile.theme) setTheme(j.profile.theme);
        if (j.profile.mood) setMood(j.profile.mood);
        if (j.profile.font_scale) {
          fontScale = parseFloat(j.profile.font_scale);
          applyFontScale();
        }
      }
    } catch {}
  }

  async function loadProfiles() {
    try {
      const r = await fetch('/api/profiles');
      const j = await r.json();
      const list = document.getElementById('profile-list');
      if (!list || !j.ok) return;
      list.innerHTML = '';
      (j.profiles || []).forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '8px';
        card.style.flexWrap = 'wrap';
        
        const nameEl = document.createElement('div');
        nameEl.textContent = `${p.name} (${p.mode})`;
        nameEl.style.flex = '1';
        nameEl.style.fontWeight = p.is_active ? '600' : '400';
        
        const badge = document.createElement('span');
        badge.className = 'muted';
        badge.textContent = p.is_active ? 'Active' : '';
        badge.style.fontSize = '0.85em';
        
        const activateBtn = document.createElement('button');
        activateBtn.className = 'btn ghost';
        activateBtn.textContent = 'Activate';
        activateBtn.style.display = p.is_active ? 'none' : 'inline-block';
        activateBtn.addEventListener('click', async () => {
          await fetch(`/api/profiles/${p.id}/activate`, { method: 'POST' });
          loadProfiles();
          loadActiveProfile();
        });
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn ghost';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', async () => {
          const newName = prompt('Profile name:', p.name);
          const newMode = prompt('Mode (study/relax/exam/work/custom):', p.mode);
          if (newName && newMode) {
            await fetch(`/api/profiles/${p.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName, mode: newMode })
            });
            loadProfiles();
            if (p.is_active) loadActiveProfile();
          }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn ghost';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Delete profile "${p.name}"?`)) return;
          const r = await fetch(`/api/profiles/${p.id}`, { method: 'DELETE' });
          const j = await r.json();
          if (j.ok) loadProfiles();
          else alert(j.error || 'Cannot delete');
        });
        
        card.appendChild(nameEl);
        card.appendChild(badge);
        card.appendChild(activateBtn);
        card.appendChild(editBtn);
        card.appendChild(deleteBtn);
        list.appendChild(card);
      });
    } catch {}
  }

  function showKeyboardHelp() {
    const modal = document.getElementById('keyboard-help-modal');
    if (modal) modal.style.display = 'block';
  }

  // Close keyboard help modal
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-keyboard-help');
    const modal = document.getElementById('keyboard-help-modal');
    const showBtn = document.getElementById('show-keyboard-help');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
      // Close on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
    if (showBtn) {
      showBtn.addEventListener('click', () => { showKeyboardHelp(); });
    }
  });
})();


