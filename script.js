/**
 * Mobile Page Builder Core Logic
 * 
 * Features:
 * - State Management (Blocks, Active Selection)
 * - Rendering Engine (Template Literals)
 * - Property Editing
 * - Drag & Drop / Reordering
 * - Communication with Google Apps Script
 */

// --- CONFIGURATION ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9mu7yMN-QNv09L9XJBVlaeEP3pfjHMXurYvGCE3HBS7tifalSsi7IJ4u0IJlrdcyxyA/exec';

// --- STATE MANAGEMENT ---
const state = {
    mode: 'editor', // 'editor' | 'viewer'
    pageTitle: '나의 모바일 페이지',
    pageId: null, // Loaded from URL if viewing
    blocks: [],   // Array of block objects
    activeBlockId: null, // Currently selected block ID
    isDirty: false
};

// --- DOM ELEMENTS ---
const elems = {
    canvas: document.getElementById('canvas'),
    propPanel: document.getElementById('properties-content'),
    tools: document.querySelectorAll('.tool-btn'),
    modal: document.getElementById('template-modal'),
    saveModal: document.getElementById('save-modal'),
    btnSave: document.getElementById('btn-save'),
    btnSaveConfirm: document.getElementById('confirm-save'),
    btnSaveCancel: document.getElementById('cancel-save'),
    viewerApp: document.getElementById('viewer-app'),
    editorApp: document.getElementById('app')
};

// --- INITIALIZATION ---
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        // Viewer Mode
        state.mode = 'viewer';
        state.pageId = id;
        switchToViewerMode();
        loadPageData(id);
    } else {
        // Editor Mode
        elems.modal.style.display = 'flex';
        setupEventListeners();
    }
}

function switchToViewerMode() {
    elems.editorApp.classList.add('hidden');
    elems.viewerApp.classList.remove('hidden');
}

// --- TEMPLATES ---
const templates = {
    newsletter: [
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x200?text=Header+Image' },
        { id: generateUUID(), type: 'text', content: '<h2>이번 주 소식</h2><p>안녕하세요! 복지관의 새로운 소식을 전해드립니다.</p>', style: { textAlign: 'left' } },
        { id: generateUUID(), type: 'divider' }
    ],
    promotion: [
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x500?text=Event+Poster' },
        { id: generateUUID(), type: 'text', content: '<h1>가을 축제 초대</h1><p>일시: 10월 25일(금) 14:00</p>', style: { textAlign: 'center', backgroundColor: '#f9f9f9' } },
        { id: generateUUID(), type: 'schedule', start: '2025-10-25T14:00', end: '2025-10-25T16:00', title: '본행사' }
    ],
    invitation: [
        { id: generateUUID(), type: 'text', content: '<h3>INVITATION</h3><h1>초 대 합 니 다</h1>', style: { textAlign: 'center', color: '#ff6b6b' } },
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x300?text=Map' },
        { id: generateUUID(), type: 'text', content: '오시는 길: 서울시 행복구 복지로 123', style: { textAlign: 'center' } }
    ]
};

// --- CORE FUNCTIONS ---

function generateUUID() {
    return 'block_' + Math.random().toString(36).substr(2, 9);
}

function addBlock(type) {
    const newBlock = {
        id: generateUUID(),
        type: type,
        content: getDefaultContent(type),
        style: {} // Custom styles like color, align
    };
    state.blocks.push(newBlock);
    renderBlocks();
    selectBlock(newBlock.id);
}

function getDefaultContent(type) {
    switch (type) {
        case 'text': return '<h3>제목을 입력하세요</h3><p>내용을 입력하세요.</p>';
        case 'image': return 'https://via.placeholder.com/400x200';
        case 'video': return 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        case 'schedule': return { title: '일정 제목', start: '', end: '' };
        case 'list': return [{ label: '항목1', value: '내용1' }, { label: '항목2', value: '내용2' }];
        default: return '';
    }
}

function deleteBlock(id) {
    if (!confirm('정말 이 블록을 삭제하시겠습니까?')) return;
    state.blocks = state.blocks.filter(b => b.id !== id);
    if (state.activeBlockId === id) {
        state.activeBlockId = null;
        renderProperties();
    }
    renderBlocks();
}

function moveBlock(id, direction) {
    const idx = state.blocks.findIndex(b => b.id === id);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
        [state.blocks[idx], state.blocks[idx - 1]] = [state.blocks[idx - 1], state.blocks[idx]];
    } else if (direction === 'down' && idx < state.blocks.length - 1) {
        [state.blocks[idx], state.blocks[idx + 1]] = [state.blocks[idx + 1], state.blocks[idx]];
    }
    renderBlocks();
}

function selectBlock(id) {
    state.activeBlockId = id;
    renderBlocks(); // Re-render to show active state
    renderProperties();
}

// --- RENDERING ---

function renderBlocks() {
    const container = state.mode === 'viewer' ? document.getElementById('viewer-content') : elems.canvas;
    container.innerHTML = state.blocks.map((block, index) => {
        const isActive = block.id === state.activeBlockId ? 'active' : '';
        const controls = state.mode === 'editor' ? `
            <div class="block-controls">
                <button class="control-btn" onclick="moveBlock('${block.id}', 'up')"><i class="fas fa-arrow-up"></i></button>
                <button class="control-btn" onclick="moveBlock('${block.id}', 'down')"><i class="fas fa-arrow-down"></i></button>
                <button class="control-btn btn-delete" onclick="deleteBlock('${block.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : '';

        return `
            <div class="block ${isActive}" id="${block.id}" onclick="selectBlock('${block.id}')">
                ${controls}
                ${renderBlockContent(block)}
            </div>
        `;
    }).join('');
}

function renderBlockContent(block) {
    switch (block.type) {
        case 'text':
            return `<div class="block-text" style="${styleToString(block.style)}">${block.content}</div>`;
        case 'image':
            return `<div class="block-image"><img src="${block.content}" alt="Image"></div>`;
        case 'video':
            return `<div class="block-video"><iframe src="${block.content}" allowfullscreen></iframe></div>`;
        case 'schedule':
            const startStr = block.content.start ? new Date(block.content.start).toLocaleString() : '시작일 미정';
            const endStr = block.content.end ? new Date(block.content.end).toLocaleString() : '종료일 미정';
            return `
                <div class="block-schedule">
                    <div class="schedule-title">${block.content.title}</div>
                    <div class="schedule-time">${startStr} ~ ${endStr}</div>
                </div>`;
        case 'list':
            const listItems = block.content.map(item => `
                <div class="list-item">
                    <span class="list-label">${item.label}</span>
                    <span class="list-value">${item.value}</span>
                </div>
            `).join('');
            return `<div class="block-list">${listItems}</div>`;
        case 'divider':
            return `<div class="block-divider"></div>`;
        default:
            return `<div>Unknown Block</div>`;
    }
}

function styleToString(style) {
    if (!style) return '';
    return Object.entries(style).map(([k, v]) => {
        const key = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        return `${key}:${v};`;
    }).join('');
}

// --- PROPERTIES PANEL ---

function renderProperties() {
    const block = state.blocks.find(b => b.id === state.activeBlockId);
    if (!block) {
        elems.propPanel.innerHTML = '<div class="empty-state"><p>블록을 선택하여 속성을 편집하거나,<br>빈 영역을 클릭하여 페이지 설정을 변경하세요.</p></div>';
        return;
    }

    let html = `<div class="prop-group"><h3>${block.type.toUpperCase()} 설정</h3></div>`;

    // Common Inputs based on type
    if (block.type === 'text') {
        html += createInput('content', '내용 (HTML)', block.content, 'textarea');
        html += createInput('style.fontSize', '글자 크기', block.style?.fontSize || '16px');
        html += createInput('style.color', '글자 색상', block.style?.color || '#000000', 'color');
        html += createInput('style.textAlign', '정렬', block.style?.textAlign || 'left', 'select', ['left', 'center', 'right']);
    } else if (block.type === 'image') {
        html += createInput('content', '이미지 URL', block.content);
    } else if (block.type === 'video') {
        html += createInput('content', '유튜브 Embed URL', block.content);
    } else if (block.type === 'schedule') {
        html += createInput('content.title', '일정 제목', block.content.title);
        html += createInput('content.start', '시작 시간', block.content.start, 'datetime-local');
        html += createInput('content.end', '종료 시간', block.content.end, 'datetime-local');
    }

    elems.propPanel.innerHTML = html;
}

function createInput(key, label, value, type = 'text', options = []) {
    if (type === 'select') {
        const opts = options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('');
        return `
            <div class="prop-group">
                <label>${label}</label>
                <select class="prop-select" onchange="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
                    ${opts}
                </select>
            </div>
        `;
    } else if (type === 'textarea') {
        return `
            <div class="prop-group">
                <label>${label}</label>
                <textarea class="prop-textarea" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">${value}</textarea>
            </div>
        `;
    } else {
        return `
            <div class="prop-group">
                <label>${label}</label>
                <input type="${type}" class="prop-input" value="${value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
            </div>
        `;
    }
}

window.updateBlockProperty = function (id, key, value) {
    const block = state.blocks.find(b => b.id === id);
    if (!block) return;

    // Handle nested keys like 'style.color' or 'content.title'
    const keys = key.split('.');
    if (keys.length === 1) {
        block[keys[0]] = value;
    } else if (keys.length === 2) {
        if (!block[keys[0]]) block[keys[0]] = {};
        block[keys[0]][keys[1]] = value;
    }

    renderBlocks(); // Real-time preview update
};

// --- EVENT LISTENERS ---

function setupEventListeners() {
    // Template Selection
    document.querySelectorAll('.template-card').forEach(btn => {
        btn.onclick = () => {
            const tpl = btn.dataset.template;
            state.blocks = JSON.parse(JSON.stringify(templates[tpl])); // Deep copy
            elems.modal.style.display = 'none';
            renderBlocks();
        };
    });

    // Toolbar
    elems.tools.forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            addBlock(type);
        };
    });

    // Save Flow
    // Save Flow
    elems.btnSave.onclick = () => {
        document.getElementById('save-modal-title').innerText = state.pageId ? '페이지 수정' : '페이지 발행';
        document.getElementById('confirm-save').innerText = state.pageId ? '수정하기' : '발행하기';
        elems.saveModal.classList.remove('hidden');
    };
    elems.btnSaveCancel.onclick = () => elems.saveModal.classList.add('hidden');

    elems.btnSaveConfirm.onclick = async () => {
        const password = document.getElementById('save-password').value;
        if (password.length < 4) {
            alert('비밀번호 4자리를 입력해주세요.');
            return;
        }
        await savePage(password);
    };
}

// --- DATA & API ---

async function savePage(password) {
    if (!APPS_SCRIPT_URL.startsWith('http')) {
        alert('Code.gs를 배포하고 APPS_SCRIPT_URL을 설정해야 합니다.');
        return;
    }

    const payload = {
        action: 'save',
        password: password,
        data: JSON.stringify(state.blocks),
        title: state.pageTitle
    };

    if (state.pageId) {
        payload.id = state.pageId;
    }

    try {
        const btn = elems.btnSaveConfirm;
        const originalText = btn.innerText;
        btn.innerText = '처리 중...';
        btn.disabled = true;

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.status === 'success') {
            state.pageId = json.id;
            let msg = state.pageId ? '작업이 완료되었습니다!' : '발행되었습니다!';
            msg += `\nID: ${json.id}`;
            alert(msg);
            elems.saveModal.classList.add('hidden');

            // Update URL
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('id', json.id);
            window.history.pushState({}, '', newUrl);
        } else {
            alert('오류 발생: ' + json.message);
        }

        btn.innerText = originalText;
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        alert('저장 중 네트워크 오류가 발생했습니다.');
        elems.btnSaveConfirm.disabled = false;
        elems.btnSaveConfirm.innerText = '다시 시도';
    }
}

async function loadPageData(id) {
    if (!APPS_SCRIPT_URL.startsWith('http')) {
        // Mock data for initial testing if no URL
        console.warn('Backend URL not set. Loading mock data.');
        state.blocks = templates.newsletter;
        renderBlocks();
        return;
    }

    try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=get&id=${id}`);
        const json = await res.json();
        if (json.status === 'success') {
            state.blocks = JSON.parse(json.data.data);
            state.pageTitle = json.data.title || '제목 없음';
            state.pageId = json.data.id;
            renderBlocks();
        } else {
            document.getElementById('viewer-content').innerHTML = '<p class="error">페이지를 찾을 수 없습니다.</p>';
        }
    } catch (e) {
        console.error(e);
        document.getElementById('viewer-content').innerHTML = '<p class="error">로딩 주 오류 발생</p>';
    }
}

// Start
init();
