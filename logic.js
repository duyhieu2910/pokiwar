let p1, p2, timer, timeLeft;
let board = [];
let selectedGem = null;
let isAnimating = false;
let currentTurn = 'p1';
let turnStats = {};
let isUltiMode = false;
let ultiClicks = 0;
let gameEnded = false;
let droppedIndices = []; 

window.addEventListener('load', () => {
    handleResize();
    loadPetSettings();
});

function handleResize() {
    const container = document.getElementById('game-container');
    const scale = Math.min(window.innerWidth / 1100, window.innerHeight / 850);
    container.style.transform = `scale(${scale > 1 ? 1 : scale})`;
}

function startGame() {
    gameEnded = false;
    document.getElementById('btn-ready').style.display = 'none';
    document.getElementById('game-board').style.display = 'grid';
    
    const pb1 = document.getElementById('pet-bro'), pb2 = document.getElementById('pet-boss');
    pb1.style.display = 'block'; pb2.style.display = 'block';
    pb1.style.backgroundImage = "url('picture/Kimmaster.png')";
    pb2.style.backgroundImage = "url('picture/Sunmaster.png')";

    p1 = { hp: 100000, mana: 0, no: 0, giapStacks: [] };
    p2 = { hp: 100000, mana: 0, no: 0, giapStacks: [] };

    initBoardDOM();
    initBoard();
    updateUI();
    currentTurn = 'p2'; // Mẹo nhỏ: Đặt p2 trước để gọi switchTurn() nảy banner p1
    switchTurn(); 
}

function checkGameOver() {
    if (p1.hp <= 0 || p2.hp <= 0) {
        gameEnded = true; clearInterval(timer); isAnimating = true;
        const winner = p1.hp > 0 ? "CHÚC MỪNG BẠN ĐÃ CHIẾN THẮNG!" : "RẤT TIẾC, AI ĐÃ THẮNG!";
        setTimeout(() => { alert(winner); location.reload(); }, 500);
        return true;
    }
    return false;
}

function getTotalGiapPercent(player) {
    return player.giapStacks.reduce((sum, val) => sum + val, 0);
}

// --- LOGIC CHIẾN ĐẤU & HIỂN THỊ (NẠP DỮ LIỆU) ---
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
                case 'HP': self.hp = Math.min(100000, self.hp + count * 2000); break;
                case 'Mana': self.mana = Math.min(3000, self.mana + count * 70); break;
                case 'Lua': self.no = Math.min(300, self.no + count * 50); break;
                case 'Hut':
                    let red = (1 - getTotalGiapPercent(atk) / 100);
                    if (Math.random() < 0.5) {
                        let stl = Math.min(atk.mana, count * 70) * red;
                        atk.mana -= stl; self.mana = Math.min(3000, self.mana + stl);
                        item.innerHTML += `<div style="font-size:10px; color:#00d2ff">+${Math.floor(stl)}💧</div>`;
                    } else {
                        let stl = Math.min(atk.no, count * 50) * red;
                        atk.no -= stl; self.no = Math.min(300, self.no + stl);
                        item.innerHTML += `<div style="font-size:10px; color:#ff9900">+${Math.floor(stl)}🔥</div>`;
                    }
                    break;
                case 'Giap': self.currentTurnGiap = count * 4; break;
                case 'Kiem':
                    let defG = getTotalGiapPercent(atk);
                    let baseDmg = count * 2000;
                    let multi = 1.0;
                    if (self.no >= 200) { multi = 1.75; self.no -= 100; }
                    else if (self.no >= 100) { multi = 1.5; self.no -= 100; }
                    atk.hp = Math.max(0, atk.hp - (baseDmg * multi * (1 - defG / 100)));
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
    const draw = (id, d) => {
        document.getElementById(`${id}-hp-text`).innerText = `${Math.floor(d.hp)}/100000`;
        let p = (d.hp/100000)*100;
        document.getElementById(`${id}-hp-green`).style.width = p > 50 ? (p-50)*2+'%' : '0%';
        document.getElementById(`${id}-hp-red`).style.width = p > 50 ? '100%' : p*2+'%';
        document.getElementById(`${id}-mana-text`).innerText = `${Math.floor(d.mana)}/3000`;
        document.getElementById(`${id}-mana-fill`).style.width = (d.mana/3000*100) + "%";
        document.getElementById(`${id}-no-text`).innerText = `${Math.floor(d.no)}/300`;
        document.getElementById(`${id}-no-fill`).style.width = (d.no/300*100) + "%";
        document.getElementById(`${id}-giap-val`).innerText = getTotalGiapPercent(d) + "%";
    };
    draw('p1', p1); draw('p2', p2);
    
    const btnUlti = document.getElementById('btn-ulti');
    btnUlti.disabled = !(currentTurn === 'p1' && p1.mana >= 200 && p1.no >= 150);
}

// --- LOGIC CHUYỂN TURN & XỬ LÝ TIMER ĐIỆN ẢNH ---
async function switchTurn() {
    if (gameEnded) return;

    // Hủy trạng thái Ulti nếu hết giờ mà sếp chưa thao tác xong
    if (isUltiMode) {
        isUltiMode = false;
        document.getElementById('ulti-hint').style.display = 'none';
        p1.mana = Math.min(3000, p1.mana + 200); // Hoàn lại tài nguyên
        p1.no = Math.min(300, p1.no + 150);
    }

    const curr = (currentTurn === 'p1') ? p1 : p2;
    curr.giapStacks.push(curr.currentTurnGiap || 0);
    if (curr.giapStacks.length > 2) curr.giapStacks.shift();
    curr.currentTurnGiap = 0; 
    
    currentTurn = (currentTurn === 'p1') ? 'p2' : 'p1';
    document.getElementById('turn-indicator').innerText = (currentTurn === 'p1') ? "LƯỢT CỦA BẠN" : "LƯỢT CỦA BOSS";
    updateUI();

    // SHOW BANNER THÔNG BÁO LƯỢT ĐI
    const banner = document.getElementById('turn-banner');
    banner.innerText = (currentTurn === 'p1') ? "LƯỢT CỦA BẠN" : "LƯỢT CỦA BOSS";
    banner.className = (currentTurn === 'p1') ? 'turn-banner show player-turn' : 'turn-banner show boss-turn';

    // Đợi 1.5 giây để sếp đọc xong chữ rồi mới đếm thời gian
    await new Promise(r => setTimeout(r, 1500)); 
    banner.className = 'turn-banner'; // Tắt banner

    if (currentTurn === 'p2') {
        setTimeout(aiMove, 300); 
    } else {
        startTimer(); // Chỉ đếm thời gian sau khi mọi thứ đã dọn dẹp xong
    }
}

// =========================================
// RENDER ENGINE (60FPS ANIMATIONS)
// =========================================
function initBoardDOM() {
    const boardEl = document.getElementById('game-board');
    // Xóa ai-overlay cũ
    boardEl.innerHTML = '<div id="ulti-hint">🔥 CHỌN 3 HÀNG NGANG ĐỂ HỦY DIỆT 🔥</div>';
    for (let i = 0; i < 64; i++) {
        let cell = document.createElement('div');
        cell.id = 'gem-' + i;
        cell.className = 'gem';
        cell.onclick = () => handleGemClick(i);
        boardEl.appendChild(cell);
    }
}

function renderBoard(isDropping = false) {
    for (let i = 0; i < 64; i++) {
        let cell = document.getElementById('gem-' + i);
        let type = board[i];
        
        if (type) {
            let img = cell.querySelector('img');
            if (!img) {
                cell.innerHTML = `<img src="picture/${type}.png">`;
                img = cell.querySelector('img');
            } else { img.src = `picture/${type}.png`; }
            img.style.transition = ''; img.style.transform = ''; img.style.opacity = '';
        } else { cell.innerHTML = ''; }
        
        cell.className = 'gem';
        if (selectedGem === i) cell.classList.add('selected');
    }
}

function renderPop(matches) {
    matches.forEach(idx => {
        let cell = document.getElementById('gem-' + idx);
        let img = cell.querySelector('img');
        if (img) {
            img.style.transition = 'transform 0.25s cubic-bezier(0.5, 0, 1, 1), opacity 0.25s';
            img.style.transform = 'scale(0.2) rotate(30deg)';
            img.style.opacity = '0';
        }
    });
}

function renderBoardWithDrop(dropData) {
    for (let i = 0; i < 64; i++) {
        let cell = document.getElementById('gem-' + i);
        let type = board[i];
        
        if (type) {
            let img = cell.querySelector('img');
            if (!img) { cell.innerHTML = `<img src="picture/${type}.png">`; img = cell.querySelector('img'); } 
            else { img.src = `picture/${type}.png`; }
            
            if (dropData[i] > 0) {
                let dropDist = dropData[i] * 70; 
                img.style.transition = 'none';
                img.style.transform = `translateY(-${dropDist}px)`;
                void img.offsetWidth; 
                img.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                img.style.transform = 'translateY(0)';
            } else {
                img.style.transition = ''; img.style.transform = '';
            }
            img.style.opacity = '';
        } else { cell.innerHTML = ''; }
        cell.className = 'gem';
        if (selectedGem === i) cell.classList.add('selected');
    }
}

async function swapGems(i1, i2) {
    isAnimating = true;
    let img1 = document.getElementById('gem-' + i1).querySelector('img');
    let img2 = document.getElementById('gem-' + i2).querySelector('img');
    
    let r1 = Math.floor(i1/8), c1 = i1%8, r2 = Math.floor(i2/8), c2 = i2%8;
    let dx = (c2 - c1) * 70, dy = (r2 - r1) * 70;
    
    if (img1) { img1.style.transition = 'transform 0.25s ease-in-out'; img1.style.transform = `translate(${dx}px, ${dy}px)`; }
    if (img2) { img2.style.transition = 'transform 0.25s ease-in-out'; img2.style.transform = `translate(${-dx}px, ${-dy}px)`; }
    if (img1 || img2) await new Promise(r => setTimeout(r, 250));
    
    [board[i1], board[i2]] = [board[i2], board[i1]];
    if (img1) { img1.style.transition = 'none'; img1.style.transform = 'translate(0px, 0px)'; }
    if (img2) { img2.style.transition = 'none'; img2.style.transform = 'translate(0px, 0px)'; }
    renderBoard();
    
    let m = findMatches();
    if (m.length > 0) {
        clearInterval(timer); // CHỐT CHẶN TIMER KHI ĐÁNH THƯỜNG
        await processMatches();
    } else {
        img1 = document.getElementById('gem-' + i1).querySelector('img');
        img2 = document.getElementById('gem-' + i2).querySelector('img');
        if (img1) { img1.style.transition = 'none'; img1.style.transform = `translate(${dx}px, ${dy}px)`; }
        if (img2) { img2.style.transition = 'none'; img2.style.transform = `translate(${-dx}px, ${-dy}px)`; }
        void document.body.offsetWidth;
        if (img1) { img1.style.transition = 'transform 0.25s ease-in-out'; img1.style.transform = 'translate(0px, 0px)'; }
        if (img2) { img2.style.transition = 'transform 0.25s ease-in-out'; img2.style.transform = 'translate(0px, 0px)'; }
        await new Promise(r => setTimeout(r, 250));
        [board[i1], board[i2]] = [board[i2], board[i1]];
        renderBoard();
    }
    isAnimating = false;
}

async function processMatches() {
    isAnimating = true;
    let hasHoles = board.some(t => t === null);
    if (hasHoles) {
        let dropData = dropGems(); 
        renderBoardWithDrop(dropData);
        await new Promise(r => setTimeout(r, 450)); 
        await processMatches();
        return;
    }
    let matches = findMatches();
    if (matches.length > 0) {
        matches.forEach(idx => {
            let type = board[idx];
            if (type) turnStats[type] = (turnStats[type] || 0) + 1;
            board[idx] = null;
        });
        renderPop(matches);
        await new Promise(r => setTimeout(r, 250)); 
        renderBoard(); 
        await new Promise(r => setTimeout(r, 50)); 
        await processMatches(); 
    } else {
        await showSummaryAndFinish();
        isAnimating = false;
    }
}

function dropGems() {
    let dropData = new Array(64).fill(0);
    for (let c = 0; c < 8; c++) {
        let empty = 0;
        for (let r = 7; r >= 0; r--) {
            let idx = r * 8 + c;
            if (board[idx] === null) { empty++; } 
            else if (empty > 0) {
                let newIdx = (r + empty) * 8 + c;
                board[newIdx] = board[idx]; board[idx] = null;
                dropData[newIdx] = empty;
            }
        }
        for (let r = 0; r < empty; r++) {
            let newIdx = r * 8 + c;
            board[newIdx] = gameConfig.gemTypes[Math.floor(Math.random() * 6)];
            dropData[newIdx] = empty; 
        }
    }
    return dropData;
}

// =========================================
// AI & THAO TÁC NGƯỜI CHƠI
// =========================================
function activateUlti() {
    if (gameEnded || isAnimating) return;
    if (p1.mana >= 200 && p1.no >= 150) {
        p1.mana -= 200; p1.no -= 150;
        isUltiMode = true; ultiClicks = 0;
        document.getElementById('ulti-hint').style.display = 'block';
        updateUI();
    }
}

async function handleGemClick(index) {
    if (isAnimating || gameEnded) return;
    if (isUltiMode) {
        let row = Math.floor(index / 8);
        let popped = [];
        for (let c=0; c<8; c++) {
            let idx = row*8+c;
            if(board[idx]) { turnStats[board[idx]] = (turnStats[board[idx]] || 0) + 1; board[idx] = null; popped.push(idx); }
        }
        renderPop(popped);
        ultiClicks++; 
        await new Promise(r => setTimeout(r, 250));
        renderBoard();
        if (ultiClicks >= 3) { 
            clearInterval(timer); // CHỐT CHẶN TIMER KHI DÙNG XONG ULTI
            isUltiMode = false; document.getElementById('ulti-hint').style.display = 'none'; 
            await processMatches(); 
        }
        return;
    }
    if (currentTurn === 'p2') return;
    const gems = document.querySelectorAll('.gem');
    if (selectedGem === null) { 
        selectedGem = index; document.getElementById('gem-'+index).classList.add('selected'); 
    } else {
        if (isAdjacent(selectedGem, index)) await swapGems(selectedGem, index);
        let oldGem = document.getElementById('gem-'+selectedGem);
        if (oldGem) oldGem.classList.remove('selected');
        selectedGem = null;
    }
}

async function aiMove() {
    if (gameEnded) return;
    if (p2.mana >= 200 && p2.no >= 150) {
        p2.mana -= 200; p2.no -= 150;
        let rows = [0,1,2,3,4,5,6,7].sort(() => Math.random() - 0.5).slice(0,3);
        let popped = [];
        rows.forEach(rIdx => {
            for (let c=0; c<8; c++) {
                let idx = rIdx*8+c;
                if(board[idx]) { turnStats[board[idx]] = (turnStats[board[idx]] || 0) + 1; board[idx] = null; popped.push(idx); }
            }
        });
        renderPop(popped);
        await new Promise(r => setTimeout(r, 250));
        renderBoard();
        await processMatches();
        return;
    }
    let move = null, maxS = -1;
    for (let i=0; i<64; i++) {
        for (let n of [i+1, i+8]) {
            if (n<64 && isAdjacent(i, n)) {
                [board[i], board[n]] = [board[n], board[i]];
                let m = findMatches();
                if (m.length > 0) {
                    let s = m.length + (board[m[0]] === 'Hut' ? 20 : 0);
                    if (s > maxS) { maxS = s; move = {a:i, b:n}; }
                }
                [board[i], board[n]] = [board[n], board[i]];
            }
        }
    }
    if (move) await swapGems(move.a, move.b); else switchTurn();
}

function initBoard() { board = []; for (let i = 0; i < 64; i++) { let type; do { type = gameConfig.gemTypes[Math.floor(Math.random() * gameConfig.gemTypes.length)]; } while (isInitialMatch(i, type)); board.push(type); } renderBoard(); }
function isInitialMatch(idx, type) { let r = Math.floor(idx / 8), c = idx % 8; if (c >= 2 && board[idx-1] === type && board[idx-2] === type) return true; if (r >= 2 && board[idx-8] === type && board[idx-16] === type) return true; return false; }
function findMatches() { let matches = new Set(); for (let r=0; r<8; r++) { for (let c=0; c<6; c++) { let i = r*8+c; if (board[i] && board[i] === board[i+1] && board[i] === board[i+2]) { matches.add(i); matches.add(i+1); matches.add(i+2); } } } for (let r=0; r<6; r++) { for (let c=0; c<8; c++) { let i = r*8+c; if (board[i] && board[i] === board[i+8] && board[i] === board[i+16]) { matches.add(i); matches.add(i+8); matches.add(i+16); } } } return Array.from(matches); }
function startTimer() { timeLeft = 15; document.getElementById('hud-timer-text').innerText = timeLeft; clearInterval(timer); timer = setInterval(() => { timeLeft--; document.getElementById('hud-timer-text').innerText = timeLeft; if (timeLeft <= 0) { clearInterval(timer); switchTurn(); } }, 1000); }
function isAdjacent(i1, i2) { let r1 = Math.floor(i1/8), c1 = i1%8, r2 = Math.floor(i2/8), c2 = i2%8; return Math.abs(r1-r2) + Math.abs(c1-c2) === 1; }
function toggleTuner() { let p = document.getElementById('tuner-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function syncVal(k, v) { if(document.getElementById('n-'+k)) document.getElementById('n-'+k).value = v; applyAndSaveTuner(); }
function applyAndSaveTuner() { const s = { p1w: document.getElementById('n-p1-w').value, p1x: document.getElementById('n-p1-x').value, p1y: document.getElementById('n-p1-y').value, p2w: document.getElementById('n-p2-w').value, p2x: document.getElementById('n-p2-x').value, p2y: document.getElementById('n-p2-y').value }; const b1 = document.getElementById('pet-bro'), b2 = document.getElementById('pet-boss'); if(b1) { b1.style.width=s.p1w+'px'; b1.style.left=s.p1x+'px'; b1.style.bottom=s.p1y+'px'; } if(b2) { b2.style.width=s.p2w+'px'; b2.style.right=s.p2x+'px'; b2.style.bottom=s.p2y+'px'; } localStorage.setItem('pokiwarPetConfig', JSON.stringify(s)); }
function loadPetSettings() { let saved = localStorage.getItem('pokiwarPetConfig'); if (saved) { let s = JSON.parse(saved); const map = {'p1-w':s.p1w,'p1-x':s.p1x,'p1-y':s.p1y,'p2-w':s.p2w,'p2-x':s.p2x,'p2-y':s.p2y}; for(let k in map) { if(document.getElementById('n-'+k)) { document.getElementById('n-'+k).value = map[k]; } } applyAndSaveTuner(); } }