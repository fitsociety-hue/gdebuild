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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2ZGd1l3vXsAjs2rFCaad9GodQUHPSSQhNNlCOPkuIsEk6UNvwkA9bZklHKbzegKUlCA/exec';

// --- STATE MANAGEMENT ---
const state = {
    mode: 'dashboard', // 'dashboard' | 'editor' | 'viewer'
    pageTitle: '제목 없음',
    pageId: null, // Loaded from URL if viewing
    globalStyle: { backgroundColor: '#ffffff' },
    blocks: [],   // Array of block objects
    activeBlockId: null, // Currently selected block ID
    isDirty: false,
    projectList: []
};

// --- DOM ELEMENTS ---
const elems = {
    canvas: document.getElementById('canvas'),
    propPanel: document.getElementById('properties-content'),
    tools: document.querySelectorAll('.tool-btn'),
    modal: document.getElementById('template-modal'),
    saveModal: document.getElementById('save-modal'),
    publishModal: document.getElementById('publish-modal'),
    btnSave: document.getElementById('btn-save'),
    btnPublish: document.getElementById('btn-publish'),
    btnSaveConfirm: document.getElementById('confirm-save'),
    btnSaveCancel: document.getElementById('cancel-save'),
    viewerApp: document.getElementById('viewer-app'),
    editorApp: document.getElementById('app'),
    dashboardApp: document.getElementById('dashboard-app'),
    projectList: document.getElementById('project-list'),
    btnNewProject: document.getElementById('btn-new-project'),
    btnBackDashboard: document.getElementById('btn-back-dashboard'),
    globalBgColor: document.getElementById('global-bg-color'),
    pageTitleInput: document.getElementById('current-page-title'),
    newProjectModal: document.getElementById('new-project-modal')
};

// --- INITIALIZATION ---
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        // Viewer Mode
        // state.mode = 'viewer'; // Handled in loadPageData
        switchToViewerMode();
        loadPageData(id);
    } else {
        // Dashboard Mode
        switchToDashboardMode();
    }
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
    newsletter: [
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x200?text=Header+Image' },
        { id: generateUUID(), type: 'header', content: '이번 주 소식', style: { color: '#333' } },
        { id: generateUUID(), type: 'text', content: '안녕하세요! 복지관의 새로운 소식을 전해드립니다.', style: { textAlign: 'left' } }
    ],
    promotion: [
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x500?text=Event+Poster' },
        { id: generateUUID(), type: 'header', content: '가을 축제 초대', style: { textAlign: 'center', fontSize: '24px' } },
        { id: generateUUID(), type: 'text', content: '일시: 10월 25일(금) 14:00', style: { textAlign: 'center', backgroundColor: '#f9f9f9', padding: '10px' } },
        { id: generateUUID(), type: 'schedule', content: { start: '2025-10-25T14:00', end: '2025-10-25T16:00', title: '본행사' } },
        { id: generateUUID(), type: 'map', content: { title: '행사장', address: '서울시 행복구 복지로 123' } }
    ],
    invitation: [
        { id: generateUUID(), type: 'header', content: 'INVITATION', style: { textAlign: 'center', color: '#ff6b6b' } },
        { id: generateUUID(), type: 'text', content: '<h1>초 대 합 니 다</h1>', style: { textAlign: 'center' } },
        { id: generateUUID(), type: 'image', content: 'https://via.placeholder.com/400x300?text=Map' },
        { id: generateUUID(), type: 'link', content: { text: '참석 여부 알리기', url: 'https://forms.google.com' }, style: { backgroundColor: '#ff6b6b' } }
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
        style: {}
    };
    state.blocks.push(newBlock);
    renderBlocks();
    selectBlock(newBlock.id);
    // Scroll to bottom
    setTimeout(() => {
        const el = document.getElementById(newBlock.id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function getDefaultContent(type) {
    switch (type) {
        case 'header': return '제목을 입력하세요';
        case 'text': return '내용을 입력하세요.';
        case 'image': return 'https://via.placeholder.com/400x200';
        case 'slide': return ['https://via.placeholder.com/400x200/eee?text=Slide+1', 'https://via.placeholder.com/400x200/ddd?text=Slide+2'];
        case 'gallery': return ['https://via.placeholder.com/150', 'https://via.placeholder.com/150', 'https://via.placeholder.com/150', 'https://via.placeholder.com/150'];
        case 'video': return 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        case 'schedule': return { title: '일정 제목', start: '', end: '' };
        case 'list': return [{ label: '항목1', value: '내용1' }, { label: '항목2', value: '내용2' }];
        case 'map': return { title: '장소명', address: '주소 입력' };
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
    renderBlocks(); // Re-render to show active state
    renderProperties();
}

// --- RENDERING ---

function renderBlocks() {
    const container = state.mode === 'viewer' ? document.getElementById('viewer-content') : elems.canvas;

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
    const commonStyle = `color:${s.color || 'inherit'}; text-align:${s.textAlign || 'left'}; font-weight:${s.fontWeight || 'normal'}; font-size:${s.fontSize || 'inherit'}; padding:${s.padding || '0'}; background-color:${s.backgroundColor || 'transparent'};`;

    switch (block.type) {
        case 'header':
            return `<h2 style="${commonStyle}">${block.content}</h2>`;
        case 'text':
            return `<div style="${commonStyle}">${block.content}</div>`;
        case 'image':
            return `<div class="block-image"><img src="${block.content}" alt="Image" style="width:100%; display:block;"></div>`;
        case 'slide':
            const slides = block.content.map(src => `<div class="slide-item"><img src="${src}"></div>`).join('');
            return `<div class="block-slide"><div class="slide-container">${slides}</div></div>`;
        case 'gallery':
            const imgs = block.content.map(src => `<div class="gallery-item"><img src="${src}"></div>`).join('');
            return `<div class="block-gallery">${imgs}</div>`;
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
        case 'map':
            const { title, address } = block.content;
            const query = encodeURIComponent(address);
            return `
                <div class="block-map">
                    <div class="map-title">${title}</div>
                    <div class="map-address">${address}</div>
                    <div class="map-buttons">
                        <a href="https://map.naver.com/v5/search/${query}" target="_blank" class="map-btn naver">네이버 지도</a>
                        <a href="https://map.kakao.com/link/search/${query}" target="_blank" class="map-btn kakao">카카오맵</a>
                    </div>
                </div>`;
            <div class="block-link">
                <a href="${block.content.url}" target="_blank" class="neu-btn" style="color:${block.style?.color || '#333'}; background-color:${block.style?.backgroundColor || '#ffffff'}">
                    ${block.content.text}
                </a>
            </div>`;
        case 'divider':
            return `< div class="block-divider" ></div > `;
        default:
            return `< div > Unknown Block</div > `;
    }
}

// --- PROPERTIES PANEL ---

function renderProperties() {
    const block = state.blocks.find(b => b.id === state.activeBlockId);
    let html = '';

    if (!block) {
        html = '<div class="empty-state"><p>블록을 선택하여 속성을 편집하세요.</p></div>';
    } else {
        html = `< div class="prop-group" > <h3>${getBlockName(block.type)} 설정</h3></div > `;

        // Common Text Styles
        if (['text', 'header'].includes(block.type)) {
            html += createInput('content', '내용', block.content, block.type === 'text' ? 'textarea' : 'text');
            html += createInput('style.fontSize', '글자 크기', block.style?.fontSize || '16px');
            html += createInput('style.color', '글자 색상', block.style?.color || '#000000', 'color');
            html += createInput('style.backgroundColor', '배경 색상', block.style?.backgroundColor || 'transparent', 'color');
            html += createInput('style.textAlign', '정렬', block.style?.textAlign || 'left', 'select', ['left', 'center', 'right']);
            html += createInput('style.fontWeight', '굵기', block.style?.fontWeight || 'normal', 'select', ['normal', 'bold']);
        }
        else if (block.type === 'image') {
            html += createFileOrUrlInput('content', block.content);
        }
        else if (block.type === 'slide' || block.type === 'gallery') {
            html += `< div class="prop-group" ><label>이미지 관리</label><p style="font-size:12px; color:#666;">이미지를 추가하려면 아래 버튼을 사용하세요.</p></div > `;
            html += createMultiImageInput('content', block.content);
        }
        else if (block.type === 'video') {
            html += createInput('content', '유튜브 Embed URL', block.content);
        }
        else if (block.type === 'schedule') {
            html += createInput('content.title', '일정 제목', block.content.title);
            html += createInput('content.start', '시작 시간', block.content.start, 'datetime-local');
            html += createInput('content.end', '종료 시간', block.content.end, 'datetime-local');
        }
        else if (block.type === 'map') {
            html += createInput('content.title', '장소명', block.content.title);
            html += createInput('content.address', '주소', block.content.address);
        }
        else if (block.type === 'link') {
            html += createInput('content.text', '버튼 텍스트', block.content.text);
            html += createInput('content.url', '이동 URL', block.content.url);
            html += createInput('style.backgroundColor', '버튼 색상', block.style?.backgroundColor || '#4a90e2', 'color');
        }
    }
    elems.propPanel.innerHTML = html;
}

function getBlockName(type) {
    const map = { header: '헤드', text: '텍스트', image: '이미지', slide: '슬라이드', gallery: '갤러리', video: '영상', schedule: '일정', map: '지도', link: '링크', divider: '구분선' };
    return map[type] || type.toUpperCase();
}

function createInput(key, label, value, type = 'text', options = []) {
    if (type === 'select') {
        const opts = options.map(o => `< option value = "${o}" ${ value === o ? 'selected' : '' }> ${ o }</option > `).join('');
        return `
                < div class="prop-group" >
                <label>${label}</label>
                <select class="prop-select" onchange="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
                    ${opts}
                </select>
            </div >
                `;
    } else if (type === 'textarea') {
        // Basic HTML stripping/handling could go here if needed, but for now simple textarea
        return `
                < div class="prop-group" >
                <label>${label}</label>
                <textarea class="prop-textarea" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">${value}</textarea>
            </div >
                `;
    } else if (type === 'color') {
        return `
                < div class="prop-group" >
                <label>${label}</label>
                <div style="display:flex; align-items:center;">
                    <input type="color" class="prop-color-picker" value="${value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
                </div>
            </div >
                `
    } else {
        return `
                < div class="prop-group" >
                <label>${label}</label>
                <input type="${type}" class="prop-input" value="${value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
            </div>
            `;
    }
}

function createFileOrUrlInput(key, value) {
    return `
                < div class="prop-group" >
            <label>이미지 소스</label>
            <label class="file-upload-label">
                <i class="fas fa-cloud-upload-alt"></i> 파일 선택
                <input type="file" accept="image/*" style="display:none;" onchange="handleImageUpload(this, '${state.activeBlockId}', '${key}')">
            </label>
            <input type="text" class="prop-input" placeholder="또는 이미지 URL 입력" value="${value.startsWith('data:') ? '' : value}" oninput="updateBlockProperty('${state.activeBlockId}', '${key}', this.value)">
        </div>
            `;
}

function createMultiImageInput(key, values) {
    // Simplified for MVP: Just add button and list current URLs
    let html = `< div style = "margin-bottom:10px;" > `;
    values.forEach((v, idx) => {
        html += `
                < div style = "display:flex; gap:5px; margin-bottom:5px;" >
                    <img src="${v}" style="width:30px; height:30px; object-fit:cover;">
                        <input type="text" class="prop-input" value="${v.startsWith('data:') ? '(Base64 Image)' : v}" disabled style="font-size:10px;">
                            <button onclick="removeArrayItem('${state.activeBlockId}', '${key}', ${idx})" style="padding:5px;">&times;</button>
                        </div>
                        `;
    });
                        html += `</div>`;

    html += `
                            < label class="file-upload-label" >
                                <i class="fas fa-plus"></i> 이미지 추가(파일)
                                    < input type = "file" accept = "image/*" style = "display:none;" onchange = "handleImageUpload(this, '${state.activeBlockId}', '${key}', true)" >
        </label >
                `;
    return html;
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
    if (Array.isArray(block.content)) {
        block.content.splice(index, 1);
        renderBlocks();
        renderProperties();
    }
}

window.handleImageUpload = function (input, blockId, key, isArray = false) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit check
        alert('이미지 파일 크기는 1MB 이하여야 합니다.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const result = e.target.result;
        if (isArray) {
            const block = state.blocks.find(b => b.id === blockId);
            if (block && Array.isArray(block.content)) {
                block.content.push(result);
                renderBlocks();
                renderProperties();
            }
        } else {
            updateBlockProperty(blockId, key, result);
            // Refresh prop panel to show base64 handled
            renderProperties();
        }
    };
    reader.readAsDataURL(file);
};


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

    document.getElementById('btn-create-project').onclick = () => {
        const title = document.getElementById('np-title').value;
        const pwd = document.getElementById('np-password').value;
        const author = document.getElementById('np-author').value;
        
        if (!title) return alert('제목을 입력해주세요.');
        if (pwd.length < 4) return alert('비밀번호 4자리를 입력해주세요.');
        if (!author) return alert('작성자용을 입력해주세요.');

        const type = document.querySelector('.type-card.selected').dataset.type;
        const category = document.querySelector('.toggle-btn.active').dataset.value;

        // Set State
        state.pageTitle = title;
        state.pageId = null; // New project
        state.password = pwd; // Store for first save (optional, or just pass to save)
        state.author = author;
        state.category = category;
        state.globalStyle = { backgroundColor: '#C0D8C8' }; // Default Neuromorphic BG
        
        // Load Template
        state.blocks = JSON.parse(JSON.stringify(templates[type]));
        
        elems.newProjectModal.classList.add('hidden');
        elems.globalBgColor.value = '#C0D8C8';
        elems.pageTitleInput.innerText = title;

        renderBlocks();
    };

    document.getElementById('btn-close-new-project').onclick = () => {
        elems.newProjectModal.classList.add('hidden');
    }

    // Toolbar
    elems.tools.forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            addBlock(type);
        };
    });

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
        // Reset inputs
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
    elems.btnPublish.onclick = () => openSaveModal(true); // Publish acts like save but opens QR modal after

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

function openSaveModal(isPublish) {
    state.isPublishAction = isPublish;
    document.getElementById('save-modal-title').innerText = state.pageId ? '페이지 수정 확인' : '페이지 저장/발행';
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
        const res = await fetch(`${ APPS_SCRIPT_URL }?action = list`);
        const json = await res.json();

        if (json.status === 'success') {
            state.projectList = json.data;
            renderProjectList(json.data);
        } else {
            alert('로드 실패: ' + json.message);
        }
    } catch (e) {
        console.error(e);
        elems.projectList.innerHTML = '<p>연결 오류</p>';
    }
}

function renderProjectList(list) {
    if (list.length === 0) {
        elems.projectList.innerHTML = '<p style="grid-column:1/-1; text-align:center;">생성된 프로젝트가 없습니다.</p>';
        return;
    }

    elems.projectList.innerHTML = list.map(item => `
                < div class="project-card" onclick = "loadProjectForEdit('${item.id}')" >
            <button class="delete-btn-card" onclick="event.stopPropagation(); deleteProject('${item.id}');">
                <i class="fas fa-trash"></i>
            </button>
            <div class="card-icon"><i class="fas fa-file-alt"></i></div>
            <div class="card-info">
                <h3>${item.title}</h3>
                <p>${new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
        </div >
                `).join('');
}

async function loadProjectForEdit(id) {
    // Fetch full data
    try {
        const res = await fetch(`${ APPS_SCRIPT_URL }?action = get & id=${ id } `);
        const json = await res.json();
        if (json.status === 'success') {
            const data = JSON.parse(json.data.data);
            state.blocks = data.blocks || [];
            state.globalStyle = data.globalStyle || { backgroundColor: '#ffffff' };
            state.pageTitle = json.data.title;
            state.pageId = json.data.id;

            // Sync UI
            elems.pageTitleInput.innerText = state.pageTitle;
            elems.globalBgColor.value = state.globalStyle.backgroundColor || '#ffffff';

            switchToEditorMode();
            renderBlocks();
        }
    } catch (e) {
        alert('로드 실패');
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

async function savePage(password) {
    const payload = {
        action: 'save',
        password: password,
        data: JSON.stringify({
            blocks: state.blocks,
            globalStyle: state.globalStyle
        }),
        title: state.pageTitle
    };

    if (state.pageId) payload.id = state.pageId;

    try {
        elems.btnSaveConfirm.disabled = true;
        elems.btnSaveConfirm.innerText = '저장 중...';

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
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
        alert('네트워크 오류');
    } finally {
        elems.btnSaveConfirm.disabled = false;
        elems.btnSaveConfirm.innerText = '확인';
    }
}

async function loadPageData(id) {
    if (!APPS_SCRIPT_URL.startsWith('http')) {
        state.blocks = templates.newsletter;
        renderBlocks();
        return;
    }
    try {
        const res = await fetch(`${ APPS_SCRIPT_URL }?action = get & id=${ id } `);
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

// --- PUBLISH & SHARES ---

function showPublishResult(id) {
    const url = `${ window.location.origin }${ window.location.pathname }?id = ${ id } `;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;

            document.getElementById('share-url').value = url;
            document.getElementById('qr-code-img').innerHTML = `<img src="${qrUrl}" alt="QR Code">`;

            elems.publishModal.classList.remove('hidden');
    }

    window.copyUrl = function () {
        const input = document.getElementById('share-url');
        input.select();
        document.execCommand('copy');
        alert('URL이 복사되었습니다.');
    }

    window.downloadQR = function () {
        const img = document.querySelector('#qr-code-img img');
        if (img) {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = 'qrcode.png';
            a.click();
        }
    }

    // Start
    init();
// Load Dashboard immediately if in dashboard mode
// (Handled in init)
