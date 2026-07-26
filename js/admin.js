import { checkAuth, login, logout, updateAuthUI } from './auth.js';
import { startGame, endGame, resetGame, scanPlayer, scoreRoom, declareWinner } from './api.js';
import { state } from './config.js';

const sysLog = document.getElementById('sys-log');
function log(msg) {
    const p = document.createElement('p');
    p.textContent = `> ${msg}`;
    sysLog.appendChild(p);
    sysLog.scrollTop = sysLog.scrollHeight;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);

    const isAuth = await checkAuth();
    updateAuthUI();

    const adminPanel = document.getElementById('admin-panel');
    const unauthMessage = document.getElementById('unauth-message');

    if (isAuth) {
        unauthMessage.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        
        bindAdminEvents();
        await loadAdminData();
        setInterval(loadAdminData, 5000);
    } else {
        unauthMessage.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }
});

async function loadAdminData() {
    try {
        const [gameState, players] = await Promise.all([
            apiCall(`/games/${state.currentGame}/${state.currentGameID}/state`),
            apiCall(`/games/${state.currentGame}/${state.currentGameID}/players`)
        ]);

        document.getElementById('stat-state').textContent = gameState.state;
        document.getElementById('stat-players').textContent = players.length;
        
        if (gameState.scores) {
            document.getElementById('stat-score').textContent = gameState.scores.red || 0;
            if (gameState.scores.winner === 1) document.getElementById('stat-winner').textContent = 'RED';
            else if (gameState.scores.winner === 2) document.getElementById('stat-winner').textContent = 'BLUE/GREEN';
            else document.getElementById('stat-winner').textContent = 'N/A';
        } else {
            document.getElementById('stat-score').textContent = 0;
            document.getElementById('stat-winner').textContent = 'N/A';
        }
    } catch (e) {
        console.error("Failed to load live data", e);
    }
}

function bindAdminEvents() {
    document.getElementById('btn-start').addEventListener('click', async () => {
        try {
            log('Starting game and assigning teams...');
            await startGame();
            log('Game started successfully.');
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-end').addEventListener('click', async () => {
        try {
            log('Ending game. Scoring now open.');
            await endGame();
            log('Game ended successfully.');
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to completely reset the game state?')) return;
        try {
            log('Resetting game to pending state...');
            await resetGame();
            log('Game reset successfully.');
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-scan').addEventListener('click', async () => {
        const uid = document.getElementById('scan-uid').value.trim();
        const room = document.getElementById('scan-room').value.trim();
        if (!uid) return alert('UUID is required');
        
        try {
            log(`Scanning player ${uid} to room ${room}...`);
            await scanPlayer(uid, room);
            log(`Player scanned successfully.`);
            document.getElementById('scan-uid').value = '';
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-score-room').addEventListener('click', async () => {
        const room = document.getElementById('scan-room').value.trim();
        if (!room) return alert('Room ID is required');
        
        try {
            log(`Scoring room ${room}...`);
            await scoreRoom(room);
            log(`Room scored successfully.`);
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-winner').addEventListener('click', async () => {
        try {
            log('Calculating winner...');
            await declareWinner();
            log('Winner declared successfully.');
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });
}
