/**
 * Mobile Page Builder Core Logic
 * 
 * Features:
 * - State Management (Blocks, Active Selection, Dashboard)
 * - Rendering Engine (Template Literals)
 * - Property Editing
 * - Drag & Drop / Reordering
 * - Communication with Google Apps Script
 */

// --- CONFIGURATION ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzR81FpUy0Ax-NA5veUQGnAhuaJ6pDhoreQ8P5WqmKGld5LPwI0PTB0mQhtfUIz-XsiQA/exec';

// --- STATE MANAGEMENT ---
const state = {
    mode: 'dashboard', // 'dashboard' | 'editor' | 'viewer'
    pageTitle: '제목 없음',
    pageId: null, // Loaded from URL if viewing
    globalStyle: { backgroundColor: '#ffffff' },
    blocks: [],   // Array of block objects
    activeBlockId: null, // Currently selected block ID
    isDirty: false,
    projectList: [],
    author: '',
    category: 'team', // 'team' | 'personal'
    password: ''
};

// --- DOM ELEMENTS ---
// Will be initialized in init() or accessed dynamically to ensure DOM is ready
let elems = {};

// --- INITIALIZATION ---
function init() {
    // Initialize Elements
    elems = {
        canvas: document.getElementById('canvas'),
        propPanel: document.getElementById('properties-content'),
        tools: document.querySelectorAll('.tool-btn'),
        modal: document.getElementById('template-modal'),
        saveModal: document.getElementById('save-modal'),
        publishModal: document.getElementById('publish-modal'),
        verifyModal: document.getElementById('verify-modal'),
        btnSave: document.getElementById('btn-save'),
        btnPublish: document.getElementById('btn-publish'),
        btnSaveConfirm: document.getElementById('confirm-save'),
        btnSaveCancel: document.getElementById('cancel-save'),
        btnVerifyConfirm: document.getElementById('confirm-verify'),
        btnVerifyCancel: document.getElementById('cancel-verify'),
        viewerApp: document.getElementById('viewer-app'),
        editorApp: document.getElementById('app'),
        dashboardApp: document.getElementById('dashboard-app'),
        projectList: document.getElementById('project-list'),
        btnNewProject: document.getElementById('btn-new-project'),
        btnBackDashboard: document.getElementById('btn-back-dashboard'),
        globalBgColor: document.getElementById('global-bg-color'),
        pageTitleInput: document.getElementById('current-page-title'),
        newProjectModal: document.getElementById('new-project-modal'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    setupEventListeners(); // Setup events for both modes

    if (id) {
        // Viewer Mode
        switchToViewerMode();
        loadPageData(id);
    } else {
        // Dashboard Mode
        switchToDashboardMode();
    }

    // Start Auto Slide
    initAutoSlide();
}

// --- MODE SWITCHING ---
function switchToViewerMode() {
    state.mode = 'viewer';
    elems.editorApp.classList.add('hidden');
    elems.dashboardApp.classList.add('hidden');
    elems.viewerApp.classList.remove('hidden');
    document.body.classList.add('viewer-mode');
}

function switchToEditorMode() {
    state.mode = 'editor';
    elems.dashboardApp.classList.add('hidden');
    elems.viewerApp.classList.add('hidden');
    elems.editorApp.classList.remove('hidden');
    renderBlocks();
}

function switchToDashboardMode() {
    state.mode = 'dashboard';
    elems.editorApp.classList.add('hidden');
    elems.viewerApp.classList.add('hidden');
    elems.dashboardApp.classList.remove('hidden');
    loadDashboard();
}

// --- TEMPLATES ---
const templates = {
    newsletter: [],
    promotion: [],
    invitation: []
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
        style: {}
    };
    state.blocks.push(newBlock);
    renderBlocks();
    selectBlock(newBlock.id);

    // Explicitly scroll to the new block
    setTimeout(() => {
        const el = document.getElementById(newBlock.id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function getDefaultContent(type) {
    switch (type) {
        case 'header': return '제목을 입력하세요';
        case 'text': return '내용을 입력하세요.';
        case 'image': return 'https://via.placeholder.com/400x200';
        case 'slide': return { images: ['https://via.placeholder.com/400x200/eee?text=Slide+1', 'https://via.placeholder.com/400x200/ddd?text=Slide+2'], duration: 3 };
        case 'gallery': return ['https://via.placeholder.com/150', 'https://via.placeholder.com/150', 'https://via.placeholder.com/150', 'https://via.placeholder.com/150'];
        case 'video': return 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        case 'schedule': return { title: '일정 제목', start: '', end: '' };
        case 'list': return [{ label: '항목1', value: '내용1' }, { label: '항목2', value: '내용2' }];
        case 'map': return { title: '장소명', address: '주소 입력', url: '' };
        case 'link': return { text: '버튼 텍스트', url: '#' };
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
    renderBlocks();
    renderProperties();
}

// --- RENDERING ---

function renderBlocks() {
    const container = state.mode === 'viewer' ? document.getElementById('viewer-content') : elems.canvas;

    if (!container) return; // Safeguard

    // Apply global style
    const bg = state.globalStyle?.backgroundColor || '#ffffff';
    container.parentElement.style.backgroundColor = bg;
    container.style.minHeight = '100%';

    container.innerHTML = state.blocks.map((block) => {
        const isActive = block.id === state.activeBlockId ? 'active' : '';
        const controls = state.mode === 'editor' ? `
            <div class="block-controls">
                <button class="control-btn" onclick="moveBlock('${block.id}', 'up')"><i class="fas fa-arrow-up"></i></button>
                <button class="control-btn" onclick="moveBlock('${block.id}', 'down')"><i class="fas fa-arrow-down"></i></button>
                <button class="control-btn btn-delete" onclick="deleteBlock('${block.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : '';

        return `
            <div class="block ${isActive}" id="${block.id}" onclick="selectBlock('${block.id}')" style="${block.type === 'text' || block.type === 'header' ? 'background:transparent;' : ''}">
                ${controls}
                ${renderBlockContent(block)}
            </div>
        `;
    }).join('');
}

function renderBlockContent(block) {
    const s = block.style || {};
    // Unified Style String
    const commonStyle = `
        color:${s.color || 'inherit'}; 
        text-align:${s.textAlign || 'left'}; 
        font-weight:${s.fontWeight || 'normal'}; 
        font-size:${s.fontSize || 'inherit'}; 
        background-color:${s.backgroundColor || 'transparent'};
    `;

    switch (block.type) {
        case 'header':
            return `<h2 style="${commonStyle}; margin:0; padding:10px;">${block.content}</h2>`;

        case 'text':
            return `<div style="${commonStyle}; padding:10px;">${block.content.replace(/\n/g, '<br>')}</div>`;

        case 'image':
            const imgContent = `<div class="block-image"><img src="${block.content}" alt="Image" style="width:100%; display:block;"></div>`;
            if (block.link) {
                return `<a href="${block.link}" target="_blank" style="display:block; text-decoration:none;">${imgContent}</a>`;
            }
            return imgContent;

        case 'slide':
            // Compatibility for old array format
            const images = Array.isArray(block.content) ? block.content : (block.content.images || []);
            const duration = (block.content.duration || 3) * 1000;

            const slides = images.map((src, idx) => `
                <div class="slide-item ${idx === 0 ? 'active' : ''}" style="display:${idx === 0 ? 'block' : 'none'}; transition: opacity 0.5s;">
                    <img src="${src}" style="width:100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px;">
                </div>
            `).join('');

            return `
            <div class="block-slide" data-duration="${duration}" data-current="0" data-total="${images.length}" style="position:relative; width:100%; overflow:hidden;">
                <div class="slide-inner">
                    ${slides.length > 0 ? slides : '<div style="height:200px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#999;">이미지 없음</div>'}
                </div>
                
                ${slides.length > 1 ? `
                    <button class="slide-nav prev" onclick="event.stopPropagation(); manualSlide('${block.id}', -1)" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.3); color:white; border:none; border-radius:50%; width:30px; height:30px;">&lt;</button>
                    <button class="slide-nav next" onclick="event.stopPropagation(); manualSlide('${block.id}', 1)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.3); color:white; border:none; border-radius:50%; width:30px; height:30px;">&gt;</button>
                ` : ''}
            </div>`;

        case 'gallery':
            const imgs = block.content.map(src => `<div class="gallery-item"><img src="${src}"></div>`).join('');
            return `<div class="block-gallery">${imgs}</div>`;

        case 'video':
            return `<div class="block-video"><iframe src="${block.content}" allowfullscreen></iframe></div>`;

        case 'schedule':
            const startStr = block.content.start ? new Date(block.content.start).toLocaleString() : '시작일 미정';
            const endStr = block.content.end ? new Date(block.content.end).toLocaleString() : '종료일 미정';
            return `
                <div class="block-schedule" style="${commonStyle}; padding: 20px; border-left: 4px solid ${s.borderColor || s.color || '#4a90e2'};">
                    <div class="schedule-title" style="font-weight:bold; font-size:1.2em; margin-bottom:5px;">${block.content.title}</div>
                    <div class="schedule-time" style="font-size:0.9em; opacity:0.8;">${startStr} ~ ${endStr}</div>
                </div>`;

        case 'list': // "Business Info"
            const listItems = block.content.map(item => `
                <div class="list-item" style="border-bottom:1px solid ${s.color ? s.color + '40' : '#eee'}; padding:8px 0;">
                    <span class="list-label" style="font-weight:bold;">${item.label}</span>
                    <span class="list-value">${item.value}</span>
                </div>
            `).join('');
            return `<div class="block-list" style="${commonStyle}; padding:20px;">${listItems}</div>`;

        case 'map':
            const { title, address } = block.content;
            const query = encodeURIComponent(address);
            return `
                <div class="block-map" style="${commonStyle}; padding:15px; border-radius:8px; background-color:${s.backgroundColor || '#f8f9fa'};">
                    <div class="map-title" style="font-weight:bold; margin-bottom:5px;">${title}</div>
                    <div class="map-address" style="margin-bottom:10px; font-size:0.9em;">${address}</div>
                    <div class="map-buttons" style="display:flex; justify-content:${s.textAlign || 'center'}; gap:5px;">
                        <a href="https://map.naver.com/v5/search/${query}" target="_blank" class="map-btn naver" style="padding:6px 10px; border-radius:4px; text-decoration:none; color:white; background:#2DB400; font-size:0.8em;">네이버 지도</a>
                        <a href="https://map.kakao.com/link/search/${query}" target="_blank" class="map-btn kakao" style="padding:6px 10px; border-radius:4px; text-decoration:none; color:#3c1e1e; background:#FEE500; font-size:0.8em;">카카오맵</a>
                    </div>
                </div>`;

        case 'link':
            const btnId = `btn-${block.id}`;
            const bg = block.style?.backgroundColor || '#4a90e2';
            const hoverBg = block.style?.hoverBackgroundColor || '#357abd';
            return `
                <div class="block-link" style="text-align:${s.textAlign || 'center'}; padding:10px;">
                    <a href="${block.content.url}" target="_blank" class="neu-btn" id="${btnId}"
                       style="display:inline-block; width:${s.width || '100%'}; color:${block.style?.color || '#ffffff'}; background-color:${bg}; transition: background-color 0.2s; font-size:${s.fontSize || '16px'}; font-weight:${s.fontWeight || 'bold'}; padding:15px; text-decoration:none; border-radius:8px;"
                       onmouseover="this.style.backgroundColor='${hoverBg}'"
                       onmouseout="this.style.backgroundColor='${bg}'">
                        ${block.content.text}
                    </a>
                </div>`;

        case 'divider':
            return `<div class="block-divider"></div>`;
        default:
            return `<div>Unknown Block</div>`;
    }
}

// --- PROPERTIES PANEL ---

function renderProperties() {
    const block = state.blocks.find(b => b.id === state.activeBlockId);
    let html = '';

    if (!block) {
        html = '<div class="empty-state"><p>블록을 선택하여 속성을 편집하세요.</p></div>';
    } else {
        html = `<div class="prop-group"><h3>${getBlockName(block.type)} 설정</h3></div>`;

        if (block.type === 'header' || block.type === 'text') {
            html += createInput('content', '내용', block.content, block.type === 'text' ? 'textarea' : 'text');
            html += renderCommonTextStyleOptions(block);
        }
        else if (block.type === 'image') {
            html += createFileOrUrlInput('content', block.content);
            html += createInput('link', '이동 URL', block.link || '');
        }
        else if (block.type === 'slide') {
            const list = Array.isArray(block.content) ? block.content : (block.content.images || []);
            const dur = block.content.duration || 3;

            html += `<div class="prop-group"><label>슬라이드 전환 간격 (초)</label>
                     <input type="number" step="0.1" min="0.5" max="7.0" class="prop-input" value="${dur}" 
                     onchange="updateSlideDuration('${state.activeBlockId}', this.value)"></div>`;

            html += createMultiImageInput('content.images', list);
        }
        else if (block.type === 'gallery') {
            html += createMultiImageInput('content', block.content);
        }
        else if (block.type === 'video') {
            html += createInput('content', 'YouTube URL', block.content);
        }
        else if (block.type === 'schedule') {
            html += createInput('content.title', '일정 제목', block.content.title);
            html += createInput('content.start', '시작', block.content.start, 'datetime-local');
            html += createInput('content.end', '종료', block.content.end, 'datetime-local');
            html += renderCommonTextStyleOptions(block);
        }
        else if (block.type === 'list') {
            html += `<div class="prop-group">
                <label>사업안내 목록</label>
                <div id="list-items-container">`;

            block.content.forEach((item, idx) => {
                html += `
                    <div class="list-item-editor" style="background:#f8f9fa; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-size:0.8rem; font-weight:bold;">항목 #${idx + 1}</span>
                            <button class="danger-btn" style="width:auto; padding:2px 8px; font-size:0.8rem;" onclick="deleteListItem('${block.id}', ${idx})">삭제</button>
                        </div>
                        <div class="prop-group" style="margin-bottom:10px;">
                            <label style="font-size:0.8rem;">사업명</label>
                            <input type="text" class="prop-input" value="${item.label}" oninput="updateListItem('${block.id}', ${idx}, 'label', this.value)">
                        </div>
                        <div class="prop-group" style="margin-bottom:0;">
                            <label style="font-size:0.8rem;">사업설명</label>
                            <textarea class="prop-textarea" style="min-height:60px;" oninput="updateListItem('${block.id}', ${idx}, 'value', this.value)">${item.value}</textarea>
                        </div>
                    </div>
                `;
            });

            html += `</div>
                <button class="secondary-btn" onclick="addListItem('${block.id}')" style="width:100%; margin-top:5px;"><i class="fas fa-plus"></i> 항목 추가</button>
            </div>`;

            html += renderCommonTextStyleOptions(block);
        }
        else if (block.type === 'map') {
            html += createInput('content.title', '장소명', block.content.title);
            html += createInput('content.address', '주소', block.content.address);
            html += renderCommonTextStyleOptions(block);
        }
        else if (block.type === 'link') {
            html += createInput('content.text', '버튼 텍스트', block.content.text);
            html += createInput('content.url', '이동 URL', block.content.url);
            html += createInput('style.backgroundColor', '버튼 배경색', block.style?.backgroundColor || '#4a90e2', 'color');
            html += createInput('style.hoverBackgroundColor', '호버 배경색', block.style?.hoverBackgroundColor || '#357abd', 'color');
            html += createInput('style.color', '글자 색상', block.style?.color || '#ffffff', 'color');
            html += createInput('style.width', '너비 (예: 100%, 50%)', block.style?.width || '100%');
            html += createInput('style.fontSize', '글자 크기', block.style?.fontSize || '16px');
            html += createInput('style.fontWeight', '굵기', block.style?.fontWeight || 'bold', 'select', ['normal', 'bold']);
        }
    }
    elems.propPanel.innerHTML = html;
}

window.updateListItem = function (id, index, field, value) {
    const block = state.blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.content)) return;
    block.content[index][field] = value;
    renderBlocks();
};

window.addListItem = function (id) {
    const block = state.blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.content)) return;
    block.content.push({ label: '새 사업명', value: '새 사업설명' });
    renderBlocks();
    renderProperties();
};

window.deleteListItem = function (id, index) {
    const block = state.blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.content)) return;
    if (confirm('이 항목을 삭제하시겠습니까?')) {
        block.content.splice(index, 1);
        renderBlocks();
        renderProperties();
    }
};

function renderCommonTextStyleOptions(block) {
    let s = block.style || {};
    let html = '';
    html += createInput('style.fontSize', '글자 크기', s.fontSize || '16px');
    html += createInput('style.color', '글자 색상', s.color || '#000000', 'color');
    html += createInput('style.textAlign', '정렬', s.textAlign || 'left', 'select', ['left', 'center', 'right']);
    html += createInput('style.fontWeight', '굵기', s.fontWeight || 'normal', 'select', ['normal', 'bold']);
    if (block.type !== 'image' && block.type !== 'video') {
        html += createInput('style.backgroundColor', '배경 색상', s.backgroundColor || 'transparent', 'color');
    }
    return html;
}

function getBlockName(type) {
    const map = { header: '헤드(제목)', text: '텍스트', image: '이미지', slide: '슬라이드', gallery: '갤러리', video: '영상', schedule: '일정', map: '지도', link: '링크 버튼', list: '사업안내' };
    return map[type] || type.toUpperCase();
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
    } else if (type === 'color') {
        return `
            <div class="prop-group">
                <label>${label}</label>
                <div style="display:flex; align-items:center;">
                    <input type="color" class="prop-color-picker" value="${value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
                </div>
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

function createFileOrUrlInput(key, value) {
    return `
        <div class="prop-group">
            <label>이미지 소스</label>
            <label class="file-upload-label">
                <i class="fas fa-cloud-upload-alt"></i> 파일 선택
                <input type="file" accept="image/*" style="display:none;" onchange="handleImageUpload(this, '${state.activeBlockId}', '${key}')">
            </label>
            
            ${value ? `
            <div class="image-preview-box" style="margin-top:10px; position:relative; display:inline-block;">
                <img src="${value}" style="max-width:100%; max-height:150px; border-radius:4px; border:1px solid #ddd;">
                <button onclick="updateBlockProperty('${state.activeBlockId}', '${key}', '')" style="position:absolute; top:5px; right:5px; background:rgba(255,0,0,0.8); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-trash" style="font-size:12px;"></i>
                </button>
            </div>
            ` : ''}
            
            <input type="text" class="prop-input" style="margin-top:5px;" placeholder="또는 이미지 URL 입력" value="${value.startsWith('data:') ? '' : value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
        </div>
    `;
}

function createMultiImageInput(key, values) {
    let html = `<div style="margin-bottom:10px;">`;
    values.forEach((v, idx) => {
        html += `
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <img src="${v}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #ddd;">
                <input type="text" class="prop-input" value="${v.startsWith('data:') ? '(Base64 Image)' : v}" disabled style="font-size:10px; flex:1;">
                <button onclick="removeArrayItem('${state.activeBlockId}', '${key}', ${idx})" class="danger-btn" style="width:auto; padding:5px 10px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    html += `</div>`;

    html += `
        <label class="file-upload-label">
            <i class="fas fa-plus"></i> 이미지 추가(파일)
            <input type="file" accept="image/*" style="display:none;" onchange="handleImageUpload(this, '${state.activeBlockId}', '${key}', true)">
        </label>
        <div style="margin-top:5px;">
            <button class="secondary-btn" style="padding:5px 10px; font-size:12px;" onclick="addUrlImagePrompt('${state.activeBlockId}', '${key}')">+ URL로 이미지 추가</button>
        </div>
    `;
    return html;
}

window.addUrlImagePrompt = function (id, key) {
    const url = prompt("이미지 URL을 입력하세요:");
    if (url) {
        const block = state.blocks.find(b => b.id === id);
        if (!block) return;

        // Handle nested property access for slides (content.images)
        if (key.includes('.')) {
            const keys = key.split('.');
            if (!block[keys[0]]) block[keys[0]] = {};
            if (!Array.isArray(block[keys[0]][keys[1]])) block[keys[0]][keys[1]] = [];
            block[keys[0]][keys[1]].push(url);
        } else {
            if (Array.isArray(block[key])) {
                block[key].push(url);
            }
        }
        renderBlocks();
        renderProperties();
    }
}

window.updateSlideDuration = function (id, val) {
    const block = state.blocks.find(b => b.id === id);
    if (!block) return;
    if (typeof block.content !== 'object') {
        // Convert old string/array content to object if needed
        block.content = { images: Array.isArray(block.content) ? block.content : [], duration: 3 };
    }
    block.content.duration = parseFloat(val);
    renderBlocks(); // Re-render to update data-duration
}

// AUTO SLIDE LOGIC
function initAutoSlide() {
    setInterval(() => {
        // Stop auto-slide if we are NOT in viewer mode (i.e. we are in editor/dashboard)
        if (state.mode !== 'viewer') return;

        const slideBlocks = document.querySelectorAll('.block-slide');
        slideBlocks.forEach(el => {
            const duration = parseInt(el.dataset.duration) || 3000;
            let lastTime = parseInt(el.dataset.lastTime) || 0;
            const now = Date.now();

            if (now - lastTime > duration) {
                const total = parseInt(el.dataset.total) || 0;
                if (total <= 1) return;

                let current = parseInt(el.dataset.current) || 0;
                const next = (current + 1) % total;

                changeSlide(el, next);
                el.dataset.lastTime = now;
            }
        });
    }, 100);
}

function changeSlide(el, index) {
    const items = el.querySelectorAll('.slide-item');
    items.forEach((item, idx) => {
        if (idx === index) {
            item.style.display = 'block';
            // Trigger reflow for transition if needed
            setTimeout(() => item.style.opacity = '1', 10);
        } else {
            item.style.opacity = '0';
            setTimeout(() => item.style.display = 'none', 500);
        }
    });
    el.dataset.current = index;
}

window.manualSlide = function (blockId, dir) {
    const el = document.getElementById(blockId).querySelector('.block-slide');
    if (!el) return;

    let current = parseInt(el.dataset.current) || 0;
    const total = parseInt(el.dataset.total) || 0;
    if (total <= 1) return;

    let next = current + dir;
    if (next >= total) next = 0;
    if (next < 0) next = total - 1;

    changeSlide(el, next);
    el.dataset.lastTime = Date.now(); // Reset timer
}

// --- LOGIC HANDLING ---

window.updateBlockProperty = function (id, key, value) {
    const block = state.blocks.find(b => b.id === id);
    if (!block) return;

    const keys = key.split('.');
    if (keys.length === 1) {
        block[keys[0]] = value;
    } else if (keys.length === 2) {
        if (!block[keys[0]]) block[keys[0]] = {};
        block[keys[0]][keys[1]] = value;
    }
    renderBlocks();
};

window.removeArrayItem = function (id, key, index) {
    const block = state.blocks.find(b => b.id === id);
    if (!block) return;

    // Handle nested arrays (e.g. content.images)
    if (key.includes('.')) {
        const keys = key.split('.');
        if (block[keys[0]] && Array.isArray(block[keys[0]][keys[1]])) {
            block[keys[0]][keys[1]].splice(index, 1);
        }
    } else if (Array.isArray(block[key])) {
        block[key].splice(index, 1);
    }
    renderBlocks();
    renderProperties();
}

// IMAGE RESIZE UTILS
function compressImage(file, maxSizeMB, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const MAX_DIM = 2000;
            let width = img.width;
            let height = img.height;

            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                } else {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            while (dataUrl.length > maxSizeMB * 1024 * 1024 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            callback(dataUrl);
        }
    }
}

window.handleImageUpload = function (input, blockId, key, isArray = false) {
    const file = input.files[0];
    if (!file) return;

    compressImage(file, 0.5, (result) => {
        if (isArray) {
            const block = state.blocks.find(b => b.id === blockId);
            if (!block) return;

            let targetArray;
            if (key.includes('.')) {
                // e.g. 'content.images'
                const keys = key.split('.');
                if (!block[keys[0]]) block[keys[0]] = {};
                // Ensure the nested property is an array
                if (!Array.isArray(block[keys[0]][keys[1]])) block[keys[0]][keys[1]] = [];
                targetArray = block[keys[0]][keys[1]];
            } else {
                // e.g. 'content' (for gallery)
                if (!Array.isArray(block[key])) block[key] = [];
                targetArray = block[key];
            }

            if (targetArray) {
                targetArray.push(result);
                renderBlocks();
                renderProperties();
            }
        } else {
            updateBlockProperty(blockId, key, result);
            renderProperties();
            renderBlocks(); // Refresh block
        }
    });
};

function getNestedProperty(obj, keyPath) {
    return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}


// --- EVENT LISTENERS ---

function setupEventListeners() {
    // New Project Modal Logic
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.onclick = () => {
            btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    });

    const typeBtns = document.querySelectorAll('.type-card');
    typeBtns.forEach(btn => {
        btn.onclick = () => {
            typeBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }
    });

    // Filtering Tabs
    elems.tabBtns.forEach(btn => {
        btn.onclick = (e) => {
            elems.tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterProjects(e.target.innerText);
        };
    });

    document.getElementById('btn-create-project').onclick = () => {
        const title = document.getElementById('np-title').value;
        const pwd = document.getElementById('np-password').value;
        const author = document.getElementById('np-author').value;

        if (!title) return alert('제목을 입력해주세요.');
        if (pwd.length < 4) return alert('비밀번호 4자리를 입력해주세요.');
        if (!author) return alert('작성자용을 입력해주세요.');

        const type = document.querySelector('.type-card.selected').dataset.type;
        const category = document.querySelector('.toggle-btn.active').dataset.value;

        state.pageTitle = title;
        state.pageId = null;
        state.password = pwd;
        state.author = author;
        state.category = category;
        state.globalStyle = { backgroundColor: '#C0D8C8' };

        state.blocks = JSON.parse(JSON.stringify(templates[type]));

        elems.newProjectModal.classList.add('hidden');
        elems.globalBgColor.value = '#C0D8C8';
        elems.pageTitleInput.innerText = title;

        renderBlocks();
    };

    document.getElementById('btn-close-new-project').onclick = () => {
        elems.newProjectModal.classList.add('hidden');
    }

    // Toolbar (Drag & Drop + Click)
    elems.tools.forEach(btn => {
        btn.onclick = () => {
            addBlock(btn.dataset.type);
        };

        btn.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', btn.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        };
    });

    const canvasArea = document.querySelector('.device-screen');
    if (canvasArea) {
        canvasArea.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasArea.parentElement.style.boxShadow = '0 0 15px rgba(74, 144, 226, 0.5)';
        };

        canvasArea.ondragleave = (e) => {
            canvasArea.parentElement.style.boxShadow = '';
        };

        canvasArea.ondrop = (e) => {
            e.preventDefault();
            canvasArea.parentElement.style.boxShadow = '';
            const type = e.dataTransfer.getData('text/plain');
            if (type) {
                addBlock(type);
            }
        };
    }

    // Global Settings
    elems.globalBgColor.oninput = (e) => {
        state.globalStyle.backgroundColor = e.target.value;
        renderBlocks();
    };
    elems.pageTitleInput.oninput = (e) => {
        state.pageTitle = e.target.innerText;
    };

    // Dashboard navigation
    elems.btnNewProject.onclick = () => {
        document.getElementById('np-title').value = '';
        document.getElementById('np-password').value = '';
        document.getElementById('np-author').value = '';
        switchToEditorMode();
        elems.newProjectModal.classList.remove('hidden');
        elems.newProjectModal.style.display = 'flex';
    };
    elems.btnBackDashboard.onclick = () => {
        if (confirm('저장하지 않은 내용은 사라집니다. 대시보드로 돌아가시겠습니까?')) {
            switchToDashboardMode();
        }
    };

    // Save & Publish
    elems.btnSave.onclick = () => openSaveModal(false);

    elems.btnPublish.onclick = async () => {
        // Feature: Auto-sets password for new projects if missing (Streamlined Publish)
        if (!state.pageId && !state.password) {
            state.password = "1234"; // Default password to avoid prompt
        }

        if (state.password) {
            state.isPublishAction = true;
            // Feature: Auto-save on publish
            await savePage(state.password);
        } else {
            // Only for existing pages where password is unknown
            openSaveModal(true);
        }
    };

    elems.btnSaveCancel.onclick = () => elems.saveModal.classList.add('hidden');

    elems.btnSaveConfirm.onclick = async () => {
        const password = document.getElementById('save-password').value;
        if (password.length < 4) {
            alert('비밀번호 4자리를 입력해주세요.');
            return;
        }
        state.password = password;
        await savePage(password);
    };

    // Verify Modal Listeners
    elems.btnVerifyCancel.onclick = () => {
        elems.verifyModal.classList.add('hidden');
        state.pendingEditId = null;
    };

    elems.btnVerifyConfirm.onclick = async () => {
        const password = document.getElementById('verify-password').value;
        if (!password) {
            alert('비밀번호를 입력해주세요.');
            return;
        }
        await verifyAndLoad(state.pendingEditId, password);
    };
}

function openSaveModal(isPublish) {
    state.isPublishAction = isPublish;
    document.getElementById('save-modal-title').innerText = state.pageId ? '페이지 수정 확인' : '페이지 저장/발행';
    if (!state.pageId && state.password) {
        document.getElementById('save-password').value = state.password;
    } else {
        document.getElementById('save-password').value = '';
    }
    elems.saveModal.classList.remove('hidden');
}


// --- DATA & API ---

async function loadDashboard() {
    if (!APPS_SCRIPT_URL.startsWith('http')) {
        elems.projectList.innerHTML = '<p>Backend URL not configured.</p>';
        return;
    }

    elems.projectList.innerHTML = '<div class="loading-spinner">Loading...</div>';

    try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=list`);
        const json = await res.json();

        if (json.status === 'success') {
            state.projectList = json.data;
            filterProjects('전체');
        } else {
            alert('로드 실패: ' + json.message);
        }
    } catch (e) {
        console.error(e);
        elems.projectList.innerHTML = '<p>연결 오류</p>';
    }
}

function filterProjects(categoryLabel) {
    let filtered = [];
    if (!state.projectList) return;

    if (categoryLabel === '전체') {
        filtered = state.projectList;
    } else if (categoryLabel === '개인') {
        filtered = state.projectList.filter(p => p.category === 'personal');
    } else if (categoryLabel === '팀') {
        filtered = state.projectList.filter(p => p.category === 'team');
    }

    renderProjectList(filtered);
}

function renderProjectList(list) {
    if (!list || list.length === 0) {
        elems.projectList.innerHTML = '<p style="grid-column:1/-1; text-align:center;">조건에 맞는 프로젝트가 없습니다.</p>';
        return;
    }

    elems.projectList.innerHTML = list.map(item => {
        const catBadge = item.category === 'team' ? '<span class="badge team">팀</span>' : '<span class="badge personal">개인</span>';

        return `
        <div class="project-card" onclick="loadProjectForEdit('${item.id}')">
            <button class="delete-btn-card" onclick="event.stopPropagation(); deleteProject('${item.id}');">
                <i class="fas fa-trash"></i>
            </button>
            <div class="card-preview">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="card-info">
                ${catBadge}
                <span class="card-date">${new Date(item.createdAt).toLocaleDateString()}</span>
                <h3>${item.title}</h3>
                <p>${item.author || '작자미상'}</p>
                <div class="card-actions">
                     <button class="text-btn" onclick="event.stopPropagation(); loadProjectForEdit('${item.id}')">편집</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.loadProjectForEdit = async function (id) {
    console.log('loadProjectForEdit called with ID:', id);

    // Open Verify Modal instead of prompt
    state.pendingEditId = id;

    // Safety check if elems wasn't init properly
    const modal = document.getElementById('verify-modal');
    if (!modal) {
        alert('Error: Verify Modal element not found in DOM');
        console.error('Verify Modal not found');
        return;
    }
    elems.verifyModal = modal;

    const pwdInput = document.getElementById('verify-password');
    if (pwdInput) pwdInput.value = '';

    elems.verifyModal.classList.remove('hidden');
    elems.verifyModal.style.display = 'flex'; // Force display just in case
};

async function verifyAndLoad(id, password) {
    try {
        const verifyRes = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'verify', id: id, password: password })
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.status !== 'success') {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        // Hide modal on success
        elems.verifyModal.classList.add('hidden');

        const res = await fetch(`${APPS_SCRIPT_URL}?action=get&id=${id}`);
        const json = await res.json();
        if (json.status === 'success') {
            const data = JSON.parse(json.data.data);
            state.blocks = data.blocks || [];
            state.globalStyle = data.globalStyle || { backgroundColor: '#ffffff' };
            state.pageTitle = json.data.title;
            state.author = json.data.author;
            state.category = json.data.category;
            state.pageId = json.data.id;
            state.password = password;

            elems.pageTitleInput.innerText = state.pageTitle;
            elems.globalBgColor.value = state.globalStyle.backgroundColor || '#ffffff';

            switchToEditorMode();
            renderBlocks();
        }
    } catch (e) {
        alert('로드 실패, 네트워크 오류');
        console.error(e);
    }
}

async function deleteProject(id) {
    const pwd = prompt('삭제하려면 프로젝트 비밀번호를 입력하세요:');
    if (!pwd) return;

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: id, password: pwd })
        });
        const json = await res.json();
        if (json.status === 'success') {
            alert('삭제되었습니다.');
            loadDashboard();
        } else {
            alert('삭제 실패: ' + json.message);
        }
    } catch (e) {
        alert('오류 발생');
    }
}

// IMAGE RESIZE UTILS
function compressImage(file, maxSizeMB, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Aggressive resizing for Google Sheets (50k char limit)
            // 30KB image ~= 40k base64 chars
            let width = img.width;
            let height = img.height;
            const MAX_DIM = 800; // Reduced from 2000

            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                } else {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.7;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            // Loop to reduce size
            while (dataUrl.length > maxSizeMB * 1024 * 1024 * 1.33 && quality > 0.3) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            // If still too big, scale down forcefully
            if (dataUrl.length > 48000) { // Safety margin for 50k limit
                const scale = Math.sqrt(48000 / dataUrl.length);
                canvas.width *= scale;
                canvas.height *= scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            }

            callback(dataUrl);
        }
    }
}

window.handleImageUpload = function (input, blockId, key, isArray = false) {
    const file = input.files[0];
    if (!file) return;

    // Use 0.03 MB (approx 30KB) limit to fit in one spreadsheet cell
    compressImage(file, 0.03, (result) => {
        if (isArray) {
            const block = state.blocks.find(b => b.id === blockId);
            if (!block) return;

            let targetArray;
            if (key.includes('.')) {
                // e.g. 'content.images'
                const keys = key.split('.');
                if (!block[keys[0]]) block[keys[0]] = {};
                if (!Array.isArray(block[keys[0]][keys[1]])) block[keys[0]][keys[1]] = [];
                targetArray = block[keys[0]][keys[1]];
            } else {
                if (!Array.isArray(block[key])) block[key] = [];
                targetArray = block[key];
            }

            if (targetArray) {
                targetArray.push(result);
                renderBlocks();
                renderProperties();
            }
        } else {
            updateBlockProperty(blockId, key, result);
            renderProperties();
            renderBlocks();
        }
    });
};

/* ... existing logic ... */

async function savePage(password) {
    const dataString = JSON.stringify({
        blocks: state.blocks,
        globalStyle: state.globalStyle
    });

    // Code Optimization: Validation against Database Constraints
    if (dataString.length > 48000) {
        alert(`데이터 용량이 너무 큽니다 (${dataString.length} / 48000 자).\n이미지를 줄이거나 텍스트를 줄여주세요.`);
        elems.btnSaveConfirm.disabled = false;
        elems.btnSaveConfirm.innerText = '확인';
        return;
    }

    const payload = {
        action: 'save',
        password: password,
        data: dataString,
        title: state.pageTitle,
        author: state.author,
        category: state.category
    };

    if (state.pageId) payload.id = state.pageId;

    try {
        elems.btnSaveConfirm.disabled = true;
        elems.btnSaveConfirm.innerText = '저장 중...';

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status}`);
        }

        const json = await res.json();

        if (json.status === 'success') {
            state.pageId = json.id;
            alert('저장되었습니다.');
            elems.saveModal.classList.add('hidden');

            if (state.isPublishAction) {
                showPublishResult(json.id);
            }
        } else {
            alert('오류: ' + json.message);
        }
    } catch (e) {
        console.error("Save failed:", e);
        if (e.name === 'SyntaxError') {
            alert('저장 서버 응답 오류입니다 (데이터 큼/권한 부족 가능성). 관리자 문의.');
        } else {
            alert('저장 중 오류가 발생했습니다: ' + e.message);
        }
    } finally {
        elems.btnSaveConfirm.disabled = false;
        elems.btnSaveConfirm.innerText = '확인';
    }
}
if (!APPS_SCRIPT_URL.startsWith('http')) {
    state.blocks = templates.newsletter;
    renderBlocks();
    return;
}
try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=get&id=${id}`);
    const json = await res.json();
    if (json.status === 'success') {
        const data = JSON.parse(json.data.data);
        state.blocks = data.blocks || [];
        state.globalStyle = data.globalStyle || { backgroundColor: '#ffffff' };
        state.pageTitle = json.data.title;
        renderBlocks();
    } else {
        document.getElementById('viewer-content').innerHTML = '<p>페이지를 찾을 수 없습니다.</p>';
    }
} catch (e) {
    document.getElementById('viewer-content').innerHTML = '<p>로딩 오류</p>';
}
}

function showPublishResult(id) {
    const url = `${APPS_SCRIPT_URL}?id=${id}`;

    document.getElementById('share-url').value = url;

    // Simple QR Code generation URL
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
    document.getElementById('qr-code-img').innerHTML = `<img src="${qrUrl}" alt="QR Code">`;

    elems.publishModal.classList.remove('hidden');
}

function copyUrl() {
    const copyText = document.getElementById("share-url");
    copyText.select();
    document.execCommand("copy");
    alert("URL이 복사되었습니다.");
}

function downloadQR() {
    const img = document.querySelector('#qr-code-img img');
    if (img) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'qrcode.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// IMPORTANT: Entry point to start the application
document.addEventListener('DOMContentLoaded', init);
