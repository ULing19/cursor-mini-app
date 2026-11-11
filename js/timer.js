(function (root, factory) {
  const api = factory();
  const isNode = typeof module === 'object' && module.exports && typeof window === 'undefined';
  if (isNode) module.exports = api;
  else root.TimerLogic = api;
})(globalThis, function () {
  'use strict';

  const WORK_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;
  const SESSION_KEY = 'focus.sessions.v1';

  function durationFor(mode) {
    return mode === 'break' ? BREAK_SECONDS : WORK_SECONDS;
  }

  function createTimer() {
    return {
      mode: 'work',
      status: 'idle',
      remaining: WORK_SECONDS,
      endsAt: null,
    };
  }

  // Remaining time is derived from endsAt so a background tab does not drift.
  function start(timer, now) {
    if (!timer || timer.status === 'running') return timer;
    const remaining = Math.max(0, timer.remaining);
    return {
      mode: timer.mode,
      status: 'running',
      remaining: remaining,
      endsAt: now + remaining * 1000,
    };
  }

  function pause(timer, now) {
    if (!timer || timer.status !== 'running' || timer.endsAt == null) return timer;
    const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    return {
      mode: timer.mode,
      status: 'paused',
      remaining: remaining,
      endsAt: null,
    };
  }

  function reset(timer) {
    if (!timer) return createTimer();
    return {
      mode: timer.mode,
      status: 'idle',
      remaining: durationFor(timer.mode),
      endsAt: null,
    };
  }

  function setMode(timer, mode) {
    if (!timer || (mode !== 'work' && mode !== 'break')) return timer;
    if (timer.mode === mode || timer.status === 'running') return timer;
    return {
      mode: mode,
      status: 'idle',
      remaining: durationFor(mode),
      endsAt: null,
    };
  }

  function tick(timer, now) {
    if (!timer || timer.status !== 'running' || timer.endsAt == null) {
      return { timer: timer, completed: false };
    }
    const remainingMs = timer.endsAt - now;
    if (remainingMs <= 0) {
      const nextMode = timer.mode === 'work' ? 'break' : 'work';
      return {
        timer: {
          mode: nextMode,
          status: 'idle',
          remaining: durationFor(nextMode),
          endsAt: null,
        },
        completed: true,
        finishedMode: timer.mode,
      };
    }
    const remaining = Math.ceil(remainingMs / 1000);
    if (remaining === timer.remaining) return { timer: timer, completed: false };
    return {
      timer: {
        mode: timer.mode,
        status: 'running',
        remaining: remaining,
        endsAt: timer.endsAt,
      },
      completed: false,
    };
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
  }

  function formatSpeech(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    const minuteLabel = minutes === 1 ? 'minute' : 'minutes';
    const secondLabel = rest === 1 ? 'second' : 'seconds';
    return minutes + ' ' + minuteLabel + ' ' + rest + ' ' + secondLabel;
  }

  function recordFocusSession(count, finishedMode) {
    const current = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    if (finishedMode !== 'work') return current;
    return current + 1;
  }

  function loadSessions(storage) {
    if (!storage) return 0;
    try {
      const value = Number(storage.getItem(SESSION_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveSessions(storage, count) {
    if (!storage) return false;
    const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    try {
      storage.setItem(SESSION_KEY, String(safe));
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    WORK_SECONDS: WORK_SECONDS,
    BREAK_SECONDS: BREAK_SECONDS,
    SESSION_KEY: SESSION_KEY,
    durationFor: durationFor,
    createTimer: createTimer,
    start: start,
    pause: pause,
    reset: reset,
    setMode: setMode,
    tick: tick,
    formatTime: formatTime,
    formatSpeech: formatSpeech,
    recordFocusSession: recordFocusSession,
    loadSessions: loadSessions,
    saveSessions: saveSessions,
  };
});
