import { FirebaseTextbook } from './firebase-service.js';

const STORAGE_KEY = 'digital_textbook_proto_v2';
const DEFAULT_ZOOM = 1.3;

function getDefaultZoom() {
  return window.innerWidth <= 640 ? 1.0 : DEFAULT_ZOOM;
}

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
  zoom: DEFAULT_ZOOM,
  panX: 0,
  panY: 0,
  suppressNextStageClick: false,
  currentIndex: 0, // 0-based index into state.activePages
  totalRawPages: window.TEXTBOOK_SAMPLE.totalPages,
  activePages: Array.from({ length: window.TEXTBOOK_SAMPLE.totalPages }, (_, i) => i + 1),
  bookTitle: window.TEXTBOOK_SAMPLE.title,
  pdfUrl: '',
  pdfDoc: null,
  pageAspectRatio: 1 / 1.32,
  hotspots: [],
  tocItems: [],
  editingTocId: null,
  revealedAnswers: new Set(),
  activeTool: null, // 'video' | 'article' | 'answer_text' | 'answer_image' | 'toc' | 'jump_area' | null
  selectedId: null,
  clipboardHotspot: null,
  contextTargetId: null,
  contextEmptyTarget: null,
  snapGuidesEnabled: true,
  user: null,
  renderTasks: { left: null, right: null }
};

// DOM Elements
const el = {
  appShell: document.getElementById('appShell'),
  bookTitleInput: document.getElementById('bookTitleInput'),
  cloudStatusBadge: document.getElementById('cloudStatusBadge'),
  editorHeaderActions: document.getElementById('editorHeaderActions'),
  enterEditorBtn: document.getElementById('enterEditorBtn'),
  exitEditorBtn: document.getElementById('exitEditorBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  pdfUploadInput: document.getElementById('pdfUploadInput'),
  cloudSaveBtn: document.getElementById('cloudSaveBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  importJsonInput: document.getElementById('importJsonInput'),
  resetDemoBtn: document.getElementById('resetDemoBtn'),
  editorToolbar: document.getElementById('editorToolbar'),
  pdfPathInput: document.getElementById('pdfPathInput'),
  applyPdfPathBtn: document.getElementById('applyPdfPathBtn'),
  editorHint: document.getElementById('editorHint'),
  toolPills: Array.from(document.querySelectorAll('.tool-pill[data-tool]')),
  tocDrawer: document.getElementById('tocDrawer'),
  closeTocDrawerBtn: document.getElementById('closeTocDrawerBtn'),
  tocList: document.getElementById('tocList'),
  tocEditorForm: document.getElementById('tocEditorForm'),
  tocLevelInput: document.getElementById('tocLevelInput'),
  tocPageInput: document.getElementById('tocPageInput'),
  tocUseCurrentPageBtn: document.getElementById('tocUseCurrentPageBtn'),
  tocTitleInput: document.getElementById('tocTitleInput'),
  tocSaveBtn: document.getElementById('tocSaveBtn'),
  tocCancelEditBtn: document.getElementById('tocCancelEditBtn'),
  thumbnailDrawer: document.getElementById('thumbnailDrawer'),
  thumbnailList: document.getElementById('thumbnailList'),
  deletedPagesSection: document.getElementById('deletedPagesSection'),
  deletedPagesList: document.getElementById('deletedPagesList'),
  restoreAllPagesBtn: document.getElementById('restoreAllPagesBtn'),
  toggleTocBtn: document.getElementById('toggleTocBtn'),
  togglePageMgrBtn: document.getElementById('togglePageMgrBtn'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  bookStage: document.getElementById('bookStage'),
  bookZoomWrap: document.getElementById('bookZoomWrap'),
  bookSpread: document.getElementById('bookSpread'),
  leftPageSlot: document.getElementById('leftPageSlot'),
  rightPageSlot: document.getElementById('rightPageSlot'),
  leftCanvas: document.getElementById('leftCanvas'),
  rightCanvas: document.getElementById('rightCanvas'),
  leftSamplePage: document.getElementById('leftSamplePage'),
  rightSamplePage: document.getElementById('rightSamplePage'),
  leftLineSvg: document.getElementById('leftLineSvg'),
  rightLineSvg: document.getElementById('rightLineSvg'),
  leftOverlay: document.getElementById('leftOverlay'),
  rightOverlay: document.getElementById('rightOverlay'),
  leftGuideSvg: document.getElementById('leftGuideSvg'),
  rightGuideSvg: document.getElementById('rightGuideSvg'),
  toggleSnapGuidesBtn: document.getElementById('toggleSnapGuidesBtn'),
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
  pageJumpForm: document.getElementById('pageJumpForm'),
  pageJumpInput: document.getElementById('pageJumpInput'),
  pageJumpTotal: document.getElementById('pageJumpTotal'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLabel: document.getElementById('zoomLabel'),
  toggleLayoutBtn: document.getElementById('toggleLayoutBtn'),
  layoutLabel: document.getElementById('layoutLabel'),
  revealAllAnswersBtn: document.getElementById('revealAllAnswersBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  inspectorPanel: document.getElementById('inspectorPanel'),
  inspectorEmptyState: document.getElementById('inspectorEmptyState'),
  inspectorForm: document.getElementById('inspectorForm'),
  closeInspectorBtn: document.getElementById('closeInspectorBtn'),
  propType: document.getElementById('propType'),
  propTitle: document.getElementById('propTitle'),
  propTargetPage: document.getElementById('propTargetPage'),
  targetPageGroup: document.getElementById('targetPageGroup'),
  jumpSizeGroup: document.getElementById('jumpSizeGroup'),
  jumpBoxSizeLabel: document.getElementById('jumpBoxSizeLabel'),
  propUrl: document.getElementById('propUrl'),
  propUrlLabel: document.getElementById('propUrlLabel'),
  propNote: document.getElementById('propNote'),
  propAnswer: document.getElementById('propAnswer'),
  propAnswerLabel: document.getElementById('propAnswerLabel'),
  propAnswerImageInput: document.getElementById('propAnswerImageInput'),
  clearAnswerImageBtn: document.getElementById('clearAnswerImageBtn'),
  answerImagePreviewWrap: document.getElementById('answerImagePreviewWrap'),
  answerImagePreview: document.getElementById('answerImagePreview'),
  answerBoxSizeLabel: document.getElementById('answerBoxSizeLabel'),
  propAnswerStyle: document.getElementById('propAnswerStyle'),
  sizeFieldGroup: document.getElementById('sizeFieldGroup'),
  propSize: document.getElementById('propSize'),
  propSizeVal: document.getElementById('propSizeVal'),
  propCoords: document.getElementById('propCoords'),
  alignColBtn: document.getElementById('alignColBtn'),
  alignRowBtn: document.getElementById('alignRowBtn'),
  urlFieldGroup: document.getElementById('urlFieldGroup'),
  noteFieldGroup: document.getElementById('noteFieldGroup'),
  answerFieldGroup: document.getElementById('answerFieldGroup'),
  answerImageGroup: document.getElementById('answerImageGroup'),
  answerStyleGroup: document.getElementById('answerStyleGroup'),
  lineSettingsGroup: document.getElementById('lineSettingsGroup'),
  propLineColor: document.getElementById('propLineColor'),
  propLineWidth: document.getElementById('propLineWidth'),
  propLineWidthVal: document.getElementById('propLineWidthVal'),
  lineCoordsHint: document.getElementById('lineCoordsHint'),
  crosswordSettingsGroup: document.getElementById('crosswordSettingsGroup'),
  propCwDirection: document.getElementById('propCwDirection'),
  propCwColor: document.getElementById('propCwColor'),
  cwBoxSizeLabel: document.getElementById('cwBoxSizeLabel'),
  testHotspotBtn: document.getElementById('testHotspotBtn'),
  deleteHotspotBtn: document.getElementById('deleteHotspotBtn'),
  contentModal: document.getElementById('contentModal'),
  modalBadge: document.getElementById('modalBadge'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalFooter: document.getElementById('modalFooter'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  hotspotContextMenu: document.getElementById('hotspotContextMenu'),
  ctxDuplicateBtn: document.getElementById('ctxDuplicateBtn'),
  ctxCopyBtn: document.getElementById('ctxCopyBtn'),
  ctxPasteBtn: document.getElementById('ctxPasteBtn'),
  ctxDivider: document.getElementById('ctxDivider'),
  ctxDeleteBtn: document.getElementById('ctxDeleteBtn'),
  toast: document.getElementById('toast')
};

let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 2600);
}

function cloneSampleHotspots() {
  return window.TEXTBOOK_SAMPLE.hotspots.map((h) => ({ ...h }));
}

function buildSequentialPages(count) {
  return Array.from({ length: count }, (_, i) => i + 1);
}

function getEffectiveAnswerKind(hs) {
  if (hs.answerKind === 'image' || hs.answerKind === 'text') return hs.answerKind;
  return hs.answerImage ? 'image' : 'text';
}

function getInspectorTypeValue(hs) {
  if (hs.type !== 'answer') return hs.type;
  return getEffectiveAnswerKind(hs) === 'image' ? 'answer_image' : 'answer_text';
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
    if (Array.isArray(parsed.tocItems)) {
      state.tocItems = parsed.tocItems;
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
        tocItems: state.tocItems,
        hotspots: state.hotspots
      })
    );
  } catch {
    showToast('브라우저 저장 용량이 가득 찼습니다. JSON 백업을 권장합니다.');
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
  if (mode === 'editor' && FirebaseTextbook.isConfigured() && !FirebaseTextbook.isAuthorizedAdmin(state.user)) {
    const allowed = FirebaseTextbook.getAllowedAdminEmails().join(', ');
    showToast(`허용된 관리자 계정(${allowed})으로 로그인해야 편집자 모드를 이용할 수 있습니다.`);
    return;
  }
  state.mode = mode;
  closeHotspotContextMenu();
  const isEditor = mode === 'editor';
  el.appShell.classList.toggle('is-editor', isEditor);
  el.appShell.classList.toggle('has-inspector', isEditor);
  el.editorToolbar.hidden = !isEditor;
  el.editorHeaderActions.hidden = !isEditor;
  el.enterEditorBtn.hidden = isEditor;
  el.cloudStatusBadge.hidden = !isEditor;
  el.inspectorPanel.hidden = !isEditor;
  el.togglePageMgrBtn.hidden = !isEditor;
  el.tocEditorForm.hidden = !isEditor;
  el.bookTitleInput.readOnly = !isEditor;
  updateCloudUi();

  if (!isEditor) {
    el.thumbnailDrawer.hidden = true;
    resetTocForm();
    selectTool(null);
    selectHotspot(null);
    clearAllAlignGuides();
  } else {
    el.pdfPathInput.value = state.pdfUrl || '';
    selectHotspot(state.selectedId);
    showToast('편집자 모드입니다. 수정 후 상단 "클라우드 저장"을 눌러 반영하세요.');
  }
  renderHotspots();
  renderThumbnails();
  renderTocDrawer();
}

async function handleEnterEditorClick() {
  if (!FirebaseTextbook.isConfigured()) {
    setMode('editor');
    return;
  }
  if (state.user) {
    if (FirebaseTextbook.isAuthorizedAdmin(state.user)) {
      setMode('editor');
      return;
    }
    await FirebaseTextbook.signOutUser();
    state.user = null;
    updateCloudUi();
  }
  try {
    showToast('관리자 구글 로그인 창을 여는 중입니다...');
    const user = await FirebaseTextbook.signInWithGoogle();
    state.user = user;
    updateCloudUi();
    setMode('editor');
  } catch (err) {
    console.error(err);
    const allowed = FirebaseTextbook.getAllowedAdminEmails().join(', ');
    if (err && (err.code === 'UNAUTHORIZED_ADMIN' || err.message === 'UNAUTHORIZED_ADMIN')) {
      const who = err.email ? `(${err.email}) ` : '';
      showToast(`접근 거부: ${who}관리자 계정(${allowed})만 편집자 모드를 사용할 수 있습니다.`);
    } else {
      showToast('구글 로그인이 취소되었거나 실패했습니다. 팝업 차단을 확인해 주세요.');
    }
  }
}

function selectTool(tool) {
  state.activeTool = state.activeTool === tool ? null : tool;
  el.toolPills.forEach((pill) => {
    if (!pill.dataset.tool) return;
    pill.classList.toggle('is-selected', pill.dataset.tool === state.activeTool);
  });
  el.appShell.classList.toggle('is-placing', Boolean(state.activeTool));
  if (!state.activeTool) {
    clearAllAlignGuides();
  }

  if (state.activeTool === 'video') {
    el.editorHint.textContent = '페이지에서 영상 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'article') {
    el.editorHint.textContent = '페이지에서 기사/웹 링크 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'answer_text') {
    el.editorHint.textContent = '페이지에서 정답(텍스트) ? 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'answer_image') {
    el.editorHint.textContent = '페이지에서 정답(이미지) ? 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'toc') {
    el.editorHint.textContent = '페이지에서 차례 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'jump_area') {
    el.editorHint.textContent = '차례 등에서 이동용 투명 버튼을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'line_answer') {
    el.editorHint.textContent = '선 잇기 시작점(?)을 놓을 위치를 클릭하세요.';
  } else if (state.activeTool === 'crossword_answer') {
    el.editorHint.textContent = '가로/세로 낱말 칸을 놓을 위치를 클릭하세요.';
  } else {
    el.editorHint.textContent =
      '도구 선택 후 페이지를 클릭하세요. 기존 버튼은 클릭해 편집하거나 드래그로 이동합니다.';
  }
}

// Updates selection WITHOUT destroying DOM nodes (critical for pointer drag!)
function syncSelectionClasses() {
  document.querySelectorAll('.hotspot-node, .line-end-handle').forEach((node) => {
    node.classList.toggle('is-selected', state.mode === 'editor' && node.dataset.id === state.selectedId);
  });
}

function selectHotspot(id) {
  state.selectedId = id;
  const hs = state.hotspots.find((item) => item.id === id) || null;
  const isEditor = state.mode === 'editor';
  el.inspectorPanel.hidden = !isEditor;
  el.appShell.classList.toggle('has-inspector', isEditor);

  el.inspectorForm.hidden = !hs;
  el.inspectorEmptyState.hidden = Boolean(hs);
  el.closeInspectorBtn.hidden = !hs;

  if (hs) {
    syncInspectorForm(hs);
  }
  syncSelectionClasses();
}

function syncInspectorForm(hs) {
  const inspectorType = getInspectorTypeValue(hs);
  el.propType.value = inspectorType;
  el.propTitle.value = hs.title || '';
  el.propTargetPage.value = hs.targetPage ? String(hs.targetPage) : '';
  el.propUrl.value = hs.url || '';
  el.propNote.value = hs.note || '';
  el.propAnswer.value = hs.answer || '';
  el.propAnswerStyle.value = hs.answerStyle || 'inline';
  el.propSize.value = String(hs.scale || 1);
  el.propSizeVal.textContent = Number(hs.scale || 1).toFixed(1);
  el.propCoords.textContent = `위치: 원본 ${hs.page}쪽 · X ${hs.x.toFixed(1)}%, Y ${hs.y.toFixed(1)}%`;

  const isAnswer = hs.type === 'answer';
  const isImageAnswer = inspectorType === 'answer_image';
  const isArticle = hs.type === 'article';
  const isPageNav = hs.type === 'toc' || hs.type === 'jump_area';
  const isJumpArea = hs.type === 'jump_area';
  const isLine = hs.type === 'line_answer';
  const isCrossword = hs.type === 'crossword_answer';

  el.urlFieldGroup.hidden = isAnswer || isPageNav || isLine || isCrossword;
  el.noteFieldGroup.hidden = !isArticle;
  el.answerFieldGroup.hidden = !isAnswer && !isCrossword;
  el.propAnswerLabel.textContent = isCrossword
    ? '정답 낱말 (글자 수만큼 칸이 생성됩니다)'
    : isImageAnswer
      ? '정답 이미지 하단 설명 (선택)'
      : '정답 텍스트';
  el.propAnswer.placeholder = isCrossword ? '예: 당진시' : isImageAnswer ? '예: 아래 설명 참고 (비워둬도 됨)' : '예: 병원';
  el.answerImageGroup.hidden = !isImageAnswer;
  el.answerStyleGroup.hidden = !isAnswer;
  el.targetPageGroup.hidden = !isPageNav;
  el.jumpSizeGroup.hidden = !isJumpArea;
  el.lineSettingsGroup.hidden = !isLine;
  el.crosswordSettingsGroup.hidden = !isCrossword;
  el.sizeFieldGroup.hidden = isJumpArea || isCrossword;
  el.propUrlLabel.textContent = hs.type === 'video' ? '유튜브 / 영상 URL' : '신문기사 / 웹페이지 URL';

  if (isJumpArea) {
    el.jumpBoxSizeLabel.textContent = `영역 크기: 가로 ${Math.round(hs.boxWidth || 38)}% × 세로 ${Math.round(hs.boxHeight || 6)}% (모서리 ↘ 드래그로 조절)`;
  }
  if (isLine) {
    el.propLineColor.value = hs.lineColor || '#ef4444';
    el.propLineWidth.value = String(hs.lineWidth || 4);
    el.propLineWidthVal.textContent = String(hs.lineWidth || 4);
  }
  if (isCrossword) {
    el.propCwDirection.value = hs.direction || 'horizontal';
    el.propCwColor.value = hs.textColor || '#dc2626';
    el.cwBoxSizeLabel.textContent = `크기: 가로 ${Math.round(hs.boxWidth || 24)}% × 세로 ${Math.round(hs.boxHeight || 6)}% (모서리 ↘ 드래그로 퍼즐 칸에 맞추세요)`;
  }

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
  if (type === 'toc') {
    return '차례';
  }
  return '?';
}

function buildAnswerImageBox(hs, isEditorPreview) {
  const box = document.createElement('div');
  box.className = isEditorPreview ? 'answer-image-box is-editor-preview' : 'answer-image-box';
  box.title = isEditorPreview ? '드래그하여 이동, 오른쪽 아래 파란 핸들로 크기 조절' : '누르면 ? 버튼으로 돌아갑니다';

  if (hs.answerImage) {
    const img = document.createElement('img');
    img.src = hs.answerImage;
    img.alt = hs.title || '정답 이미지';
    box.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'answer-image-placeholder';
    ph.textContent = '오른쪽 패널에서 정답 이미지를 올려주세요';
    box.appendChild(ph);
  }

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

function buildJumpAreaBox(hs, isEditorPreview) {
  const box = document.createElement('div');
  box.className = isEditorPreview ? 'jump-area-box is-editor-preview' : 'jump-area-box';
  const target = hs.targetPage || 1;
  box.title = isEditorPreview
    ? '드래그로 이동, 모서리 ↘ 핸들로 가로·세로 크기 조절'
    : (hs.title ? `${hs.title} (${target}쪽으로 이동)` : `${target}쪽으로 이동`);

  if (isEditorPreview) {
    const label = document.createElement('span');
    label.className = 'jump-area-label';
    label.textContent = `${hs.title || '이동'} → ${target}쪽`;
    box.appendChild(label);

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.title = '드래그하여 투명 버튼 크기 조절';
    handle.textContent = '↘';
    box.appendChild(handle);
  }
  return box;
}

function buildCrosswordBox(hs, isEditorPreview) {
  const dir = hs.direction === 'vertical' ? 'vertical' : 'horizontal';
  const grid = document.createElement('div');
  grid.className = `cw-grid cw-grid--${dir} ${isEditorPreview ? 'is-editor-preview' : 'is-revealed'}`;
  grid.title = isEditorPreview
    ? '드래그로 이동, 모서리 ↘ 핸들로 가로·세로 크기를 퍼즐 칸에 맞추세요'
    : '누르면 ? 버튼으로 돌아갑니다';

  const chars = Array.from((hs.answer || '').trim());
  const displayChars = chars.length > 0 ? chars : (isEditorPreview ? ['?', '?', '?'] : ['(미입력)']);
  const textColor = hs.textColor || '#dc2626';

  for (const ch of displayChars) {
    const cell = document.createElement('div');
    cell.className = 'cw-cell';
    cell.style.color = textColor;
    cell.textContent = ch;
    grid.appendChild(cell);
  }

  if (isEditorPreview) {
    const badge = document.createElement('span');
    badge.className = 'answer-box-anchor-badge';
    badge.textContent = '?';
    grid.appendChild(badge);

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.title = '드래그하여 낱말 칸 크기 조절';
    handle.textContent = '↘';
    grid.appendChild(handle);
  }

  return grid;
}

function createSvgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

let alignFlashTimer = null;

function getGuideSvgForOverlay(overlayEl) {
  if (overlayEl === el.leftOverlay) return el.leftGuideSvg;
  if (overlayEl === el.rightOverlay) return el.rightGuideSvg;
  return null;
}

function getGuideSvgForPage(pageNum) {
  const { leftPage, rightPage } = getVisiblePages();
  if (pageNum === leftPage) return el.leftGuideSvg;
  if (pageNum === rightPage) return el.rightGuideSvg;
  return null;
}

function clearAlignGuides(guideSvg) {
  if (guideSvg) guideSvg.innerHTML = '';
}

function clearAllAlignGuides() {
  if (alignFlashTimer) {
    clearTimeout(alignFlashTimer);
    alignFlashTimer = null;
  }
  clearAlignGuides(el.leftGuideSvg);
  clearAlignGuides(el.rightGuideSvg);
}

function collectSnapAnchors(pageNum, excludeId, includeSelfEndpoint) {
  const anchors = [];
  for (const h of state.hotspots) {
    if (h.page !== pageNum) continue;
    if (h.id === excludeId) continue;
    anchors.push({ x: h.x, y: h.y, id: h.id });
    if (h.type === 'line_answer' && typeof h.endX === 'number' && typeof h.endY === 'number') {
      anchors.push({ x: h.endX, y: h.endY, id: h.id });
    }
  }
  if (includeSelfEndpoint) {
    anchors.push({ x: includeSelfEndpoint.x, y: includeSelfEndpoint.y, id: excludeId || 'self' });
  }
  return anchors;
}

function computeSmartSnap(rawX, rawY, pageNum, rect, opts = {}) {
  const minBound = opts.clampMin ?? 3;
  const maxBound = opts.clampMax ?? 97;
  const clampedX = Math.min(maxBound, Math.max(minBound, rawX));
  const clampedY = Math.min(maxBound, Math.max(minBound, rawY));
  const roundedX = Number(clampedX.toFixed(1));
  const roundedY = Number(clampedY.toFixed(1));

  if (!state.snapGuidesEnabled || opts.bypass || !rect || !rect.width || !rect.height) {
    return { x: roundedX, y: roundedY, guideX: null, guideY: null };
  }

  const tolX = Math.min(2.4, Math.max(0.55, (7 / rect.width) * 100));
  const tolY = Math.min(2.2, Math.max(0.45, (7 / rect.height) * 100));
  const anchors = collectSnapAnchors(pageNum, opts.excludeId, opts.includeSelfEndpoint);

  let bestXDist = Infinity;
  let snappedXVal = null;
  for (const a of anchors) {
    const d = Math.abs(a.x - clampedX);
    if (d <= tolX && d < bestXDist) {
      bestXDist = d;
      snappedXVal = a.x;
    }
  }
  let isCenterX = false;
  if (snappedXVal === null && Math.abs(50 - clampedX) <= tolX * 0.85) {
    snappedXVal = 50;
    isCenterX = true;
  }

  let bestYDist = Infinity;
  let snappedYVal = null;
  for (const a of anchors) {
    const d = Math.abs(a.y - clampedY);
    if (d <= tolY && d < bestYDist) {
      bestYDist = d;
      snappedYVal = a.y;
    }
  }
  let isCenterY = false;
  if (snappedYVal === null && Math.abs(50 - clampedY) <= tolY * 0.85) {
    snappedYVal = 50;
    isCenterY = true;
  }

  const finalX = snappedXVal !== null ? Number(Math.min(maxBound, Math.max(minBound, snappedXVal)).toFixed(1)) : roundedX;
  const finalY = snappedYVal !== null ? Number(Math.min(maxBound, Math.max(minBound, snappedYVal)).toFixed(1)) : roundedY;

  const guideX =
    snappedXVal !== null
      ? {
          coord: finalX,
          isCenter: isCenterX,
          matches: isCenterX ? [] : anchors.filter((a) => Math.abs(a.x - snappedXVal) <= 0.15)
        }
      : null;

  const guideY =
    snappedYVal !== null
      ? {
          coord: finalY,
          isCenter: isCenterY,
          matches: isCenterY ? [] : anchors.filter((a) => Math.abs(a.y - snappedYVal) <= 0.15)
        }
      : null;

  return { x: finalX, y: finalY, guideX, guideY };
}

function appendGuideDot(svg, x, y, color) {
  svg.appendChild(
    createSvgEl('line', {
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      stroke: '#ffffff',
      'stroke-width': 9,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke'
    })
  );
  svg.appendChild(
    createSvgEl('line', {
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      stroke: color,
      'stroke-width': 5.5,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke'
    })
  );
}

function renderAlignGuides(guideSvg, snapResult, opts = {}) {
  if (!guideSvg) return;
  guideSvg.innerHTML = '';
  if (!snapResult) return;

  const { x, y, guideX, guideY } = snapResult;

  if (guideX) {
    const color = guideX.isCenter ? '#0284c7' : '#ef4444';
    const ys = guideX.matches.map((m) => m.y).concat(y);
    const y1 = guideX.isCenter ? 2 : Math.max(1, Math.min(...ys) - 3);
    const y2 = guideX.isCenter ? 98 : Math.min(99, Math.max(...ys) + 3);
    guideSvg.appendChild(
      createSvgEl('line', {
        x1: guideX.coord,
        y1,
        x2: guideX.coord,
        y2,
        stroke: color,
        'stroke-width': 1.6,
        'stroke-dasharray': '4 3',
        'vector-effect': 'non-scaling-stroke'
      })
    );
    for (const m of guideX.matches) {
      appendGuideDot(guideSvg, guideX.coord, m.y, color);
    }
  }

  if (guideY) {
    const color = guideY.isCenter ? '#0284c7' : '#ef4444';
    const xs = guideY.matches.map((m) => m.x).concat(x);
    const x1 = guideY.isCenter ? 2 : Math.max(1, Math.min(...xs) - 3);
    const x2 = guideY.isCenter ? 98 : Math.min(99, Math.max(...xs) + 3);
    guideSvg.appendChild(
      createSvgEl('line', {
        x1,
        y1: guideY.coord,
        x2,
        y2: guideY.coord,
        stroke: color,
        'stroke-width': 1.6,
        'stroke-dasharray': '4 3',
        'vector-effect': 'non-scaling-stroke'
      })
    );
    for (const m of guideY.matches) {
      appendGuideDot(guideSvg, m.x, guideY.coord, color);
    }
  }

  if (opts.showPreviewDot && (guideX || guideY)) {
    appendGuideDot(guideSvg, x, y, '#7c3aed');
  }
}

function flashAlignGuide(pageNum, axis, target, currentX, currentY) {
  clearAllAlignGuides();
  const guideSvg = getGuideSvgForPage(pageNum);
  if (!guideSvg) return;
  const snapResult = {
    x: currentX,
    y: currentY,
    guideX: axis === 'x' ? { coord: target.x, isCenter: false, matches: [target] } : null,
    guideY: axis === 'y' ? { coord: target.y, isCenter: false, matches: [target] } : null
  };
  renderAlignGuides(guideSvg, snapResult);
  alignFlashTimer = setTimeout(() => {
    clearAlignGuides(guideSvg);
    alignFlashTimer = null;
  }, 900);
}

function alignSelectedHotspotToNearest(axis) {
  const hs = state.hotspots.find((item) => item.id === state.selectedId);
  if (!hs) return;
  const candidates = state.hotspots.filter((item) => item.page === hs.page && item.id !== hs.id);
  if (!candidates.length) {
    showToast('같은 페이지에 맞출 다른 버튼이 없습니다.');
    return;
  }

  // Score by primary axis distance first, then cross-axis proximity
  let best = null;
  let bestScore = Infinity;
  for (const cand of candidates) {
    const primaryDiff = axis === 'x' ? Math.abs(cand.x - hs.x) : Math.abs(cand.y - hs.y);
    const crossDiff = axis === 'x' ? Math.abs(cand.y - hs.y) : Math.abs(cand.x - hs.x);
    if (primaryDiff > 18) continue;
    const score = primaryDiff * 10 + crossDiff * 0.2;
    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  if (!best) {
    showToast(axis === 'x' ? '위/아래 근처에 세로로 맞출 버튼이 없습니다.' : '양옆 근처에 가로로 맞출 버튼이 없습니다.');
    return;
  }

  if (axis === 'x') {
    const dx = best.x - hs.x;
    hs.x = best.x;
    if (hs.type === 'line_answer' && typeof hs.endX === 'number') {
      hs.endX = Number(Math.min(97, Math.max(3, hs.endX + dx)).toFixed(1));
    }
  } else {
    const dy = best.y - hs.y;
    hs.y = best.y;
    if (hs.type === 'line_answer' && typeof hs.endY === 'number') {
      hs.endY = Number(Math.min(97, Math.max(3, hs.endY + dy)).toFixed(1));
    }
  }

  persistState();
  renderHotspots();
  selectHotspot(hs.id);
  flashAlignGuide(hs.page, axis, best, hs.x, hs.y);
  showToast(
    axis === 'x'
      ? `세로선(X ${best.x.toFixed(1)}%)에 딱 맞췄습니다.`
      : `가로선(Y ${best.y.toFixed(1)}%)에 딱 맞췄습니다.`
  );
}

function renderLineLayer(svgEl, overlayEl, pageNum) {
  if (!svgEl) return;
  svgEl.innerHTML = '';
  if (!pageNum) return;

  const lineList = state.hotspots.filter((h) => h.page === pageNum && h.type === 'line_answer');
  for (const hs of lineList) {
    const isEditor = state.mode === 'editor';
    const isRevealed = state.mode === 'viewer' && state.revealedAnswers.has(hs.id);
    if (!isEditor && !isRevealed) continue;

    const endX = typeof hs.endX === 'number' ? hs.endX : Math.min(92, hs.x + 22);
    const endY = typeof hs.endY === 'number' ? hs.endY : hs.y;
    const color = hs.lineColor || '#ef4444';
    const width = Number(hs.lineWidth || 4);

    const lineEl = createSvgEl('line', {
      x1: hs.x,
      y1: hs.y,
      x2: endX,
      y2: endY,
      stroke: color,
      'stroke-width': width,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke',
      'data-line-id': hs.id
    });
    if (isEditor) {
      lineEl.setAttribute('stroke-dasharray', '6 4');
    }
    svgEl.appendChild(lineEl);

    // Perfect circular endpoint caps using zero-length round-capped strokes
    const startDot = createSvgEl('line', {
      x1: hs.x,
      y1: hs.y,
      x2: hs.x,
      y2: hs.y,
      stroke: color,
      'stroke-width': width * 2.4,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke',
      'data-dot-start': hs.id
    });
    const endDot = createSvgEl('line', {
      x1: endX,
      y1: endY,
      x2: endX,
      y2: endY,
      stroke: color,
      'stroke-width': width * 2.4,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke',
      'data-dot-end': hs.id
    });
    svgEl.appendChild(startDot);
    svgEl.appendChild(endDot);

    if (!isEditor && isRevealed) {
      const hitLine = createSvgEl('line', {
        x1: hs.x,
        y1: hs.y,
        x2: endX,
        y2: endY,
        stroke: 'transparent',
        'stroke-width': Math.max(20, width * 4),
        'stroke-linecap': 'round',
        'vector-effect': 'non-scaling-stroke',
        class: 'line-hit-area'
      });
      hitLine.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.suppressNextStageClick) return;
        toggleAnswerHotspotInPlace(hs);
      });
      svgEl.appendChild(hitLine);
    }

    if (isEditor) {
      const endHandle = document.createElement('div');
      endHandle.className = 'line-end-handle';
      if (hs.id === state.selectedId) endHandle.classList.add('is-selected');
      endHandle.dataset.id = hs.id;
      endHandle.style.left = `${endX}%`;
      endHandle.style.top = `${endY}%`;
      endHandle.style.background = color;
      endHandle.title = '드래그하여 선 끝점 위치 조절';

      endHandle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        closeHotspotContextMenu();
        e.stopPropagation();
        e.preventDefault();
        selectHotspot(hs.id);
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const origEndX = endX;
        const origEndY = endY;
        let moved = false;

        const onMove = (ev) => {
          const rect = overlayEl.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const dxPct = ((ev.clientX - startClientX) / rect.width) * 100;
          const dyPct = ((ev.clientY - startClientY) / rect.height) * 100;
          if (Math.abs(ev.clientX - startClientX) > 2 || Math.abs(ev.clientY - startClientY) > 2) {
            moved = true;
          }
          const snap = computeSmartSnap(origEndX + dxPct, origEndY + dyPct, pageNum, rect, {
            excludeId: hs.id,
            bypass: ev.altKey,
            includeSelfEndpoint: { x: hs.x, y: hs.y }
          });
          hs.endX = snap.x;
          hs.endY = snap.y;
          endHandle.style.left = `${snap.x}%`;
          endHandle.style.top = `${snap.y}%`;
          lineEl.setAttribute('x2', String(snap.x));
          lineEl.setAttribute('y2', String(snap.y));
          endDot.setAttribute('x1', String(snap.x));
          endDot.setAttribute('y1', String(snap.y));
          endDot.setAttribute('x2', String(snap.x));
          endDot.setAttribute('y2', String(snap.y));
          renderAlignGuides(getGuideSvgForOverlay(overlayEl), snap);
        };

        const onUp = () => {
          clearAlignGuides(getGuideSvgForOverlay(overlayEl));
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          if (moved) persistState();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });

      endHandle.addEventListener('click', (e) => {
        e.stopPropagation();
        selectHotspot(hs.id);
      });

      endHandle.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectHotspot(hs.id);
        openHotspotContextMenu(e.clientX, e.clientY, hs.id, null);
      });

      overlayEl.appendChild(endHandle);
    }
  }
}

function createHotspotNode(hs, overlayEl, svgEl) {
  if (state.mode === 'viewer' && hs.type === 'line_answer' && state.revealedAnswers.has(hs.id)) {
    return null;
  }

  const node = document.createElement('div');
  node.className = 'hotspot-node';
  if (state.mode === 'editor' && hs.id === state.selectedId) {
    node.classList.add('is-selected');
  }
  node.style.left = `${hs.x}%`;
  node.style.top = `${hs.y}%`;
  node.style.setProperty('--hs-scale', String(hs.scale || 1));
  node.dataset.id = hs.id;

  const answerKind = getEffectiveAnswerKind(hs);
  const isRevealed = state.mode === 'viewer' && (hs.type === 'answer' || hs.type === 'crossword_answer') && state.revealedAnswers.has(hs.id);

  if (hs.type === 'jump_area') {
    node.classList.add('is-jump-area');
    node.style.width = `${hs.boxWidth || 38}%`;
    node.style.height = `${hs.boxHeight || 6}%`;
    const box = buildJumpAreaBox(hs, state.mode === 'editor');
    node.appendChild(box);
    attachHotspotEvents(node, box, hs, overlayEl, svgEl);
  } else if (hs.type === 'crossword_answer' && (state.mode === 'editor' || isRevealed)) {
    node.classList.add('is-crossword');
    node.style.width = `${hs.boxWidth || 24}%`;
    node.style.height = `${hs.boxHeight || 6}%`;
    const grid = buildCrosswordBox(hs, state.mode === 'editor');
    if (state.mode === 'viewer') {
      grid.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.suppressNextStageClick) return;
        toggleAnswerHotspotInPlace(hs);
      });
    } else {
      attachHotspotEvents(node, grid, hs, overlayEl, svgEl);
    }
    node.appendChild(grid);
  } else if (state.mode === 'editor' && hs.type === 'answer' && answerKind === 'image') {
    node.classList.add('is-answer-box');
    node.style.width = `${hs.answerWidth || 30}%`;
    const box = buildAnswerImageBox(hs, true);
    node.appendChild(box);
    attachHotspotEvents(node, box, hs, overlayEl, svgEl);
  } else if (isRevealed && hs.type === 'answer' && hs.answerStyle !== 'modal') {
    if (answerKind === 'image' && hs.answerImage) {
      node.classList.add('is-answer-box');
      node.style.width = `${hs.answerWidth || 30}%`;
      const box = buildAnswerImageBox(hs, false);
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.suppressNextStageClick) return;
        toggleAnswerHotspotInPlace(hs);
      });
      node.appendChild(box);
    } else {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'answer-pill';
      const fallbackMsg = answerKind === 'image' ? '(정답 이미지 미등록)' : '(정답 미입력)';
      pill.textContent = (hs.answer && hs.answer.trim()) ? hs.answer : fallbackMsg;
      pill.title = '누르면 ? 버튼으로 돌아갑니다';
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.suppressNextStageClick) return;
        toggleAnswerHotspotInPlace(hs);
      });
      node.appendChild(pill);
    }
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hotspot-btn hotspot-btn--${hs.type}`;
    btn.title = hs.type === 'toc' ? `${hs.targetPage || 1}쪽으로 이동` : (hs.title || '');
    btn.innerHTML = hs.type === 'toc' ? escapeHtml(hs.title || '차례') : getIconSvg(hs.type);
    if (hs.type === 'line_answer' && hs.lineColor) {
      btn.style.background = hs.lineColor;
    }
    node.appendChild(btn);

    if (state.mode === 'editor') {
      const tag = document.createElement('span');
      tag.className = 'hotspot-editor-tag';
      if (hs.type === 'answer') {
        tag.textContent = (hs.answer && hs.answer.trim()) || hs.title || '정답';
      } else if (hs.type === 'toc') {
        tag.textContent = `→ ${hs.targetPage || 1}쪽`;
      } else if (hs.type === 'line_answer') {
        tag.textContent = hs.title || '선 잇기';
      } else {
        tag.textContent = hs.title || hs.type;
      }
      node.appendChild(tag);
    }

    attachHotspotEvents(node, btn, hs, overlayEl, svgEl);
  }

  return node;
}

function toggleAnswerHotspotInPlace(hs) {
  if (state.revealedAnswers.has(hs.id)) {
    state.revealedAnswers.delete(hs.id);
  } else {
    state.revealedAnswers.add(hs.id);
  }

  const { leftPage, rightPage } = getVisiblePages();
  const isLeft = hs.page === leftPage;
  const isRight = hs.page === rightPage;
  if (!isLeft && !isRight) return;

  const overlayEl = isLeft ? el.leftOverlay : el.rightOverlay;
  const svgEl = isLeft ? el.leftLineSvg : el.rightLineSvg;

  if (hs.type === 'line_answer') {
    renderLineLayer(svgEl, overlayEl, hs.page);
  }

  const existing = overlayEl.querySelector(`.hotspot-node[data-id="${hs.id}"]`);
  const nextNode = createHotspotNode(hs, overlayEl, svgEl);
  if (existing && nextNode) {
    existing.replaceWith(nextNode);
  } else if (existing && !nextNode) {
    existing.remove();
  } else if (!existing && nextNode) {
    overlayEl.appendChild(nextNode);
  }
}

function renderOverlay(overlayEl, pageNum, svgEl) {
  overlayEl.innerHTML = '';
  if (svgEl) svgEl.innerHTML = '';
  if (!pageNum) {
    delete overlayEl.dataset.page;
    return;
  }
  overlayEl.dataset.page = String(pageNum);

  renderLineLayer(svgEl, overlayEl, pageNum);

  const list = state.hotspots.filter((h) => h.page === pageNum);
  for (const hs of list) {
    const node = createHotspotNode(hs, overlayEl, svgEl);
    if (node) {
      overlayEl.appendChild(node);
    }
  }
}

function closeHotspotContextMenu() {
  el.hotspotContextMenu.hidden = true;
  state.contextTargetId = null;
  state.contextEmptyTarget = null;
}

function openHotspotContextMenu(clientX, clientY, hotspotId, emptyTarget) {
  if (state.mode !== 'editor') return;
  state.contextTargetId = hotspotId || null;
  state.contextEmptyTarget = emptyTarget || null;

  const isOnHotspot = Boolean(hotspotId);
  el.ctxDuplicateBtn.hidden = !isOnHotspot;
  el.ctxCopyBtn.hidden = !isOnHotspot;
  el.ctxDivider.hidden = !isOnHotspot;
  el.ctxDeleteBtn.hidden = !isOnHotspot;
  el.ctxPasteBtn.hidden = isOnHotspot || !state.clipboardHotspot;

  if (el.ctxDuplicateBtn.hidden && el.ctxPasteBtn.hidden) {
    closeHotspotContextMenu();
    return;
  }

  el.hotspotContextMenu.hidden = false;
  const menuRect = el.hotspotContextMenu.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - menuRect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - menuRect.height - 8);
  el.hotspotContextMenu.style.left = `${Math.min(clientX, maxLeft)}px`;
  el.hotspotContextMenu.style.top = `${Math.min(clientY, maxTop)}px`;
}

function copyHotspotById(id) {
  const hs = state.hotspots.find((item) => item.id === id);
  if (!hs) return false;
  state.clipboardHotspot = { ...hs };
  showToast('버튼을 복사했습니다. (Ctrl+V 또는 빈 곳 우클릭으로 붙여넣기)');
  return true;
}

function cloneHotspotAt(source, targetPage, targetX, targetY) {
  const clampedX = Number(Math.min(96, Math.max(4, targetX)).toFixed(1));
  const clampedY = Number(Math.min(96, Math.max(4, targetY)).toFixed(1));
  const copy = {
    ...source,
    id: `hs-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    page: targetPage,
    x: clampedX,
    y: clampedY
  };
  if (source.type === 'line_answer') {
    const dx = clampedX - source.x;
    const dy = clampedY - source.y;
    const srcEndX = typeof source.endX === 'number' ? source.endX : Math.min(92, source.x + 22);
    const srcEndY = typeof source.endY === 'number' ? source.endY : source.y;
    copy.endX = Number(Math.min(96, Math.max(4, srcEndX + dx)).toFixed(1));
    copy.endY = Number(Math.min(96, Math.max(4, srcEndY + dy)).toFixed(1));
  }
  state.hotspots.push(copy);
  persistState();
  renderHotspots();
  selectHotspot(copy.id);
  return copy;
}

function duplicateHotspotById(id) {
  const hs = state.hotspots.find((item) => item.id === id);
  if (!hs) return;
  cloneHotspotAt(hs, hs.page, hs.x + 3, hs.y + 3);
  showToast('버튼을 복제했습니다.');
}

function pasteHotspotFromClipboard(targetOverride) {
  if (!state.clipboardHotspot) return;
  const src = state.clipboardHotspot;
  let targetPage = src.page;
  let nextX = src.x + 3;
  let nextY = src.y + 3;

  if (targetOverride) {
    targetPage = targetOverride.page;
    nextX = targetOverride.x;
    nextY = targetOverride.y;
  } else {
    const { leftPage, rightPage } = getVisiblePages();
    if (src.page !== leftPage && src.page !== rightPage) {
      targetPage = leftPage || rightPage || src.page;
    }
  }

  const created = cloneHotspotAt(src, targetPage, nextX, nextY);
  // Nudge clipboard offset so repeated Ctrl+V cascades neatly
  state.clipboardHotspot = { ...created };
  showToast('버튼을 붙여넣었습니다.');
}

function deleteHotspotById(id) {
  if (!id) return;
  const exists = state.hotspots.some((item) => item.id === id);
  if (!exists) return;
  state.hotspots = state.hotspots.filter((item) => item.id !== id);
  persistState();
  if (state.selectedId === id) {
    selectHotspot(null);
  }
  renderHotspots();
  showToast('버튼을 삭제했습니다.');
}

function attachHotspotEvents(node, triggerEl, hs, overlayEl, svgEl) {
  let dragging = false;
  let resizing = false;
  let moved = false;
  let startClientX = 0;
  let startClientY = 0;
  let startX = hs.x;
  let startY = hs.y;
  const isBoxResize = hs.type === 'jump_area' || hs.type === 'crossword_answer';
  let startWidthPct = isBoxResize
    ? (hs.boxWidth || (hs.type === 'crossword_answer' ? 24 : 38))
    : (hs.answerWidth || 30);
  let startHeightPct = hs.boxHeight || 6;

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
      startClientY = e.clientY;
      startWidthPct = isBoxResize
        ? (hs.boxWidth || (hs.type === 'crossword_answer' ? 24 : 38))
        : (hs.answerWidth || 30);
      startHeightPct = hs.boxHeight || 6;

      const onMove = (ev) => {
        if (!resizing) return;
        const overlayRect = overlayEl.getBoundingClientRect();
        if (!overlayRect.width || !overlayRect.height) return;
        const deltaXPct = ((ev.clientX - startClientX) / overlayRect.width) * 100 * 2;
        if (isBoxResize) {
          const deltaYPct = ((ev.clientY - startClientY) / overlayRect.height) * 100 * 2;
          const nextW = Math.min(95, Math.max(4, startWidthPct + deltaXPct));
          const nextH = Math.min(95, Math.max(2.5, startHeightPct + deltaYPct));
          hs.boxWidth = Number(nextW.toFixed(1));
          hs.boxHeight = Number(nextH.toFixed(1));
          node.style.width = `${hs.boxWidth}%`;
          node.style.height = `${hs.boxHeight}%`;
          moved = true;
          if (state.selectedId === hs.id) {
            const msg = `크기: 가로 ${Math.round(hs.boxWidth)}% × 세로 ${Math.round(hs.boxHeight)}% (모서리 ↘ 드래그로 조절)`;
            if (hs.type === 'crossword_answer') {
              el.cwBoxSizeLabel.textContent = msg;
            } else {
              el.jumpBoxSizeLabel.textContent = msg;
            }
          }
        } else {
          const nextWidth = Math.min(90, Math.max(10, startWidthPct + deltaXPct));
          hs.answerWidth = Number(nextWidth.toFixed(1));
          node.style.width = `${hs.answerWidth}%`;
          moved = true;
          if (state.selectedId === hs.id) {
            el.answerBoxSizeLabel.textContent = `크기: 가로 ${Math.round(hs.answerWidth)}% (페이지 위 ↘ 드래그로 조절)`;
          }
        }
      };

      const onUp = () => {
        resizing = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (moved) persistState();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  node.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'editor') return;
    if (e.button !== 0) return;
    if (e.target.closest('.resize-handle')) return;
    closeHotspotContextMenu();
    e.stopPropagation();
    e.preventDefault();
    selectHotspot(hs.id);
    dragging = true;
    moved = false;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startX = hs.x;
    startY = hs.y;

    const svgLine = svgEl ? svgEl.querySelector(`line[data-line-id="${hs.id}"]`) : null;
    const svgStartDot = svgEl ? svgEl.querySelector(`line[data-dot-start="${hs.id}"]`) : null;

    const onMove = (ev) => {
      if (!dragging || state.mode !== 'editor') return;
      const rect = overlayEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dxPct = ((ev.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startClientY) / rect.height) * 100;
      if (Math.abs(ev.clientX - startClientX) > 3 || Math.abs(ev.clientY - startClientY) > 3) {
        moved = true;
      }
      const snap = computeSmartSnap(startX + dxPct, startY + dyPct, hs.page, rect, {
        excludeId: hs.id,
        bypass: ev.altKey
      });
      hs.x = snap.x;
      hs.y = snap.y;
      node.style.left = `${hs.x}%`;
      node.style.top = `${hs.y}%`;
      if (svgLine) {
        svgLine.setAttribute('x1', String(hs.x));
        svgLine.setAttribute('y1', String(hs.y));
      }
      if (svgStartDot) {
        svgStartDot.setAttribute('x1', String(hs.x));
        svgStartDot.setAttribute('y1', String(hs.y));
        svgStartDot.setAttribute('x2', String(hs.x));
        svgStartDot.setAttribute('y2', String(hs.y));
      }
      renderAlignGuides(getGuideSvgForOverlay(overlayEl), snap);
      if (state.selectedId === hs.id) {
        el.propCoords.textContent = `위치: 원본 ${hs.page}쪽 · X ${hs.x.toFixed(1)}%, Y ${hs.y.toFixed(1)}%`;
      }
    };

    const onUp = () => {
      dragging = false;
      clearAlignGuides(getGuideSvgForOverlay(overlayEl));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (moved) persistState();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // Always stop click bubbling from node so Inspector never flashes & closes!
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.mode === 'editor') {
      selectHotspot(hs.id);
    }
  });

  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.suppressNextStageClick) return;
    if (state.mode === 'editor') {
      selectHotspot(hs.id);
      return;
    }
    activateHotspot(hs);
  });

  node.addEventListener('contextmenu', (e) => {
    if (state.mode !== 'editor') return;
    e.preventDefault();
    e.stopPropagation();
    selectHotspot(hs.id);
    openHotspotContextMenu(e.clientX, e.clientY, hs.id, null);
  });
}

function activateHotspot(hs) {
  if (hs.type === 'answer' || hs.type === 'line_answer' || hs.type === 'crossword_answer') {
    if (hs.type === 'answer' && hs.answerStyle === 'modal') {
      openAnswerModal(hs);
      return;
    }
    toggleAnswerHotspotInPlace(hs);
    return;
  }

  if (hs.type === 'video' || hs.type === 'article') {
    openHotspotLinkInNewTab(hs);
    return;
  }

  if (hs.type === 'toc' || hs.type === 'jump_area') {
    goToDisplayPage(hs.targetPage || 1);
  }
}

function resolveSafeExternalUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed === 'https://' || trimmed === 'http://') return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function openHotspotLinkInNewTab(hs) {
  const targetUrl = resolveSafeExternalUrl(hs.url);
  if (!targetUrl) {
    const label = hs.type === 'article' ? '기사/웹' : '영상';
    showToast(`연결된 ${label} 링크(URL)가 없거나 올바르지 않습니다.`);
    return;
  }
  const link = document.createElement('a');
  link.href = targetUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  clearAllAlignGuides();
  const { leftPage, rightPage } = getVisiblePages();
  renderOverlay(el.leftOverlay, leftPage, el.leftLineSvg);
  renderOverlay(el.rightOverlay, rightPage, el.rightLineSvg);
  renderThumbnails();
  renderTocDrawer();
}

const MAX_PAGE_CACHE = 8;
const pageRenderCache = new Map();
const inFlightPageRenders = new Map();
const slotRenderTokens = { left: 0, right: 0 };

function clearPageRenderCache() {
  for (const c of pageRenderCache.values()) {
    c.width = 0;
    c.height = 0;
  }
  pageRenderCache.clear();
  inFlightPageRenders.clear();
}

function getCachedOffscreenPage(pdfPageNum) {
  const cached = pageRenderCache.get(pdfPageNum);
  if (!cached) return null;
  // Refresh LRU order
  pageRenderCache.delete(pdfPageNum);
  pageRenderCache.set(pdfPageNum, cached);
  return cached;
}

function storeOffscreenPage(pdfPageNum, offCanvas) {
  if (pageRenderCache.has(pdfPageNum)) {
    pageRenderCache.delete(pdfPageNum);
  }
  pageRenderCache.set(pdfPageNum, offCanvas);
  while (pageRenderCache.size > MAX_PAGE_CACHE) {
    const oldestKey = pageRenderCache.keys().next().value;
    const oldestCanvas = pageRenderCache.get(oldestKey);
    if (oldestCanvas) {
      oldestCanvas.width = 0;
      oldestCanvas.height = 0;
    }
    pageRenderCache.delete(oldestKey);
  }
}

async function renderPdfPageToOffscreen(pdfPageNum, slotWidth) {
  const cached = getCachedOffscreenPage(pdfPageNum);
  if (cached) return cached;

  if (inFlightPageRenders.has(pdfPageNum)) {
    return inFlightPageRenders.get(pdfPageNum);
  }

  const job = (async () => {
    const page = await state.pdfDoc.getPage(pdfPageNum);
    const unscaledViewport = page.getViewport({ scale: 1 });
    state.pageAspectRatio = unscaledViewport.width / unscaledViewport.height;

    const dpr = Math.max(window.devicePixelRatio || 1, 2.5);
    const desiredPixelWidth = Math.min(2200, Math.max(1800, Math.round((slotWidth || 460) * dpr * 1.6)));
    const scale = desiredPixelWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const offCanvas = document.createElement('canvas');
    offCanvas.width = Math.floor(viewport.width);
    offCanvas.height = Math.floor(viewport.height);
    const offCtx = offCanvas.getContext('2d', { alpha: false });
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    await page.render({ canvasContext: offCtx, viewport }).promise;
    storeOffscreenPage(pdfPageNum, offCanvas);
    return offCanvas;
  })();

  inFlightPageRenders.set(pdfPageNum, job);
  try {
    return await job;
  } finally {
    inFlightPageRenders.delete(pdfPageNum);
  }
}

async function renderSlot(side, pdfPageNum, displayNum) {
  const slot = side === 'left' ? el.leftPageSlot : el.rightPageSlot;
  const canvas = side === 'left' ? el.leftCanvas : el.rightCanvas;
  const sampleLayer = side === 'left' ? el.leftSamplePage : el.rightSamplePage;
  const badge = side === 'left' ? el.leftPageNum : el.rightPageNum;

  const myToken = ++slotRenderTokens[side];
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

  try {
    const offCanvas = await renderPdfPageToOffscreen(pdfPageNum, slot.clientWidth || 460);
    if (myToken !== slotRenderTokens[side]) return;

    slot.style.aspectRatio = String(offCanvas.width / offCanvas.height);
    if (canvas.width !== offCanvas.width || canvas.height !== offCanvas.height) {
      canvas.width = offCanvas.width;
      canvas.height = offCanvas.height;
    }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(offCanvas, 0, 0);
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
  el.pageJumpTotal.textContent = `/ ${total}`;
  el.pageJumpInput.max = String(total);

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

function resetTocForm() {
  state.editingTocId = null;
  el.tocLevelInput.value = 'unit';
  el.tocPageInput.value = '';
  el.tocTitleInput.value = '';
  el.tocSaveBtn.textContent = '목차 추가';
  el.tocCancelEditBtn.hidden = true;
}

function renderTocDrawer() {
  if (el.tocDrawer.hidden) return;
  const { leftIndex, rightIndex } = getVisiblePages();
  const visiblePageNums = new Set([leftIndex + 1, rightIndex >= 0 ? rightIndex + 1 : -1]);
  el.tocList.innerHTML = '';

  if (state.tocItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent =
      state.mode === 'editor'
        ? '아직 등록된 목차가 없습니다. 아래에서 대단원/소단원 제목과 쪽수를 추가해 주세요.'
        : '등록된 목차가 아직 없습니다.';
    el.tocList.appendChild(empty);
    return;
  }

  state.tocItems.forEach((item, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'toc-item-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    const levelClass = item.level === 'subunit' ? 'toc-item--subunit' : 'toc-item--unit';
    btn.className = `toc-item ${levelClass}`;
    if (visiblePageNums.has(Number(item.page))) {
      btn.classList.add('is-active');
    }
    btn.innerHTML = `<span class="toc-item__title">${escapeHtml(item.title)}</span><span class="toc-item__page">${item.page}쪽</span>`;
    btn.title = `${item.title} (${item.page}쪽으로 이동)`;
    btn.addEventListener('click', () => goToDisplayPage(item.page));
    wrap.appendChild(btn);

    if (state.mode === 'editor') {
      const controls = document.createElement('div');
      controls.className = 'toc-item-controls';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'toc-mini-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => {
        if (index === 0) return;
        const [movedItem] = state.tocItems.splice(index, 1);
        state.tocItems.splice(index - 1, 0, movedItem);
        persistState();
        renderTocDrawer();
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'toc-mini-btn';
      downBtn.textContent = '↓';
      downBtn.disabled = index === state.tocItems.length - 1;
      downBtn.addEventListener('click', () => {
        if (index >= state.tocItems.length - 1) return;
        const [movedItem] = state.tocItems.splice(index, 1);
        state.tocItems.splice(index + 1, 0, movedItem);
        persistState();
        renderTocDrawer();
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'toc-mini-btn';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', () => {
        state.editingTocId = item.id;
        el.tocLevelInput.value = item.level === 'subunit' ? 'subunit' : 'unit';
        el.tocPageInput.value = String(item.page);
        el.tocTitleInput.value = item.title;
        el.tocSaveBtn.textContent = '수정 저장';
        el.tocCancelEditBtn.hidden = false;
        el.tocTitleInput.focus();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'toc-mini-btn toc-mini-btn--del';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => {
        state.tocItems = state.tocItems.filter((t) => t.id !== item.id);
        if (state.editingTocId === item.id) resetTocForm();
        persistState();
        renderTocDrawer();
      });

      controls.append(upBtn, downBtn, editBtn, delBtn);
      wrap.appendChild(controls);
    }

    el.tocList.appendChild(wrap);
  });
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

let prefetchTimer = null;
function prefetchAdjacentSpreads() {
  if (!state.pdfDoc) return;
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(async () => {
    const { leftIndex, rightIndex } = getVisiblePages();
    const candidates = [];
    if (rightIndex >= 0) {
      if (rightIndex + 1 < state.activePages.length) candidates.push(state.activePages[rightIndex + 1]);
      if (rightIndex + 2 < state.activePages.length) candidates.push(state.activePages[rightIndex + 2]);
    } else if (leftIndex + 1 < state.activePages.length) {
      candidates.push(state.activePages[leftIndex + 1]);
    }
    if (leftIndex - 1 >= 0) candidates.push(state.activePages[leftIndex - 1]);
    if (leftIndex - 2 >= 0) candidates.push(state.activePages[leftIndex - 2]);

    const slotWidth = el.leftPageSlot.clientWidth || 460;
    for (const pdfPageNum of candidates) {
      if (!state.pdfDoc) break;
      if (pageRenderCache.has(pdfPageNum)) continue;
      try {
        await renderPdfPageToOffscreen(pdfPageNum, slotWidth);
      } catch {
        // Ignore background prefetch errors
      }
    }
  }, 50);
}

async function renderSpread() {
  const { leftPage, rightPage, leftIndex, rightIndex } = getVisiblePages();
  updatePagerUi();
  await Promise.all([
    renderSlot('left', leftPage, leftIndex + 1),
    renderSlot('right', rightPage, rightIndex + 1)
  ]);
  renderHotspots();
  prefetchAdjacentSpreads();
}

function goToIndex(idx) {
  const maxIdx = Math.max(0, state.activePages.length - 1);
  const clamped = Math.min(maxIdx, Math.max(0, idx));
  state.currentIndex = state.layout === 'double' && clamped % 2 === 1 ? clamped - 1 : clamped;
  renderSpread();
}

function goToDisplayPage(pageNum) {
  const parsed = Number(pageNum);
  if (!Number.isFinite(parsed) || parsed < 1) return;
  goToIndex(Math.round(parsed) - 1);
}

function stepSpread(dir) {
  const delta = state.layout === 'double' ? 2 : 1;
  goToIndex(state.currentIndex + dir * delta);
}

function applyZoomAndPan() {
  el.bookZoomWrap.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  el.bookStage.classList.toggle('is-zoomed', state.zoom > 1);
}

function setZoom(nextZoom) {
  state.zoom = Math.min(2.4, Math.max(0.6, Number(nextZoom.toFixed(2))));
  if (state.zoom <= 1) {
    state.panX = 0;
    state.panY = 0;
  }
  applyZoomAndPan();
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setupStagePanning() {
  el.bookStage.addEventListener('pointerdown', (e) => {
    if (state.zoom <= 1) return;
    if (state.activeTool) return;
    if (e.button !== 0) return;
    if (e.target.closest('.hotspot-node, .resize-handle, .page-delete-btn, .side-nav-btn')) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPanX = state.panX;
    const startPanY = state.panY;
    let moved = false;

    el.bookStage.classList.add('is-panning');
    el.bookZoomWrap.classList.add('is-panning');

    const onMove = (ev) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
      }
      if (!moved) return;
      state.panX = startPanX + dx;
      state.panY = startPanY + dy;
      applyZoomAndPan();
    };

    const onUp = () => {
      el.bookStage.classList.remove('is-panning');
      el.bookZoomWrap.classList.remove('is-panning');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (moved) {
        state.suppressNextStageClick = true;
        setTimeout(() => {
          state.suppressNextStageClick = false;
        }, 50);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // Mouse wheel zoom directly on the book stage (cursor-anchored, instant GPU scaling)
  let wheelTransitionTimer = null;
  el.bookStage.addEventListener(
    'wheel',
    (e) => {
      if (!el.contentModal.hidden) return;
      if (!e.deltaY) return;
      e.preventDefault();

      el.bookZoomWrap.classList.add('is-panning');
      clearTimeout(wheelTransitionTimer);
      wheelTransitionTimer = setTimeout(() => {
        el.bookZoomWrap.classList.remove('is-panning');
      }, 120);

      const oldZoom = state.zoom;
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      const nextZoom = Math.min(2.4, Math.max(0.6, Number((oldZoom + step).toFixed(2))));
      if (nextZoom === oldZoom) return;

      if (nextZoom <= 1) {
        state.panX = 0;
        state.panY = 0;
      } else {
        const rect = el.bookStage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const mx = e.clientX - cx;
        const my = e.clientY - cy;
        const ratio = nextZoom / oldZoom;
        state.panX = Number((mx - (mx - state.panX) * ratio).toFixed(1));
        state.panY = Number((my - (my - state.panY) * ratio).toFixed(1));
      }

      setZoom(nextZoom);
    },
    { passive: false }
  );
}

let pointerDownOnEmptyOverlay = false;

function handleOverlayHover(e, overlayEl) {
  const guideSvg = getGuideSvgForOverlay(overlayEl);
  if (state.mode !== 'editor' || !state.activeTool || e.target.closest('.hotspot-node')) {
    clearAlignGuides(guideSvg);
    return;
  }
  const pageNum = Number(overlayEl.dataset.page);
  if (!pageNum) {
    clearAlignGuides(guideSvg);
    return;
  }
  const rect = overlayEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const rawX = ((e.clientX - rect.left) / rect.width) * 100;
  const rawY = ((e.clientY - rect.top) / rect.height) * 100;
  const snap = computeSmartSnap(rawX, rawY, pageNum, rect, {
    bypass: e.altKey,
    clampMin: 4,
    clampMax: 96
  });
  renderAlignGuides(guideSvg, snap, { showPreviewDot: true });
}

function handleOverlayClick(e, overlayEl) {
  if (state.suppressNextStageClick) return;
  if (state.mode !== 'editor') return;
  if (e.target.closest('.hotspot-node')) return;

  if (!state.activeTool) {
    if (pointerDownOnEmptyOverlay && e.target === overlayEl) {
      selectHotspot(null);
    }
    pointerDownOnEmptyOverlay = false;
    return;
  }
  pointerDownOnEmptyOverlay = false;

  const pageNum = Number(overlayEl.dataset.page);
  if (!pageNum) return;

  const rect = overlayEl.getBoundingClientRect();
  const rawX = ((e.clientX - rect.left) / rect.width) * 100;
  const rawY = ((e.clientY - rect.top) / rect.height) * 100;
  const snap = computeSmartSnap(rawX, rawY, pageNum, rect, {
    bypass: e.altKey,
    clampMin: 4,
    clampMax: 96
  });
  const x = snap.x;
  const y = snap.y;
  clearAllAlignGuides();

  const tool = state.activeTool;
  const isAnswer = tool === 'answer_text' || tool === 'answer_image';
  const answerKind = tool === 'answer_image' ? 'image' : 'text';
  const isToc = tool === 'toc';
  const isJumpArea = tool === 'jump_area';
  const isLine = tool === 'line_answer';
  const isCrossword = tool === 'crossword_answer';

  const newHotspot = {
    id: `hs-${Date.now()}`,
    page: pageNum,
    x,
    y,
    type: isAnswer ? 'answer' : tool,
    answerKind: isAnswer ? answerKind : undefined,
    title:
      tool === 'video'
        ? '새 영상 링크'
        : tool === 'article'
          ? '새 기사 링크'
          : tool === 'answer_image'
            ? '정답 이미지'
            : isToc
              ? '차례'
              : isJumpArea
                ? '주제 이동'
                : isLine
                  ? '선 잇기'
                  : isCrossword
                    ? '낱말 칸'
                    : '정답 확인',
    targetPage: isToc ? 2 : isJumpArea ? 6 : undefined,
    boxWidth: isJumpArea ? 38 : isCrossword ? 24 : undefined,
    boxHeight: isJumpArea || isCrossword ? 6 : undefined,
    endX: isLine ? Number(Math.min(92, x + 22).toFixed(1)) : undefined,
    endY: isLine ? y : undefined,
    lineColor: isLine ? '#ef4444' : undefined,
    lineWidth: isLine ? 4 : undefined,
    direction: isCrossword ? 'horizontal' : undefined,
    textColor: isCrossword ? '#dc2626' : undefined,
    url: isAnswer || isToc || isJumpArea || isLine || isCrossword ? '' : 'https://',
    note: '',
    answer: tool === 'answer_text' ? '정답' : isCrossword ? '당진시' : '',
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
  showToast(
    tool === 'answer_image'
      ? '정답(이미지) 버튼이 배치되었습니다. 오른쪽에서 이미지를 불러오세요.'
      : isJumpArea
        ? '투명 버튼이 배치되었습니다. 모서리 ↘ 드래그로 크기를 맞추고 이동 페이지를 입력하세요.'
        : isToc
          ? '차례 버튼이 배치되었습니다. 오른쪽에서 이동할 페이지를 설정하세요.'
          : isLine
            ? '선 잇기가 배치되었습니다. ? 버튼과 동그라미(●) 끝점을 각각 점에 맞추세요.'
            : isCrossword
              ? '낱말 칸이 배치되었습니다. 정답 낱말을 입력하고 모서리 ↘로 칸에 맞추세요.'
              : '버튼이 배치되었습니다. 오른쪽 패널에서 내용을 편집하세요.'
  );
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
  clearPageRenderCache();
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
    el.logoutBtn.hidden = true;
    el.cloudSaveBtn.hidden = true;
    return;
  }

  el.cloudSaveBtn.hidden = false;
  el.logoutBtn.hidden = !state.user;
  if (state.user) {
    const shortName = (state.user.email || '관리자').split('@')[0];
    el.logoutBtn.textContent = `${shortName} 로그아웃`;
  }
}

async function handleCloudSave() {
  if (!FirebaseTextbook.isConfigured()) {
    showToast('Firebase 설정이 연결되지 않았습니다.');
    return;
  }
  if (!state.user || !FirebaseTextbook.isAuthorizedAdmin(state.user)) {
    showToast('허용된 관리자 계정 로그인이 필요합니다.');
    await handleEnterEditorClick();
    if (!state.user || !FirebaseTextbook.isAuthorizedAdmin(state.user)) return;
  }

  const cleanHotspots = state.hotspots.map((h) =>
    Object.fromEntries(Object.entries(h).filter(([, val]) => val !== undefined))
  );

  const payload = {
    title: state.bookTitle,
    pdfUrl: (el.pdfPathInput.value || state.pdfUrl || '').trim(),
    totalRawPages: state.totalRawPages,
    activePages: state.activePages,
    tocItems: state.tocItems,
    hotspots: cleanHotspots
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
    if (err && (err.code === 'UNAUTHORIZED_ADMIN' || String(err.message) === 'UNAUTHORIZED_ADMIN')) {
      const allowed = FirebaseTextbook.getAllowedAdminEmails().join(', ');
      showToast(`저장 거부: 관리자 계정(${allowed})만 저장할 수 있습니다.`);
    } else if (err && (err.code === 'permission-denied' || String(err.message).includes('permission'))) {
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
    if (Array.isArray(data.tocItems)) {
      state.tocItems = data.tocItems;
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
    tocItems: state.tocItems,
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
  showToast('버튼 배치 및 목차·페이지 구성 JSON을 저장했습니다.');
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
    if (Array.isArray(data.tocItems)) {
      state.tocItems = data.tocItems;
    }
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
  el.inspectorForm.addEventListener('submit', (e) => e.preventDefault());

  const updateSelected = (updater) => {
    const hs = state.hotspots.find((item) => item.id === state.selectedId);
    if (!hs) return;
    updater(hs);
    persistState();
    syncInspectorForm(hs);
    renderHotspots();
  };

  el.propType.addEventListener('change', () => {
    const val = el.propType.value;
    updateSelected((hs) => {
      if (val === 'answer_text') {
        hs.type = 'answer';
        hs.answerKind = 'text';
      } else if (val === 'answer_image') {
        hs.type = 'answer';
        hs.answerKind = 'image';
        if (!hs.answerWidth) hs.answerWidth = 30;
      } else if (val === 'toc') {
        hs.type = 'toc';
        if (!hs.title || hs.title === '새 영상 링크') hs.title = '차례';
        if (!hs.targetPage) hs.targetPage = 2;
        delete hs.answerKind;
      } else if (val === 'jump_area') {
        hs.type = 'jump_area';
        if (!hs.boxWidth) hs.boxWidth = 38;
        if (!hs.boxHeight) hs.boxHeight = 6;
        if (!hs.targetPage) hs.targetPage = 6;
        delete hs.answerKind;
      } else if (val === 'line_answer') {
        hs.type = 'line_answer';
        if (typeof hs.endX !== 'number') hs.endX = Number(Math.min(92, hs.x + 22).toFixed(1));
        if (typeof hs.endY !== 'number') hs.endY = hs.y;
        if (!hs.lineColor) hs.lineColor = '#ef4444';
        if (!hs.lineWidth) hs.lineWidth = 4;
        delete hs.answerKind;
      } else if (val === 'crossword_answer') {
        hs.type = 'crossword_answer';
        if (!hs.direction) hs.direction = 'horizontal';
        if (!hs.boxWidth) hs.boxWidth = 24;
        if (!hs.boxHeight) hs.boxHeight = 6;
        if (!hs.textColor) hs.textColor = '#dc2626';
        if (!hs.answer || hs.answer === '정답') hs.answer = '당진시';
        delete hs.answerKind;
      } else {
        hs.type = val;
        delete hs.answerKind;
      }
    });
  });

  el.propTitle.addEventListener('input', () => updateSelected((hs) => { hs.title = el.propTitle.value; }));
  el.propTargetPage.addEventListener('input', () => {
    const val = Number(el.propTargetPage.value);
    updateSelected((hs) => {
      hs.targetPage = Number.isFinite(val) && val >= 1 ? Math.round(val) : 1;
    });
  });
  el.propUrl.addEventListener('input', () => updateSelected((hs) => { hs.url = el.propUrl.value; }));
  el.propNote.addEventListener('input', () => updateSelected((hs) => { hs.note = el.propNote.value; }));
  el.propAnswer.addEventListener('input', () => updateSelected((hs) => { hs.answer = el.propAnswer.value; }));
  el.propAnswerStyle.addEventListener('change', () => updateSelected((hs) => { hs.answerStyle = el.propAnswerStyle.value; }));
  el.propSize.addEventListener('input', () => updateSelected((hs) => { hs.scale = Number(el.propSize.value); }));

  el.propLineColor.addEventListener('input', () => updateSelected((hs) => { hs.lineColor = el.propLineColor.value; }));
  el.propLineWidth.addEventListener('input', () => updateSelected((hs) => { hs.lineWidth = Number(el.propLineWidth.value); }));
  document.querySelectorAll('[data-line-color]').forEach((btn) => {
    btn.addEventListener('click', () => updateSelected((hs) => { hs.lineColor = btn.dataset.lineColor; }));
  });

  el.propCwDirection.addEventListener('change', () => {
    const nextDir = el.propCwDirection.value;
    updateSelected((hs) => {
      if (hs.direction !== nextDir) {
        const prevW = hs.boxWidth || 24;
        const prevH = hs.boxHeight || 6;
        const ratio = state.pageAspectRatio || 0.72;
        hs.boxWidth = Number(Math.max(4, Math.min(90, prevH / ratio)).toFixed(1));
        hs.boxHeight = Number(Math.max(3, Math.min(90, prevW * ratio)).toFixed(1));
        hs.direction = nextDir;
      }
    });
  });
  el.propCwColor.addEventListener('input', () => updateSelected((hs) => { hs.textColor = el.propCwColor.value; }));
  document.querySelectorAll('[data-cw-color]').forEach((btn) => {
    btn.addEventListener('click', () => updateSelected((hs) => { hs.textColor = btn.dataset.cwColor; }));
  });

  el.propAnswerImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageAsResizedDataUrl(file);
      updateSelected((hs) => {
        hs.answerKind = 'image';
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
    if (hs.type === 'answer' || hs.type === 'crossword_answer') {
      openAnswerModal(hs);
      return;
    }
    if (hs.type === 'line_answer') {
      showToast('관찰자 모드에서 ?를 누르면 시작점과 끝점 사이에 선이 그려집니다.');
      return;
    }
    activateHotspot(hs);
  });

  el.deleteHotspotBtn.addEventListener('click', () => {
    deleteHotspotById(state.selectedId);
  });

  el.alignColBtn.addEventListener('click', () => alignSelectedHotspotToNearest('x'));
  el.alignRowBtn.addEventListener('click', () => alignSelectedHotspotToNearest('y'));

  el.closeInspectorBtn.addEventListener('click', () => selectHotspot(null));
}

function bindEvents() {
  el.enterEditorBtn.addEventListener('click', handleEnterEditorClick);
  el.exitEditorBtn.addEventListener('click', () => setMode('viewer'));
  el.logoutBtn.addEventListener('click', async () => {
    await FirebaseTextbook.signOutUser();
    setMode('viewer');
    showToast('로그아웃되었습니다.');
  });

  el.bookTitleInput.addEventListener('input', () => {
    state.bookTitle = el.bookTitleInput.value;
    persistState();
  });

  el.toolPills.forEach((pill) => {
    pill.addEventListener('click', () => selectTool(pill.dataset.tool));
  });

  el.toggleSnapGuidesBtn.addEventListener('click', () => {
    state.snapGuidesEnabled = !state.snapGuidesEnabled;
    el.toggleSnapGuidesBtn.classList.toggle('is-selected', state.snapGuidesEnabled);
    if (!state.snapGuidesEnabled) clearAllAlignGuides();
    showToast(
      state.snapGuidesEnabled
        ? '정렬선 및 자석 맞춤이 켜졌습니다.'
        : '정렬선 및 자석 맞춤이 꺼졌습니다.'
    );
  });

  el.leftOverlay.addEventListener('pointerdown', (e) => {
    pointerDownOnEmptyOverlay = e.target === el.leftOverlay;
  });
  el.rightOverlay.addEventListener('pointerdown', (e) => {
    pointerDownOnEmptyOverlay = e.target === el.rightOverlay;
  });
  el.leftOverlay.addEventListener('pointermove', (e) => handleOverlayHover(e, el.leftOverlay));
  el.rightOverlay.addEventListener('pointermove', (e) => handleOverlayHover(e, el.rightOverlay));
  el.leftOverlay.addEventListener('pointerleave', () => clearAlignGuides(el.leftGuideSvg));
  el.rightOverlay.addEventListener('pointerleave', () => clearAlignGuides(el.rightGuideSvg));
  el.leftOverlay.addEventListener('click', (e) => handleOverlayClick(e, el.leftOverlay));
  el.rightOverlay.addEventListener('click', (e) => handleOverlayClick(e, el.rightOverlay));

  const handleEmptyContextMenu = (e, overlayEl) => {
    if (state.mode !== 'editor') return;
    if (e.target.closest('.hotspot-node')) return;
    if (!state.clipboardHotspot) return;
    const pageNum = Number(overlayEl.dataset.page);
    if (!pageNum) return;
    e.preventDefault();
    const rect = overlayEl.getBoundingClientRect();
    const x = Number(Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100)).toFixed(1));
    const y = Number(Math.min(96, Math.max(4, ((e.clientY - rect.top) / rect.height) * 100)).toFixed(1));
    openHotspotContextMenu(e.clientX, e.clientY, null, { page: pageNum, x, y });
  };
  el.leftOverlay.addEventListener('contextmenu', (e) => handleEmptyContextMenu(e, el.leftOverlay));
  el.rightOverlay.addEventListener('contextmenu', (e) => handleEmptyContextMenu(e, el.rightOverlay));

  el.ctxDuplicateBtn.addEventListener('click', () => {
    const id = state.contextTargetId;
    closeHotspotContextMenu();
    duplicateHotspotById(id);
  });
  el.ctxCopyBtn.addEventListener('click', () => {
    const id = state.contextTargetId;
    closeHotspotContextMenu();
    copyHotspotById(id);
  });
  el.ctxPasteBtn.addEventListener('click', () => {
    const target = state.contextEmptyTarget;
    closeHotspotContextMenu();
    pasteHotspotFromClipboard(target);
  });
  el.ctxDeleteBtn.addEventListener('click', () => {
    const id = state.contextTargetId;
    closeHotspotContextMenu();
    deleteHotspotById(id);
  });

  document.addEventListener('click', (e) => {
    if (!el.hotspotContextMenu.hidden && !e.target.closest('#hotspotContextMenu')) {
      closeHotspotContextMenu();
    }
  });

  el.deleteLeftPageBtn.addEventListener('click', () => {
    const { leftIndex } = getVisiblePages();
    deletePageAt(leftIndex);
  });
  el.deleteRightPageBtn.addEventListener('click', () => {
    const { rightIndex } = getVisiblePages();
    deletePageAt(rightIndex);
  });
  el.restoreAllPagesBtn.addEventListener('click', restoreAllPages);

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
    clearPageRenderCache();
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

  // Clickable page indicator -> inline page number jump input
  const closePageJump = (applyValue) => {
    if (el.pageJumpForm.hidden) return;
    if (applyValue) {
      const val = Number(el.pageJumpInput.value);
      if (Number.isFinite(val) && val >= 1) {
        goToDisplayPage(val);
      }
    }
    el.pageJumpForm.hidden = true;
    el.pageIndicator.hidden = false;
  };

  el.pageIndicator.addEventListener('click', () => {
    const { leftIndex } = getVisiblePages();
    el.pageIndicator.hidden = true;
    el.pageJumpForm.hidden = false;
    el.pageJumpInput.value = String(leftIndex + 1);
    el.pageJumpInput.focus();
    el.pageJumpInput.select();
  });

  el.pageJumpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    closePageJump(true);
  });

  el.pageJumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePageJump(false);
    }
  });

  el.pageJumpInput.addEventListener('blur', () => {
    closePageJump(true);
  });

  el.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.15));
  el.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.15));
  el.zoomResetBtn.addEventListener('click', () => {
    state.panX = 0;
    state.panY = 0;
    setZoom(getDefaultZoom());
  });

  el.toggleLayoutBtn.addEventListener('click', () => {
    state.layout = state.layout === 'double' ? 'single' : 'double';
    goToIndex(state.currentIndex);
  });

  el.revealAllAnswersBtn.addEventListener('click', () => {
    const { leftPage, rightPage } = getVisiblePages();
    const isAnswerType = (t) => t === 'answer' || t === 'line_answer' || t === 'crossword_answer';
    const visibleAnswerIds = state.hotspots
      .filter((h) => isAnswerType(h.type) && (h.page === leftPage || h.page === rightPage))
      .map((h) => h.id);

    const allRevealed = visibleAnswerIds.length > 0 && visibleAnswerIds.every((id) => state.revealedAnswers.has(id));
    if (allRevealed) {
      visibleAnswerIds.forEach((id) => state.revealedAnswers.delete(id));
    } else {
      visibleAnswerIds.forEach((id) => state.revealedAnswers.add(id));
    }
    renderHotspots();
  });

  el.toggleTocBtn.addEventListener('click', () => {
    const nextOpen = el.tocDrawer.hidden;
    el.tocDrawer.hidden = !nextOpen;
    if (nextOpen) {
      el.thumbnailDrawer.hidden = true;
      renderTocDrawer();
    }
  });
  el.closeTocDrawerBtn.addEventListener('click', () => {
    el.tocDrawer.hidden = true;
  });

  el.togglePageMgrBtn.addEventListener('click', () => {
    if (state.mode !== 'editor') return;
    const nextOpen = el.thumbnailDrawer.hidden;
    el.thumbnailDrawer.hidden = !nextOpen;
    if (nextOpen) {
      el.tocDrawer.hidden = true;
      renderThumbnails();
    }
  });
  el.closeDrawerBtn.addEventListener('click', () => {
    el.thumbnailDrawer.hidden = true;
  });

  el.tocUseCurrentPageBtn.addEventListener('click', () => {
    const { leftIndex } = getVisiblePages();
    el.tocPageInput.value = String(leftIndex + 1);
  });

  el.tocCancelEditBtn.addEventListener('click', resetTocForm);

  el.tocEditorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = el.tocTitleInput.value.trim();
    const pageNum = Math.max(1, Math.round(Number(el.tocPageInput.value) || 1));
    const level = el.tocLevelInput.value === 'subunit' ? 'subunit' : 'unit';
    if (!title) {
      showToast('단원 또는 소단원 제목을 입력해 주세요.');
      el.tocTitleInput.focus();
      return;
    }

    if (state.editingTocId) {
      const target = state.tocItems.find((t) => t.id === state.editingTocId);
      if (target) {
        target.level = level;
        target.title = title;
        target.page = pageNum;
      }
      showToast('목차 항목을 수정했습니다.');
    } else {
      state.tocItems.push({
        id: `toc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        level,
        title,
        page: pageNum
      });
      showToast('목차 항목을 추가했습니다.');
    }

    resetTocForm();
    persistState();
    renderTocDrawer();
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
    if (e.key === 'Escape') {
      closeModal();
      closeHotspotContextMenu();
    }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

    if (state.mode === 'editor') {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'c' && state.selectedId) {
        e.preventDefault();
        copyHotspotById(state.selectedId);
        return;
      }
      if (mod && key === 'v' && state.clipboardHotspot) {
        e.preventDefault();
        pasteHotspotFromClipboard(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        e.preventDefault();
        deleteHotspotById(state.selectedId);
        return;
      }
    }

    if (e.key === 'ArrowLeft') stepSpread(-1);
    if (e.key === 'ArrowRight') stepSpread(1);
  });

  setupStagePanning();
  bindInspectorEvents();
}

async function init() {
  loadSavedState();
  if (window.innerWidth <= 640) {
    state.zoom = 1.0;
    state.layout = 'single';
  }
  el.bookTitleInput.value = state.bookTitle;
  el.pdfPathInput.value = state.pdfUrl || '';
  applyZoomAndPan();
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  bindEvents();
  await renderSpread();

  FirebaseTextbook.onAuthChange(async (user) => {
    if (user && !FirebaseTextbook.isAuthorizedAdmin(user)) {
      const deniedEmail = user.email || '';
      const allowed = FirebaseTextbook.getAllowedAdminEmails().join(', ');
      state.user = null;
      updateCloudUi();
      if (state.mode === 'editor') {
        setMode('viewer');
      }
      try {
        await FirebaseTextbook.signOutUser();
      } catch (err) {
        console.warn('Unauthorized sign-out failed:', err);
      }
      showToast(`접근 거부: ${deniedEmail ? `(${deniedEmail}) ` : ''}관리자 계정(${allowed})만 편집할 수 있습니다.`);
      return;
    }
    state.user = user;
    if (!user && FirebaseTextbook.isConfigured() && state.mode === 'editor') {
      setMode('viewer');
    }
    updateCloudUi();
  });
  await loadFromCloud();
}

init();
