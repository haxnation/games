import { API_BASE_URL, state } from './config.js';

export async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                state.currentUser = data;
                return true;
            }
        }
    } catch (error) {
        console.log('Not logged in');
    }
    state.currentUser = null;
    return false;
}

export function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');

    if (state.currentUser) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (userName) userName.textContent = state.currentUser.name;
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
    }
}

export async function login() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, { credentials: 'include' });
        const data = await response.json();
        if (data.authorizationUrl) window.location.href = data.authorizationUrl;
    } catch (error) {
        alert('Login failed. Please try again.');
    }
}

export async function logout() {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.reload();
}
