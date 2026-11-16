import { FirebaseTextbook } from './firebase-service.js';

const STORAGE_KEY = 'digital_textbook_proto_v2';

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const urlParams = new URLSearchParams(window.location.search);
const BOOK_ID = (urlParams.get('book') || 'dangjin-2026').trim();

const state = {
  bookId: BOOK_ID,
  mode: 'viewer', // 'viewer' | 'editor'
  layout: 'double', // 'double' | 'single'
  zoom: 1,
  currentIndex: 0, // 0-based index into state.activePages
  totalRawPages: window.TEXTBOOK_SAMPLE.totalPages,
  activePages: Array.from({ length: window.TEXTBOOK_SAMPLE.totalPages }, (_, i) => i + 1),
  bookTitle: window.TEXTBOOK_SAMPLE.title,
  pdfUrl: '',
  pdfDoc: null,
  pageAspectRatio: 1 / 1.32,
  hotspots: [],
  revealedAnswers: new Set(),
  activeTool: null, // 'video' | 'article' | 'answer' | null
  selectedId: null,
  user: null,
  renderTasks: { left: null, right: null }
};

  // DOM Elements
  const el = {
    appShell: document.getElementById('appShell'),
    bookTitleInput: document.getElementById('bookTitleInput'),
    cloudStatusBadge: document.getElementById('cloudStatusBadge'),
    viewerModeBtn: document.getElementById('viewerModeBtn'),
    editorModeBtn: document.getElementById('editorModeBtn'),
    pdfUploadInput: document.getElementById('pdfUploadInput'),
    cloudSaveBtn: document.getElementById('cloudSaveBtn'),
    authBtn: document.getElementById('authBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    importJsonInput: document.getElementById('importJsonInput'),
    resetDemoBtn: document.getElementById('resetDemoBtn'),
    editorToolbar: document.getElementById('editorToolbar'),
    pdfPathInput: document.getElementById('pdfPathInput'),
    applyPdfPathBtn: document.getElementById('applyPdfPathBtn'),
    editorHint: document.getElementById('editorHint'),
    toolPills: Array.from(document.querySelectorAll('.tool-pill')),
    thumbnailDrawer: document.getElementById('thumbnailDrawer'),
    thumbnailList: document.getElementById('thumbnailList'),
    deletedPagesSection: document.getElementById('deletedPagesSection'),
    deletedPagesList: document.getElementById('deletedPagesList'),
    restoreAllPagesBtn: document.getElementById('restoreAllPagesBtn'),
    toggleDrawerBtn: document.getElementById('toggleDrawerBtn'),
    closeDrawerBtn: document.getElementById('closeDrawerBtn'),
    bookZoomWrap: document.getElementById('bookZoomWrap'),
    bookSpread: document.getElementById('bookSpread'),
    leftPageSlot: document.getElementById('leftPageSlot'),
    rightPageSlot: document.getElementById('rightPageSlot'),
    leftCanvas: document.getElementById('leftCanvas'),
    rightCanvas: document.getElementById('rightCanvas'),
    leftSamplePage: document.getElementById('leftSamplePage'),
    rightSamplePage: document.getElementById('rightSamplePage'),
    leftOverlay: document.getElementById('leftOverlay'),
    rightOverlay: document.getElementById('rightOverlay'),
    leftPageNum: document.getElementById('leftPageNum'),
    rightPageNum: document.getElementById('rightPageNum'),
    deleteLeftPageBtn: document.getElementById('deleteLeftPageBtn'),
    deleteRightPageBtn: document.getElementById('deleteRightPageBtn'),
    prevSpreadBtn: document.getElementById('prevSpreadBtn'),
    nextSpreadBtn: document.getElementById('nextSpreadBtn'),
    firstPageBtn: document.getElementById('firstPageBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    lastPageBtn: document.getElementById('lastPageBtn'),
    pageIndicator: document.getElementById('pageIndicator'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    zoomLabel: document.getElementById('zoomLabel'),
    toggleLayoutBtn: document.getElementById('toggleLayoutBtn'),
    layoutLabel: document.getElementById('layoutLabel'),
    revealAllAnswersBtn: document.getElementById('revealAllAnswersBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    inspectorPanel: document.getElementById('inspectorPanel'),
    closeInspectorBtn: document.getElementById('closeInspectorBtn'),
    propType: document.getElementById('propType'),
    propTitle: document.getElementById('propTitle'),
    propUrl: document.getElementById('propUrl'),
    propUrlLabel: document.getElementById('propUrlLabel'),
    propNote: document.getElementById('propNote'),
    propAnswer: document.getElementById('propAnswer'),
    propAnswerImageInput: document.getElementById('propAnswerImageInput'),
    clearAnswerImageBtn: document.getElementById('clearAnswerImageBtn'),
    answerImagePreviewWrap: document.getElementById('answerImagePreviewWrap'),
    answerImagePreview: document.getElementById('answerImagePreview'),
    answerBoxSizeLabel: document.getElementById('answerBoxSizeLabel'),
    propAnswerStyle: document.getElementById('propAnswerStyle'),
    propSize: document.getElementById('propSize'),
    propSizeVal: document.getElementById('propSizeVal'),
    propCoords: document.getElementById('propCoords'),
    urlFieldGroup: document.getElementById('urlFieldGroup'),
    noteFieldGroup: document.getElementById('noteFieldGroup'),
    answerFieldGroup: document.getElementById('answerFieldGroup'),
    answerImageGroup: document.getElementById('answerImageGroup'),
    answerStyleGroup: document.getElementById('answerStyleGroup'),
    testHotspotBtn: document.getElementById('testHotspotBtn'),
    deleteHotspotBtn: document.getElementById('deleteHotspotBtn'),
    contentModal: document.getElementById('contentModal'),
    modalBadge: document.getElementById('modalBadge'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalFooter: document.getElementById('modalFooter'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    toast: document.getElementById('toast')
  };

  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, 2500);
  }

  function cloneSampleHotspots() {
    return window.TEXTBOOK_SAMPLE.hotspots.map((h) => ({ ...h }));
  }

  function buildSequentialPages(count) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.hotspots = cloneSampleHotspots();
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.hotspots)) {
        state.hotspots = parsed.hotspots;
      } else {
        state.hotspots = cloneSampleHotspots();
      }
      if (typeof parsed.bookTitle === 'string' && parsed.bookTitle.trim()) {
        state.bookTitle = parsed.bookTitle;
      }
      if (typeof parsed.pdfUrl === 'string') {
        state.pdfUrl = parsed.pdfUrl;
      }
      if (Array.isArray(parsed.activePages) && parsed.activePages.length > 0 && !state.pdfDoc) {
        const valid = parsed.activePages.filter((p) => p >= 1 && p <= window.TEXTBOOK_SAMPLE.totalPages);
        if (valid.length > 0) {
          state.activePages = valid;
        }
      }
    } catch {
      state.hotspots = cloneSampleHotspots();
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bookTitle: state.bookTitle,
          pdfUrl: state.pdfUrl,
          activePages: state.activePages,
          hotspots: state.hotspots
        })
      );
    } catch {
      showToast('브라우저 저장 용량이 가득 찼습니다. JSON 내보내기를 권장합니다.');
    }
  }

  function getVisiblePages() {
    const total = state.activePages.length;
    if (total === 0) {
      return { leftPage: null, rightPage: null, leftIndex: -1, rightIndex: -1 };
    }
    if (state.layout === 'single') {
      const idx = Math.min(total - 1, Math.max(0, state.currentIndex));
      return { leftPage: state.activePages[idx], rightPage: null, leftIndex: idx, rightIndex: -1 };
    }
    const evenIdx = state.currentIndex % 2 === 1 ? state.currentIndex - 1 : state.currentIndex;
    const leftIdx = Math.min(Math.max(0, evenIdx), total - 1);
    const alignedLeftIdx = leftIdx % 2 === 1 ? leftIdx - 1 : leftIdx;
    const rightIdx = alignedLeftIdx + 1 < total ? alignedLeftIdx + 1 : -1;
    return {
      leftPage: state.activePages[alignedLeftIdx],
      rightPage: rightIdx >= 0 ? state.activePages[rightIdx] : null,
      leftIndex: alignedLeftIdx,
      rightIndex: rightIdx
    };
  }

  function setMode(mode) {
    state.mode = mode;
    const isEditor = mode === 'editor';
    el.appShell.classList.toggle('is-editor', isEditor);
    el.viewerModeBtn.classList.toggle('is-active', !isEditor);
    el.editorModeBtn.classList.toggle('is-active', isEditor);
    el.viewerModeBtn.setAttribute('aria-selected', String(!isEditor));
    el.editorModeBtn.setAttribute('aria-selected', String(isEditor));
    el.editorToolbar.hidden = !isEditor;
    el.bookTitleInput.readOnly = !isEditor;
    el.resetDemoBtn.hidden = !isEditor;
    updateCloudUi();

    if (!isEditor) {
      selectTool(null);
      selectHotspot(null);
    } else {
      el.pdfPathInput.value = state.pdfUrl || '';
      showToast('편집자 모드입니다. 수정 후 상단 "클라우드 저장"을 눌러 반영하세요.');
    }
    renderHotspots();
    renderThumbnails();
  }

  function selectTool(tool) {
    state.activeTool = state.activeTool === tool ? null : tool;
    el.toolPills.forEach((pill) => {
      pill.classList.toggle('is-selected', pill.dataset.tool === state.activeTool);
    });
    el.appShell.classList.toggle('is-placing', Boolean(state.activeTool));

    if (state.activeTool === 'video') {
      el.editorHint.textContent = '페이지에서 영상 버튼을 놓을 위치를 클릭하세요.';
    } else if (state.activeTool === 'article') {
      el.editorHint.textContent = '페이지에서 기사/웹 링크 버튼을 놓을 위치를 클릭하세요.';
    } else if (state.activeTool === 'answer') {
      el.editorHint.textContent = '페이지에서 정답(?) 버튼을 놓을 위치를 클릭하세요.';
    } else {
      el.editorHint.textContent =
        '도구를 선택한 뒤 책 페이지 원하는 위치를 클릭하세요. 기존 버튼은 드래그로 이동할 수 있습니다.';
    }
  }

  // Updates selection WITHOUT destroying DOM nodes (critical for pointer drag!)
  function syncSelectionClasses() {
    document.querySelectorAll('.hotspot-node').forEach((node) => {
      node.classList.toggle('is-selected', state.mode === 'editor' && node.dataset.id === state.selectedId);
    });
  }

  function selectHotspot(id) {
    state.selectedId = id;
    const hs = state.hotspots.find((item) => item.id === id) || null;
    const showInspector = state.mode === 'editor' && Boolean(hs);
    el.inspectorPanel.hidden = !showInspector;
    el.appShell.classList.toggle('has-inspector', showInspector);

    if (hs) {
      syncInspectorForm(hs);
    }
    syncSelectionClasses();
  }

  function syncInspectorForm(hs) {
    el.propType.value = hs.type;
    el.propTitle.value = hs.title || '';
    el.propUrl.value = hs.url || '';
    el.propNote.value = hs.note || '';
    el.propAnswer.value = hs.answer || '';
    el.propAnswerStyle.value = hs.answerStyle || 'inline';
    el.propSize.value = String(hs.scale || 1);
    el.propSizeVal.textContent = Number(hs.scale || 1).toFixed(1);
    el.propCoords.textContent = `위치: 원본 ${hs.page}쪽 · X ${hs.x.toFixed(1)}%, Y ${hs.y.toFixed(1)}%`;

    const isAnswer = hs.type === 'answer';
    const isArticle = hs.type === 'article';
    el.urlFieldGroup.hidden = isAnswer;
    el.noteFieldGroup.hidden = !isArticle;
    el.answerFieldGroup.hidden = !isAnswer;
    el.answerImageGroup.hidden = !isAnswer;
    el.answerStyleGroup.hidden = !isAnswer;
    el.propUrlLabel.textContent = hs.type === 'video' ? '유튜브 / 영상 URL' : '신문기사 / 웹페이지 URL';

    const hasImage = Boolean(hs.answerImage);
    el.clearAnswerImageBtn.hidden = !hasImage;
    el.answerImagePreviewWrap.hidden = !hasImage;
    if (hasImage) {
      el.answerImagePreview.src = hs.answerImage;
      el.answerBoxSizeLabel.textContent = `크기: 가로 ${Math.round(hs.answerWidth || 30)}% (페이지 위 ↘ 드래그로 조절)`;
    }
  }

  function getIconSvg(type) {
    if (type === 'video') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
    }
    if (type === 'article') {
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></svg>';
    }
    return '?';
  }

  function buildAnswerImageBox(hs, isEditorPreview) {
    const box = document.createElement('div');
    box.className = isEditorPreview ? 'answer-image-box is-editor-preview' : 'answer-image-box';
    box.title = isEditorPreview ? '드래그하여 이동, 오른쪽 아래 파란 핸들로 크기 조절' : '누르면 정답 숨기기';

    const img = document.createElement('img');
    img.src = hs.answerImage;
    img.alt = hs.title || '정답 이미지';
    box.appendChild(img);

    if (hs.answer && hs.answer.trim()) {
      const cap = document.createElement('div');
      cap.className = 'answer-image-caption';
      cap.textContent = hs.answer;
      box.appendChild(cap);
    }

    if (isEditorPreview) {
      const badge = document.createElement('span');
      badge.className = 'answer-box-anchor-badge';
      badge.textContent = '?';
      box.appendChild(badge);

      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.title = '드래그하여 정답 이미지 크기 조절';
      handle.textContent = '↘';
      box.appendChild(handle);
    }

    return box;
  }

  function renderOverlay(overlayEl, pageNum) {
    overlayEl.innerHTML = '';
    if (!pageNum) {
      delete overlayEl.dataset.page;
      return;
    }
    overlayEl.dataset.page = String(pageNum);

    const list = state.hotspots.filter((h) => h.page === pageNum);
    for (const hs of list) {
      const node = document.createElement('div');
      node.className = 'hotspot-node';
      if (state.mode === 'editor' && hs.id === state.selectedId) {
        node.classList.add('is-selected');
      }
      node.style.left = `${hs.x}%`;
      node.style.top = `${hs.y}%`;
      node.style.setProperty('--hs-scale', String(hs.scale || 1));
      node.dataset.id = hs.id;

      const isRevealed = state.mode === 'viewer' && hs.type === 'answer' && state.revealedAnswers.has(hs.id);
      const hasImageAnswer = hs.type === 'answer' && Boolean(hs.answerImage);

      if (state.mode === 'editor' && hasImageAnswer) {
        // Editor mode with answer image: show WYSIWYG resizable box
        node.classList.add('is-answer-box');
        node.style.width = `${hs.answerWidth || 30}%`;
        const box = buildAnswerImageBox(hs, true);
        node.appendChild(box);
        attachHotspotEvents(node, box, hs, overlayEl);
      } else if (isRevealed && hs.answerStyle !== 'modal') {
        // Viewer mode revealed: hide '?' and show answer (image or text pill)
        if (hasImageAnswer) {
          node.classList.add('is-answer-box');
          node.style.width = `${hs.answerWidth || 30}%`;
          const box = buildAnswerImageBox(hs, false);
          box.addEventListener('click', (e) => {
            e.stopPropagation();
            state.revealedAnswers.delete(hs.id);
            renderHotspots();
          });
          node.appendChild(box);
        } else {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'answer-pill';
          pill.textContent = hs.answer || '(정답 미입력)';
          pill.title = '누르면 ? 버튼으로 돌아갑니다';
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            state.revealedAnswers.delete(hs.id);
            renderHotspots();
          });
          node.appendChild(pill);
        }
      } else {
        // Standard icon button (?, video, article)
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `hotspot-btn hotspot-btn--${hs.type}`;
        btn.title = hs.title || '';
        btn.innerHTML = getIconSvg(hs.type);
        node.appendChild(btn);

        if (state.mode === 'editor') {
          const tag = document.createElement('span');
          tag.className = 'hotspot-editor-tag';
          tag.textContent = hs.title || (hs.type === 'answer' ? hs.answer || '정답' : hs.type);
          node.appendChild(tag);
        }

        attachHotspotEvents(node, btn, hs, overlayEl);
      }

      overlayEl.appendChild(node);
    }
  }

  function attachHotspotEvents(node, triggerEl, hs, overlayEl) {
    let dragging = false;
    let resizing = false;
    let moved = false;
    let startClientX = 0;
    let startClientY = 0;
    let startX = hs.x;
    let startY = hs.y;
    let startWidthPct = hs.answerWidth || 30;

    const resizeHandle = node.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', (e) => {
        if (state.mode !== 'editor') return;
        e.stopPropagation();
        e.preventDefault();
        selectHotspot(hs.id);
        resizing = true;
        moved = false;
        startClientX = e.clientX;
        startWidthPct = hs.answerWidth || 30;
        resizeHandle.setPointerCapture(e.pointerId);
      });

      resizeHandle.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const overlayRect = overlayEl.getBoundingClientRect();
        if (!overlayRect.width) return;
        const deltaPct = ((e.clientX - startClientX) / overlayRect.width) * 100 * 2;
        const nextWidth = Math.min(90, Math.max(10, startWidthPct + deltaPct));
        hs.answerWidth = Number(nextWidth.toFixed(1));
        node.style.width = `${hs.answerWidth}%`;
        moved = true;
        if (state.selectedId === hs.id) {
          el.answerBoxSizeLabel.textContent = `크기: 가로 ${Math.round(hs.answerWidth)}% (페이지 위 ↘ 드래그로 조절)`;
        }
      });

      const finishResize = (e) => {
        if (!resizing) return;
        resizing = false;
        try {
          resizeHandle.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        if (moved) persistState();
      };
      resizeHandle.addEventListener('pointerup', finishResize);
      resizeHandle.addEventListener('pointercancel', finishResize);
    }

    node.addEventListener('pointerdown', (e) => {
      if (state.mode !== 'editor') return;
      if (e.target.closest('.resize-handle')) return;
      e.stopPropagation();
      e.preventDefault();
      selectHotspot(hs.id);
      dragging = true;
      moved = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startX = hs.x;
      startY = hs.y;
      node.setPointerCapture(e.pointerId);
    });

    node.addEventListener('pointermove', (e) => {
      if (!dragging || state.mode !== 'editor') return;
      const rect = overlayEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dxPct = ((e.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - startClientY) / rect.height) * 100;
      if (Math.abs(e.clientX - startClientX) > 3 || Math.abs(e.clientY - startClientY) > 3) {
        moved = true;
      }
      const nx = Math.min(97, Math.max(3, startX + dxPct));
      const ny = Math.min(97, Math.max(3, startY + dyPct));
      hs.x = Number(nx.toFixed(1));
      hs.y = Number(ny.toFixed(1));
      node.style.left = `${hs.x}%`;
      node.style.top = `${hs.y}%`;
      if (state.selectedId === hs.id) {
        el.propCoords.textContent = `위치: 원본 ${hs.page}쪽 · X ${hs.x.toFixed(1)}%, Y ${hs.y.toFixed(1)}%`;
      }
    });

    const finishDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        node.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      if (moved) {
        persistState();
      }
    };
    node.addEventListener('pointerup', finishDrag);
    node.addEventListener('pointercancel', finishDrag);

    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.mode === 'editor') {
        selectHotspot(hs.id);
        return;
      }
      activateHotspot(hs);
    });
  }

  function toYouTubeEmbedUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace('/', '');
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
      }
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.split('/')[2];
          return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
        }
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function activateHotspot(hs) {
    if (hs.type === 'answer') {
      if (hs.answerStyle === 'modal') {
        openAnswerModal(hs);
        return;
      }
      if (state.revealedAnswers.has(hs.id)) {
        state.revealedAnswers.delete(hs.id);
      } else {
        state.revealedAnswers.add(hs.id);
      }
      renderHotspots();
      return;
    }

    if (hs.type === 'video') {
      openVideoModal(hs);
      return;
    }

    if (hs.type === 'article') {
      openArticleModal(hs);
    }
  }

  function openVideoModal(hs) {
    el.modalBadge.textContent = '영상 자료';
    el.modalBadge.style.background = 'var(--video-color)';
    el.modalTitle.textContent = hs.title || '영상 보기';

    const embed = toYouTubeEmbedUrl(hs.url);
    if (embed) {
      el.modalBody.innerHTML = `
        <div class="video-frame-wrap">
          <iframe src="${escapeHtml(embed)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
        </div>
      `;
    } else if (hs.url && /\.(mp4|webm|ogg)(\?|$)/i.test(hs.url)) {
      el.modalBody.innerHTML = `
        <div class="video-frame-wrap">
          <video src="${escapeHtml(hs.url)}" controls autoplay></video>
        </div>
      `;
    } else {
      el.modalBody.innerHTML = `
        <div class="article-preview-box">
          <p style="margin:0 0 8px;">등록된 영상 링크를 새 창에서 열 수 있습니다.</p>
          <div class="article-url-text">${escapeHtml(hs.url || '등록된 URL이 없습니다.')}</div>
        </div>
      `;
    }

    el.modalFooter.innerHTML = '';
    if (hs.url) {
      const linkBtn = document.createElement('a');
      linkBtn.className = 'btn btn--secondary';
      linkBtn.href = hs.url;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener noreferrer';
      linkBtn.textContent = '새 탭에서 영상 열기';
      el.modalFooter.appendChild(linkBtn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', closeModal);
    el.modalFooter.appendChild(closeBtn);

    el.contentModal.hidden = false;
  }

  function openArticleModal(hs) {
    el.modalBadge.textContent = '신문기사 / 웹';
    el.modalBadge.style.background = 'var(--article-color)';
    el.modalTitle.textContent = hs.title || '참고 기사 보기';

    el.modalBody.innerHTML = `
      <div class="article-preview-box">
        <p style="margin:0;">${escapeHtml(hs.note || '아래 버튼을 누르면 연결된 기사 또는 웹사이트가 새 탭에서 열립니다.')}</p>
        <div class="article-url-text">${escapeHtml(hs.url || '등록된 URL이 없습니다.')}</div>
      </div>
    `;

    el.modalFooter.innerHTML = '';
    if (hs.url) {
      const openBtn = document.createElement('a');
      openBtn.className = 'btn btn--secondary';
      openBtn.href = hs.url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener noreferrer';
      openBtn.textContent = '새 탭에서 기사 열기';
      el.modalFooter.appendChild(openBtn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', closeModal);
    el.modalFooter.appendChild(closeBtn);

    el.contentModal.hidden = false;
  }

  function openAnswerModal(hs) {
    el.modalBadge.textContent = '정답 확인';
    el.modalBadge.style.background = 'var(--answer-color)';
    el.modalTitle.textContent = hs.title || '정답';

    let inner = '';
    if (hs.answerImage) {
      inner += `<img src="${hs.answerImage}" alt="정답 이미지" style="max-width:100%; max-height:360px; border-radius:8px; margin-bottom:10px;" />`;
    }
    if (hs.answer) {
      inner += `<div class="answer-modal-value">${escapeHtml(hs.answer)}</div>`;
    }
    if (!inner) {
      inner = `<div class="answer-modal-value">(정답 미입력)</div>`;
    }

    el.modalBody.innerHTML = `
      <div class="answer-modal-box">
        ${inner}
        <div style="font-size:13px; color:#78350f;">선생님이 설정한 정답입니다.</div>
      </div>
    `;
    el.modalFooter.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn--secondary';
    closeBtn.textContent = '확인';
    closeBtn.addEventListener('click', closeModal);
    el.modalFooter.appendChild(closeBtn);
    el.contentModal.hidden = false;
  }

  function closeModal() {
    el.contentModal.hidden = true;
    el.modalBody.innerHTML = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderHotspots() {
    const { leftPage, rightPage } = getVisiblePages();
    renderOverlay(el.leftOverlay, leftPage);
    renderOverlay(el.rightOverlay, rightPage);
    renderThumbnails();
  }

  async function renderSlot(side, pdfPageNum, displayNum) {
    const slot = side === 'left' ? el.leftPageSlot : el.rightPageSlot;
    const canvas = side === 'left' ? el.leftCanvas : el.rightCanvas;
    const sampleLayer = side === 'left' ? el.leftSamplePage : el.rightSamplePage;
    const badge = side === 'left' ? el.leftPageNum : el.rightPageNum;

    slot.style.aspectRatio = String(state.pageAspectRatio);

    if (!pdfPageNum) {
      slot.classList.add('is-empty');
      canvas.width = 0;
      canvas.height = 0;
      sampleLayer.innerHTML = '';
      badge.textContent = '';
      return;
    }

    slot.classList.remove('is-empty');
    badge.textContent = String(displayNum);

    if (!state.pdfDoc) {
      canvas.width = 0;
      canvas.height = 0;
      sampleLayer.innerHTML = window.TEXTBOOK_SAMPLE.pagesHtml[pdfPageNum] || '';
      return;
    }

    sampleLayer.innerHTML = '';
    if (state.renderTasks[side]) {
      try {
        state.renderTasks[side].cancel();
      } catch {
        // Ignore cancellation errors
      }
    }

    const page = await state.pdfDoc.getPage(pdfPageNum);
    const unscaledViewport = page.getViewport({ scale: 1 });
    state.pageAspectRatio = unscaledViewport.width / unscaledViewport.height;
    slot.style.aspectRatio = String(state.pageAspectRatio);

    // High-resolution supersampling so small textbook fonts stay crisp even when zoomed in
    const slotWidth = slot.clientWidth || 460;
    const dpr = Math.max(window.devicePixelRatio || 1, 2.5);
    const desiredPixelWidth = Math.min(2400, Math.max(1500, Math.round(slotWidth * dpr * Math.max(state.zoom, 1))));
    const scale = desiredPixelWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    const task = page.render({ canvasContext: ctx, viewport });
    state.renderTasks[side] = task;

    try {
      await task.promise;
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') {
        console.error(err);
      }
    }
  }

  function updatePagerUi() {
    const total = state.activePages.length;
    const { leftIndex, rightIndex } = getVisiblePages();

    el.bookSpread.classList.toggle('is-single', state.layout === 'single');
    el.layoutLabel.textContent = state.layout === 'double' ? '양면' : '단면';
    el.pageIndicator.textContent = rightIndex >= 0
      ? `${leftIndex + 1} - ${rightIndex + 1} / ${total}`
      : `${leftIndex + 1} / ${total}`;

    const atStart = leftIndex <= 0;
    const atEnd = (rightIndex >= 0 ? rightIndex : leftIndex) >= total - 1;
    el.prevSpreadBtn.disabled = atStart;
    el.prevPageBtn.disabled = atStart;
    el.firstPageBtn.disabled = atStart;
    el.nextSpreadBtn.disabled = atEnd;
    el.nextPageBtn.disabled = atEnd;
    el.lastPageBtn.disabled = atEnd;

    el.deleteLeftPageBtn.disabled = total <= 1;
    el.deleteRightPageBtn.disabled = total <= 1;
  }

  function renderThumbnails() {
    if (el.thumbnailDrawer.hidden) return;
    const { leftIndex, rightIndex } = getVisiblePages();
    el.thumbnailList.innerHTML = '';

    state.activePages.forEach((origPage, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb-item';
      if (idx === leftIndex || idx === rightIndex) btn.classList.add('is-active');
      const count = state.hotspots.filter((h) => h.page === origPage).length;
      const label = origPage === idx + 1 ? `${idx + 1} 페이지` : `${idx + 1}쪽 (원본 ${origPage}쪽)`;
      btn.innerHTML = `<span>${label}</span><span class="thumb-count">${count}개</span>`;
      btn.addEventListener('click', () => goToIndex(idx));
      el.thumbnailList.appendChild(btn);
    });

    // Deleted pages section
    const activeSet = new Set(state.activePages);
    const deleted = [];
    for (let p = 1; p <= state.totalRawPages; p += 1) {
      if (!activeSet.has(p)) deleted.push(p);
    }

    el.deletedPagesSection.hidden = deleted.length === 0;
    el.deletedPagesList.innerHTML = '';
    for (const origPage of deleted) {
      const row = document.createElement('div');
      row.className = 'deleted-page-item';
      row.innerHTML = `<span>원본 ${origPage}쪽</span>`;
      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'link-btn';
      restoreBtn.textContent = '복구';
      restoreBtn.addEventListener('click', () => restorePage(origPage));
      row.appendChild(restoreBtn);
      el.deletedPagesList.appendChild(row);
    }
  }

  function deletePageAt(indexInActive) {
    if (indexInActive < 0 || indexInActive >= state.activePages.length) return;
    if (state.activePages.length <= 1) {
      showToast('최소 1페이지는 남아 있어야 합니다.');
      return;
    }
    const removedOrig = state.activePages[indexInActive];
    state.activePages.splice(indexInActive, 1);

    if (state.selectedId) {
      const sel = state.hotspots.find((h) => h.id === state.selectedId);
      if (sel && sel.page === removedOrig) {
        selectHotspot(null);
      }
    }

    if (state.currentIndex >= state.activePages.length) {
      state.currentIndex = Math.max(0, state.activePages.length - 1);
    }
    persistState();
    renderSpread();
    showToast(`원본 ${removedOrig}쪽을 삭제했습니다. 왼쪽 '페이지 관리'에서 복구할 수 있습니다.`);
  }

  function restorePage(origPage) {
    if (state.activePages.includes(origPage)) return;
    state.activePages.push(origPage);
    state.activePages.sort((a, b) => a - b);
    persistState();
    renderSpread();
    showToast(`원본 ${origPage}쪽을 복구했습니다.`);
  }

  function restoreAllPages() {
    state.activePages = buildSequentialPages(state.totalRawPages);
    persistState();
    renderSpread();
    showToast('삭제된 모든 페이지를 복구했습니다.');
  }

  async function renderSpread() {
    const { leftPage, rightPage, leftIndex, rightIndex } = getVisiblePages();
    updatePagerUi();
    await Promise.all([
      renderSlot('left', leftPage, leftIndex + 1),
      renderSlot('right', rightPage, rightIndex + 1)
    ]);
    renderHotspots();
  }

  function goToIndex(idx) {
    const maxIdx = Math.max(0, state.activePages.length - 1);
    const clamped = Math.min(maxIdx, Math.max(0, idx));
    state.currentIndex = state.layout === 'double' && clamped % 2 === 1 ? clamped - 1 : clamped;
    renderSpread();
  }

  function stepSpread(dir) {
    const delta = state.layout === 'double' ? 2 : 1;
    goToIndex(state.currentIndex + dir * delta);
  }

  let zoomRenderTimer = null;
  function setZoom(nextZoom) {
    state.zoom = Math.min(1.8, Math.max(0.6, Number(nextZoom.toFixed(2))));
    el.bookZoomWrap.style.transform = `scale(${state.zoom})`;
    el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;

    if (state.pdfDoc) {
      clearTimeout(zoomRenderTimer);
      zoomRenderTimer = setTimeout(() => {
        renderSpread();
      }, 180);
    }
  }

  function handleOverlayClick(e, overlayEl) {
    if (state.mode !== 'editor') return;
    if (!state.activeTool) {
      selectHotspot(null);
      return;
    }

    const pageNum = Number(overlayEl.dataset.page);
    if (!pageNum) return;

    const rect = overlayEl.getBoundingClientRect();
    const x = Number(Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100)).toFixed(1));
    const y = Number(Math.min(96, Math.max(4, ((e.clientY - rect.top) / rect.height) * 100)).toFixed(1));

    const type = state.activeTool;
    const newHotspot = {
      id: `hs-${Date.now()}`,
      page: pageNum,
      x,
      y,
      type,
      title: type === 'video' ? '새 영상 링크' : type === 'article' ? '새 기사 링크' : '새 정답 확인',
      url: type === 'answer' ? '' : 'https://',
      note: '',
      answer: type === 'answer' ? '정답' : '',
      answerImage: '',
      answerWidth: 30,
      answerStyle: 'inline',
      scale: 1
    };

    state.hotspots.push(newHotspot);
    persistState();
    selectTool(null);
    renderHotspots();
    selectHotspot(newHotspot.id);
    showToast('버튼이 배치되었습니다. 드래그로 옮기거나 오른쪽에서 편집하세요.');
  }

  function readImageAsResizedDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 680;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const webp = canvas.toDataURL('image/webp', 0.8);
          resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function applyLoadedPdfDoc(doc, titleFallback, preserveActivePages) {
    state.pdfDoc = doc;
    state.totalRawPages = doc.numPages;
    if (!preserveActivePages || !state.activePages.length) {
      state.activePages = buildSequentialPages(doc.numPages);
    } else {
      state.activePages = state.activePages.filter((p) => p >= 1 && p <= doc.numPages);
      if (state.activePages.length === 0) {
        state.activePages = buildSequentialPages(doc.numPages);
      }
    }
    if (titleFallback) {
      state.bookTitle = titleFallback;
      el.bookTitleInput.value = state.bookTitle;
    }
    state.currentIndex = 0;
    state.revealedAnswers.clear();
    await renderSpread();
  }

  async function loadPdfFromUrl(url, preserveActivePages = true) {
    if (!url || !window.pdfjsLib) return false;
    try {
      const doc = await window.pdfjsLib.getDocument(url).promise;
      await applyLoadedPdfDoc(doc, null, preserveActivePages);
      return true;
    } catch (err) {
      console.warn('PDF URL load failed:', url, err);
      return false;
    }
  }

  async function handlePdfUpload(file) {
    if (!file) return;
    if (!window.pdfjsLib) {
      showToast('PDF.js 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
      return;
    }
    try {
      showToast('고화질로 PDF를 불러오는 중입니다...');
      const buffer = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;

      const isOnlySample =
        state.hotspots.length === window.TEXTBOOK_SAMPLE.hotspots.length &&
        state.hotspots.every((h, idx) => h.id === window.TEXTBOOK_SAMPLE.hotspots[idx].id);
      if (isOnlySample) {
        state.hotspots = [];
      }

      if (!state.pdfUrl) {
        state.pdfUrl = `./books/${file.name}`;
        el.pdfPathInput.value = state.pdfUrl;
      }

      await applyLoadedPdfDoc(doc, file.name.replace(/\.pdf$/i, ''), false);
      persistState();
      showToast(`"${state.bookTitle}" (${state.totalRawPages}쪽) 로드 완료!`);
    } catch (err) {
      console.error(err);
      showToast('PDF 파일을 열 수 없습니다. 파일 형식을 확인해 주세요.');
    }
  }

  function updateCloudUi() {
    if (!FirebaseTextbook.isConfigured()) {
      el.cloudStatusBadge.textContent = '로컬 모드';
      el.cloudStatusBadge.classList.remove('is-online');
      el.authBtn.hidden = true;
      el.cloudSaveBtn.hidden = true;
      return;
    }

    el.authBtn.hidden = false;
    if (state.user) {
      const shortName = (state.user.email || '관리자').split('@')[0];
      el.authBtn.textContent = `${shortName} (로그아웃)`;
      el.cloudSaveBtn.hidden = state.mode !== 'editor';
    } else {
      el.authBtn.textContent = '관리자 로그인';
      el.cloudSaveBtn.hidden = state.mode !== 'editor';
    }
  }

  async function handleAuthClick() {
    if (!FirebaseTextbook.isConfigured()) return;
    if (state.user) {
      await FirebaseTextbook.signOutUser();
      showToast('로그아웃되었습니다.');
      return;
    }
    try {
      await FirebaseTextbook.signInWithGoogle();
      showToast('관리자 구글 로그인 완료!');
    } catch (err) {
      console.error(err);
      showToast('로그인에 실패했습니다. 승인된 도메인 또는 팝업 차단을 확인해 주세요.');
    }
  }

  async function handleCloudSave() {
    if (!FirebaseTextbook.isConfigured()) {
      showToast('Firebase 설정이 연결되지 않았습니다.');
      return;
    }
    if (!state.user) {
      showToast('먼저 상단 "관리자 로그인"을 진행해 주세요.');
      await handleAuthClick();
      if (!state.user) return;
    }

    const payload = {
      title: state.bookTitle,
      pdfUrl: (el.pdfPathInput.value || state.pdfUrl || '').trim(),
      totalRawPages: state.totalRawPages,
      activePages: state.activePages,
      hotspots: state.hotspots
    };

    const bytes = new Blob([JSON.stringify(payload)]).size;
    if (bytes > 950000) {
      showToast('정답 이미지 총 용량이 너무 큽니다(약 950KB 초과). 이미지 수를 줄이거나 크기를 줄여주세요.');
      return;
    }

    try {
      el.cloudSaveBtn.disabled = true;
      el.cloudSaveBtn.textContent = '저장 중...';
      await FirebaseTextbook.saveTextbook(state.bookId, payload);
      state.pdfUrl = payload.pdfUrl;
      persistState();
      el.cloudStatusBadge.textContent = '클라우드 저장됨';
      el.cloudStatusBadge.classList.add('is-online');
      showToast('Firebase 클라우드에 저장되었습니다! 이제 모든 방문자에게 반영됩니다.');
    } catch (err) {
      console.error(err);
      if (err && (err.code === 'permission-denied' || String(err.message).includes('permission'))) {
        showToast('저장 권한이 없습니다. Firestore 규칙에 등록된 관리자 이메일로 로그인했는지 확인하세요.');
      } else {
        showToast('클라우드 저장 중 오류가 발생했습니다.');
      }
    } finally {
      el.cloudSaveBtn.disabled = false;
      el.cloudSaveBtn.textContent = '클라우드 저장';
    }
  }

  async function loadFromCloud() {
    if (!FirebaseTextbook.isConfigured()) {
      updateCloudUi();
      return;
    }
    try {
      const data = await FirebaseTextbook.loadTextbook(state.bookId);
      if (!data) {
        el.cloudStatusBadge.textContent = '클라우드 대기(미저장)';
        el.cloudStatusBadge.classList.add('is-online');
        const defaultPath = './books/dangjin.pdf';
        const isOnlySample =
          state.hotspots.length === window.TEXTBOOK_SAMPLE.hotspots.length &&
          state.hotspots.every((h, idx) => h.id === window.TEXTBOOK_SAMPLE.hotspots[idx].id);
        if (isOnlySample) {
          state.hotspots = [];
        }
        const loaded = await loadPdfFromUrl(defaultPath, false);
        if (loaded) {
          state.pdfUrl = defaultPath;
          el.pdfPathInput.value = defaultPath;
          state.bookTitle = '2026 우리 고장 당진';
          el.bookTitleInput.value = state.bookTitle;
          persistState();
        } else if (isOnlySample) {
          state.hotspots = cloneSampleHotspots();
          await renderSpread();
        }
        return;
      }

      if (data.title) {
        state.bookTitle = data.title;
        el.bookTitleInput.value = data.title;
      }
      if (typeof data.pdfUrl === 'string') {
        state.pdfUrl = data.pdfUrl;
        el.pdfPathInput.value = data.pdfUrl;
      }
      if (typeof data.totalRawPages === 'number' && data.totalRawPages > 0) {
        state.totalRawPages = data.totalRawPages;
      }
      if (Array.isArray(data.activePages) && data.activePages.length > 0) {
        state.activePages = data.activePages;
      }
      if (Array.isArray(data.hotspots)) {
        state.hotspots = data.hotspots;
      }

      el.cloudStatusBadge.textContent = '클라우드 연동됨';
      el.cloudStatusBadge.classList.add('is-online');

      if (state.pdfUrl) {
        const ok = await loadPdfFromUrl(state.pdfUrl, true);
        if (!ok) {
          showToast(`배포 PDF(${state.pdfUrl})를 아직 찾을 수 없어 현재 화면으로 표시합니다.`);
          await renderSpread();
        }
      } else {
        await renderSpread();
      }
    } catch (err) {
      console.error(err);
      el.cloudStatusBadge.textContent = '연결 오류(로컬)';
      el.cloudStatusBadge.classList.remove('is-online');
    }
  }

  function exportJson() {
    const payload = {
      title: state.bookTitle,
      totalRawPages: state.totalRawPages,
      activePages: state.activePages,
      exportedAt: new Date().toISOString(),
      hotspots: state.hotspots
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.bookTitle || 'textbook'}-buttons.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('버튼 배치 및 페이지 구성 JSON을 저장했습니다.');
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.hotspots)) {
        throw new Error('Invalid format');
      }
      state.hotspots = data.hotspots;
      if (data.title) {
        state.bookTitle = data.title;
        el.bookTitleInput.value = data.title;
      }
      if (Array.isArray(data.activePages) && data.activePages.length > 0) {
        state.activePages = data.activePages.filter((p) => p >= 1 && p <= state.totalRawPages);
        if (state.activePages.length === 0) {
          state.activePages = buildSequentialPages(state.totalRawPages);
        }
      }
      state.currentIndex = 0;
      state.revealedAnswers.clear();
      persistState();
      await renderSpread();
      showToast('저장된 데이터를 불러왔습니다.');
    } catch {
      showToast('올바른 JSON 파일이 아닙니다.');
    }
  }

  function bindInspectorEvents() {
    const updateSelected = (updater) => {
      const hs = state.hotspots.find((item) => item.id === state.selectedId);
      if (!hs) return;
      updater(hs);
      persistState();
      syncInspectorForm(hs);
      renderHotspots();
    };

    el.propType.addEventListener('change', () => updateSelected((hs) => { hs.type = el.propType.value; }));
    el.propTitle.addEventListener('input', () => updateSelected((hs) => { hs.title = el.propTitle.value; }));
    el.propUrl.addEventListener('input', () => updateSelected((hs) => { hs.url = el.propUrl.value; }));
    el.propNote.addEventListener('input', () => updateSelected((hs) => { hs.note = el.propNote.value; }));
    el.propAnswer.addEventListener('input', () => updateSelected((hs) => { hs.answer = el.propAnswer.value; }));
    el.propAnswerStyle.addEventListener('change', () => updateSelected((hs) => { hs.answerStyle = el.propAnswerStyle.value; }));
    el.propSize.addEventListener('input', () => updateSelected((hs) => { hs.scale = Number(el.propSize.value); }));

    el.propAnswerImageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await readImageAsResizedDataUrl(file);
        updateSelected((hs) => {
          hs.answerImage = dataUrl;
          if (!hs.answerWidth) hs.answerWidth = 30;
          if (hs.answer === '정답') hs.answer = '';
        });
        showToast('정답 이미지를 적용했습니다. 모서리 ↘ 핸들을 드래그해 크기를 조절하세요.');
      } catch {
        showToast('이미지를 불러오지 못했습니다.');
      }
    });

    el.clearAnswerImageBtn.addEventListener('click', () => {
      updateSelected((hs) => {
        hs.answerImage = '';
      });
    });

    el.testHotspotBtn.addEventListener('click', () => {
      const hs = state.hotspots.find((item) => item.id === state.selectedId);
      if (!hs) return;
      if (hs.type === 'answer' && hs.answerStyle !== 'modal') {
        openAnswerModal(hs);
        return;
      }
      activateHotspot(hs);
    });

    el.deleteHotspotBtn.addEventListener('click', () => {
      if (!state.selectedId) return;
      state.hotspots = state.hotspots.filter((item) => item.id !== state.selectedId);
      persistState();
      selectHotspot(null);
      renderHotspots();
      showToast('버튼을 삭제했습니다.');
    });

    el.closeInspectorBtn.addEventListener('click', () => selectHotspot(null));
  }

  function bindEvents() {
    el.viewerModeBtn.addEventListener('click', () => setMode('viewer'));
    el.editorModeBtn.addEventListener('click', () => setMode('editor'));

    el.bookTitleInput.addEventListener('input', () => {
      state.bookTitle = el.bookTitleInput.value;
      persistState();
    });

    el.toolPills.forEach((pill) => {
      pill.addEventListener('click', () => selectTool(pill.dataset.tool));
    });

    el.leftOverlay.addEventListener('click', (e) => handleOverlayClick(e, el.leftOverlay));
    el.rightOverlay.addEventListener('click', (e) => handleOverlayClick(e, el.rightOverlay));

    el.deleteLeftPageBtn.addEventListener('click', () => {
      const { leftIndex } = getVisiblePages();
      deletePageAt(leftIndex);
    });
    el.deleteRightPageBtn.addEventListener('click', () => {
      const { rightIndex } = getVisiblePages();
      deletePageAt(rightIndex);
    });
    el.restoreAllPagesBtn.addEventListener('click', restoreAllPages);

    el.authBtn.addEventListener('click', handleAuthClick);
    el.cloudSaveBtn.addEventListener('click', handleCloudSave);

    el.applyPdfPathBtn.addEventListener('click', async () => {
      const nextUrl = el.pdfPathInput.value.trim();
      state.pdfUrl = nextUrl;
      persistState();
      if (!nextUrl) {
        showToast('PDF 경로를 비웠습니다.');
        return;
      }
      showToast('PDF 경로에서 파일을 불러오는 중입니다...');
      const ok = await loadPdfFromUrl(nextUrl, true);
      showToast(ok ? '배포 PDF 불러오기 완료!' : '해당 경로에서 PDF를 찾지 못했습니다. 파일명/위치를 확인하세요.');
    });

    el.pdfUploadInput.addEventListener('change', (e) => {
      handlePdfUpload(e.target.files[0]);
      e.target.value = '';
    });

    el.exportJsonBtn.addEventListener('click', exportJson);
    el.importJsonInput.addEventListener('change', (e) => {
      importJson(e.target.files[0]);
      e.target.value = '';
    });

    el.resetDemoBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      state.pdfDoc = null;
      state.pdfUrl = '';
      el.pdfPathInput.value = '';
      state.pageAspectRatio = 1 / 1.32;
      state.totalRawPages = window.TEXTBOOK_SAMPLE.totalPages;
      state.activePages = buildSequentialPages(window.TEXTBOOK_SAMPLE.totalPages);
      state.bookTitle = window.TEXTBOOK_SAMPLE.title;
      el.bookTitleInput.value = state.bookTitle;
      state.hotspots = cloneSampleHotspots();
      state.revealedAnswers.clear();
      selectHotspot(null);
      goToIndex(0);
      showToast('기본 시안으로 초기화했습니다.');
    });

    el.prevSpreadBtn.addEventListener('click', () => stepSpread(-1));
    el.nextSpreadBtn.addEventListener('click', () => stepSpread(1));
    el.prevPageBtn.addEventListener('click', () => stepSpread(-1));
    el.nextPageBtn.addEventListener('click', () => stepSpread(1));
    el.firstPageBtn.addEventListener('click', () => goToIndex(0));
    el.lastPageBtn.addEventListener('click', () => goToIndex(state.activePages.length - 1));

    el.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.1));
    el.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.1));
    el.zoomResetBtn.addEventListener('click', () => setZoom(1));

    el.toggleLayoutBtn.addEventListener('click', () => {
      state.layout = state.layout === 'double' ? 'single' : 'double';
      goToIndex(state.currentIndex);
    });

    el.revealAllAnswersBtn.addEventListener('click', () => {
      const { leftPage, rightPage } = getVisiblePages();
      const visibleAnswerIds = state.hotspots
        .filter((h) => h.type === 'answer' && (h.page === leftPage || h.page === rightPage))
        .map((h) => h.id);

      const allRevealed = visibleAnswerIds.length > 0 && visibleAnswerIds.every((id) => state.revealedAnswers.has(id));
      if (allRevealed) {
        visibleAnswerIds.forEach((id) => state.revealedAnswers.delete(id));
      } else {
        visibleAnswerIds.forEach((id) => state.revealedAnswers.add(id));
      }
      renderHotspots();
    });

    el.toggleDrawerBtn.addEventListener('click', () => {
      el.thumbnailDrawer.hidden = !el.thumbnailDrawer.hidden;
      renderThumbnails();
    });
    el.closeDrawerBtn.addEventListener('click', () => {
      el.thumbnailDrawer.hidden = true;
    });

    el.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    el.closeModalBtn.addEventListener('click', closeModal);
    el.contentModal.addEventListener('click', (e) => {
      if (e.target === el.contentModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') stepSpread(-1);
      if (e.key === 'ArrowRight') stepSpread(1);
    });

    bindInspectorEvents();
  }

  async function init() {
    loadSavedState();
    el.bookTitleInput.value = state.bookTitle;
    el.pdfPathInput.value = state.pdfUrl || '';
    bindEvents();
    await renderSpread();

    FirebaseTextbook.onAuthChange((user) => {
      state.user = user;
      updateCloudUi();
    });
    await loadFromCloud();
  }

  init();
