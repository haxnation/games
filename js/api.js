import { API_BASE_URL, state } from './config.js';

export async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || `HTTP Error ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error('API Error:', e);
        throw e;
    }
}

export async function getGameState() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/state`);
}

export async function getGamePlayers() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/players`);
}

export async function startGame() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/start`, 'POST');
}

export async function endGame() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/end`, 'POST');
}

export async function resetGame() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/reset`, 'POST');
}

export async function scanPlayer(userId, room) {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/scan`, 'POST', { user_id: userId, room });
}

export async function scoreRoom(room) {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/score`, 'POST', { room });
}

export async function removePlayer(userId, room) {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/remove-player`, 'POST', { user_id: userId, room });
}

export async function declareWinner() {
    return apiCall(`/games/${state.currentGame}/${state.currentGameID}/winner`, 'POST');
}
