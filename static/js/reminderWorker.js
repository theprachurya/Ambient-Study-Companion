let timers = new Map();
let paused = false;

function clearAll() {
  for (const [, id] of timers) clearInterval(id);
  timers.clear();
}

function schedule(list) {
  clearAll();
  list.forEach((r) => {
    if (!r.active) return;
    const ms = Math.max(1, parseInt(r.interval_min || r.interval || 30, 10)) * 60 * 1000;
    const id = setInterval(() => {
      if (paused) return;
      postMessage({ type: 'fire', text: r.text, id: r.id, use_notif: r.use_notif, use_tts: r.use_tts });
    }, ms);
    timers.set(r.id || r.text, id);
  });
}

onmessage = (e) => {
  const { type, reminders } = e.data || {};
  if (type === 'set') schedule(reminders || []);
  else if (type === 'pause') paused = true;
  else if (type === 'resume') paused = false;
  else if (type === 'clear') clearAll();
};



