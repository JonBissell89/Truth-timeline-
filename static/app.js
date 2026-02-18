// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProvider = 'auto';  // selected AI provider id
let selectedNode   = null;
let chatHistory    = [];  // [{role, content}]
let graphNodes     = [];  // all nodes loaded into the graph
let graph          = null;

// ── STORAGE HELPERS ────────────────────────────────────────────────────────
function storageGet(k)    { try { return localStorage.getItem(k); }      catch(e) { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); }          catch(e) {} }
function storageRemove(k) { try { localStorage.removeItem(k); }          catch(e) {} }

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
const PROVIDER_ICONS = {
    anthropic: '🟣',
    google:    '🔵',
    openai:    '🟢'
};

async function loadProviders() {
    try {
        const res  = await fetch('/api/providers');
        const data = await res.json();
        renderProviders(data.providers);
    } catch (e) {
        document.getElementById('provider-list').innerHTML =
            '<div class="provider-loading">Could not load providers</div>';
    }
}

function renderProviders(providers) {
    const list      = document.getElementById('provider-list');
    const savedProv = storageGet('ttProvider') || 'auto';
    let   html      = '';

    // Pick default: first available, or 'auto'
    const firstAvail = providers.find(p => p.available);
    const defaultId  = savedProv !== 'auto' ? savedProv : (firstAvail ? firstAvail.id : 'auto');

    for (const p of providers) {
        const isSel  = p.id === defaultId;
        const icon   = PROVIDER_ICONS[p.id] || '⚪';
        const badge  = p.available
            ? (p.free ? '<span class="provider-badge badge-free">FREE</span>' : '')
            : '<span class="provider-badge badge-no-key">NO KEY</span>';

        html += `
        <button class="provider-card${isSel ? ' selected' : ''}${!p.available ? ' unavailable' : ''}"
                id="pcard-${p.id}"
                onclick="selectProvider('${p.id}')"
                ${!p.available ? 'disabled' : ''}>
            <span class="provider-icon">${icon}</span>
            <span class="provider-info">
                <span class="provider-name">${p.name}</span>
                <span class="provider-maker">${p.maker}</span>
            </span>
            ${badge}
        </button>`;
    }

    list.innerHTML = html;

    // Set current selection
    currentProvider = defaultId;
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

    // Show which AI is active in chat header
    const providerNames = { anthropic: 'Claude', google: 'Gemini', openai: 'ChatGPT', auto: 'AI' };
    const icons = { anthropic: '🟣', google: '🔵', openai: '🟢', auto: '◎' };
    const hdr = document.getElementById('chat-header');
    if (hdr) {
        const name = providerNames[currentProvider] || currentProvider;
        const icon = icons[currentProvider] || '◎';
        hdr.textContent = `${icon} Chatting with ${name} · ${currentUser}`;
    }

    initGraph();
    loadGraphNodes();
}

// ── TABS ───────────────────────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.querySelector(`.nav-btn[data-tab="${name}"]`).classList.add('active');

    if (name === 'graph') {
        if (graph) { graph.resize(); graph.draw(); }
    }
    if (name === 'timeline') {
        loadTimeline();
    }
}

// ══════════════════════════════════════════════════════════════════════════
// GRAPH ENGINE
// ══════════════════════════════════════════════════════════════════════════

class NodeGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx    = this.canvas.getContext('2d');
        this.nodes  = [];
        this.pan    = { x: 0, y: 0 };
        this.scale  = 1;
        this.drag   = null;   // { startX, startY, panStart }
        this.raf    = null;
        this.dirty  = true;

        this.resize();
        this.bindEvents();
        this.loop();
    }

    resize() {
        const tab = document.getElementById('tab-graph');
        this.canvas.width  = tab.clientWidth  || window.innerWidth;
        this.canvas.height = tab.clientHeight || (window.innerHeight - 56);
    }

    // ── ADD / UPDATE NODES ─────────────────────────────────────────────────
    addNode(nodeData) {
        if (this.nodes.find(n => n.id === nodeData.id)) {
            this.updateNode(nodeData);
            return;
        }
        const cx = this.canvas.width  / 2;
        const cy = this.canvas.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const r     = 80 + Math.random() * 120;
        nodeData.x  = cx + Math.cos(angle) * r;
        nodeData.y  = cy + Math.sin(angle) * r;
        nodeData.vx = (Math.random() - 0.5) * 2;
        nodeData.vy = (Math.random() - 0.5) * 2;
        this.nodes.push(nodeData);
        this.dirty = true;
        this.updateEmpty();
    }

    updateNode(nodeData) {
        const idx = this.nodes.findIndex(n => n.id === nodeData.id);
        if (idx >= 0) {
            const { x, y, vx, vy } = this.nodes[idx];
            this.nodes[idx] = { ...nodeData, x, y, vx, vy };
            this.dirty = true;
        }
    }

    updateEmpty() {
        const el = document.getElementById('graph-empty');
        if (el) el.classList.toggle('hidden', this.nodes.length > 0);
        const info = document.getElementById('graph-info');
        if (info) info.textContent = this.nodes.length > 0 ? `${this.nodes.length} node${this.nodes.length !== 1 ? 's' : ''}` : '';
    }

    // ── PHYSICS ────────────────────────────────────────────────────────────
    tick() {
        if (this.nodes.length < 2) return;
        const cx = this.canvas.width  / 2;
        const cy = this.canvas.height / 2;

        for (let i = 0; i < this.nodes.length; i++) {
            const a = this.nodes[i];

            // Gentle pull toward center
            a.vx += (cx - a.x) * 0.0008;
            a.vy += (cy - a.y) * 0.0008;

            for (let j = i + 1; j < this.nodes.length; j++) {
                const b  = this.nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d  = Math.sqrt(dx * dx + dy * dy) || 1;
                const f  = Math.min(4000 / (d * d), 8);
                const fx = (dx / d) * f;
                const fy = (dy / d) * f;
                a.vx -= fx;  a.vy -= fy;
                b.vx += fx;  b.vy += fy;
            }

            a.vx *= 0.85;
            a.vy *= 0.85;
            a.x  += a.vx;
            a.y  += a.vy;
        }
        this.dirty = true;
    }

    // ── DRAW ───────────────────────────────────────────────────────────────
    draw() {
        const { ctx, canvas, pan, scale } = this;
        const w = canvas.width, h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#07080f';
        ctx.fillRect(0, 0, w, h);

        // Starfield
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        const seed = 42;
        for (let i = 0; i < 60; i++) {
            const sx = ((seed * (i * 7 + 3) * 1234567) % w + w) % w;
            const sy = ((seed * (i * 11 + 5) * 7654321) % h + h) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        const nodeColor = (n) => {
            if (n.user_vote === 'yes')   return '#34d399';
            if (n.user_vote === 'no')    return '#f87171';
            if (n.user_vote === 'maybe') return '#fbbf24';
            return '#6366f1';
        };

        // Draw nodes
        for (const node of this.nodes) {
            const c  = nodeColor(node);
            const r  = 22;
            const isSel = selectedNode && selectedNode.id === node.id;

            // Glow
            ctx.shadowColor = c;
            ctx.shadowBlur  = isSel ? 24 : 10;

            // Fill
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle   = node.user_vote ? c + '33' : 'rgba(99,102,241,0.15)';
            ctx.strokeStyle = c;
            ctx.lineWidth   = isSel ? 2.5 : 1.5;
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Label
            const words = (node.question || '').split(' ');
            const label = words.slice(0, 4).join(' ') + (words.length > 4 ? '…' : '');
            ctx.fillStyle  = 'rgba(226,232,240,0.85)';
            ctx.font       = '10px -apple-system, sans-serif';
            ctx.textAlign  = 'center';
            ctx.fillText(label, node.x, node.y + r + 13);

            // Vote indicator dot
            if (node.user_vote) {
                ctx.beginPath();
                ctx.arc(node.x + r - 4, node.y - r + 4, 5, 0, Math.PI * 2);
                ctx.fillStyle = c;
                ctx.fill();
            }
        }

        ctx.restore();
        this.dirty = false;
    }

    // ── LOOP ───────────────────────────────────────────────────────────────
    loop() {
        this.tick();
        if (this.dirty) this.draw();
        this.raf = requestAnimationFrame(() => this.loop());
    }

    // ── HIT TEST ───────────────────────────────────────────────────────────
    hitTest(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (clientX - rect.left  - this.pan.x) / this.scale;
        const wy = (clientY - rect.top   - this.pan.y) / this.scale;
        for (const n of this.nodes) {
            const dx = wx - n.x, dy = wy - n.y;
            if (Math.sqrt(dx*dx + dy*dy) < 28) return n;
        }
        return null;
    }

    // ── TOUCH / MOUSE EVENTS ───────────────────────────────────────────────
    bindEvents() {
        const c = this.canvas;

        // Touch
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const t = e.touches[0];
                const hit = this.hitTest(t.clientX, t.clientY);
                if (hit) {
                    openNodeModal(hit);
                } else {
                    this.drag = { startX: t.clientX, startY: t.clientY, panStart: { ...this.pan } };
                }
            }
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.drag) {
                const t = e.touches[0];
                this.pan.x = this.drag.panStart.x + (t.clientX - this.drag.startX);
                this.pan.y = this.drag.panStart.y + (t.clientY - this.drag.startY);
                this.dirty = true;
            }
        }, { passive: false });

        c.addEventListener('touchend', () => { this.drag = null; });

        // Mouse (for desktop testing)
        c.addEventListener('mousedown', (e) => {
            const hit = this.hitTest(e.clientX, e.clientY);
            if (hit) {
                openNodeModal(hit);
            } else {
                this.drag = { startX: e.clientX, startY: e.clientY, panStart: { ...this.pan } };
            }
        });
        c.addEventListener('mousemove', (e) => {
            if (this.drag) {
                this.pan.x = this.drag.panStart.x + (e.clientX - this.drag.startX);
                this.pan.y = this.drag.panStart.y + (e.clientY - this.drag.startY);
                this.dirty = true;
            }
        });
        c.addEventListener('mouseup', () => { this.drag = null; });

        window.addEventListener('resize', () => { this.resize(); this.dirty = true; });
    }
}

function initGraph() {
    graph = new NodeGraph('graph-canvas');
    graph.updateEmpty();
}

async function loadGraphNodes() {
    try {
        const res  = await fetch(`/api/timeline/${currentUser}?vote_filter=all`);
        const data = await res.json();
        const nodes = data.timeline || [];

        // Also load vote info
        for (const node of nodes) {
            const voteRes  = await fetch(`/api/votes/${node.id}/${currentUser}`);
            const voteData = await voteRes.json();
            node.user_vote = voteData.vote;
            graph.addNode(node);
            graphNodes.push(node);
        }
    } catch (e) {
        console.error('loadGraphNodes:', e);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════════════

function sendPrompt(text) {
    document.getElementById('chat-input').value = text;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.disabled = true;
    document.getElementById('send-btn').disabled = true;

    // Add user bubble
    appendMsg('user', text);
    chatHistory.push({ role: 'user', content: text });

    // Add thinking indicator
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
            const voteRes  = await fetch(`/api/votes/${node.id}/${currentUser}`);
            const voteData = await voteRes.json();
            node.user_vote = voteData.vote;
            graph.addNode(node);
            if (!graphNodes.find(n => n.id === node.id)) graphNodes.push(node);
        }

    } catch (e) {
        removeThinking(thinkId);
        appendMsg('ai', 'Connection error. Is the server running?', []);
    }

    input.disabled  = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
}

function appendMsg(role, text, nodes) {
    const feed = document.getElementById('chat-messages');

    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);

    if (nodes && nodes.length > 0) {
        const nodeWrap = document.createElement('div');
        nodeWrap.className = 'msg-nodes';

        for (const n of nodes) {
            const pill = document.createElement('div');
            pill.className = 'node-pill';
            pill.innerHTML = `
                <span class="node-pill-dot"></span>
                <span class="node-pill-text">${n.question}</span>
                <span class="node-pill-arrow">→ vote</span>
            `;
            pill.onclick = () => openNodeModal(n);
            nodeWrap.appendChild(pill);
        }
        wrap.appendChild(nodeWrap);
    }

    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    return wrap;
}

let thinkCounter = 0;
function appendThinking() {
    const id = 'think-' + (++thinkCounter);
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

    // Tally
    const counts = node.vote_counts || { yes: 0, no: 0 };
    const maybe  = counts.maybe || 0;
    document.getElementById('modal-tally').textContent =
        `${counts.yes || 0} true · ${maybe} perhaps · ${counts.no || 0} false`;

    // Highlight current vote
    document.querySelectorAll('.v-btn').forEach(b => b.style.opacity = '1');
    if (node.user_vote === 'yes')   document.querySelector('.v-true').style.opacity  = '1';
    if (node.user_vote === 'maybe') document.querySelector('.v-maybe').style.opacity = '1';
    if (node.user_vote === 'no')    document.querySelector('.v-false').style.opacity  = '1';

    document.getElementById('node-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('node-modal').classList.remove('open');
    selectedNode = null;
}

// Close modal on backdrop tap
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
            // Update local node
            selectedNode.user_vote  = vote;
            selectedNode.vote_counts = data.vote_counts;
            graph.updateNode(selectedNode);

            // Update graphNodes list
            const n = graphNodes.find(n => n.id === selectedNode.id);
            if (n) { n.user_vote = vote; n.vote_counts = data.vote_counts; }

            closeModal();
            if (document.getElementById('tab-timeline').classList.contains('active')) {
                loadTimeline();
            }
        }
    } catch (e) {
        console.error('castVote:', e);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════════════════════════════════════════

async function loadTimeline() {
    const list = document.getElementById('timeline-list');
    list.innerHTML = '';

    const trueNodes = graphNodes.filter(n => n.user_vote === 'yes');

    if (trueNodes.length === 0) {
        list.innerHTML = '<div class="timeline-empty">No TRUE votes yet.<br>Chat with the AI, then vote TRUE on statements you believe.</div>';
        return;
    }

    for (const node of trueNodes) {
        const el = document.createElement('div');
        el.className = 'timeline-node';
        el.textContent = node.question;
        el.onclick = () => openNodeModal(node);
        list.appendChild(el);
    }
}
