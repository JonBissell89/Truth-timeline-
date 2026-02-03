// Truth Timeline - Main Application Logic

// Global state
let currentUser = null;
let currentNodeId = null;
let currentTerm = null;

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved user
    const savedUser = localStorage.getItem('truthTimelineUser');
    if (savedUser) {
        currentUser = savedUser;
        showAppScreen();
    } else {
        loadGlobalStats();
    }
});

// Authentication
function login() {
    const username = document.getElementById('username-input').value.trim();
    if (!username) {
        showToast('Please enter a username', 'error');
        return;
    }

    currentUser = username;
    localStorage.setItem('truthTimelineUser', username);
    showAppScreen();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('truthTimelineUser');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

function showAppScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('current-user').textContent = `👤 ${currentUser}`;
    showView('home');
}

// View Navigation
function showView(viewName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');

    // Load view data
    if (viewName === 'timeline') {
        loadTimeline();
    }
}

// Define Term Flow
async function searchTerm() {
    const term = document.getElementById('term-input').value.trim();
    if (!term) {
        showToast('Please enter a term', 'error');
        return;
    }

    currentTerm = term;
    showLoading(true);

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, user_id: currentUser })
        });

        const data = await response.json();
        displaySearchResults(data.results, term);
    } catch (error) {
        showToast('Error searching for term', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function displaySearchResults(results, term) {
    const container = document.getElementById('search-results');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p>❌ No definitions found for "${term}"</p>
                <p style="color: var(--text-dim); margin: 1rem 0;">We need to create one.</p>
                <button onclick="showCreateModal('${term}')" class="btn-primary">
                    Create Definition
                </button>
            </div>
        `;
        return;
    }

    // Check if user already defined this term
    const userDefinition = results.find(r => r.scope === `personal:${currentUser}`);

    if (userDefinition) {
        container.innerHTML = `
            <div class="card">
                <p>✓ You already defined "${term}":</p>
                ${renderNode(userDefinition)}
            </div>
        `;
        return;
    }

    // Show community definitions
    let html = `
        <div class="card">
            <p>📚 Found ${results.length} community definition(s):</p>
        </div>
    `;

    results.forEach(node => {
        html += renderNode(node);
    });

    html += `
        <div class="card">
            <button onclick="showCreateModal('${term}')" class="btn-primary">
                Create Custom Definition
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// Word Classification
function getTierBadge(tier) {
    const icons = {
        'primitive': '🔵',
        'functional': '⚪',
        'concrete': '🟢',
        'derived': '🟡',
        'subjective': '🔴'
    };

    const labels = {
        'primitive': 'Primitive',
        'functional': 'Functional',
        'concrete': 'Concrete',
        'derived': 'Derived',
        'subjective': 'Subjective'
    };

    return `
        <span class="tier-badge tier-${tier}">
            <span class="tier-badge-icon">${icons[tier] || '⚪'}</span>
            ${labels[tier] || tier}
        </span>
    `;
}

async function classifyWord(word) {
    try {
        const response = await fetch(`/api/words/classify/${encodeURIComponent(word)}`);
        return await response.json();
    } catch (error) {
        console.error('Error classifying word:', error);
        return { tier: 'derived', type: 'unknown', needs_definition: true };
    }
}

async function checkCircular(term, question) {
    try {
        const response = await fetch('/api/words/check-circular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, question })
        });
        return await response.json();
    } catch (error) {
        console.error('Error checking circular:', error);
        return { is_circular: false };
    }
}

// Create Definition
async function showCreateModal(term) {
    currentTerm = term;
    document.getElementById('create-term').textContent = term;

    showLoading(true);

    try {
        // Classify the word first
        const classification = await classifyWord(term);

        // Show tier information
        let tierInfo = '';
        if (classification.tier === 'primitive') {
            tierInfo = `
                <div class="info-box" style="margin-bottom: 1rem;">
                    ${getTierBadge('primitive')}
                    <p style="margin-top: 0.5rem; color: var(--text-dim);">
                        This is a <strong>primitive</strong> term - a foundational concept that cannot be broken down further.
                        Most people understand "${term}" through direct experience.
                    </p>
                </div>
            `;
        } else if (classification.tier === 'subjective') {
            tierInfo = `
                <div class="info-box" style="margin-bottom: 1rem; border-color: var(--danger);">
                    ${getTierBadge('subjective')}
                    <p style="margin-top: 0.5rem; color: var(--text-dim);">
                        This is a <strong>subjective</strong> term - it means different things to different people.
                        Your definition will be personal to your timeline.
                    </p>
                </div>
            `;
        } else if (classification.tier === 'derived') {
            tierInfo = `
                <div class="info-box" style="margin-bottom: 1rem;">
                    ${getTierBadge('derived')}
                    <p style="margin-top: 0.5rem; color: var(--text-dim);">
                        This is a <strong>derived</strong> term - try to break it down into simpler words.
                        Best definitions use foundational primitives.
                    </p>
                </div>
            `;
        }

        // Get AI suggestions
        const response = await fetch('/api/ai/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, count: 3 })
        });

        const data = await response.json();

        // Update modal with tier info
        const modalContent = document.querySelector('#create-modal .modal-content');
        const existingTierInfo = modalContent.querySelector('.tier-info');
        if (existingTierInfo) {
            existingTierInfo.remove();
        }

        const h3 = modalContent.querySelector('h3');
        if (tierInfo) {
            h3.insertAdjacentHTML('afterend', `<div class="tier-info">${tierInfo}</div>`);
        }

        displayAISuggestions(data.suggestions);
    } catch (error) {
        console.error('Error in showCreateModal:', error);
    } finally {
        showLoading(false);
    }

    document.getElementById('create-modal').classList.add('active');
}

function displayAISuggestions(suggestions) {
    const container = document.getElementById('ai-suggestions');
    let html = '<p style="margin-bottom: 1rem;">🤖 AI Suggestions:</p>';

    suggestions.forEach((suggestion, index) => {
        html += `
            <button class="suggestion-btn" onclick="selectSuggestion('${escapequotes(suggestion)}')">
                ${suggestion}
            </button>
        `;
    });

    container.innerHTML = html;
}

function escapequotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function selectSuggestion(question) {
    await createDefinition(question);
}

async function createCustomDefinition() {
    const question = document.getElementById('custom-question-input').value.trim();
    if (!question) {
        showToast('Please enter a question', 'error');
        return;
    }

    await createDefinition(question);
}

async function createDefinition(question) {
    showLoading(true);

    try {
        // Check for circular definition
        const circularCheck = await checkCircular(currentTerm, question);

        if (circularCheck.is_circular) {
            showLoading(false);
            showToast(`⚠️ Circular definition detected: ${circularCheck.reason}`, 'error');
            return;
        }

        // Create node
        const response = await fetch('/api/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                user_id: currentUser,
                defining_terms: [currentTerm],
                using_terms: extractTerms(question),
                scope: `personal:${currentUser}`
            })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            showToast('Definition created!', 'success');

            // Show vote modal
            currentNodeId = data.node.id;
            showVoteModal(data.node);
        }
    } catch (error) {
        showToast('Error creating definition', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function extractTerms(question) {
    // Simple term extraction
    const words = question.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const common = new Set(['is', 'are', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'that', 'this']);
    return [...new Set(words.filter(w => !common.has(w)))];
}

// Voting
function showVoteModal(node) {
    currentNodeId = node.id;

    document.getElementById('modal-question').textContent = node.question;

    const definingTerms = JSON.parse(node.defining_terms || '[]');
    if (definingTerms.length > 0) {
        document.getElementById('modal-defines').innerHTML =
            `<span class="defines-tag">Defines: ${definingTerms.join(', ')}</span>`;
    } else {
        document.getElementById('modal-defines').innerHTML = '';
    }

    const voteCounts = node.vote_counts || { yes: 0, no: 0 };
    document.getElementById('modal-votes').textContent =
        `👥 ${voteCounts.yes} yes, ${voteCounts.no} no`;

    document.getElementById('vote-modal').classList.add('active');
}

async function voteOnNode(vote) {
    showLoading(true);

    try {
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                node_id: currentNodeId,
                user_id: currentUser,
                vote
            })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            showToast(`Voted ${vote.toUpperCase()}!`, 'success');

            // Refresh current view
            const activeView = document.querySelector('.view.active').id;
            if (activeView === 'timeline-view') {
                loadTimeline();
            } else if (activeView === 'define-view') {
                searchTerm();
            }
        }
    } catch (error) {
        showToast('Error voting', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// Timeline
async function loadTimeline() {
    showLoading(true);

    try {
        const response = await fetch(`/api/timeline/${currentUser}`);
        const data = await response.json();

        displayTimeline(data.timeline);

        // Check for orphaned nodes
        const orphanedResponse = await fetch(`/api/orphaned/${currentUser}`);
        const orphanedData = await orphanedResponse.json();

        if (orphanedData.orphaned.length > 0) {
            displayOrphanedWarning(orphanedData.orphaned);
        } else {
            document.getElementById('orphaned-warning').innerHTML = '';
        }
    } catch (error) {
        showToast('Error loading timeline', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function displayTimeline(timeline) {
    const container = document.getElementById('timeline-list');

    if (timeline.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <p>📭 Your timeline is empty</p>
                <p style="margin-top: 1rem; color: var(--text-dim);">
                    Start by defining fundamental terms!
                </p>
                <button onclick="showView('define')" class="btn-primary" style="margin-top: 1rem;">
                    Define Your First Term
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    timeline.forEach(node => {
        html += renderNode(node, true);
    });

    container.innerHTML = html;
}

function displayOrphanedWarning(orphaned) {
    const container = document.getElementById('orphaned-warning');
    container.innerHTML = `
        <div class="warning-box">
            <h4>⚠️ ${orphaned.length} Orphaned Node(s) Detected!</h4>
            <p style="color: var(--text-dim); margin-top: 0.5rem;">
                These nodes are no longer reachable due to changed votes.
            </p>
        </div>
    `;
}

// Search
async function performSearch() {
    const term = document.getElementById('search-input').value.trim();
    if (!term) {
        showToast('Please enter a search term', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, user_id: currentUser })
        });

        const data = await response.json();
        displaySearchList(data.results, term);
    } catch (error) {
        showToast('Error searching', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function displaySearchList(results, term) {
    const container = document.getElementById('search-results-list');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p>❌ No definitions found for "${term}"</p>
            </div>
        `;
        return;
    }

    let html = `<p style="margin-bottom: 1rem;">Found ${results.length} definition(s) for "${term}":</p>`;
    results.forEach(node => {
        html += renderNode(node);
    });

    container.innerHTML = html;
}

// Render Node Card
function renderNode(node, isTimeline = false) {
    const definingTerms = JSON.parse(node.defining_terms || '[]');
    const voteCounts = node.vote_counts || { yes: 0, no: 0 };
    const userVote = node.user_vote || null;

    let voteClass = '';
    if (userVote === 'yes') voteClass = 'user-voted-yes';
    if (userVote === 'no') voteClass = 'user-voted-no';

    return `
        <div class="node-card ${voteClass}" onclick='showVoteModal(${JSON.stringify(node)})'>
            <div class="node-question">${node.question}</div>
            ${definingTerms.length > 0 ? `
                <div style="margin: 0.5rem 0;">
                    <span class="defines-tag">Defines: ${definingTerms.join(', ')}</span>
                </div>
            ` : ''}
            <div class="node-meta">
                <span>👥 ${voteCounts.yes} yes, ${voteCounts.no} no</span>
                ${userVote ? `<span>Your vote: <strong>${userVote.toUpperCase()}</strong></span>` : ''}
            </div>
        </div>
    `;
}

// Modals
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.getElementById('custom-question-input').value = '';
}

// UI Helpers
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `show ${type}`;

    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

// Load global stats
async function loadGlobalStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        document.getElementById('global-stats').innerHTML = `
            📊 ${data.nodes} questions • ${data.votes} votes • ${data.users} users
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}
