let decks = JSON.parse(localStorage.getItem('decks')) || [];
let currentDeckIdx = -1, currentCards = [], currentIndex = 0, isReviewMode = false;

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP'; u.rate = 0.85;
        window.speechSynthesis.speak(u);
    }
}
function playSound(isCorrect) {
    let audio = new Audio(isCorrect ? "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg" : "https://actions.google.com/sounds/v1/cartoon/boing_backward.ogg");
    audio.volume = 0.5; audio.play().catch(e => {});
}
function formatBackText(t) { return t ? t.replace(/\s*[,;]\s*/g, '<br>') : ""; }

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const t = document.getElementById(id);
    if (t) t.classList.remove('hidden');
    if (id === 'home-screen') updateHome();
}

function checkSchedule() {
    const box = document.getElementById('daily-schedule'), list = document.getElementById('task-list');
    list.innerHTML = '';
    let hasTask = false, now = new Date();
    decks.forEach((d, i) => {
        if (!d.createdAt) return;
        const diff = Math.floor(Math.abs(now - new Date(d.createdAt)) / 86400000);
        if ([1, 3, 5, 7, 14, 30].includes(diff)) {
            hasTask = true;
            const li = document.createElement('li'); li.className = 'urgent';
            li.innerHTML = `<span>🔥 Ôn: ${d.name}</span><small>Ngày ${diff}</small>`;
            li.onclick = () => openDeck(i);
            list.appendChild(li);
        }
    });
    const last = decks.length ? new Date(decks[decks.length-1].createdAt || 0) : new Date(0);
    if (!hasTask || (now - last)/86400000 >= 3) {
        hasTask = true;
        const li = document.createElement('li'); li.className = 'create-new';
        li.innerHTML = `<span>✨ Tạo bài mới ngay!</span>`;
        li.onclick = () => createNewDeck();
        list.appendChild(li);
    }
    hasTask ? box.classList.remove('hidden') : box.classList.add('hidden');
}

function updateHome() {
    const list = document.getElementById('deck-list'); list.innerHTML = '';
    checkSchedule();
    decks.forEach((d, i) => {
        const div = document.createElement('div'); div.className = 'deck-item';
        div.innerHTML = `<div><strong>${d.name}</strong><br><small>${d.cards.length} thẻ | ⭐ ${d.reviewList.length}</small></div><span>›</span>`;
        div.onclick = () => openDeck(i);
        list.appendChild(div);
    });
}

window.createNewDeck = () => {
    const name = prompt("Tên bài học:");
    if (name) { decks.push({name, cards:[], reviewList:[], createdAt: new Date().toISOString()}); save(); updateHome(); }
};
function openDeck(i) {
    currentDeckIdx = i;
    const d = decks[i], validIds = new Set(d.cards.map(c=>c.id));
    d.reviewList = d.reviewList.filter(c=>validIds.has(c.id));
    document.getElementById('current-deck-name').innerText = d.name;
    document.getElementById('card-count').innerText = d.cards.length;
    showScreen('deck-detail-screen'); renderCards();
}
window.deleteCurrentDeck = () => { if(confirm("Xóa bài này?")) { decks.splice(currentDeckIdx,1); save(); showScreen('home-screen'); } };
window.shuffleDeck = () => { 
    if(decks[currentDeckIdx].cards.length<2) return alert("Cần > 2 thẻ");
    if(confirm("Trộn thẻ?")) { decks[currentDeckIdx].cards.sort(()=>0.5-Math.random()); save(); renderCards(); alert("Xong!"); }
};

function renderCards() {
    const c = document.getElementById('card-list'); c.innerHTML = '';
    decks[currentDeckIdx].cards.forEach((card, i) => {
        const div = document.createElement('div'); div.className = 'card-item-manage';
        const starred = decks[currentDeckIdx].reviewList.some(x=>x.id===card.id);
        div.innerHTML = `<div style="display:flex;align-items:center"><span class="star-list-btn ${starred?'star-active':'star-inactive'}" onclick="toggleStarInList(${card.id})">⭐</span><div><strong>${card.front}</strong><br><small>${card.back}</small></div></div><button onclick="deleteCard(${i})" class="danger">Xóa</button>`;
        c.appendChild(div);
    });
}
window.toggleStarInList = (id) => {
    const d = decks[currentDeckIdx], c = d.cards.find(x=>x.id===id), idx = d.reviewList.findIndex(x=>x.id===id);
    idx===-1 ? d.reviewList.push(c) : d.reviewList.splice(idx,1); save(); renderCards();
};
window.deleteCard = (i) => {
    const id = decks[currentDeckIdx].cards[i].id;
    decks[currentDeckIdx].reviewList = decks[currentDeckIdx].reviewList.filter(x=>x.id!==id);
    decks[currentDeckIdx].cards.splice(i,1); save(); renderCards();
    document.getElementById('card-count').innerText = decks[currentDeckIdx].cards.length;
};
window.handleBulkImport = () => {
    const val = document.getElementById('bulk-input').value.trim();
    if(!val) return alert("Trống!");
    val.split('\n').forEach(l => {
        const p = l.split(/[-:|	]/);
        if(p.length>=2) decks[currentDeckIdx].cards.push({id:Date.now()+Math.random(), front:p[0].trim(), back:p[1].trim()});
    });
    save(); document.getElementById('bulk-input').value=''; alert("Đã nhập!"); openDeck(currentDeckIdx);
};

window.startStudy = (isRev) => {
    isReviewMode = isRev;
    const d = decks[currentDeckIdx];
    currentCards = isRev ? [...d.reviewList] : [...d.cards];
    if(!currentCards.length) return alert("Không có thẻ!");
    currentIndex=0; showScreen('study-screen'); loadCard();
};
function loadCard() {
    const c = currentCards[currentIndex];
    document.getElementById('main-card').classList.remove('is-flipped');
    document.getElementById('front-text').innerText = c.front;
    document.getElementById('back-text').innerHTML = formatBackText(c.back);
    document.getElementById('study-progress').innerText = `${currentIndex+1}/${currentCards.length}`;
    document.getElementById('study-controls').classList.add('hidden');
    updateStarUI(); speak(c.front);
}
window.prevCard = () => { if(currentIndex>0) {currentIndex--; loadCard();} else alert("Đầu!"); };
window.nextCard = () => { if(currentIndex<currentCards.length-1) {currentIndex++; loadCard();} else alert("Cuối!"); };
window.flipCard = () => {
    const el = document.getElementById('main-card');
    if(!el.classList.contains('is-flipped')) { el.classList.add('is-flipped'); document.getElementById('study-controls').classList.remove('hidden'); }
    else speak(currentCards[currentIndex].front);
};
function updateStarUI() {
    const s = decks[currentDeckIdx].reviewList.some(x=>x.id===currentCards[currentIndex].id);
    const b = document.getElementById('star-btn'); b.className = s?'active':''; b.innerText = s?'⭐':'☆';
}
window.toggleStarCurrent = (e) => { e.stopPropagation(); window.toggleStarInList(currentCards[currentIndex].id); updateStarUI(); };
window.markKnown = (k) => {
    const d = decks[currentDeckIdx], c = currentCards[currentIndex];
    if(!k && !d.reviewList.find(x=>x.id===c.id)) d.reviewList.push(c);
    else if(k && isReviewMode) d.reviewList = d.reviewList.filter(x=>x.id!==c.id);
    save();
    if(currentIndex<currentCards.length-1) {currentIndex++; loadCard();} else {alert("Xong!"); showScreen('deck-detail-screen');}
};

window.startQuiz = (isRev) => {
    isReviewMode = isRev;
    const d = decks[currentDeckIdx];
    currentCards = isRev ? [...d.reviewList] : [...d.cards];
    if(currentCards.length<4) return alert("Cần >= 4 thẻ!");
    currentCards.sort(()=>0.5-Math.random()); currentIndex=0; showScreen('quiz-screen'); loadQuiz();
};
function loadQuiz() {
    const cor = currentCards[currentIndex];
    document.getElementById('quiz-question').innerText = cor.front; speak(cor.front);
    const all = decks[currentDeckIdx].cards.map(c=>c.back);
    let opts = [cor.back];
    while(opts.length<4 && opts.length<all.length) {
        let r = all[Math.floor(Math.random()*all.length)];
        if(!opts.includes(r)) opts.push(r);
    }
    opts.sort(()=>0.5-Math.random());
    const con = document.getElementById('quiz-options'); con.innerHTML=''; con.style.pointerEvents='auto';
    opts.forEach(o => {
        const b = document.createElement('button'); b.innerHTML = formatBackText(o);
        b.onclick = () => {
            const isC = (o===cor.back); playSound(isC);
            b.style.background = isC?"#2ecc71":"#e74c3c"; b.style.color="white";
            if(isC && isReviewMode) decks[currentDeckIdx].reviewList = decks[currentDeckIdx].reviewList.filter(x=>x.id!==cor.id);
            else if(!isC && !decks[currentDeckIdx].reviewList.find(x=>x.id===cor.id)) decks[currentDeckIdx].reviewList.push(cor);
            save(); con.style.pointerEvents='none';
            setTimeout(()=>{ currentIndex++; if(currentIndex<currentCards.length) loadQuiz(); else {alert("Xong!"); showScreen('deck-detail-screen');} }, 1000);
        };
        con.appendChild(b);
    });
}
function save() { localStorage.setItem('decks', JSON.stringify(decks)); }
window.exportData = () => { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(decks)); a.download = "mina.json"; a.click(); };
window.importData = (e) => { const r = new FileReader(); r.onload = (ev) => { try{decks=JSON.parse(ev.target.result);save();updateHome();alert("Xong!");}catch(e){alert("Lỗi!");} }; r.readAsText(e.target.files[0]); };
updateHome();