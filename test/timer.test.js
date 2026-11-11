const test = require('node:test');
const assert = require('node:assert/strict');
const timer = require('../js/timer.js');

test('formatTime renders a mm:ss countdown', () => {
  assert.equal(timer.formatTime(0), '00:00');
  assert.equal(timer.formatTime(25 * 60), '25:00');
  assert.equal(timer.formatTime(65), '01:05');
  assert.equal(timer.formatTime(-4), '00:00');
  assert.equal(timer.formatTime(Number.NaN), '00:00');
});

test('formatSpeech spells the remaining time', () => {
  assert.equal(timer.formatSpeech(25 * 60), '25 minutes 0 seconds');
  assert.equal(timer.formatSpeech(61), '1 minute 1 second');
});

test('start, pause, and resume keep the time left', () => {
  const started = timer.start(timer.createTimer(), 1_000);
  assert.equal(started.status, 'running');
  assert.equal(started.endsAt, 1_000 + 25 * 60 * 1000);
  assert.equal(timer.start(started, 5_000), started);

  const paused = timer.pause(started, 1_000 + 90 * 1000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remaining, 25 * 60 - 90);
  assert.equal(paused.endsAt, null);
  assert.equal(timer.pause(paused, 9_000), paused);

  const resumed = timer.start(paused, 50_000);
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.remaining, paused.remaining);
  assert.equal(resumed.endsAt, 50_000 + paused.remaining * 1000);
});

test('tick waits for the next displayed second', () => {
  const started = timer.start(timer.createTimer(), 0);
  const early = timer.tick(started, 400);
  assert.equal(early.completed, false);
  assert.equal(early.timer, started);

  const next = timer.tick(started, 1000);
  assert.equal(next.completed, false);
  assert.notEqual(next.timer, started);
  assert.equal(next.timer.remaining, 25 * 60 - 1);
  assert.deepEqual(started, {
    mode: 'work',
    status: 'running',
    remaining: 25 * 60,
    endsAt: 25 * 60 * 1000,
  });
});

test('tick finishes a focus session and arms a break', () => {
  const started = timer.start(timer.createTimer(), 0);
  const almost = timer.tick(started, 25 * 60 * 1000 - 1);
  assert.equal(almost.completed, false);
  assert.equal(almost.timer.remaining, 1);
  assert.equal(almost.timer.status, 'running');

  const done = timer.tick(started, 25 * 60 * 1000);
  assert.equal(done.completed, true);
  assert.equal(done.finishedMode, 'work');
  assert.deepEqual(done.timer, {
    mode: 'break',
    status: 'idle',
    remaining: 5 * 60,
    endsAt: null,
  });
});

test('a finished break returns to focus', () => {
  const started = timer.start(timer.setMode(timer.createTimer(), 'break'), 0);
  const done = timer.tick(started, 5 * 60 * 1000);
  assert.equal(done.finishedMode, 'break');
  assert.equal(done.timer.mode, 'work');
  assert.equal(done.timer.status, 'idle');
  assert.equal(done.timer.remaining, 25 * 60);
});

test('reset restores the current mode and setMode stays out of a running session', () => {
  const running = timer.start(timer.createTimer(), 0);
  assert.equal(timer.setMode(running, 'break'), running);
  assert.equal(timer.setMode(running, 'later'), running);

  const paused = timer.pause(timer.start(timer.setMode(timer.createTimer(), 'break'), 0), 30_000);
  assert.deepEqual(timer.reset(paused), {
    mode: 'break',
    status: 'idle',
    remaining: 5 * 60,
    endsAt: null,
  });

  const idle = timer.createTimer();
  const switched = timer.setMode(idle, 'break');
  assert.equal(switched.mode, 'break');
  assert.equal(switched.remaining, 5 * 60);
  assert.equal(timer.setMode(switched, 'break'), switched);
});

test('focus sessions increment only when a focus block finishes', () => {
  assert.equal(timer.recordFocusSession(0, 'work'), 1);
  assert.equal(timer.recordFocusSession(2, 'work'), 3);
  assert.equal(timer.recordFocusSession(2, 'break'), 2);
  assert.equal(timer.recordFocusSession(Number.NaN, 'work'), 1);
});

test('session counts round-trip through storage', () => {
  const saved = new Map();
  const storage = {
    getItem(key) { return saved.has(key) ? saved.get(key) : null; },
    setItem(key, value) { saved.set(key, value); },
  };
  assert.equal(timer.loadSessions(storage), 0);
  assert.equal(timer.saveSessions(storage, 4), true);
  assert.equal(storage.getItem(timer.SESSION_KEY), '4');
  assert.equal(timer.loadSessions(storage), 4);
  assert.equal(timer.saveSessions(storage, -2), true);
  assert.equal(timer.loadSessions(storage), 0);
  assert.equal(timer.loadSessions({ getItem() { throw new Error('denied'); } }), 0);
  assert.equal(timer.saveSessions({ setItem() { throw new Error('quota'); } }, 1), false);
});
