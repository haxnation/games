import { checkAuth, login, logout, updateAuthUI } from './auth.js';
import { startGame, endGame, resetGame, scanPlayer, scoreRoom, declareWinner, removePlayer, apiCall } from './api.js';
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
        
        document.getElementById('roster-room-select').addEventListener('change', renderRoomRoster);
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

        const totalVictims = players.filter(p => p.team === 'green').length;
        if (totalVictims > 0) {
            document.getElementById('stat-win-condition').textContent = `WIN: > ${(totalVictims / 2).toFixed(1)}`;
        } else {
            document.getElementById('stat-win-condition').textContent = '';
        }

        currentPlayers = players;
        renderRoomRoster();
        updateRoomDropdowns(players);
    } catch (e) {
        console.error("Failed to load live data", e);
    }
}

let currentPlayers = [];

function updateRoomDropdowns(players) {
    const rooms = new Set();
    players.forEach(p => {
        if (p.room) rooms.add(p.room);
    });
    
    const select = document.getElementById('roster-room-select');
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- SELECT A ROOM --</option>';
    rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        select.appendChild(opt);
    });
    
    if (rooms.has(currentVal)) {
        select.value = currentVal;
    }
}

function renderRoomRoster() {
    const room = document.getElementById('roster-room-select').value;
    const list = document.getElementById('roster-list');
    
    if (!room) {
        list.innerHTML = '<p class="font-mono text-sm text-gray-500 text-center mt-8">NO ROOM SELECTED</p>';
        return;
    }

    const roomPlayers = currentPlayers.filter(p => p.room === room);
    
    if (roomPlayers.length === 0) {
        list.innerHTML = '<p class="font-mono text-sm text-gray-500 text-center mt-8">ROOM IS EMPTY</p>';
        return;
    }

    list.innerHTML = '';
    roomPlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white border-2 border-ink p-3 mb-2';
        
        let teamColor = 'text-ink';
        if (p.team === 'red') teamColor = 'text-danger';
        if (p.team === 'green') teamColor = 'text-green-500';
        if (p.team === 'blue') teamColor = 'text-cyan';

        item.innerHTML = `
            <div>
                <p class="font-mono font-bold text-sm truncate w-48">${p.user_id}</p>
                <p class="font-mono text-xs uppercase font-bold ${teamColor}">${p.team || 'NONE'}</p>
            </div>
            <button class="btn-remove font-mono text-xs font-bold bg-danger text-white px-2 py-1 uppercase" data-uid="${p.user_id}">REMOVE</button>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.target.getAttribute('data-uid');
            try {
                log(`Removing player ${uid} from room ${room}...`);
                await removePlayer(uid, room);
                log(`Player removed.`);
                loadAdminData();
            } catch (err) {
                log(`ERROR: ${err.message}`);
            }
        });
    });
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

    let html5QrcodeScanner = null;
    document.getElementById('btn-toggle-camera').addEventListener('click', () => {
        const reader = document.getElementById('reader');
        if (reader.classList.contains('hidden')) {
            reader.classList.remove('hidden');
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
                html5QrcodeScanner.render((decodedText, decodedResult) => {
                    log(`QR Detected: ${decodedText}`);
                    document.getElementById('scan-uid').value = decodedText;
                }, (error) => {});
            }
        } else {
            reader.classList.add('hidden');
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }
        }
    });


}
