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

let currentRoomNumber = 1;
let currentPlayers = [];

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
        
        document.getElementById('roster-room-select').addEventListener('change', () => {
            document.getElementById('roster-room-select').dataset.manuallySelected = 'true';
            renderRoomRoster();
        });
    } else {
        unauthMessage.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }
});

// ─── DATA LOADING ────────────────────────────────────────────────────────────

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

        // Contextual Scanner UI states
        const instruction = document.getElementById('scanner-instruction');
        const roomSelection = document.getElementById('room-selection-container');
        const scoreBtn = document.getElementById('btn-score-room');
        const scannerContainer = document.getElementById('scanner-container');
        const manualEntryContainer = document.getElementById('scan-uid').closest('.border-t-2');

        if (gameState.state === 'pending') {
            instruction.textContent = 'SCAN TO JOIN GAME';
            instruction.className = 'font-mono text-xs font-bold uppercase tracking-wider text-center p-2 bg-cyan text-ink border-2 border-ink';
            roomSelection.classList.add('hidden');
            scoreBtn.classList.add('hidden');
            scannerContainer.classList.remove('hidden');
            manualEntryContainer.classList.remove('hidden');
        } else if (gameState.state === 'started') {
            instruction.textContent = 'GAME IN PROGRESS - SCANNING DISABLED';
            instruction.className = 'font-mono text-xs font-bold uppercase tracking-wider text-center p-2 bg-ink text-cyan border-2 border-ink';
            roomSelection.classList.add('hidden');
            scoreBtn.classList.add('hidden');
            scannerContainer.classList.add('hidden');
            manualEntryContainer.classList.add('hidden');
        } else if (gameState.state === 'ended') {
            instruction.textContent = 'SCAN PLAYERS INTO ROOMS';
            instruction.className = 'font-mono text-xs font-bold uppercase tracking-wider text-center p-2 bg-danger text-white border-2 border-ink';
            roomSelection.classList.remove('hidden');
            scoreBtn.classList.remove('hidden');
            scannerContainer.classList.remove('hidden');
            manualEntryContainer.classList.remove('hidden');
        } else if (gameState.state === 'scored') {
            instruction.textContent = 'SCORING COMPLETE';
            instruction.className = 'font-mono text-xs font-bold uppercase tracking-wider text-center p-2 bg-green-500 text-white border-2 border-ink';
            roomSelection.classList.add('hidden');
            scoreBtn.classList.add('hidden');
            scannerContainer.classList.add('hidden');
            manualEntryContainer.classList.add('hidden');
        }

        currentPlayers = players;
        updateRoomDropdowns();

        // Auto-select the current scanning room/mode in the roster dropdown
        const rosterSelect = document.getElementById('roster-room-select');
        if (rosterSelect && !rosterSelect.dataset.manuallySelected) {
            if (gameState.state === 'pending' || gameState.state === 'started') {
                rosterSelect.value = 'all';
            } else {
                rosterSelect.value = `room${currentRoomNumber}`;
            }
        }

        renderRoomRoster();
    } catch (e) {
        console.error("Failed to load live data", e);
    }
}

// ─── ROOM ROSTER ─────────────────────────────────────────────────────────────

function updateRoomDropdowns() {
    const totalRoomsInput = document.getElementById('total-rooms');
    let totalRooms = 3;
    if (totalRoomsInput) {
        totalRooms = parseInt(totalRoomsInput.value, 10);
        if (isNaN(totalRooms) || totalRooms < 1) totalRooms = 1;
    }

    const select = document.getElementById('roster-room-select');
    if (!select) return;

    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- SELECT A ROOM --</option>';
    
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = '-- ALL PLAYERS --';
    select.appendChild(allOpt);

    for (let i = 1; i <= totalRooms; i++) {
        const r = `room${i}`;
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = `ROOM ${i}`;
        select.appendChild(opt);
    }
    
    if (currentVal === 'all') {
        select.value = 'all';
    } else if (currentVal && parseInt(currentVal.replace('room', ''), 10) <= totalRooms) {
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

    let roomPlayers = [];
    if (room === 'all') {
        roomPlayers = currentPlayers;
    } else {
        roomPlayers = currentPlayers.filter(p => p.room === room);
    }
    
    if (roomPlayers.length === 0) {
        list.innerHTML = `<p class="font-mono text-sm text-gray-500 text-center mt-8">${room === 'all' ? 'NO PLAYERS REGISTERED' : 'ROOM IS EMPTY'}</p>`;
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

        const hasRoom = p.room && p.room !== "";
        const showRemoveButton = room !== 'all' && hasRoom;

        item.innerHTML = `
            <div class="flex-1 min-w-0 pr-4">
                <p class="font-mono font-bold text-sm truncate">${p.user_id}</p>
                ${p.name ? `<p class="font-mono text-xs text-gray-700 truncate">${p.name} &lt;${p.email || 'no-email'}&gt;</p>` : ''}
                <div class="flex gap-2 items-center mt-1">
                    <span class="font-mono text-xs uppercase font-bold px-2 py-0.5 border border-ink bg-ink text-white rounded">${p.status || 'JOINED'}</span>
                    <span class="font-mono text-xs uppercase font-bold ${teamColor}">${p.team || 'NO TEAM'}</span>
                    ${hasRoom ? `<span class="font-mono text-xs uppercase font-bold text-gray-400">@ ${p.room}</span>` : ''}
                </div>
            </div>
            ${showRemoveButton ? `<button class="btn-remove font-mono text-xs font-bold bg-danger text-white px-2 py-1 uppercase" data-uid="${p.user_id}">REMOVE</button>` : ''}
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
                await loadAdminData();
            } catch (err) {
                log(`ERROR: ${err.message}`);
            }
        });
    });
}

// ─── ADMIN EVENTS ────────────────────────────────────────────────────────────

function bindAdminEvents() {

    // --- Game Control Buttons ---

    document.getElementById('btn-start').addEventListener('click', async () => {
        try {
            log('Starting game and assigning teams...');
            await startGame();
            log('Game started successfully.');
            const rosterSelect = document.getElementById('roster-room-select');
            if (rosterSelect) delete rosterSelect.dataset.manuallySelected;
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-end').addEventListener('click', async () => {
        try {
            log('Ending game. Scoring now open.');
            await endGame();
            log('Game ended successfully.');
            const rosterSelect = document.getElementById('roster-room-select');
            if (rosterSelect) delete rosterSelect.dataset.manuallySelected;
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to completely reset the game state? All players will be removed.')) return;
        try {
            log('Resetting game to pending state...');
            await resetGame();
            log('Game reset successfully.');
            const rosterSelect = document.getElementById('roster-room-select');
            if (rosterSelect) delete rosterSelect.dataset.manuallySelected;
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    document.getElementById('btn-winner').addEventListener('click', async () => {
        try {
            log('Calculating winner...');
            await declareWinner();
            log('Winner declared successfully.');
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    // --- Room Controls ---

    document.getElementById('total-rooms').addEventListener('change', () => {
        updateRoomDropdowns();
    });

    document.getElementById('btn-next-room').addEventListener('click', () => {
        let totalRooms = parseInt(document.getElementById('total-rooms').value, 10);
        if (isNaN(totalRooms) || totalRooms < 1) totalRooms = 1;
        
        currentRoomNumber++;
        if (currentRoomNumber > totalRooms) {
            currentRoomNumber = 1;
        }
        document.getElementById('current-room-display').textContent = currentRoomNumber;
    });

    document.getElementById('btn-score-room').addEventListener('click', async () => {
        const room = `room${currentRoomNumber}`;
        
        try {
            log(`Scoring ${room}...`);
            await scoreRoom(room);
            log(`Room scored successfully.`);
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    });

    // --- QR Scanner (using Html5Qrcode directly, NOT the Scanner wrapper) ---

    let html5QrCode = null;

    const stopScanner = () => {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Scanner stop failed", err));
        }
    };

    const startScanner = () => {
        stopScanner();
        document.getElementById('scanner-idle-view').classList.add('hidden');
        document.getElementById('scan-result-ui').classList.add('hidden');
        document.getElementById('reader').classList.remove('hidden');
        
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }
        
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                // On success — immediately stop the scanner
                stopScanner();
                document.getElementById('reader').classList.add('hidden');
                
                let uid = decodedText;
                if (uid.startsWith('https://auth.haxnation.org/u/')) {
                     uid = uid.split('/').pop();
                }
                
                log(`QR Detected: ${uid}`);
                document.getElementById('scan-uid').value = uid;
                document.getElementById('scan-result-uid').textContent = uid;
                document.getElementById('scan-result-ui').classList.remove('hidden');
            },
            (errorMessage) => {
                // Ignore parse errors (frames without QR codes)
            }
        ).catch((err) => {
            log(`Scanner error: ${err}`);
            document.getElementById('reader').classList.add('hidden');
            document.getElementById('scanner-idle-view').classList.remove('hidden');
        });
    };

    document.getElementById('btn-start-scanner').addEventListener('click', startScanner);
    
    document.getElementById('btn-scan-again').addEventListener('click', () => {
        document.getElementById('scan-uid').value = '';
        startScanner();
    });

    // --- Shared scan submit logic ---

    async function submitScan(rawUid) {
        let uid = rawUid.trim();
        if (!uid) return alert('No UUID provided');

        // Extract ID from auth URL if pasted/scanned as full URL
        if (uid.startsWith('https://auth.haxnation.org/u/')) {
            uid = uid.split('/').pop();
        }

        const currentState = document.getElementById('stat-state').textContent;
        const room = currentState === 'ended' ? `room${currentRoomNumber}` : '';
        
        try {
            log(`Scanning player ${uid}${room ? ' to ' + room : ''}...`);
            await scanPlayer(uid, room);
            log(`Player scanned successfully.`);
            document.getElementById('scan-uid').value = '';
            await loadAdminData();
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }
    }

    // --- Confirm Scan (from QR) ---

    document.getElementById('btn-confirm-scan').addEventListener('click', async () => {
        await submitScan(document.getElementById('scan-uid').value);
        // Reset scanner UI back to idle state
        document.getElementById('scan-result-ui').classList.add('hidden');
        document.getElementById('scanner-idle-view').classList.remove('hidden');
    });

    // --- Manual Submit ---

    document.getElementById('btn-manual-submit').addEventListener('click', async () => {
        await submitScan(document.getElementById('scan-uid').value);
    });

    // Also allow pressing Enter in the manual input
    document.getElementById('scan-uid').addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await submitScan(document.getElementById('scan-uid').value);
        }
    });
}
