let state = { running: false, paused: false, totalMs: 0, remainingMs: 0, lastTick: 0 };

function tick() {
  if (!state.running) return;
  if (!state.paused) {
    const now = Date.now();
    const delta = Math.max(0, now - state.lastTick);
    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.lastTick = now;
  }
  const p = state.totalMs > 0 ? 1 - (state.remainingMs / state.totalMs) : 0;
  postMessage({ type: 'tick', progress: p, remaining: state.remainingMs, paused: state.paused });
  if (state.remainingMs <= 0) {
    state.running = false;
    postMessage({ type: 'done' });
  } else {
    setTimeout(tick, 200);
  }
}

onmessage = (e) => {
  const { type, minutes } = e.data || {};
  if (type === 'start') {
    const mins = Math.max(1, parseInt(minutes || 25, 10));
    state.running = true;
    state.paused = false;
    state.totalMs = mins * 60 * 1000;
    state.remainingMs = state.totalMs;
    state.lastTick = Date.now();
    tick();
  } else if (type === 'stop') {
    state.running = false;
  } else if (type === 'pause') {
    if (state.running) state.paused = true;
  } else if (type === 'resume') {
    if (state.running && state.paused) { state.paused = false; state.lastTick = Date.now(); tick(); }
  } else if (type === 'get') {
    postMessage({ type: 'state', running: state.running, paused: state.paused, remaining: state.remainingMs, total: state.totalMs });
  }
};



