let state = { running: false, paused: false, elapsedMs: 0, lastTick: 0 };

function tick() {
  if (!state.running) return;
  if (!state.paused) {
    const now = Date.now();
    const delta = Math.max(0, now - state.lastTick);
    state.elapsedMs += delta;
    state.lastTick = now;
  }
  postMessage({ type: 'tick', elapsed: state.elapsedMs, paused: state.paused });
  if (state.running) {
    setTimeout(tick, 200);
  }
}

onmessage = (e) => {
  const { type } = e.data || {};
  if (type === 'start') {
    state.running = true;
    state.paused = false;
    state.elapsedMs = 0;
    state.lastTick = Date.now();
    tick();
  } else if (type === 'stop') {
    const finalTime = state.elapsedMs;
    state.running = false;
    state.elapsedMs = 0;
    postMessage({ type: 'stopped', elapsed: finalTime });
  } else if (type === 'pause') {
    if (state.running) state.paused = true;
  } else if (type === 'resume') {
    if (state.running && state.paused) { 
      state.paused = false; 
      state.lastTick = Date.now(); 
      tick(); 
    }
  } else if (type === 'get') {
    postMessage({ type: 'state', running: state.running, paused: state.paused, elapsed: state.elapsedMs });
  }
};
