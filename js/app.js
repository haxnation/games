import { checkAuth, login, logout, updateAuthUI } from './auth.js';
import { getGameState, getGamePlayers } from './api.js';
import { state } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);

    const isAuth = await checkAuth();
    updateAuthUI();

    const mainPanel = document.getElementById('game-status-card');
    const unauthMessage = document.getElementById('unauth-message');

    if (isAuth) {
        unauthMessage.classList.add('hidden');
        mainPanel.classList.remove('hidden');
        await loadGameData();
        // Poll every 5 seconds
        setInterval(loadGameData, 5000);
    } else {
        unauthMessage.classList.remove('hidden');
        mainPanel.classList.add('hidden');
    }
});

async function loadGameData() {
    try {
        const gameState = await getGameState();
        document.getElementById('game-id-display').textContent = gameState.game_id;
        document.getElementById('game-state').textContent = gameState.state;

        const players = await getGamePlayers();
        const me = players.find(p => p.user_id === state.currentUser.user_id);
        
        if (me) {
            document.getElementById('player-team').textContent = me.team;
            document.getElementById('player-room').textContent = me.room || 'NONE';
        } else {
            document.getElementById('player-team').textContent = 'NOT IN GAME';
        }

        const resultsDiv = document.getElementById('game-results');
        if (gameState.state === 'scored' && gameState.scores) {
            resultsDiv.classList.remove('hidden');
            document.getElementById('result-score').textContent = gameState.scores.red || 0;
            
            const totalVictims = players.filter(p => p.team === 'green').length;
            if (totalVictims > 0) {
                document.getElementById('result-win-condition').textContent = `POINTS TO WIN: > ${(totalVictims / 2).toFixed(1)}`;
            } else {
                document.getElementById('result-win-condition').textContent = '';
            }

            const winnerSpan = document.getElementById('result-winner');
            if (gameState.scores.winner === 1) {
                winnerSpan.textContent = 'RED (HUNTERS)';
                winnerSpan.className = 'bg-danger text-white px-2 py-1 font-bold';
            } else if (gameState.scores.winner === 2) {
                winnerSpan.textContent = 'BLUE/GREEN (GUARDS/VICTIMS)';
                winnerSpan.className = 'bg-cyan text-ink px-2 py-1 font-bold';
            }
        } else {
            resultsDiv.classList.add('hidden');
        }
    } catch (e) {
        console.error("Failed to load game data", e);
    }
}
