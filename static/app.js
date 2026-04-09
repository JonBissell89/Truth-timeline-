// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentApiKey  = null;
let currentView    = 'mymind';   // 'mymind' | 'community' | 'compare'
let compareTarget  = null;
let compareNodes   = [];
let selectedNode   = null;
let chatHistory    = [];
let graphNodes     = [];
let graph          = null;

// ── STORAGE ────────────────────────────────────────────────────────────────
function storageGet(k)    { try { return localStorage.getItem(k); }  catch(e) { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); }      catch(e) {} }
function storageDel(k)    { try { localStorage.removeItem(k); }       catch(e) {} }

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = storageGet('ttUser');
    const savedKey  = storageGet('ttApiKey');
    if (savedUser && savedKey) {
        currentUser   = savedUser;
        currentApiKey = savedKey;
        startApp();
    }
});

// ── LOGIN ──────────────────────────────────────────────────────────────────
function login() {
    const name   = document.getElementById('username-input').value.trim();
    const apiKey = document.getElementById('apikey-input').value.trim();
    if (!name || !apiKey) return;
    currentUser   = name;
    currentApiKey = apiKey;
    storageSet('ttUser',   name);
    storageSet('ttApiKey', apiKey);
    startApp();
}

function startApp() {
    document.getElementById('login-screen').style.display = 'none';
    const app = document.getElementById('app-screen');
    app.style.display = 'flex';

    const tag = document.getElementById('user-tag');
    if (tag) tag.textContent = currentUser;

    initGraph();
    loadAllNodes();
}

function confirmLogout() {
    if (confirm(`Signed in as: ${currentUser}\n\nSign out and clear API key?`)) {
        storageDel('ttUser');
        storageDel('ttApiKey');
        location.reload();
    }
}

// ── VIEW SWITCHING ─────────────────────────────────────────────────────────
function setView(v) {
    currentView = v;
    document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));

    const cw = document.getElementById('compare-wrap');
    cw.classList.toggle('hidden', v !== 'compare');

    if (graph) { graph.dirty = true; }
    updateGraphOverlay();
}

async function loadCompare() {
    const target = document.getElementById('compare-input').value.trim();
    if (!target) return;
    compareTarget = target;
    try {
        const res  = await fetch(`/api/nodes/compare?user_a=${encodeURIComponent(currentUser)}&user_b=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data.warning) {
            alert(data.warning);
            return;
        }
        compareNodes = data.nodes || [];
        if (graph) {
            // Sync compare vote data into graphNodes
            for (const cn of compareNodes) {
                const gn = graphNodes.find(n => n.id === cn.id);
                if (gn) { gn.vote_a = cn.vote_a; gn.vote_b = cn.vote_b; }
            }
            graph.dirty = true;
        }
    } catch(e) { console.error('loadCompare:', e); }
}

// ── GRAPH OVERLAY ──────────────────────────────────────────────────────────
function updateGraphOverlay() {
    const empty = document.getElementById('graph-empty');
    const info  = document.getElementById('graph-info');
    if (!graph) return;
    if (empty) empty.classList.toggle('hidden', graphNodes.length > 0);

    const labels = {
        mymind:    `${graphNodes.filter(n => n.user_vote).length} voted / ${graphNodes.length} total`,
        community: `${graphNodes.length} nodes · community view`,
        compare:   compareTarget ? `You vs ${compareTarget}` : 'Enter a username above'
    };
    if (info) info.textContent = labels[currentView] || '';
}

// ── COLOR & RADIUS HELPERS ─────────────────────────────────────────────────
function totalVotes(node) {
    const vc = node.vote_counts || {};
    return (vc.yes || 0) + (vc.no || 0) + (vc.maybe || 0);
}

function nodeRadius(node) {
    const tv = totalVotes(node);
    return Math.max(12, Math.min(38, 12 + tv * 2.5));
}

function nodeColor(node) {
    if (currentView === 'mymind') {
        if (node.user_vote === 'yes')   return '#34d399';
        if (node.user_vote === 'no')    return '#f87171';
        if (node.user_vote === 'maybe') return '#fbbf24';
        return '#6366f1';
    }
    if (currentView === 'community') {
        const vc    = node.vote_counts || {};
        const total = (vc.yes || 0) + (vc.no || 0) + (vc.maybe || 0);
        if (total === 0) return '#6366f1';
        if ((vc.yes || 0) / total > 0.5) return '#34d399';
        if ((vc.no  || 0) / total > 0.5) return '#f87171';
        return '#fbbf24';
    }
    if (currentView === 'compare') {
        const va = node.vote_a, vb = node.vote_b;
        if (!va || !vb) return '#6366f1';
        if (va === vb)  return '#34d399';
        return '#f87171';
    }
    return '#6366f1';
}

function nodeAlpha(node) {
    if (currentView === 'mymind' && !node.user_vote) return 0.2;
    if (currentView === 'compare' && !node.vote_a && !node.vote_b) return 0.1;
    return 1;
}

// ── PANEL SWITCH ───────────────────────────────────────────────────────────
function switchPanel(name) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
    document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
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
        this.nodes  = [];
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
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
        const a  = Math.random() * Math.PI * 2;
        const r  = 60 + Math.random() * 140;
        nodeData.x  = cx + Math.cos(a) * r;
        nodeData.y  = cy + Math.sin(a) * r;
        nodeData.vx = (Math.random() - 0.5) * 1.5;
        nodeData.vy = (Math.random() - 0.5) * 1.5;
        this.nodes.push(nodeData);
        this.dirty = true;
        updateGraphOverlay();
    }

    updateNode(nodeData) {
        const idx = this.nodes.findIndex(n => n.id === nodeData.id);
        if (idx >= 0) {
            const { x, y, vx, vy } = this.nodes[idx];
            this.nodes[idx] = { ...nodeData, x, y, vx, vy };
            this.dirty = true;
        }
    }

    tick() {
        const nodes = this.nodes;
        if (nodes.length < 2) return;
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;

        for (let i = 0; i < nodes.length; i++) {
            const a  = nodes[i];
            const ra = nodeRadius(a);
            a.vx += (cx - a.x) * 0.0006;
            a.vy += (cy - a.y) * 0.0006;

            for (let j = i + 1; j < nodes.length; j++) {
                const b  = nodes[j];
                const rb = nodeRadius(b);
                const dx = b.x - a.x, dy = b.y - a.y;
                const d  = Math.sqrt(dx*dx + dy*dy) || 1;
                const minDist = ra + rb + 30;
                const f  = Math.min(5000 / (d * d), 10);
                const fx = (dx / d) * f, fy = (dy / d) * f;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
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

    draw() {
        const { ctx, canvas, pan, scale } = this;
        ctx.fillStyle = '#07080f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Starfield
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 60; i++) {
            const sx = ((42*(i*7+3)*1234567) % canvas.width  + canvas.width)  % canvas.width;
            const sy = ((42*(i*11+5)*7654321) % canvas.height + canvas.height) % canvas.height;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        for (const node of this.nodes) {
            const c     = nodeColor(node);
            const r     = nodeRadius(node);
            const alpha = nodeAlpha(node);
            const isSel = selectedNode && selectedNode.id === node.id;

            ctx.globalAlpha = alpha;
            ctx.shadowColor = alpha > 0.5 ? c : 'transparent';
            ctx.shadowBlur  = isSel ? 28 : (alpha > 0.5 ? 12 : 0);

            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle   = node.user_vote || node.vote_a ? c + '22' : 'rgba(99,102,241,0.1)';
            ctx.strokeStyle = c;
            ctx.lineWidth   = isSel ? 2.5 : 1.5;
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            if (alpha > 0.3) {
                const words = (node.question || '').split(' ');
                const label = words.slice(0, 4).join(' ') + (words.length > 4 ? '…' : '');
                ctx.fillStyle = 'rgba(226,232,240,0.8)';
                ctx.font      = `${Math.max(9, Math.min(12, r * 0.4))}px -apple-system, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(label, node.x, node.y + r + 13);
            }

            // Vote indicator dot
            if ((node.user_vote || node.vote_a) && alpha > 0.3) {
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
        if (this.dirty) { this.draw(); updateGraphOverlay(); }
        requestAnimationFrame(() => this.loop());
    }

    hitTest(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const wx   = (clientX - rect.left - this.pan.x) / this.scale;
        const wy   = (clientY - rect.top  - this.pan.y) / this.scale;
        for (const n of this.nodes) {
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
                const t = e.touches[0];
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
        c.addEventListener('mouseup', () => { this.drag = null; });
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
    } catch(e) { console.error('loadAllNodes:', e); }
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
            body:    JSON.stringify({
                messages: chatHistory,
                user_id:  currentUser,
                api_key:  currentApiKey,
                nodes:    graphNodes.map(n => ({
                    text: n.question,
                    vote: n.user_vote || null,
                    community: totalVotes(n)
                }))
            })
        });
        const data = await res.json();

        removeThinking(thinkId);
        chatHistory.push({ role: 'assistant', content: data.response });
        appendMsg('ai', data.response, data.nodes || []);

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
    const feed = document.getElementById('chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;

    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
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
    document.getElementById('modal-text').textContent = node.question || '';

    // Context line: compare view shows both votes, otherwise context text
    if (currentView === 'compare' && compareTarget) {
        const voteLabel = v => v === 'yes' ? 'TRUE' : v === 'no' ? 'FALSE' : v === 'maybe' ? 'PERHAPS' : 'unvoted';
        document.getElementById('modal-context').textContent =
            `You: ${voteLabel(node.vote_a)}  ·  ${compareTarget}: ${voteLabel(node.vote_b)}`;
    } else {
        document.getElementById('modal-context').textContent = node.context || '';
    }

    const vc = node.vote_counts || {};
    document.getElementById('modal-tally').textContent =
        `${vc.yes||0} true · ${vc.maybe||0} perhaps · ${vc.no||0} false  ·  ${totalVotes(node)} total`;

    document.getElementById('node-modal').classList.add('open');
    if (graph) graph.dirty = true;
}

function closeModal() {
    document.getElementById('node-modal').classList.remove('open');
    selectedNode = null;
    if (graph) graph.dirty = true;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('node-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('node-modal')) closeModal();
    });
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
        list.innerHTML = '<div class="timeline-empty">No TRUE votes yet.<br>Chat with Claude, then tap a node to vote.</div>';
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
