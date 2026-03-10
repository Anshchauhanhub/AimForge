// State Management
const state = {
  streak: 0,
  sessions: 0,
  currentView: 'overview',
  plan: [],
  timer: null,
  timeLeft: 25 * 60, // 25 mins default
  isTimerRunning: false,
  activeTopic: null,
  notificationTimer: null
};

// DOM Elements
const els = {
  streakCounter: document.getElementById('streakCounter'),
  sessionCounter: document.getElementById('sessionCounter'),
  navBtns: document.querySelectorAll('.tab-btn'),
  views: document.querySelectorAll('.view'),

  // Badge
  goalsBadge: document.getElementById('goalsBadge'),

  // Overview
  heatmapGrid: document.getElementById('heatmapGrid'),
  pinnedGoalsGrid: document.getElementById('pinnedGoalsGrid'),
  activityTimeline: document.getElementById('activityTimeline'),

  // Chat
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),

  // Plan
  planContainer: document.getElementById('planContainer'),

  // Timer
  currentFocusTopic: document.getElementById('currentFocusTopic'),
  timerDisplay: document.getElementById('timerDisplay'),
  startTimerBtn: document.getElementById('startTimerBtn'),
  pauseTimerBtn: document.getElementById('pauseTimerBtn'),
  finishTimerBtn: document.getElementById('finishTimerBtn'),

  // Notification
  notificationOverlay: document.getElementById('notificationOverlay'),
  notifTitle: document.getElementById('notifTitle'),
  notifMessage: document.getElementById('notifMessage'),
  bypassToTimerBtn: document.getElementById('bypassToTimerBtn'),
};

// Initialize
async function init() {
  await loadUserData();

  updateStatsPanel();
  setupEventListeners();
  renderHeatmap();

  if (state.plan.length > 0) {
    renderPlan();
    renderPinnedGoals();
  }

  // Start notification loop
  scheduleRandomNotification();
}

async function loadUserData() {
  try {
    const statsRes = await fetch('http://127.0.0.1:8000/api/me');
    if (!statsRes.ok) throw new Error('Could not fetch user data');
    const stats = await statsRes.json();
    state.streak = stats.streak;
    state.sessions = stats.sessions;

    const planRes = await fetch('http://127.0.0.1:8000/api/plan');
    if (planRes.ok) {
      state.plan = await planRes.json();
    }

    updateStatsPanel();
  } catch (e) {
    console.error("Failed to load global user data:", e);
  }
}

function updateStatsPanel() {
  els.streakCounter.textContent = `${state.streak} Days`;
  els.sessionCounter.textContent = `${state.sessions} Completed`;

  const uncompletedCount = state.plan.filter(p => !p.completed).length;
  els.goalsBadge.textContent = uncompletedCount.toString();
}

function switchView(viewName) {
  state.currentView = viewName;

  els.navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  els.views.forEach(view => {
    view.classList.remove('active-view');
    view.classList.add('hidden-view');
    if (view.id === `view-${viewName}`) {
      view.classList.remove('hidden-view');
      view.classList.add('active-view');
    }
  });

  if (viewName === 'goals' || viewName === 'overview') {
    renderPlan();
    renderPinnedGoals();
  }
}

function setupEventListeners() {
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Chat
  els.sendChatBtn.addEventListener('click', handleUserChat);
  els.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserChat();
  });

  // Timer
  els.startTimerBtn.addEventListener('click', startTimer);
  els.pauseTimerBtn.addEventListener('click', pauseTimer);
  els.finishTimerBtn.addEventListener('click', finishTimerSession);

  // Notification Bypass
  els.bypassToTimerBtn.addEventListener('click', bypassToTimer);
}

// ==============
// Rendering Overview & Heatmap 
// ==============
function renderHeatmap() {
  els.heatmapGrid.innerHTML = '';
  // 53 cols * 7 rows = 371 cells
  const totalCells = 371;
  const today = new Date();

  // Make heatmap look slightly realistic based on streak and session data
  // We'll mark the last `state.streak` continuous active cells.
  // And randomly sprinkle older sessions.

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    // Logic to highlight recent activity based on streak
    const daysAgo = totalCells - 1 - i;

    if (daysAgo < state.streak) {
      // Recent consecutive streak
      cell.setAttribute('data-level', Math.floor(Math.random() * 3) + 2); // 2, 3, or 4
    } else if (Math.random() < 0.15 && daysAgo < 200) {
      // Random older activity
      cell.setAttribute('data-level', Math.floor(Math.random() * 2) + 1); // 1 or 2
    } else {
      cell.setAttribute('data-level', '0');
    }

    els.heatmapGrid.appendChild(cell);
  }
}

function renderPinnedGoals() {
  const inProgress = state.plan.filter(p => !p.completed).slice(0, 4);

  if (inProgress.length === 0) {
    els.pinnedGoalsGrid.innerHTML = `
      <div class="pinned-goal-card empty-card">
         <p class="text-sm">No goals in progress.</p>
      </div>`;
    return;
  }

  els.pinnedGoalsGrid.innerHTML = '';
  inProgress.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pinned-goal-card';
    card.innerHTML = `
      <h4><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" class="octicon"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9Zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8ZM5 12.25v3.25a.25.25 0 0 0 .4.2l1.45-1.087a.25.25 0 0 1 .3 0L8.6 15.7a.25.25 0 0 0 .4-.2v-3.25a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25Z"></path></svg> ${item.topic}</h4>
      <p>A ${item.duration}-minute learning session designed by your AI Copilot.</p>
      <div class="mt-2 text-sm color-muted">⏳ In Progress</div>
    `;
    els.pinnedGoalsGrid.appendChild(card);
  });
}

function addActivityLog(message) {
  const item = document.createElement('div');
  item.className = 'activity-item text-sm';
  item.textContent = message;
  els.activityTimeline.prepend(item);
}


// ==============
// Chat & AI Logic 
// ==============
function handleUserChat() {
  const text = els.chatInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  els.chatInput.value = '';

  // Show typing indicator
  const indicator = document.createElement('div');
  indicator.className = 'message ai-message typing-indicator';
  indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  els.chatMessages.appendChild(indicator);
  scrollToBottom(els.chatMessages);

  generatePlanFromChat(text, indicator);
}

function appendMessage(sender, text) {
  const div = document.createElement('div');
  div.className = `message ${sender}-message`;
  div.innerHTML = `<div class="message-content">${text}</div>`;
  els.chatMessages.appendChild(div);
  scrollToBottom(els.chatMessages);
}

function scrollToBottom(element) {
  element.scrollTop = element.scrollHeight;
}

async function generatePlanFromChat(userText, indicator) {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: userText })
    });

    indicator.remove();

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // Save to backend
    const newPlan = data.plan.map(t => ({
      topic: t.topic,
      duration: t.duration || 25
    }));

    const saveRes = await fetch('http://127.0.0.1:8000/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newPlan)
    });

    if (saveRes.ok) {
      state.plan = await saveRes.json();
      updateStatsPanel();
      addActivityLog(`Generated a new learning plan for: ${userText}`);
    } else {
      throw new Error("Failed to save plan to backend");
    }

    appendMessage('ai', data.reply);
  } catch (err) {
    console.error(err);
    if (indicator.parentNode) indicator.remove();
    appendMessage('ai', 'Error connecting to the AI backend. Make sure the Python server is running.');
  }
}

// ==============
// Plan / Goals Logic
// ==============
function renderPlan() {
  if (state.plan.length === 0) {
    els.planContainer.innerHTML = '<div class="empty-state text-sm">No curriculum assigned yet. Consult the AI in the Practice tab to begin!</div>';
    return;
  }

  els.planContainer.innerHTML = '';
  state.plan.forEach(item => {
    const el = document.createElement('div');
    el.className = 'goal-repo-item';
    el.innerHTML = `
      <div class="goal-repo-info">
        <h3><a href="#" onclick="event.preventDefault(); document.dispatchEvent(new CustomEvent('start-topic', {detail: '${item.id}'}))">${item.topic}</a></h3>
        <p>Focused practice session on ${item.topic} taking roughly ${item.duration} minutes.</p>
        <div class="text-sm color-muted">
          ${item.completed
        ? '<span style="color:var(--color-fg-success)">🔥 Completed</span>'
        : '<span style="color:var(--color-fg-warn)">⏳ In Progress</span>'}
        </div>
      </div>
      <div>
        ${item.completed
        ? '<button class="gh-btn" disabled>Finished</button>'
        : `<button class="gh-btn primary" onclick="document.dispatchEvent(new CustomEvent('start-topic', {detail: '${item.id}'}))">Practice</button>`
      }
      </div>
    `;
    els.planContainer.appendChild(el);
  });
}

// Listens for inline buttons in the plan view
document.addEventListener('start-topic', (e) => {
  const id = parseInt(e.detail);
  const item = state.plan.find(i => i.id === id);
  if (item) {
    switchView('practice');
    prepareTimerFor(item);
  }
});

// ==============
// Timer Logic
// ==============
function prepareTimerFor(planItem) {
  state.activeTopic = planItem;
  state.timeLeft = planItem.duration * 60;
  state.isTimerRunning = false;
  clearInterval(state.timer);

  els.currentFocusTopic.textContent = `Active Goal: ${planItem.topic}`;
  updateTimerDisplay();

  els.startTimerBtn.classList.remove('hidden');
  els.pauseTimerBtn.classList.add('hidden');
  els.finishTimerBtn.classList.add('hidden');
  els.startTimerBtn.textContent = "Start Session";
}

function updateTimerDisplay() {
  const m = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
  const s = (state.timeLeft % 60).toString().padStart(2, '0');
  els.timerDisplay.textContent = `${m}:${s}`;
}

function startTimer() {
  if (state.isTimerRunning) return;
  state.isTimerRunning = true;

  els.startTimerBtn.classList.add('hidden');
  els.pauseTimerBtn.classList.remove('hidden');
  els.finishTimerBtn.classList.remove('hidden');

  state.timer = setInterval(() => {
    if (state.timeLeft > 0) {
      state.timeLeft--;
      updateTimerDisplay();
    } else {
      finishTimerSession();
    }
  }, 1000);
}

function pauseTimer() {
  state.isTimerRunning = false;
  clearInterval(state.timer);

  els.startTimerBtn.classList.remove('hidden');
  els.startTimerBtn.textContent = "Resume";
  els.pauseTimerBtn.classList.add('hidden');
}

async function finishTimerSession() {
  clearInterval(state.timer);
  state.isTimerRunning = false;

  // Gamification Logic
  state.sessions++;
  state.streak++; // Simplification to guarantee streak bumps

  updateStatsPanel();
  renderHeatmap();
  if (state.activeTopic) addActivityLog(`Completed session: ${state.activeTopic.topic}`);

  els.currentFocusTopic.textContent = `Lesson Complete! +1 Contribution`;
  els.startTimerBtn.classList.add('hidden');
  els.pauseTimerBtn.classList.add('hidden');
  els.finishTimerBtn.classList.add('hidden');
  setTimeout(() => switchView('overview'), 2500);

  // Sync to backend
  try {
    await fetch('http://127.0.0.1:8000/api/me/stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ streak_add: 1, sessions_add: 1 })
    });

    if (state.activeTopic) {
      state.activeTopic.completed = true;
      await fetch(`http://127.0.0.1:8000/api/plan/${state.activeTopic.id}`, {
        method: 'PUT'
      });
      // Update badge
      updateStatsPanel();
    }
  } catch (err) {
    console.error("Failed to sync stats", err);
  }
}

// ==============
// Notification System
// ==============
function scheduleRandomNotification() {
  const delay = 30000;

  state.notificationTimer = setTimeout(() => {
    if (state.currentView === 'practice' && state.isTimerRunning) {
      scheduleRandomNotification();
      return;
    }
    showNotification();
  }, delay);
}

function showNotification() {
  let targetTopic = "your goals";
  let targetItem = null;
  const uncompleted = state.plan.filter(p => !p.completed);

  if (uncompleted.length > 0) {
    targetItem = uncompleted[0];
    targetTopic = targetItem.topic;
  }

  const motivations = [
    `Time to contribute! Open your mind and conquer ${targetTopic} right now.`,
    `Consistency is key. Jump in to practice ${targetTopic}.`,
    `Your heatmap is waiting to be painted green. Start working on ${targetTopic}!`
  ];

  const msg = motivations[Math.floor(Math.random() * motivations.length)];

  els.notifMessage.textContent = msg;
  els.notifTitle.textContent = `Practice Reminder`;
  els.notificationOverlay.classList.remove('hidden');

  els.bypassToTimerBtn.onclick = () => {
    els.notificationOverlay.classList.add('hidden');
    switchView('practice');

    if (targetItem) {
      prepareTimerFor(targetItem);
    } else {
      prepareTimerFor({ id: 999, topic: "Ad-hoc Lesson", duration: 25, completed: false });
    }

    startTimer();
    scheduleRandomNotification();
  };
}

function bypassToTimer() {
  // defined inline above mostly, but this serves as a fallback 
  els.notificationOverlay.classList.add('hidden');
}

// Kickoff
init();
