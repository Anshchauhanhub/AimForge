// State Management
const state = {
  streak: parseInt(localStorage.getItem('focus_streak') || '0'),
  sessions: parseInt(localStorage.getItem('focus_sessions') || '0'),
  currentView: 'chat',
  plan: JSON.parse(localStorage.getItem('focus_plan') || '[]'),
  timer: null,
  timeLeft: 25 * 60, // 25 mins default
  isTimerRunning: false,
  activeTopic: null,
  notificationTimer: null,
  token: localStorage.getItem('focus_token'),
  authMode: 'login' // 'login' or 'register'
};

// DOM Elements
const els = {
  streakCounter: document.getElementById('streakCounter'),
  sessionCounter: document.getElementById('sessionCounter'),
  navBtns: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),

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

  // Auth
  authContent: document.getElementById('authContent'),
  appContent: document.getElementById('appContent'),
  authForm: document.getElementById('authForm'),
  authSubtitle: document.getElementById('authSubtitle'),
  usernameInput: document.getElementById('username'),
  passwordInput: document.getElementById('password'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authError: document.getElementById('authError'),
  authToggleText: document.getElementById('authToggleText'),
  authToggleLink: document.getElementById('authToggleLink'),
  logoutBtn: document.getElementById('logoutBtn')
};

// Initialize
function init() {
  if (state.token) {
    showApp();
  } else {
    showAuth();
  }

  updateStatsPanel();
  setupEventListeners();
  if (state.plan.length > 0) renderPlan();

  // Start random notification loop
  scheduleRandomNotification();
}

function updateStatsPanel() {
  els.streakCounter.textContent = state.streak;
  els.sessionCounter.textContent = state.sessions;
  localStorage.setItem('focus_streak', state.streak.toString());
  localStorage.setItem('focus_sessions', state.sessions.toString());
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

  if (viewName === 'plan') renderPlan();
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

  // Auth
  els.authToggleLink.addEventListener('click', toggleAuthMode);
  els.authForm.addEventListener('submit', handleAuthSubmit);
  els.logoutBtn.addEventListener('click', logout);
}

// ==============
// Auth Logic
// ==============
function showAuth() {
  els.appContent.classList.add('hidden');
  els.authContent.classList.remove('hidden');
  clearAuthError();
}

function showApp() {
  els.authContent.classList.add('hidden');
  els.appContent.classList.remove('hidden');
  // Start random notification loop only when logged in
  scheduleRandomNotification();
}

function toggleAuthMode(e) {
  e.preventDefault();
  state.authMode = state.authMode === 'login' ? 'register' : 'login';
  clearAuthError();

  if (state.authMode === 'register') {
    els.authSubtitle.textContent = "Create an account to start syncing";
    els.authSubmitBtn.textContent = "Sign Up";
    els.authToggleText.textContent = "Already have an account?";
    els.authToggleLink.textContent = "Log in";
  } else {
    els.authSubtitle.textContent = "Log in to sync your productivity";
    els.authSubmitBtn.textContent = "Log In";
    els.authToggleText.textContent = "Don't have an account?";
    els.authToggleLink.textContent = "Sign up";
  }
}

function clearAuthError() {
  els.authError.textContent = '';
  els.authError.classList.add('hidden');
}

function showAuthError(msg) {
  els.authError.textContent = msg;
  els.authError.classList.remove('hidden');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = els.usernameInput.value.trim();
  const password = els.passwordInput.value.trim();
  if (!username || !password) return;

  els.authSubmitBtn.disabled = true;
  clearAuthError();

  try {
    if (state.authMode === 'register') {
      const res = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
      // Auto-switch to login mode
      state.authMode = 'login';
      showAuthError("Account created! Logging you in...");
    }

    // Login (both for manual login and auto-login after register)
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const loginRes = await fetch('http://localhost:8000/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    if (!loginRes.ok) {
      const errorData = await loginRes.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await loginRes.json();
    state.token = data.access_token;
    localStorage.setItem('focus_token', state.token);

    // Clear inputs and show app
    els.usernameInput.value = '';
    els.passwordInput.value = '';
    showApp();

  } catch (err) {
    showAuthError(err.message);
  } finally {
    els.authSubmitBtn.disabled = false;
  }
}

function logout() {
  state.token = null;
  localStorage.removeItem('focus_token');

  // Optionally clear plan/streaks or keep them local. 
  // We'll keep them local for this demo but stop the UI loop.
  clearTimeout(state.notificationTimer);
  showAuth();
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
  if (!state.token) {
    logout();
    return;
  }

  try {
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ message: userText })
    });

    indicator.remove();

    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // Create new plan array
    state.plan = data.plan.map((t, i) => ({
      id: Date.now() + i,
      topic: t.topic,
      duration: t.duration || 25,
      completed: false
    }));

    localStorage.setItem('focus_plan', JSON.stringify(state.plan));

    appendMessage('ai', data.reply);
  } catch (err) {
    console.error(err);
    if (indicator.parentNode) indicator.remove();
    appendMessage('ai', 'Error connecting to the AI backend. Please make sure the Python server is running on port 8000 and the HF token is set in the .env file.');
  }
}

// ==============
// Plan Logic
// ==============
function renderPlan() {
  if (state.plan.length === 0) {
    els.planContainer.innerHTML = '<div class="empty-state">No plan generated yet. Go to Chat to create one!</div>';
    return;
  }

  els.planContainer.innerHTML = '';
  state.plan.forEach(item => {
    const el = document.createElement('div');
    el.className = 'plan-item';
    el.innerHTML = `
      <div class="plan-info">
        <h3>${item.topic}</h3>
        <p>${item.duration} Min Focus Session</p>
      </div>
      <div>
        ${item.completed
        ? `<span style="color:var(--success-color); font-weight: bold;">✓ Done</span>`
        : `<button class="primary-btn" onclick="document.dispatchEvent(new CustomEvent('start-topic', {detail: '${item.id}'}))">Focus Now</button>`
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

  els.currentFocusTopic.textContent = `Focusing on: ${planItem.topic}`;
  updateTimerDisplay();

  els.startTimerBtn.classList.remove('hidden');
  els.pauseTimerBtn.classList.add('hidden');
  els.finishTimerBtn.classList.add('hidden');
  els.startTimerBtn.textContent = "Start Focus";
  els.startTimerBtn.classList.add('pulse-anim');

  switchView('timer');
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
  els.startTimerBtn.classList.remove('pulse-anim');
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

function finishTimerSession() {
  clearInterval(state.timer);
  state.isTimerRunning = false;

  // Gamification Logic
  state.sessions++;
  // Increment streak if first session of day (simplified logic, usually needs date check)
  state.streak++;

  if (state.activeTopic) {
    state.activeTopic.completed = true;
    localStorage.setItem('focus_plan', JSON.stringify(state.plan));
  }

  updateStatsPanel();

  els.currentFocusTopic.textContent = `Session Complete! +1 Streak`;
  els.startTimerBtn.classList.add('hidden');
  els.pauseTimerBtn.classList.add('hidden');
  els.finishTimerBtn.classList.add('hidden');
  setTimeout(() => switchView('plan'), 2500);
}

// ==============
// Notification System (AI Motivation)
// ==============
function scheduleRandomNotification() {
  // Fire between 10 to 20 seconds for demo purposes
  const delay = Math.floor(Math.random() * 10000) + 10000;

  state.notificationTimer = setTimeout(() => {
    // Don't show if they are already in timer and it's running
    if (state.currentView === 'timer' && state.isTimerRunning) {
      scheduleRandomNotification();
      return;
    }
    showNotification();
  }, delay);
}

function showNotification() {
  // Pick a random uncompleted topic if plan exists
  let targetTopic = "your goals";
  let targetItem = null;
  const uncompleted = state.plan.filter(p => !p.completed);

  if (uncompleted.length > 0) {
    targetItem = uncompleted[0];
    targetTopic = targetItem.topic;
  }

  const motivations = [
    `You're scrolling, aren't you? It's time to tackle ${targetTopic}. Engage focus mode!`,
    `A champion doesn't wait for the 'right time'. Drop in and conquer ${targetTopic} now.`,
    `Your future self is begging you to work on ${targetTopic} right now. Let's go.`
  ];

  const msg = motivations[Math.floor(Math.random() * motivations.length)];

  els.notifMessage.textContent = msg;
  els.notifTitle.textContent = `Time for ${targetTopic}!`;
  els.notificationOverlay.classList.remove('hidden');

  // Attach current item directly to bypass btn for convenience
  els.bypassToTimerBtn.onclick = () => {
    els.notificationOverlay.classList.add('hidden');

    if (targetItem) {
      prepareTimerFor(targetItem);
    } else {
      // Create a dummy ad-hoc plan item if no plan
      prepareTimerFor({ id: 999, topic: "Ad-hoc Focus", duration: 25, completed: false });
    }

    startTimer();
    scheduleRandomNotification();
  };
}

// Kickoff
init();
