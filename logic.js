let p1, p2, timer, timeLeft;
let board = [];
let selectedGem = null;
let isAnimating = false;
let currentTurn = 'p1';
let turnStats = {};
let isUltiMode = false;
let ultiClicks = 0;
let gameEnded = false;

// Biến lưu trữ nhân vật được chọn
let selectedPetId = null;
let selectedBossId = null;

window.addEventListener('load', () => {
    handleResize();
    loadPetSettings();
    initSelectionScreen(); // Mở màn hình chọn trước tiên
});

function handleResize() {
    const container = document.getElementById('game-container');
    const scale = Math.min(window.innerWidth / 1100, window.innerHeight / 850);
    container.style.transform = `scale(${scale > 1 ? 1 : scale})`;
}

// =========================================
// 1. MÀN HÌNH CHỌN PET / BOSS
// =========================================
function initSelectionScreen() {
    const petContainer = document.getElementById('pet-cards');
    const bossContainer = document.getElementById('boss-cards');

    // Đổ dữ liệu Pet
    petDatabase.forEach(pet => {
        let div = document.createElement('div');
        div.className = 'char-card';
        div.id = 'pet-card-' + pet.id;
        
        let totalHp = gameConfig.baseStats.hp + pet.stats.hp;
        let totalDame = gameConfig.baseStats.dame + pet.stats.dame;
        let totalGiap = gameConfig.baseStats.giap + pet.stats.giap;

        div.innerHTML = `
            <img src="${pet.img}">
            <h3>${pet.name}</h3>
            <p>❤️ HP: <span>${(totalHp/1000).toFixed(0)}k</span></p>
            <p>⚔️ ATK: <span>${totalDame}</span></p>
            <p>🛡️ DEF: <span>${totalGiap}</span></p>
        `;
        div.onclick = () => selectPet(pet.id);
        petContainer.appendChild(div);
    });

    // Đổ dữ liệu Boss
    bossDatabase.forEach(boss => {
        let div = document.createElement('div');
        div.className = 'char-card boss-card';
        div.id = 'boss-card-' + boss.id;
        
        let totalHp = gameConfig.baseStats.hp + boss.stats.hp;
        let totalDame = gameConfig.baseStats.dame + boss.stats.dame;
        let totalGiap = gameConfig.baseStats.giap + boss.stats.giap;

        div.innerHTML = `
            <img src="${boss.img}">
            <h3>${boss.name}</h3>
            <p>❤️ HP: <span>${(totalHp/1000).toFixed(0)}k</span></p>
            <p>⚔️ ATK: <span>${totalDame}</span></p>
            <p>🛡️ DEF: <span>${totalGiap}</span></p>
        `;
        div.onclick = () => selectBoss(boss.id);
        bossContainer.appendChild(div);
    });
}

function selectPet(id) {
    document.querySelectorAll('#pet-cards .char-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('pet-card-' + id).classList.add('selected');
    selectedPetId = id;
    checkReady();
}

function selectBoss(id) {
    document.querySelectorAll('#boss-cards .char-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('boss-card-' + id).classList.add('selected');
    selectedBossId = id;
    checkReady();
}

function checkReady() {
    document.getElementById('btn-start-combat').disabled = !(selectedPetId && selectedBossId);
}

// =========================================
// 2. KHỞI TẠO TRẬN CHIẾN (FIX BUG BẢNG)
// =========================================
function startCombat() {
    // Tắt màn hình chọn, bật màn hình chiến đấu
    document.getElementById('selection-screen').style.display = 'none';
    document.getElementById('combat-screen').style.display = 'block';
    
    // FIX BUG: Hiển thị Bàn Cờ (Grid)
    document.getElementById('game-board').style.display = 'grid'; 
    
    gameEnded = false;
    
    const playerPetData = petDatabase.find(p => p.id === selectedPetId);
    const bossPetData = bossDatabase.find(b => b.id === selectedBossId);

    const pb1 = document.getElementById('pet-bro'), pb2 = document.getElementById('pet-boss');
    pb1.style.display = 'block'; pb2.style.display = 'block';
    pb1.style.backgroundImage = `url('${playerPetData.img}')`;
    pb2.style.backgroundImage = `url('${bossPetData.img}')`;

    document.getElementById('p1-name').innerText = playerPetData.name;
    document.getElementById('p2-name').innerText = bossPetData.name;

    // TÍNH CHỈ SỐ: BASE STATS + PET STATS
    const p1MaxHp = gameConfig.baseStats.hp + playerPetData.stats.hp;
    const p1Dame = gameConfig.baseStats.dame + playerPetData.stats.dame;
    const p1Giap = gameConfig.baseStats.giap + playerPetData.stats.giap;

    const p2MaxHp = gameConfig.baseStats.hp + bossPetData.stats.hp;
    const p2Dame = gameConfig.baseStats.dame + bossPetData.stats.dame;
    const p2Giap = gameConfig.baseStats.giap + bossPetData.stats.giap;

    p1 = { maxHp: p1MaxHp, hp: p1MaxHp, baseDame: p1Dame, baseGiap: p1Giap, mana: 0, no: 0, giapStacks: [] };
    p2 = { maxHp: p2MaxHp, hp: p2MaxHp, baseDame: p2Dame, baseGiap: p2Giap, mana: 0, no: 0, giapStacks: [] };

    initBoardDOM();
    initBoard();
    updateUI(); // Cập nhật máu ngay lập tức
    
    currentTurn = 'p2'; // Thủ thuật nảy banner
    switchTurn(); 
}

function checkGameOver() {
    if (p1.hp <= 0 || p2.hp <= 0) {
        gameEnded = true; clearInterval(timer); isAnimating = true;
        const winner = p1.hp > 0 ? "BẠN ĐÃ CHIẾN THẮNG!" : "BOSS ĐÃ CHIẾN THẮNG!";
        setTimeout(() => { alert(winner); location.reload(); }, 500);
        return true;
    }
    return false;
}

function getTotalGiap(player) {
    return player.giapStacks.reduce((sum, val) => sum + val, 0);
}

// =========================================
// 3. LOGIC NẠP TỈ LỆ (%)
// =========================================
async function showSummaryAndFinish() {
    const summary = document.getElementById('turn-summary');
    summary.innerHTML = "";
    summary.style.display = 'flex';

    const loadOrder = ['HP', 'Mana', 'Lua', 'Hut', 'Giap', 'Kiem'];
    const atk = (currentTurn === 'p1') ? p2 : p1; 
    const self = (currentTurn === 'p1') ? p1 : p2;

    for (const type of loadOrder) {
        if (turnStats[type] && turnStats[type] > 0) {
            let count = turnStats[type];
            const item = document.createElement('div');
            item.className = 'summary-item';
            item.innerHTML = `<img src="picture/${type}.png" width="30">x${count}`;
            summary.appendChild(item);

            switch(type) {
                case 'HP': 
                    let healAmount = count * (self.maxHp * 0.01);
                    self.hp = Math.min(self.maxHp, self.hp + healAmount); 
                    break;
                case 'Mana': 
                    self.mana = Math.min(gameConfig.maxMana, self.mana + count * 70); 
                    break;
                case 'Lua': 
                    self.no = Math.min(gameConfig.maxNo, self.no + count * 50); 
                    break;
                case 'Hut':
                    if (Math.random() < 0.5) {
                        let stl = Math.min(atk.mana, count * 70);
                        atk.mana -= stl; self.mana = Math.min(gameConfig.maxMana, self.mana + stl);
                        item.innerHTML += `<div style="font-size:11px; color:#00ccff">+${Math.floor(stl)}💧</div>`;
                    } else {
                        let stl = Math.min(atk.no, count * 50);
                        atk.no -= stl; self.no = Math.min(gameConfig.maxNo, self.no + stl);
                        item.innerHTML += `<div style="font-size:11px; color:#ffcc00">+${Math.floor(stl)}🔥</div>`;
                    }
                    break;
                case 'Giap': 
                    self.currentTurnGiap = count * (self.baseGiap * 0.02); 
                    break;
                case 'Kiem':
                    let defGiap = getTotalGiap(atk); 
                    let baseDmg = count * (self.baseDame * 0.40);
                    let multi = 1.0;
                    if (self.no >= 200) { multi = 1.75; self.no -= 100; }
                    else if (self.no >= 100) { multi = 1.5; self.no -= 100; }
                    let finalDmg = baseDmg * multi;
                    let actualDmg = Math.max(0, finalDmg - defGiap); 
                    atk.hp = Math.max(0, atk.hp - actualDmg);
                    break;
            }
            updateUI();
            await new Promise(r => setTimeout(r, 600)); 
        }
    }

    if (checkGameOver()) return;
    await new Promise(r => setTimeout(r, 800));
    summary.style.display = 'none';
    turnStats = {};
    if (!gameEnded) switchTurn();
}

function updateUI() {
    if (!p1 || !p2) return;
    const draw = (id, d) => {
        document.getElementById(`${id}-hp-text`).innerText = `${Math.floor(d.hp)}/${Math.floor(d.maxHp)}`;
        let p = (d.hp/d.maxHp)*100;
        document.getElementById(`${id}-hp-green`).style.width = p > 50 ? (p-50)*2+'%' : '0%';
        document.getElementById(`${id}-hp-red`).style.width = p > 50 ? '100%' : p*2+'%';
        document.getElementById(`${id}-mana-text`).innerText = `${Math.floor(d.mana)}/${gameConfig.maxMana}`;
        document.getElementById(`${id}-mana-fill`).style.width = (d.mana/gameConfig.maxMana*100) + "%";
        document.getElementById(`${id}-no-text`).innerText = `${Math.floor(d.no)}/${gameConfig.maxNo}`;
        document.getElementById(`${id}-no-fill`).style.width = (d.no/gameConfig.maxNo*100) + "%";
        document.getElementById(`${id}-giap-val`).innerText = Math.floor(getTotalGiap(d));
    };
    draw('p1', p1); draw('p2', p2);
    const btnUlti = document.getElementById('btn-ulti');
    btnUlti.disabled = !(currentTurn === 'p1' && p1.mana >= 200 && p1.no >= 150);
}

// =========================================
// 4. AI THÔNG MINH - SÁT THỦ (HEURISTIC)
// =========================================
async function aiMove() {
    if (gameEnded) return;

    // Kích hoạt Ulti
    if (p2.mana >= 200 && p2.no >= 150) {
        p2.mana -= 200; p2.no -= 150;
        
        let rowScores = [];
        for (let r = 0; r < 8; r++) {
            let score = 0;
            for (let c = 0; c < 8; c++) {
                let type = board[r * 8 + c];
                if (type === 'Kiem') score += 10;
                if (type === 'Hut') score += 8;
                if (type === 'Lua') score += 5;
            }
            rowScores.push({ idx: r, score: score });
        }
        rowScores.sort((a, b) => b.score - a.score);
        let bestRows = rowScores.slice(0, 3).map(r => r.idx);

        let popped = [];
        bestRows.forEach(rIdx => {
            for (let c = 0; c < 8; c++) {
                let idx = rIdx * 8 + c;
                if (board[idx]) { turnStats[board[idx]] = (turnStats[board[idx]] || 0) + 1; board[idx] = null; popped.push(idx); }
            }
        });
        renderPop(popped);
        await new Promise(r => setTimeout(r, 250));
        renderBoard();
        await processMatches();
        return;
    }

    // TÌM NƯỚC ĐI TỐI ƯU
    let bestMove = null;
    let maxWeight = -1;

    // ĐỌC TÂM LÝ
    let dangerSabo = (p1.mana >= 130 && p1.no >= 80); 
    let dangerKill = (p1.hp < p1.maxHp * 0.4);        
    let selfLow = (p2.hp < p2.maxHp * 0.4);           

    for (let i = 0; i < 64; i++) {
        let neighbors = [i + 1, i + 8];
        for (let n of neighbors) {
            if (n < 64 && isAdjacent(i, n)) {
                [board[i], board[n]] = [board[n], board[i]];
                let matches = findMatches();
                
                if (matches.length > 0) {
                    let moveWeight = 0;
                    matches.forEach(mIdx => {
                        let type = board[mIdx];
                        
                        if (type === 'Kiem') moveWeight += dangerKill ? 60 : 25; 
                        if (type === 'Hut') moveWeight += dangerSabo ? 80 : 15;  
                        if (type === 'HP') moveWeight += selfLow ? 50 : 5;       
                        if (type === 'Lua') moveWeight += 20;                    
                        if (type === 'Giap') moveWeight += 10;
                        if (type === 'Mana') moveWeight += 10;
                    });

                    if (matches.length > 3) moveWeight += 30; 

                    if (moveWeight > maxWeight) {
                        maxWeight = moveWeight;
                        bestMove = { a: i, b: n };
                    }
                }
                [board[i], board[n]] = [board[n], board[i]];
            }
        }
    }

    if (bestMove) {
        await swapGems(bestMove.a, bestMove.b);
    } else {
        let i = Math.floor(Math.random() * 56);
        await swapGems(i, i + 8);
    }
}

// =========================================
// 5. CÁC HÀM CƠ BẢN (CHUYỂN TURN, RENDER)
// =========================================
async function switchTurn() {
    if (gameEnded) return;
    if (isUltiMode) {
        isUltiMode = false;
        document.getElementById('ulti-hint').style.display = 'none';
        document.getElementById('btn-ulti').innerText = "ULTI ⚡";
        p1.mana = Math.min(gameConfig.maxMana, p1.mana + 200);
        p1.no = Math.min(gameConfig.maxNo, p1.no + 150);
    }
    const curr = (currentTurn === 'p1') ? p1 : p2;
    curr.giapStacks.push(curr.currentTurnGiap || 0);
    if (curr.giapStacks.length > 2) curr.giapStacks.shift();
    curr.currentTurnGiap = 0; 
    currentTurn = (currentTurn === 'p1') ? 'p2' : 'p1';
    updateUI();
    const banner = document.getElementById('turn-banner');
    banner.innerText = (currentTurn === 'p1') ? "LƯỢT CỦA BẠN" : "LƯỢT CỦA BOSS";
    banner.className = (currentTurn === 'p1') ? 'turn-banner show player-turn' : 'turn-banner show boss-turn';
    await new Promise(r => setTimeout(r, 1500)); 
    banner.className = 'turn-banner'; 
    if (currentTurn === 'p2') { setTimeout(aiMove, 300); } 
    else { isAnimating = false; startTimer(); }
}

function startTimer() {
    timeLeft = gameConfig.turnTime; 
    document.getElementById('hud-timer-text').innerText = timeLeft; 
    clearInterval(timer); 
    timer = setInterval(() => { 
        timeLeft--; 
        document.getElementById('hud-timer-text').innerText = timeLeft; 
        if (timeLeft <= 0) { clearInterval(timer); isAnimating = true; switchTurn(); } 
    }, 1000); 
}

function initBoardDOM() { const boardEl = document.getElementById('game-board'); boardEl.innerHTML = ''; for (let i = 0; i < 64; i++) { let cell = document.createElement('div'); cell.id = 'gem-' + i; cell.className = 'gem'; cell.onclick = () => handleGemClick(i); boardEl.appendChild(cell); } }
function renderBoard(isDropping = false, dropData = []) { for (let i = 0; i < 64; i++) { let cell = document.getElementById('gem-' + i); let type = board[i]; if (type) { let img = cell.querySelector('img'); if (!img) { cell.innerHTML = `<img src="picture/${type}.png">`; img = cell.querySelector('img'); } else { img.src = `picture/${type}.png`; } if (isDropping && dropData[i] > 0) { let dropDist = dropData[i] * 70; img.style.transition = 'none'; img.style.transform = `translateY(-${dropDist}px)`; void img.offsetWidth; img.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'; img.style.transform = 'translateY(0)'; } else { img.style.transition = ''; img.style.transform = ''; } img.style.opacity = ''; } else { cell.innerHTML = ''; } cell.className = 'gem'; if (selectedGem === i) cell.classList.add('selected'); } }
function renderPop(matches) { matches.forEach(idx => { let cell = document.getElementById('gem-' + idx); let img = cell.querySelector('img'); if (img) { img.style.transition = 'transform 0.25s cubic-bezier(0.5, 0, 1, 1), opacity 0.25s'; img.style.transform = 'scale(0.2) rotate(30deg)'; img.style.opacity = '0'; } }); }

async function swapGems(i1, i2) { isAnimating = true; let img1 = document.getElementById('gem-' + i1).querySelector('img'); let img2 = document.getElementById('gem-' + i2).querySelector('img'); let r1 = Math.floor(i1/8), c1 = i1%8, r2 = Math.floor(i2/8), c2 = i2%8; let dx = (c2 - c1) * 70, dy = (r2 - r1) * 70; if (img1) { img1.style.transition = 'transform 0.25s ease-in-out'; img1.style.transform = `translate(${dx}px, ${dy}px)`; } if (img2) { img2.style.transition = 'transform 0.25s ease-in-out'; img2.style.transform = `translate(${-dx}px, ${-dy}px)`; } if (img1 || img2) await new Promise(r => setTimeout(r, 250)); [board[i1], board[i2]] = [board[i2], board[i1]]; if (img1) { img1.style.transition = 'none'; img1.style.transform = 'translate(0px, 0px)'; } if (img2) { img2.style.transition = 'none'; img2.style.transform = 'translate(0px, 0px)'; } renderBoard(); let m = findMatches(); if (m.length > 0) { clearInterval(timer); await processMatches(); } else { img1 = document.getElementById('gem-' + i1).querySelector('img'); img2 = document.getElementById('gem-' + i2).querySelector('img'); if (img1) { img1.style.transition = 'none'; img1.style.transform = `translate(${dx}px, ${dy}px)`; } if (img2) { img2.style.transition = 'none'; img2.style.transform = `translate(${-dx}px, ${-dy}px)`; } void document.body.offsetWidth; if (img1) { img1.style.transition = 'transform 0.25s ease-in-out'; img1.style.transform = 'translate(0px, 0px)'; } if (img2) { img2.style.transition = 'transform 0.25s ease-in-out'; img2.style.transform = 'translate(0px, 0px)'; } await new Promise(r => setTimeout(r, 250)); [board[i1], board[i2]] = [board[i2], board[i1]]; renderBoard(); isAnimating = false; } }
async function processMatches() { isAnimating = true; let hasHoles = board.some(t => t === null); if (hasHoles) { let dropData = dropGems(); renderBoard(true, dropData); await new Promise(r => setTimeout(r, 450)); await processMatches(); return; } let matches = findMatches(); if (matches.length > 0) { matches.forEach(idx => { let type = board[idx]; if (type) turnStats[type] = (turnStats[type] || 0) + 1; board[idx] = null; }); renderPop(matches); await new Promise(r => setTimeout(r, 250)); renderBoard(); await new Promise(r => setTimeout(r, 50)); await processMatches(); } else { await showSummaryAndFinish(); isAnimating = false; } }
function dropGems() { let dropData = new Array(64).fill(0); for (let c = 0; c < 8; c++) { let empty = 0; for (let r = 7; r >= 0; r--) { let idx = r * 8 + c; if (board[idx] === null) { empty++; } else if (empty > 0) { let newIdx = (r + empty) * 8 + c; board[newIdx] = board[idx]; board[idx] = null; dropData[newIdx] = empty; } } for (let r = 0; r < empty; r++) { let newIdx = r * 8 + c; board[newIdx] = gameConfig.gemTypes[Math.floor(Math.random() * 6)]; dropData[newIdx] = empty; } } return dropData; }

function activateUlti() { if (gameEnded || isAnimating) return; if (p1.mana >= 200 && p1.no >= 150) { clearInterval(timer); p1.mana -= 200; p1.no -= 150; isUltiMode = true; ultiClicks = 0; document.getElementById('ulti-hint').style.display = 'block'; document.getElementById('btn-ulti').innerText = "CHỌN HÀNG..."; updateUI(); } }
async function handleGemClick(index) { if (isAnimating || gameEnded) return; if (isUltiMode) { let row = Math.floor(index / 8); let popped = []; for (let c=0; c<8; c++) { let idx = row*8+c; if(board[idx]) { turnStats[board[idx]] = (turnStats[board[idx]] || 0) + 1; board[idx] = null; popped.push(idx); } } renderPop(popped); ultiClicks++; await new Promise(r => setTimeout(r, 250)); renderBoard(); if (ultiClicks >= 3) { isUltiMode = false; document.getElementById('ulti-hint').style.display = 'none'; document.getElementById('btn-ulti').innerText = "ULTI ⚡"; await processMatches(); } return; } if (currentTurn === 'p2') return; if (selectedGem === null) { selectedGem = index; document.getElementById('gem-'+index).classList.add('selected'); } else { if (isAdjacent(selectedGem, index)) await swapGems(selectedGem, index); let oldGem = document.getElementById('gem-'+selectedGem); if (oldGem) oldGem.classList.remove('selected'); selectedGem = null; } }
function initBoard() { board = []; for (let i = 0; i < 64; i++) { let type; do { type = gameConfig.gemTypes[Math.floor(Math.random() * gameConfig.gemTypes.length)]; } while (isInitialMatch(i, type)); board.push(type); } renderBoard(); }
function isInitialMatch(idx, type) { let r = Math.floor(idx / 8), c = idx % 8; if (c >= 2 && board[idx-1] === type && board[idx-2] === type) return true; if (r >= 2 && board[idx-8] === type && board[idx-16] === type) return true; return false; }
function findMatches() { let matches = new Set(); for (let r=0; r<8; r++) { for (let c=0; c<6; c++) { let i = r*8+c; if (board[i] && board[i] === board[i+1] && board[i] === board[i+2]) { matches.add(i); matches.add(i+1); matches.add(i+2); } } } for (let r=0; r<6; r++) { for (let c=0; c<8; c++) { let i = r*8+c; if (board[i] && board[i] === board[i+8] && board[i] === board[i+16]) { matches.add(i); matches.add(i+8); matches.add(i+16); } } } return Array.from(matches); }
function isAdjacent(i1, i2) { let r1 = Math.floor(i1/8), c1 = i1%8, r2 = Math.floor(i2/8), c2 = i2%8; return Math.abs(r1-r2) + Math.abs(c1-c2) === 1; }

function toggleTuner() { let p = document.getElementById('tuner-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function syncVal(k, v) { if(document.getElementById('n-'+k)) document.getElementById('n-'+k).value = v; applyAndSaveTuner(); }
function applyAndSaveTuner() { const s = { p1w: document.getElementById('n-p1-w').value, p1x: document.getElementById('n-p1-x').value, p1y: document.getElementById('n-p1-y').value, p2w: document.getElementById('n-p2-w').value, p2x: document.getElementById('n-p2-x').value, p2y: document.getElementById('n-p2-y').value }; const b1 = document.getElementById('pet-bro'), b2 = document.getElementById('pet-boss'); if(b1) { b1.style.width=s.p1w+'px'; b1.style.left=s.p1x+'px'; b1.style.bottom=s.p1y+'px'; } if(b2) { b2.style.width=s.p2w+'px'; b2.style.right=s.p2x+'px'; b2.style.bottom=s.p2y+'px'; } localStorage.setItem('pokiwarPetConfig', JSON.stringify(s)); }
function loadPetSettings() { let saved = localStorage.getItem('pokiwarPetConfig'); if (saved) { let s = JSON.parse(saved); const map = {'p1-w':s.p1w,'p1-x':s.p1x,'p1-y':s.p1y,'p2-w':s.p2w,'p2-x':s.p2x,'p2-y':s.p2y}; for(let k in map) { if(document.getElementById('n-'+k)) { document.getElementById('n-'+k).value = map[k]; } } applyAndSaveTuner(); } }