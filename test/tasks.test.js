const test = require('node:test');
const assert = require('node:assert/strict');
const tasks = require('../js/tasks.js');

function memoryStorage(initial) {
  const saved = new Map(initial || []);
  return {
    saved,
    getItem(key) { return saved.has(key) ? saved.get(key) : null; },
    setItem(key, value) { saved.set(key, value); },
  };
}

test('addTask trims titles, rejects blanks, and does not mutate the list', () => {
  const before = [];
  assert.equal(tasks.addTask(before, '   '), before);
  assert.equal(tasks.addTask(before, null), before);

  const long = '  hello   world  ' + 'x'.repeat(200);
  const next = tasks.addTask(before, long, { id: 'a', now: 10 });
  assert.equal(before.length, 0);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'a');
  assert.equal(next[0].done, false);
  assert.equal(next[0].createdAt, 10);
  assert.equal(next[0].title.length, tasks.MAX_TITLE);
  assert.equal(next[0].title.startsWith('hello world '), true);

  const second = tasks.addTask(next, 'Second', { id: 'b', now: 11 });
  assert.deepEqual(second.map((task) => task.id), ['b', 'a']);
  assert.equal(next.length, 1);
});

test('toggleTask and deleteTask copy the list and ignore unknown ids', () => {
  const original = [{ id: '1', title: 'Write tests', done: false, createdAt: 1 }];
  const done = tasks.toggleTask(original, '1');
  assert.equal(original[0].done, false);
  assert.equal(done[0].done, true);
  assert.equal(tasks.toggleTask(done, 'missing'), done);

  const undone = tasks.toggleTask(done, '1');
  assert.equal(undone[0].done, false);

  const removed = tasks.deleteTask(done, '1');
  assert.deepEqual(removed, []);
  assert.equal(done.length, 1);
  assert.equal(tasks.deleteTask(original, 'nope'), original);
});

test('parseTasks keeps valid entries and drops everything else', () => {
  assert.deepEqual(tasks.parseTasks(null), []);
  assert.deepEqual(tasks.parseTasks(''), []);
  assert.deepEqual(tasks.parseTasks('not json'), []);
  assert.deepEqual(tasks.parseTasks('{"id":"a"}'), []);

  const raw = JSON.stringify([
    { id: 'a', title: '  Keep   me ', done: 1, createdAt: 5, extra: true },
    { id: 2, title: 'Bad id' },
    { title: 'Missing id' },
    null,
    { id: 'b', title: '   ' },
  ]);
  assert.deepEqual(tasks.parseTasks(raw), [
    { id: 'a', title: 'Keep me', done: true, createdAt: 5 },
  ]);
});

test('tasks round-trip through storage and survive a broken store', () => {
  const storage = memoryStorage();
  const list = tasks.addTask([], 'Ship the timer', { id: 't1', now: 20 });
  assert.equal(tasks.saveTasks(storage, list), true);
  assert.deepEqual(tasks.loadTasks(storage), [
    { id: 't1', title: 'Ship the timer', done: false, createdAt: 20 },
  ]);
  assert.equal(storage.saved.get(tasks.STORAGE_KEY).includes('Ship the timer'), true);

  storage.saved.set(tasks.STORAGE_KEY, '{');
  assert.deepEqual(tasks.loadTasks(storage), []);
  assert.deepEqual(tasks.loadTasks({ getItem() { throw new Error('denied'); } }), []);
  assert.equal(tasks.saveTasks({ setItem() { throw new Error('quota'); } }, list), false);
});
