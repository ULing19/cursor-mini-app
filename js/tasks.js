(function (root, factory) {
  const api = factory();
  const isNode = typeof module === 'object' && module.exports && typeof window === 'undefined';
  if (isNode) module.exports = api;
  else root.TaskLogic = api;
})(globalThis, function () {
  'use strict';

  const STORAGE_KEY = 'focus.tasks.v1';
  const MAX_TITLE = 140;

  function cleanTitle(title) {
    return String(title ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE);
  }

  function addTask(tasks, title, options) {
    const list = Array.isArray(tasks) ? tasks : [];
    const text = cleanTitle(title);
    if (!text) return list;
    const opts = options || {};
    const now = opts.now == null ? Date.now() : opts.now;
    const task = {
      id: opts.id || 't_' + now + '_' + Math.random().toString(36).slice(2, 8),
      title: text,
      done: false,
      createdAt: now,
    };
    return [task].concat(list);
  }

  function toggleTask(tasks, id) {
    const list = Array.isArray(tasks) ? tasks : [];
    let changed = false;
    const next = list.map(function (task) {
      if (!task || task.id !== id) return task;
      changed = true;
      return {
        id: task.id,
        title: task.title,
        done: !task.done,
        createdAt: task.createdAt,
      };
    });
    return changed ? next : list;
  }

  function deleteTask(tasks, id) {
    const list = Array.isArray(tasks) ? tasks : [];
    const next = list.filter(function (task) {
      return task && task.id !== id;
    });
    return next.length === list.length ? list : next;
  }

  function parseTasks(raw) {
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.reduce(function (list, entry) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.title !== 'string') return list;
        const title = cleanTitle(entry.title);
        if (!title) return list;
        list.push({
          id: entry.id,
          title: title,
          done: Boolean(entry.done),
          createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : 0,
        });
        return list;
      }, []);
    } catch (error) {
      return [];
    }
  }

  function loadTasks(storage, key) {
    if (!storage) return [];
    try {
      return parseTasks(storage.getItem(key || STORAGE_KEY));
    } catch (error) {
      return [];
    }
  }

  function saveTasks(storage, tasks, key) {
    if (!storage) return false;
    try {
      const clean = (Array.isArray(tasks) ? tasks : []).map(function (task) {
        return {
          id: task.id,
          title: task.title,
          done: Boolean(task.done),
          createdAt: task.createdAt,
        };
      });
      storage.setItem(key || STORAGE_KEY, JSON.stringify(clean));
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    MAX_TITLE: MAX_TITLE,
    cleanTitle: cleanTitle,
    addTask: addTask,
    toggleTask: toggleTask,
    deleteTask: deleteTask,
    parseTasks: parseTasks,
    loadTasks: loadTasks,
    saveTasks: saveTasks,
  };
});
