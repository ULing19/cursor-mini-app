(function () {
  'use strict';

  const timerApi = window.TimerLogic;
  const taskApi = window.TaskLogic;
  const RING_RADIUS = 52;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;

  const cueCopy = {
    work: 'Focus block complete. Take a five-minute break.',
    break: 'Break is over. Ready for another 25 minutes?',
  };

  let timer = timerApi.createTimer();
  let tasks = taskApi.loadTasks(window.localStorage);
  let sessions = timerApi.loadSessions(window.localStorage);
  let audioCtx = null;
  let pulseTimer = 0;

  const timeEl = document.querySelector('#time');
  const phaseEl = document.querySelector('#phase');
  const startBtn = document.querySelector('#start');
  const pauseBtn = document.querySelector('#pause');
  const resetBtn = document.querySelector('#reset');
  const cueEl = document.querySelector('#cue');
  const form = document.querySelector('#task-form');
  const input = document.querySelector('#task-input');
  const list = document.querySelector('#task-list');
  const emptyEl = document.querySelector('#empty');
  const countEl = document.querySelector('#task-count');
  const sessionsEl = document.querySelector('#sessions');
  const ring = document.querySelector('#ring-progress');
  const card = document.querySelector('.timer-card');
  const modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-set-mode]'));

  function ensureAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (error) {
      return null;
    }
  }

  function playChime(mode) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const notes = mode === 'work' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
    const startAt = ctx.currentTime;
    notes.forEach(function (freq, index) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = startAt + index * 0.11;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.5);
    });
  }

  function clearCue() {
    cueEl.textContent = '';
    card.classList.remove('is-complete');
    window.clearTimeout(pulseTimer);
  }

  function showCue(finishedMode) {
    cueEl.textContent = cueCopy[finishedMode] || 'Time is up.';
    card.classList.add('is-complete');
    window.clearTimeout(pulseTimer);
    pulseTimer = window.setTimeout(function () {
      card.classList.remove('is-complete');
    }, 4800);
    playChime(finishedMode);
  }

  function onSessionComplete(result) {
    sessions = timerApi.recordFocusSession(sessions, result.finishedMode);
    timerApi.saveSessions(window.localStorage, sessions);
    showCue(result.finishedMode);
  }

  function renderTimer() {
    const clock = timerApi.formatTime(timer.remaining);
    const total = timerApi.durationFor(timer.mode);
    const remainingRatio = total === 0 ? 0 : timer.remaining / total;
    const modeLabel = timer.mode === 'work' ? 'Focus' : 'Break';
    const statusLabel = timer.status === 'running' ? 'In progress' : timer.status === 'paused' ? 'Paused' : 'Ready';

    document.body.dataset.mode = timer.mode;
    timeEl.textContent = clock;
    timeEl.setAttribute('aria-label', timerApi.formatSpeech(timer.remaining) + ', ' + modeLabel);
    phaseEl.textContent = (timer.mode === 'work' ? 'Focus session' : 'Break') + ' · ' + statusLabel;
    ring.style.strokeDasharray = String(RING_CIRC);
    ring.style.strokeDashoffset = String(RING_CIRC * (1 - remainingRatio));
    ring.style.strokeLinecap = timer.remaining === total ? 'butt' : 'round';

    startBtn.disabled = timer.status === 'running';
    startBtn.textContent = timer.status === 'paused' ? 'Resume' : 'Start';
    pauseBtn.disabled = timer.status !== 'running';
    resetBtn.disabled = timer.status === 'idle' && timer.remaining === total;

    modeButtons.forEach(function (button) {
      const active = button.dataset.setMode === timer.mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = timer.status === 'running' && !active;
    });

    sessionsEl.hidden = sessions < 1;
    sessionsEl.textContent = sessions === 1 ? '1 focus session completed' : sessions + ' focus sessions completed';

    document.title = cueEl.textContent
      ? 'Time’s up · ' + clock
      : clock + ' · ' + modeLabel;
  }

  function renderTasks() {
    const open = tasks.filter(function (task) { return !task.done; }).length;
    const done = tasks.length - open;
    countEl.textContent = tasks.length === 0 ? 'Nothing queued' : open + ' open · ' + done + ' done';
    emptyEl.hidden = tasks.length !== 0;
    list.replaceChildren();

    tasks.forEach(function (task) {
      const item = document.createElement('li');
      item.className = 'task' + (task.done ? ' is-done' : '');
      item.dataset.id = task.id;

      const label = document.createElement('label');
      label.className = 'task-check';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = task.done;
      box.dataset.action = 'toggle';

      const title = document.createElement('span');
      title.className = 'task-title';
      title.textContent = task.title;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn';
      remove.dataset.action = 'delete';
      remove.setAttribute('aria-label', 'Delete ' + task.title);
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5h6M4.5 6.5h15M8 6.5l.6 12.2a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4L16 6.5M10 10.5v6M14 10.5v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

      label.append(box, title);
      item.append(label, remove);
      list.append(item);
    });
  }

  function step() {
    const result = timerApi.tick(timer, Date.now());
    const changed = result.timer !== timer || result.completed;
    timer = result.timer;
    if (result.completed) onSessionComplete(result);
    if (changed) renderTimer();
  }

  function onStart() {
    ensureAudio();
    clearCue();
    timer = timerApi.start(timer, Date.now());
    renderTimer();
  }

  function onPause() {
    const now = Date.now();
    const result = timerApi.tick(timer, now);
    if (result.completed) {
      timer = result.timer;
      onSessionComplete(result);
      renderTimer();
      return;
    }
    timer = timerApi.pause(result.timer, now);
    renderTimer();
  }

  function onReset() {
    timer = timerApi.reset(timer);
    clearCue();
    renderTimer();
  }

  startBtn.addEventListener('click', onStart);
  pauseBtn.addEventListener('click', onPause);
  resetBtn.addEventListener('click', onReset);

  modeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const next = timerApi.setMode(timer, button.dataset.setMode);
      if (next === timer) return;
      timer = next;
      clearCue();
      renderTimer();
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const next = taskApi.addTask(tasks, input.value);
    if (next === tasks) {
      input.value = '';
      input.classList.remove('shake');
      window.requestAnimationFrame(function () { input.classList.add('shake'); });
      input.focus();
      return;
    }
    tasks = next;
    input.value = '';
    input.classList.remove('shake');
    taskApi.saveTasks(window.localStorage, tasks);
    renderTasks();
    input.focus();
  });

  input.addEventListener('animationend', function () {
    input.classList.remove('shake');
  });

  list.addEventListener('change', function (event) {
    const target = event.target;
    if (!target || target.dataset.action !== 'toggle') return;
    const item = target.closest('.task');
    if (!item) return;
    tasks = taskApi.toggleTask(tasks, item.dataset.id);
    taskApi.saveTasks(window.localStorage, tasks);
    renderTasks();
  });

  list.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;
    const item = button.closest('.task');
    if (!item) return;
    tasks = taskApi.deleteTask(tasks, item.dataset.id);
    taskApi.saveTasks(window.localStorage, tasks);
    renderTasks();
  });

  document.addEventListener('keydown', function (event) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (event.target && event.target.isContentEditable);
    if (typing) return;
    if (event.code === 'Space' && tag !== 'BUTTON' && tag !== 'A') {
      event.preventDefault();
      if (timer.status === 'running') onPause();
      else onStart();
    } else if ((event.key === 'r' || event.key === 'R') && tag !== 'BUTTON') {
      onReset();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') step();
  });

  window.setInterval(step, 250);
  renderTimer();
  renderTasks();
})();
