// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser     = null;
let currentProvider = 'auto';
let currentFilter   = 'all';
let selectedNode    = null;
let chatHistory     = [];
let graphNodes      = [];   // master list of all nodes
let graph           = null;

// ── STORAGE ────────────────────────────────────────────────────────────────
function storageGet(k)    { try { return localStorage.getItem(k); }  catch(e) { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); }      catch(e) {} }

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadProviders();
    const saved = storageGet('ttUser');
    if (saved) {
        currentUser     = saved;
        currentProvider = storageGet('ttProvider') || 'auto';
        startApp();
    }
});

// ── PROVIDERS ──────────────────────────────────────────────────────────────
const PROVIDER_ICONS = { anthropic: '🟣', google: '🔵', openai: '🟢' };
const PROVIDER_NAMES = { anthropic: 'Claude', google: 'Gemini', openai: 'ChatGPT', auto: 'AI' };

async function loadProviders() {
    try {
        const res  = await fetch('/api/providers');
        const data = await res.json();
        renderProviders(data.providers);
    } catch(e) {
        document.getElementById('provider-list').innerHTML = '<div class="provider-loading">Could not load</div>';
    }
}

function renderProviders(providers) {
    const list       = document.getElementById('provider-list');
    const savedProv  = storageGet('ttProvider') || 'auto';
    const firstAvail = providers.find(p => p.available);
    const defaultId  = (savedProv !== 'auto') ? savedProv : (firstAvail ? firstAvail.id : 'auto');
    currentProvider  = defaultId;

    let html = '';
    for (const p of providers) {
        const isSel = p.id === defaultId;
        const icon  = PROVIDER_ICONS[p.id] || '⚪';
        const badge = p.available
            ? (p.free ? '<span class="provider-badge badge-free">FREE</span>' : '')
            : '<span class="provider-badge badge-no-key">NO KEY</span>';
        html += `
        <button class="provider-card${isSel?' selected':''}${!p.available?' unavailable':''}"
                id="pcard-${p.id}" onclick="selectProvider('${p.id}')"
                ${!p.available?'disabled':''}>
            <span class="provider-icon">${icon}</span>
            <span class="provider-info">
                <span class="provider-name">${p.name}</span>
                <span class="provider-maker">${p.maker}</span>
            </span>${badge}
        </button>`;
    }
    list.innerHTML = html;
}

function selectProvider(id) {
    currentProvider = id;
    storageSet('ttProvider', id);
    document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('pcard-' + id);
    if (card) card.classList.add('selected');
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
function login() {
    const name = document.getElementById('username-input').value.trim();
    if (!name) return;
    currentUser = name;
    storageSet('ttUser', name);
    storageSet('ttProvider', currentProvider);
    startApp();
}

function startApp() {
    const ls = document.getElementById('login-screen');
    const as = document.getElementById('app-screen');
    ls.style.display = 'none';
    ls.classList.remove('active');
    as.style.display = 'flex';
    as.classList.add('active');

    // User tag in filter bar
    const tag = document.getElementById('user-tag');
    if (tag) tag.textContent = currentUser;

    // AI indicator in panel header
    const ind = document.getElementById('ai-indicator');
    if (ind) {
        const icon = PROVIDER_ICONS[currentProvider] || '◎';
        const name = PROVIDER_NAMES[currentProvider] || currentProvider;
        ind.textContent = `${icon} ${name}`;
    }

    initGraph();
    loadAllNodes();
}

// ── FILTER ─────────────────────────────────────────────────────────────────
function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`.chip[data-filter="${f}"]`).classList.add('active');
    if (graph) graph.dirty = true;
}

function totalVotes(node) {
    const vc = node.vote_counts || {};
    return (vc.yes || 0) + (vc.no || 0) + (vc.maybe || 0);
}

function nodeRadius(node) {
    // Size proportional to community engagement, min 12, max 38
    const tv = totalVotes(node);
    return Math.max(12, Math.min(38, 12 + tv * 2.5));
}

function getVisibleNodes(all) {
    switch (currentFilter) {
        case 'true':    return all.filter(n => n.user_vote === 'yes');
        case 'false':   return all.filter(n => n.user_vote === 'no');
        case 'perhaps': return all.filter(n => n.user_vote === 'maybe');
        case 'hot':     return [...all].sort((a,b) => totalVotes(b) - totalVotes(a)).slice(0, 30);
        default:        return all;
    }
}

// ── PANEL SWITCH ───────────────────────────────────────────────────────────
function switchPanel(name) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
    document.querySelector(`.panel-tab[data-panel="${name}"]`).classList.add('active');
    document.getElementById('panel-' + name).classList.add('active');
    if (name === 'timeline') renderTimeline();
}

// ══════════════════════════════════════════════════════════════════════════
// NODE GRAPH ENGINE
// ══════════════════════════════════════════════════════════════════════════

class NodeGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx    = this.canvas.getContext('2d');
        this.nodes  = [];          // all nodes with physics state
        this.pan    = { x: 0, y: 0 };
        this.scale  = 1;
        this.drag   = null;
        this.dirty  = true;

        this.resize();
        this.bindEvents();
        this.loop();
    }

    resize() {
        const area = document.getElementById('graph-area');
        this.canvas.width  = area.clientWidth  || window.innerWidth;
        this.canvas.height = area.clientHeight || Math.floor(window.innerHeight * 0.55);
    }

    addNode(nodeData) {
        if (this.nodes.find(n => n.id === nodeData.id)) {
            this.updateNode(nodeData);
            return;
        }
        const cx = this.canvas.width  / 2;
        const cy = this.canvas.height / 2;
        const a  = Math.random() * Math.PI * 2;
        const r  = 60 + Math.random() * 140;
        nodeData.x  = cx + Math.cos(a) * r;
        nodeData.y  = cy + Math.sin(a) * r;
        nodeData.vx = (Math.random() - 0.5) * 1.5;
        nodeData.vy = (Math.random() - 0.5) * 1.5;
        this.nodes.push(nodeData);
        this.dirty = true;
        this.updateOverlay();
    }

    updateNode(nodeData) {
        const idx = this.nodes.findIndex(n => n.id === nodeData.id);
        if (idx >= 0) {
            const { x, y, vx, vy } = this.nodes[idx];
            this.nodes[idx] = { ...nodeData, x, y, vx, vy };
            this.dirty = true;
        }
    }

    updateOverlay() {
        const empty = document.getElementById('graph-empty');
        const info  = document.getElementById('graph-info');
        const vis   = getVisibleNodes(this.nodes);
        if (empty) empty.classList.toggle('hidden', this.nodes.length > 0);
        if (info)  info.textContent = this.nodes.length > 0
            ? `${vis.length} / ${this.nodes.length} nodes`
            : '';
    }

    // ── PHYSICS ────────────────────────────────────────────────────────────
    tick() {
        const visible = getVisibleNodes(this.nodes);
        if (visible.length < 2) return;
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;

        for (let i = 0; i < visible.length; i++) {
            const a  = visible[i];
            const ra = nodeRadius(a);

            // Center gravity
            a.vx += (cx - a.x) * 0.0006;
            a.vy += (cy - a.y) * 0.0006;

            for (let j = i + 1; j < visible.length; j++) {
                const b  = visible[j];
                const rb = nodeRadius(b);
                const dx = b.x - a.x, dy = b.y - a.y;
                const d  = Math.sqrt(dx*dx + dy*dy) || 1;
                const minDist = ra + rb + 30;
                const f  = Math.min(5000 / (d * d), 10);
                const fx = (dx / d) * f, fy = (dy / d) * f;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
                // Push apart if overlapping
                if (d < minDist) {
                    const push = (minDist - d) * 0.1;
                    a.vx -= (dx/d)*push; a.vy -= (dy/d)*push;
                    b.vx += (dx/d)*push; b.vy += (dy/d)*push;
                }
            }
            a.vx *= 0.82; a.vy *= 0.82;
            a.x  += a.vx;  a.y  += a.vy;
        }
        this.dirty = true;
    }

    // ── DRAW ───────────────────────────────────────────────────────────────
    draw() {
        const { ctx, canvas, pan, scale } = this;
        const w = canvas.width, h = canvas.height;

        // Background
        ctx.fillStyle = '#07080f';
        ctx.fillRect(0, 0, w, h);

        // Subtle starfield
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 50; i++) {
            const sx = ((42 * (i*7+3) * 1234567) % w + w) % w;
            const sy = ((42 * (i*11+5) * 7654321) % h + h) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        const visible = getVisibleNodes(this.nodes);
        const visSet  = new Set(visible.map(n => n.id));

        const color = (n) => {
            if (n.user_vote === 'yes')   return '#34d399';
            if (n.user_vote === 'no')    return '#f87171';
            if (n.user_vote === 'maybe') return '#fbbf24';
            return '#6366f1';
        };

        for (const node of this.nodes) {
            const isVisible = visSet.has(node.id);
            const c  = color(node);
            const r  = nodeRadius(node);
            const isSel = selectedNode && selectedNode.id === node.id;

            // Dim non-visible nodes rather than hiding entirely
            const alpha = isVisible ? 1 : 0.08;
            ctx.globalAlpha = alpha;

            ctx.shadowColor = isVisible ? c : 'transparent';
            ctx.shadowBlur  = isSel ? 28 : (isVisible ? 12 : 0);

            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle   = node.user_vote ? c + '22' : 'rgba(99,102,241,0.1)';
            ctx.strokeStyle = c;
            ctx.lineWidth   = isSel ? 2.5 : 1.5;
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Label
            if (isVisible) {
                const words = (node.question || '').split(' ');
                const label = words.slice(0, 4).join(' ') + (words.length > 4 ? '…' : '');
                ctx.fillStyle = 'rgba(226,232,240,0.8)';
                ctx.font      = `${Math.max(9, Math.min(12, r * 0.4))}px -apple-system, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(label, node.x, node.y + r + 13);
            }

            // Vote dot
            if (node.user_vote && isVisible) {
                ctx.beginPath();
                ctx.arc(node.x + r - 4, node.y - r + 4, 4, 0, Math.PI * 2);
                ctx.fillStyle = c;
                ctx.fill();
            }

            ctx.globalAlpha = 1;
        }

        ctx.restore();
        this.dirty = false;
    }

    loop() {
        this.tick();
        if (this.dirty) {
            this.draw();
            this.updateOverlay();
        }
        requestAnimationFrame(() => this.loop());
    }

    hitTest(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (clientX - rect.left - this.pan.x) / this.scale;
        const wy = (clientY - rect.top  - this.pan.y) / this.scale;
        const visible = getVisibleNodes(this.nodes);
        for (const n of visible) {
            const dx = wx - n.x, dy = wy - n.y;
            if (Math.sqrt(dx*dx + dy*dy) < nodeRadius(n) + 6) return n;
        }
        return null;
    }

    bindEvents() {
        const c = this.canvas;
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const t   = e.touches[0];
                const hit = this.hitTest(t.clientX, t.clientY);
                if (hit) openNodeModal(hit);
                else this.drag = { sx: t.clientX, sy: t.clientY, px: this.pan.x, py: this.pan.y };
            }
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.drag) {
                const t = e.touches[0];
                this.pan.x = this.drag.px + (t.clientX - this.drag.sx);
                this.pan.y = this.drag.py + (t.clientY - this.drag.sy);
                this.dirty = true;
            }
        }, { passive: false });

        c.addEventListener('touchend',  () => { this.drag = null; });
        c.addEventListener('mousedown', (e) => {
            const hit = this.hitTest(e.clientX, e.clientY);
            if (hit) openNodeModal(hit);
            else this.drag = { sx: e.clientX, sy: e.clientY, px: this.pan.x, py: this.pan.y };
        });
        c.addEventListener('mousemove', (e) => {
            if (this.drag) {
                this.pan.x = this.drag.px + (e.clientX - this.drag.sx);
                this.pan.y = this.drag.py + (e.clientY - this.drag.sy);
                this.dirty = true;
            }
        });
        c.addEventListener('mouseup',   () => { this.drag = null; });
        window.addEventListener('resize', () => { this.resize(); this.dirty = true; });
    }
}

function initGraph() {
    graph = new NodeGraph('graph-canvas');
}

async function loadAllNodes() {
    try {
        const res  = await fetch(`/api/nodes/global?user_id=${encodeURIComponent(currentUser)}`);
        const data = await res.json();
        for (const node of (data.nodes || [])) {
            graph.addNode(node);
            if (!graphNodes.find(n => n.id === node.id)) graphNodes.push(node);
        }
    } catch(e) {
        console.error('loadAllNodes:', e);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════════════

function sendPrompt(text) {
    switchPanel('chat');
    document.getElementById('chat-input').value = text;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value    = '';
    input.disabled = true;
    document.getElementById('send-btn').disabled = true;

    appendMsg('user', text);
    chatHistory.push({ role: 'user', content: text });
    const thinkId = appendThinking();

    try {
        const res  = await fetch('/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ messages: chatHistory, user_id: currentUser, provider: currentProvider })
        });
        const data = await res.json();

        removeThinking(thinkId);
        chatHistory.push({ role: 'assistant', content: data.response });
        appendMsg('ai', data.response, data.nodes || []);

        // Add new nodes to graph
        for (const node of (data.nodes || [])) {
            graph.addNode(node);
            if (!graphNodes.find(n => n.id === node.id)) graphNodes.push(node);
        }

    } catch(e) {
        removeThinking(thinkId);
        appendMsg('ai', 'Connection error.', []);
    }

    input.disabled  = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
}

function appendMsg(role, text, nodes) {
    const feed   = document.getElementById('chat-messages');
    const wrap   = document.createElement('div');
    wrap.className = 'msg ' + role;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);

    if (nodes && nodes.length > 0) {
        const nw = document.createElement('div');
        nw.className = 'msg-nodes';
        for (const n of nodes) {
            const pill = document.createElement('div');
            pill.className = 'node-pill';
            pill.innerHTML = `<span class="node-pill-dot"></span>
                <span class="node-pill-text">${n.question}</span>
                <span class="node-pill-arrow">→ vote</span>`;
            pill.onclick = () => openNodeModal(n);
            nw.appendChild(pill);
        }
        wrap.appendChild(nw);
    }

    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
}

let _thinkN = 0;
function appendThinking() {
    const id   = 'think-' + (++_thinkN);
    const feed = document.getElementById('chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg ai ai-thinking';
    wrap.id = id;
    wrap.innerHTML = '<div class="msg-bubble">thinking…</div>';
    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    return id;
}
function removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ══════════════════════════════════════════════════════════════════════════
// NODE MODAL & VOTING
// ══════════════════════════════════════════════════════════════════════════

function openNodeModal(node) {
    selectedNode = node;
    document.getElementById('modal-text').textContent    = node.question || '';
    document.getElementById('modal-context').textContent = node.context  || '';

    const vc    = node.vote_counts || {};
    const maybe = vc.maybe || 0;
    document.getElementById('modal-tally').textContent =
        `${vc.yes || 0} true · ${maybe} perhaps · ${vc.no || 0} false  ·  ${totalVotes(node)} total`;

    document.getElementById('node-modal').classList.add('open');
    if (graph) graph.dirty = true;
}

function closeModal() {
    document.getElementById('node-modal').classList.remove('open');
    selectedNode = null;
    if (graph) graph.dirty = true;
}

document.getElementById('node-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('node-modal')) closeModal();
});

async function castVote(vote) {
    if (!selectedNode || !currentUser) return;

    try {
        const res  = await fetch('/api/votes', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ node_id: selectedNode.id, user_id: currentUser, vote })
        });
        const data = await res.json();

        if (data.success) {
            selectedNode.user_vote   = vote;
            selectedNode.vote_counts = data.vote_counts;
            graph.updateNode(selectedNode);

            const n = graphNodes.find(n => n.id === selectedNode.id);
            if (n) { n.user_vote = vote; n.vote_counts = data.vote_counts; }

            closeModal();
            renderTimeline();
        }
    } catch(e) { console.error('castVote:', e); }
}

// ══════════════════════════════════════════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════════════════════════════════════════

function renderTimeline() {
    const list      = document.getElementById('timeline-list');
    const trueNodes = graphNodes.filter(n => n.user_vote === 'yes');

    if (trueNodes.length === 0) {
        list.innerHTML = '<div class="timeline-empty">No TRUE votes yet.<br>Chat with the AI, then tap a node to vote.</div>';
        return;
    }

    list.innerHTML = '';
    for (const node of trueNodes) {
        const el = document.createElement('div');
        el.className   = 'timeline-node';
        el.textContent = node.question;
        el.onclick     = () => openNodeModal(node);
        list.appendChild(el);
    }
}
