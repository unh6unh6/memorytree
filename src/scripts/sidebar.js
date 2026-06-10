import { nodeService, qaService } from './storage.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

let _container  = null;
let _selectedId = null;
let _expandedIds = new Set();
let _searchQuery = '';
let _initialized = false;
let _ctxPanel   = null;   // 우클릭 컨텍스트 패널 DOM 요소

function init(container) {
  _container = container;

  if (!_initialized) {
    _initialized = true;
    document.addEventListener('navbar:search', (e) => {
      _searchQuery = e.detail.query.toLowerCase();
      render();
    });
    _initResizer();
  }

  render();
}

function _initResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('sidebar');
  if (!resizer || !sidebar) return;

  let startX = 0;
  let startW = 0;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    resizer.classList.add('sidebar-resizer--active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let prevW = startW;

    function onMove(e) {
      const dx    = e.clientX - startX;
      const newW  = Math.max(160, Math.min(500, startW + dx));
      const delta = newW - prevW;
      prevW = newW;
      sidebar.style.width = `${newW}px`;
      // 사이드바 너비 변화량을 캔버스에 전달해 노드 화면 위치가 고정되도록 한다
      document.dispatchEvent(new CustomEvent('sidebar:resize', { detail: { delta } }));
    }

    function onUp() {
      resizer.classList.remove('sidebar-resizer--active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function render() {
  if (!_container) return;

  const nodes = nodeService.getAll();
  const roots = Object.values(nodes).filter(n => n.parentId === null);

  if (roots.length === 0) {
    _container.innerHTML = '<p class="sidebar__empty">트리가 비어있습니다.</p>';
    return;
  }

  // 루트 노드는 기본으로 펼쳐진 상태
  roots.forEach(r => _expandedIds.add(r.id));

  const html = roots.map(r => renderNode(nodes, r, 0)).join('');
  _container.innerHTML = `<div class="sidebar__tree">${html}</div>`;
  _bindEvents();
}

function renderNode(nodes, node, depth) {
  if (_searchQuery && !_nodeMatchesSearch(nodes, node, _searchQuery)) {
    return '';
  }

  const isExpanded = _expandedIds.has(node.id);
  const isSelected = node.id === _selectedId;
  const isCategory = node.type === 'category';
  const hasChildren = node.children.length > 0;
  const indentPx = 8 + depth * 16;

  const toggleBtn = isCategory
    ? `<button
         class="sidebar__toggle ${isExpanded ? 'sidebar__toggle--open' : ''}"
         data-toggle="${node.id}"
         aria-label="${isExpanded ? '접기' : '펼치기'}"
         ${!hasChildren ? 'style="visibility:hidden"' : ''}
       >
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <polyline points="9 18 15 12 9 6"/>
         </svg>
       </button>`
    : `<span class="sidebar__qa-dot" aria-hidden="true"></span>`;

  const childrenHtml = (isCategory && hasChildren && isExpanded)
    ? node.children
        .map(id => nodes[id] ? renderNode(nodes, nodes[id], depth + 1) : '')
        .join('')
    : '';

  return `
    <div class="sidebar__item-wrapper">
      <div
        class="sidebar__item${isSelected ? ' sidebar__item--selected' : ''}"
        data-id="${node.id}"
        data-type="${node.type}"
        style="padding-left:${indentPx}px"
        role="treeitem"
        aria-selected="${isSelected}"
        tabindex="0"
      >
        ${toggleBtn}
        <span class="sidebar__item-name">${_escapeHtml(node.name)}</span>
      </div>
      ${childrenHtml ? `<div class="sidebar__children">${childrenHtml}</div>` : ''}
    </div>
  `;
}

function _nodeMatchesSearch(nodes, node, query) {
  if (node.name.toLowerCase().includes(query)) return true;
  for (const childId of node.children) {
    if (nodes[childId] && _nodeMatchesSearch(nodes, nodes[childId], query)) return true;
  }
  return false;
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _bindEvents() {
  if (!_container) return;

  _container.querySelectorAll('.sidebar__item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar__toggle')) return;
      _hideContextPanel();
      const id = el.dataset.id;
      _selectedId = id;
      render();
      document.dispatchEvent(new CustomEvent('sidebar:select', {
        detail: { id, type: el.dataset.type },
      }));
    });

    // 우클릭: 컨텍스트 패널 표시
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      _selectedId = id;
      render();
      _showContextPanel(id, e.clientX, e.clientY);
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  _container.querySelectorAll('.sidebar__toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.toggle;
      if (_expandedIds.has(id)) {
        _expandedIds.delete(id);
      } else {
        _expandedIds.add(id);
      }
      render();
    });
  });
}

function refresh() {
  render();
}

function select(id) {
  _selectedId = id;

  // 선택 노드의 모든 조상을 펼쳐서 사이드바에서 보이도록 한다
  const nodes = nodeService.getAll();
  let current = nodes[id];
  while (current && current.parentId) {
    _expandedIds.add(current.parentId);
    current = nodes[current.parentId];
  }

  render();

  // 렌더 후 선택 항목이 사이드바 뷰포트 안에 들어오도록 스크롤
  requestAnimationFrame(() => {
    _container?.querySelector(`.sidebar__item[data-id="${id}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function getSelectedId() {
  return _selectedId;
}

// ─── 컨텍스트 패널 ────────────────────────────────────────────────────────────

function _showContextPanel(nodeId, clientX, clientY) {
  _hideContextPanel();
  const nodes   = nodeService.getAll();
  const node    = nodes[nodeId];
  if (!node) return;

  const isRoot    = node.parentId === null;
  const typeLabel = node.type === 'category' ? '카테고리' : 'Q&A';

  const panel = document.createElement('div');
  panel.className = 'sidebar-ctx-panel';
  panel.innerHTML = `
    <div class="sidebar-ctx-panel__name" title="${_escapeHtml(node.name)}">${_escapeHtml(node.name)}</div>
    <div class="sidebar-ctx-panel__type">${typeLabel}</div>
    <hr class="sidebar-ctx-panel__divider">
    ${node.type === 'category'
      ? `<button class="sidebar-ctx-panel__item" data-action="view">모아보기</button>` : ''}
    ${!isRoot
      ? `<button class="sidebar-ctx-panel__item" data-action="edit">편집</button>` : ''}
    ${!isRoot
      ? `<button class="sidebar-ctx-panel__item sidebar-ctx-panel__item--danger" data-action="delete">삭제</button>` : ''}
  `;

  document.body.appendChild(panel);
  _ctxPanel = panel;

  // 뷰포트 범위 조정
  const PW = 180;
  const PH = panel.offsetHeight || 120;
  let left = clientX + 4;
  let top  = clientY;
  if (left + PW > window.innerWidth  - 8) left = clientX - PW - 4;
  if (top  + PH > window.innerHeight - 8) top  = window.innerHeight - PH - 8;
  panel.style.left = `${Math.max(4, left)}px`;
  panel.style.top  = `${Math.max(4, top)}px`;

  // 액션 바인딩
  panel.querySelector('[data-action="view"]')?.addEventListener('click', () => {
    _hideContextPanel();
    window.location.hash = `#list?nodeId=${nodeId}`;
  });

  panel.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
    _hideContextPanel();
    _openEditModal(nodeId);
  });

  panel.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    _hideContextPanel();
    _deleteNode(nodeId);
  });

  // 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('mousedown', _onOutsideClick, { once: true });
    document.addEventListener('contextmenu', _onOutsideClick, { once: true });
  }, 0);
}

function _onOutsideClick(e) {
  if (_ctxPanel && !_ctxPanel.contains(e.target)) {
    _hideContextPanel();
  }
}

function _hideContextPanel() {
  if (_ctxPanel) { _ctxPanel.remove(); _ctxPanel = null; }
  document.removeEventListener('mousedown', _onOutsideClick);
  document.removeEventListener('contextmenu', _onOutsideClick);
}

// ─── 사이드바 CRUD ────────────────────────────────────────────────────────────

function _openEditModal(nodeId) {
  const nodes = nodeService.getAll();
  const node  = nodes[nodeId];
  if (!node) return;

  if (node.type === 'category') {
    modal.openNodeForm({
      mode: 'edit-category',
      initial: { name: node.name },
      onConfirm: (data) => {
        try {
          nodeService.update(nodeId, { name: data.name });
          toast.success('수정되었습니다.');
          render();
          document.dispatchEvent(new CustomEvent('canvas:data-change'));
        } catch (e) { toast.error(e.message); }
      },
    });
  } else {
    const qa = qaService.get(nodeId);
    modal.openNodeForm({
      mode: 'edit-qa',
      initial: {
        question:   qa?.question   || node.name,
        answer:     qa?.answer     || '',
        importance: qa?.importance ?? 3,
      },
      onConfirm: (data) => {
        try {
          nodeService.update(nodeId, { name: data.question });
          qaService.update(nodeId, { question: data.question, answer: data.answer, importance: data.importance });
          toast.success('수정되었습니다.');
          render();
          document.dispatchEvent(new CustomEvent('canvas:data-change'));
        } catch (e) { toast.error(e.message); }
      },
    });
  }
}

function _deleteNode(nodeId) {
  const nodes = nodeService.getAll();
  const node  = nodes[nodeId];
  if (!node) return;
  modal.open({
    title: '노드 삭제',
    bodyHTML: `<p style="color:var(--color-on-surface-variant);font-size:14px">
      <strong>"${_escapeHtml(node.name)}"</strong> 및 하위 노드를 모두 삭제합니다.<br>이 작업은 되돌릴 수 없습니다.
    </p>`,
    confirmLabel: '삭제',
    onConfirm: () => {
      try {
        nodeService.remove(nodeId);
        if (_selectedId === nodeId) _selectedId = null;
        toast.success('삭제되었습니다.');
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (e) { toast.error(e.message); }
    },
  });
}

export { init, refresh, select, getSelectedId };
