const STORAGE_KEY = 'focusflow_data_v1';
const THEME_KEY = 'focusflow_theme';

const state = loadState();

const els = {
  todayDate: document.getElementById('todayDate'),
  pendingCount: document.getElementById('pendingCount'),
  doneCount: document.getElementById('doneCount'),
  goalAvg: document.getElementById('goalAvg'),
  habitCount: document.getElementById('habitCount'),
  taskForm: document.getElementById('taskForm'),
  taskTitle: document.getElementById('taskTitle'),
  taskPriority: document.getElementById('taskPriority'),
  taskDate: document.getElementById('taskDate'),
  taskList: document.getElementById('taskList'),
  goalForm: document.getElementById('goalForm'),
  goalTitle: document.getElementById('goalTitle'),
  goalProgress: document.getElementById('goalProgress'),
  goalProgressValue: document.getElementById('goalProgressValue'),
  goalList: document.getElementById('goalList'),
  habitForm: document.getElementById('habitForm'),
  habitTitle: document.getElementById('habitTitle'),
  habitList: document.getElementById('habitList'),
  clearDoneTasks: document.getElementById('clearDoneTasks'),
  resetHabitChecks: document.getElementById('resetHabitChecks'),
  themeToggle: document.getElementById('themeToggle'),
  exportBtn: document.getElementById('exportBtn'),
  tabs: [...document.querySelectorAll('.tab')],
  panels: {
    tasks: document.getElementById('tasksPanel'),
    goals: document.getElementById('goalsPanel'),
    habits: document.getElementById('habitsPanel')
  }
};

init();

function init() {
  setToday();
  applyTheme();
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  els.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.taskTitle.value.trim();
    if (!title) return;

    state.tasks.unshift({
      id: uid(),
      title,
      priority: els.taskPriority.value,
      date: els.taskDate.value || '',
      done: false,
      createdAt: new Date().toISOString()
    });

    els.taskForm.reset();
    persistAndRender();
  });

  els.goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.goalTitle.value.trim();
    if (!title) return;

    state.goals.unshift({
      id: uid(),
      title,
      progress: Number(els.goalProgress.value)
    });

    els.goalForm.reset();
    els.goalProgress.value = 0;
    els.goalProgressValue.textContent = '0%';
    persistAndRender();
  });

  els.goalProgress.addEventListener('input', () => {
    els.goalProgressValue.textContent = `${els.goalProgress.value}%`;
  });

  els.habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.habitTitle.value.trim();
    if (!title) return;

    state.habits.unshift({
      id: uid(),
      title,
      streak: 0,
      lastCompletedDate: '',
      completedToday: false
    });

    els.habitForm.reset();
    persistAndRender();
  });

  els.clearDoneTasks.addEventListener('click', () => {
    state.tasks = state.tasks.filter(task => !task.done);
    persistAndRender();
  });

  els.resetHabitChecks.addEventListener('click', () => {
    state.habits = state.habits.map(habit => ({ ...habit, completedToday: false }));
    persistAndRender();
  });

  els.themeToggle.addEventListener('click', toggleTheme);

  els.exportBtn.addEventListener('click', exportData);

  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  // Single delegated listener for all dynamic action buttons
  document.querySelector('.content').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) handleAction(btn.dataset.action, btn.dataset.id);
  });
}

function render() {
  normalizeHabitsForNewDay();
  renderSummary();
  renderTasks();
  renderGoals();
  renderHabits();
}

function renderSummary() {
  const pending = state.tasks.filter(t => !t.done).length;
  const done = state.tasks.filter(t => t.done).length;
  const avgGoal = state.goals.length
    ? Math.round(state.goals.reduce((sum, g) => sum + g.progress, 0) / state.goals.length)
    : 0;
  const habitsCompleted = state.habits.filter(h => h.completedToday).length;
  const habitsTotal = state.habits.length;

  els.pendingCount.textContent = pending;
  els.doneCount.textContent = done;
  els.goalAvg.textContent = `${avgGoal}%`;
  els.habitCount.textContent = `${habitsCompleted}/${habitsTotal}`;
}

function renderTasks() {
  els.taskList.innerHTML = '';
  if (!state.tasks.length) return appendEmpty(els.taskList);

  const today = todayKey();
  state.tasks.forEach(task => {
    const isOverdue = task.date && !task.done && task.date < today;
    const item = document.createElement('article');
    item.className = `item${task.done ? ' done' : ''}${isOverdue ? ' overdue' : ''}`;
    item.innerHTML = `
      <div class="item-main">
        <span class="item-title">${escapeHtml(task.title)}</span>
        <span class="pill">${escapeHtml(task.priority)}</span>
      </div>
      <div class="item-meta muted">
        ${task.date ? `<span class="pill date-pill">${formatDate(task.date)}</span>` : '<span>Sin fecha</span>'}
        <span>${task.done ? 'Completada' : 'Pendiente'}</span>
      </div>
      <div class="actions">
        <button class="small-btn ${task.done ? '' : 'success'}" data-action="toggle-task" data-id="${task.id}">
          ${task.done ? 'Desmarcar' : 'Hecha'}
        </button>
        <button class="small-btn danger" data-action="delete-task" data-id="${task.id}">Eliminar</button>
      </div>
    `;
    els.taskList.appendChild(item);
  });
}

function renderGoals() {
  els.goalList.innerHTML = '';
  if (!state.goals.length) return appendEmpty(els.goalList);

  state.goals.forEach(goal => {
    const item = document.createElement('article');
    item.className = 'item';
    item.innerHTML = `
      <div class="item-main">
        <span class="item-title">${escapeHtml(goal.title)}</span>
        <span class="pill">${goal.progress}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${goal.progress}%"></div>
      </div>
      <div class="actions">
        <button class="small-btn" data-action="goal-minus" data-id="${goal.id}">-10%</button>
        <button class="small-btn success" data-action="goal-plus" data-id="${goal.id}">+10%</button>
        <button class="small-btn danger" data-action="delete-goal" data-id="${goal.id}">Eliminar</button>
      </div>
    `;
    els.goalList.appendChild(item);
  });
}

function renderHabits() {
  els.habitList.innerHTML = '';
  if (!state.habits.length) return appendEmpty(els.habitList);

  state.habits.forEach(habit => {
    const item = document.createElement('article');
    item.className = 'item';
    item.innerHTML = `
      <div class="habit-top">
        <span class="item-title">${escapeHtml(habit.title)}</span>
        <span class="pill${habit.streak > 2 ? ' hot' : ''}">Racha ${habit.streak}</span>
      </div>
      <div class="item-meta muted">
        <span>${habit.completedToday ? 'Hecho hoy' : 'Pendiente hoy'}</span>
      </div>
      <div class="actions">
        <button class="small-btn ${habit.completedToday ? '' : 'success'}" data-action="toggle-habit" data-id="${habit.id}">
          ${habit.completedToday ? 'Quitar check' : 'Marcar hoy'}
        </button>
        <button class="small-btn danger" data-action="delete-habit" data-id="${habit.id}">Eliminar</button>
      </div>
    `;
    els.habitList.appendChild(item);
  });
}

function handleAction(action, id) {
  if (action === 'toggle-task') {
    state.tasks = state.tasks.map(task => task.id === id ? { ...task, done: !task.done } : task);
  }

  if (action === 'delete-task') {
    if (!confirm('¿Eliminar este elemento?')) return;
    state.tasks = state.tasks.filter(task => task.id !== id);
  }

  if (action === 'goal-plus') {
    state.goals = state.goals.map(goal => goal.id === id ? { ...goal, progress: clamp(goal.progress + 10, 0, 100) } : goal);
  }

  if (action === 'goal-minus') {
    state.goals = state.goals.map(goal => goal.id === id ? { ...goal, progress: clamp(goal.progress - 10, 0, 100) } : goal);
  }

  if (action === 'delete-goal') {
    if (!confirm('¿Eliminar este elemento?')) return;
    state.goals = state.goals.filter(goal => goal.id !== id);
  }

  if (action === 'toggle-habit') {
    state.habits = state.habits.map(habit => {
      if (habit.id !== id) return habit;
      const today = todayKey();

      if (!habit.completedToday) {
        const streak = habit.lastCompletedDate === yesterdayKey()
          ? habit.streak + 1
          : habit.lastCompletedDate === today ? habit.streak : 1;
        return { ...habit, completedToday: true, lastCompletedDate: today, streak };
      }

      // Uncheck same day: only remove the visual check, never penalize streak
      return { ...habit, completedToday: false };
    });
  }

  if (action === 'delete-habit') {
    if (!confirm('¿Eliminar este elemento?')) return;
    state.habits = state.habits.filter(habit => habit.id !== id);
  }

  persistAndRender();
}

function activateTab(name) {
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  Object.entries(els.panels).forEach(([key, panel]) => {
    const isActive = key === name;
    panel.classList.toggle('active', isActive);
    if (isActive) {
      panel.classList.add('entering');
      panel.addEventListener('animationend', () => panel.classList.remove('entering'), { once: true });
    }
  });
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  els.themeToggle.textContent = isDark ? '☀︎' : '☾';
}

function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved ? saved === 'dark' : prefersDark;
  document.body.classList.toggle('dark', dark);
  els.themeToggle.textContent = dark ? '☀︎' : '☾';
}

function setToday() {
  const now = new Date();
  els.todayDate.textContent = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function exportData() {
  const today = todayKey();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focusflow-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function persistAndRender() {
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { tasks: [], goals: [], habits: [] };
  } catch {
    return { tasks: [], goals: [], habits: [] };
  }
}

function normalizeHabitsForNewDay() {
  const today = todayKey();
  let changed = false;
  state.habits = state.habits.map(habit => {
    if (habit.lastCompletedDate !== today && habit.completedToday) {
      changed = true;
      return { ...habit, completedToday: false };
    }
    return habit;
  });
  if (changed) saveState();
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function appendEmpty(container) {
  const tpl = document.getElementById('emptyStateTemplate');
  container.appendChild(tpl.content.cloneNode(true));
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
