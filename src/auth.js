// Auth page logic
const API_BASE = 'http://127.0.0.1:8000';

// DOM
const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const authMessage = document.getElementById('authMessage');

// If already logged in, go to main app
if (localStorage.getItem('aimforge_token')) {
    window.location.href = '/';
}

// Tab switching
loginTab.addEventListener('click', () => switchTab('login'));
signupTab.addEventListener('click', () => switchTab('signup'));

function switchTab(tab) {
    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden-form');
        loginForm.classList.add('active-form');
        signupForm.classList.remove('active-form');
        signupForm.classList.add('hidden-form');
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden-form');
        signupForm.classList.add('active-form');
        loginForm.classList.remove('active-form');
        loginForm.classList.add('hidden-form');
    }
    hideMessage();
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) return showMessage('Please fill in all fields.', 'error');

    setLoading(loginForm, true);

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        // Save token and username
        localStorage.setItem('aimforge_token', data.token);
        localStorage.setItem('aimforge_username', data.username);

        // Quick verify: make sure the token actually works before redirecting
        const verifyRes = await fetch(`${API_BASE}/api/me`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`
            }
        });

        if (!verifyRes.ok) {
            console.error('Token verification failed after login!', verifyRes.status);
            localStorage.removeItem('aimforge_token');
            localStorage.removeItem('aimforge_username');
            throw new Error('Authentication error - token invalid. Please try again.');
        }

        showMessage('Login successful! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = '/';
        }, 800);

    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        setLoading(loginForm, false);
    }
});

// Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!email || !username || !password) return showMessage('Please fill in all fields.', 'error');
    if (password.length < 6) return showMessage('Password must be at least 6 characters.', 'error');

    setLoading(signupForm, true);

    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Registration failed');
        }

        // Save token and username
        localStorage.setItem('aimforge_token', data.token);
        localStorage.setItem('aimforge_username', data.username);

        // Quick verify: make sure the token actually works before redirecting
        const verifyRes = await fetch(`${API_BASE}/api/me`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`
            }
        });

        if (!verifyRes.ok) {
            console.error('Token verification failed after signup!', verifyRes.status);
            localStorage.removeItem('aimforge_token');
            localStorage.removeItem('aimforge_username');
            throw new Error('Authentication error - token invalid. Please try again.');
        }

        showMessage('Account created! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = '/';
        }, 800);

    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        setLoading(signupForm, false);
    }
});

// Helpers
function showMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
}

function hideMessage() {
    authMessage.className = 'auth-message hidden';
}

function setLoading(form, loading) {
    const btn = form.querySelector('.auth-submit-btn');
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    if (loading) {
        btn.disabled = true;
        text.style.opacity = '0';
        loader.classList.remove('hidden');
    } else {
        btn.disabled = false;
        text.style.opacity = '1';
        loader.classList.add('hidden');
    }
}

// Create floating fire particles
function createParticles() {
    const container = document.getElementById('particles');
    const colors = ['#ff6a00', '#ff4500', '#ffd700', '#ff8c00'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 4 + 2;
        particle.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: -10px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      animation-duration: ${Math.random() * 6 + 4}s;
      animation-delay: ${Math.random() * 6}s;
    `;
        container.appendChild(particle);
    }
}

createParticles();
