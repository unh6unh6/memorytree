import { nodeService, qaService } from './storage.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

let _container    = null;
let _selectedId   = null;
let _selectedIds  = new Set();   // 다중선택 상태
let _expandedIds  = new Set();
let _searchQuery  = '';
let _initialized  = false;
let _ctxPanel     = null;
let _searchTimeout = null;

// 드래그 상태
let _dragSourceIds = [];

// ─── Public API ───────────────────────────────────────────────────────────────

function init(container) {
  _container = container;

  if (!_initialized) {
    _initialized = true;

    // 탐색기 전용 검색창 (사이드바 상단)
    document.getElementById('sidebar-search')?.addEventListener('input', (e) => {
      clearTimeout(_searchTimeout);
      _searchTimeout = setTimeout(() => {
        _searchQuery = e.target.value.toLowerCase();
        render();
      }, 200);
    });

    document.getElementById('sidebar-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        _searchQuery = '';
        render();
      }
    });

    // 캔버스 다중선택 → 사이드바 다중선택 동기화
    document.addEventListener('canvas:multiselect', (e) => {
      const ids = e.detail.ids || [];
      _selectedIds = new Set(ids);
      _selectedId  = ids[ids.length - 1] || null;
      const nodes  = nodeService.getAll();
      ids.forEach(id => {
        let cur = nodes[id];
        while (cur && cur.parentId) {
          _expandedIds.add(cur.parentId);
          cur = nodes[cur.parentId];
        }
      });
      render();
      requestAnimationFrame(() => {
        if (_selectedId) {
          _container?.querySelector(`.sidebar__item[data-id="${_selectedId}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
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
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    let prevW = startW;

    function onMove(e) {
      const dx   = e.clientX - startX;
      const newW = Math.max(160, Math.min(500, startW + dx));
      const delta = newW - prevW;
      prevW = newW;
      sidebar.style.width = `${newW}px`;
      document.dispatchEvent(new CustomEvent('sidebar:resize', { detail: { delta } }));
    }

    function onUp() {
      resizer.classList.remove('sidebar-resizer--active');
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;

  const nodes = nodeService.getAll();
  const roots = Object.values(nodes).filter(n => n.parentId === null);

  if (roots.length === 0) {
    _container.innerHTML = '<p class="sidebar__empty">트리가 비어있습니다.</p>';
    return;
  }

  roots.forEach(r => _expandedIds.add(r.id));

  // 검색 중: 매칭 노드의 모든 조상을 자동 펼침
  if (_searchQuery) {
    Object.values(nodes).forEach(node => {
      if (node.name.toLowerCase().includes(_searchQuery)) {
        let cur = nodes[node.parentId];
        while (cur) {
          _expandedIds.add(cur.id);
          cur = nodes[cur.parentId];
        }
      }
    });
  }

  const html = roots.map(r => renderNode(nodes, r, 0)).join('');
  _container.innerHTML = `<div class="sidebar__tree">${html}</div>`;
  _bindEvents();
}

function renderNode(nodes, node, depth) {
  if (_searchQuery && !_nodeMatchesSearch(nodes, node, _searchQuery)) return '';

  const isExpanded  = _expandedIds.has(node.id);
  const isSelected  = _selectedIds.has(node.id);
  const isCategory  = node.type === 'category';
  const hasChildren = node.children.length > 0;
  const indentPx    = 8 + depth * 16;

  // Task 3: 카테고리 노드는 자식 유무와 관계없이 항상 토글 표시
  const toggleBtn = isCategory
    ? `<button
         class="sidebar__toggle ${isExpanded ? 'sidebar__toggle--open' : ''}"
         data-toggle="${node.id}"
         aria-label="${isExpanded ? '접기' : '펼치기'}"
       >
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <polyline points="9 18 15 12 9 6"/>
         </svg>
       </button>`
    : `<span class="sidebar__qa-dot" aria-hidden="true"></span>`;

  // Task 4: 카테고리 노드에만 인라인 추가 버튼
  const addBtn = isCategory
    ? `<button class="sidebar__add-btn" data-add-to="${node.id}" title="노드 추가" tabindex="-1">
         <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
         </svg>
       </button>`
    : '';

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
        draggable="true"
      >
        ${toggleBtn}
        <span class="sidebar__item-name">${_escapeHtml(node.name)}</span>
        ${addBtn}
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;') .replace(/"/g, '&quot;');
}

// ─── Event Binding ────────────────────────────────────────────────────────────

function _bindEvents() {
  if (!_container) return;

  const nodes = nodeService.getAll();

  _container.querySelectorAll('.sidebar__item').forEach(el => {
    // ── 좌클릭 ──────────────────────────────────────────────────────────────
    el.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar__toggle')) return;
      if (e.target.closest('.sidebar__add-btn')) return;
      _hideContextPanel();
      const id = el.dataset.id;

      if (e.shiftKey) {
        // Shift 다중선택 — 토글 + canvas 동기화
        if (_selectedIds.has(id)) {
          _selectedIds.delete(id);
          if (_selectedId === id) _selectedId = [..._selectedIds][_selectedIds.size - 1] || null;
        } else {
          _selectedIds.add(id);
          _selectedId = id;
        }
        document.dispatchEvent(new CustomEvent('sidebar:multiselect', {
          detail: { ids: [..._selectedIds] },
        }));
      } else {
        // 단일 선택
        _selectedIds.clear();
        _selectedIds.add(id);
        _selectedId = id;
        document.dispatchEvent(new CustomEvent('sidebar:select', {
          detail: { id, type: el.dataset.type },
        }));
      }
      render();
    });

    // ── 우클릭 ──────────────────────────────────────────────────────────────
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;

      if (_selectedIds.size > 1 && _selectedIds.has(id)) {
        // 다중선택 상태: 삭제만 제공
        _showMultiDeletePanel(e.clientX, e.clientY);
      } else {
        // 단일 선택
        _selectedIds.clear();
        _selectedIds.add(id);
        _selectedId = id;
        render();
        _showContextPanel(id, e.clientX, e.clientY);
      }
    });

    // ── 키보드 ──────────────────────────────────────────────────────────────
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });

    // ── Task 4: 인라인 추가 버튼 ─────────────────────────────────────────────
    el.querySelector('.sidebar__add-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _openAddModal(el.dataset.id);
    });

    // ── Task 7: 드래그 이동 ───────────────────────────────────────────────────
    el.addEventListener('dragstart', (e) => {
      if (e.target.closest('[data-toggle]') || e.target.closest('.sidebar__add-btn')) {
        e.preventDefault();
        return;
      }
      const id = el.dataset.id;
      _dragSourceIds = (_selectedIds.size > 1 && _selectedIds.has(id))
        ? [..._selectedIds]
        : [id];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(_dragSourceIds));
      el.classList.add('sidebar__item--dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('sidebar__item--dragging');
      _container.querySelectorAll('.sidebar__item--drag-over')
        .forEach(t => t.classList.remove('sidebar__item--drag-over'));
      _dragSourceIds = [];
    });

    el.addEventListener('dragover', (e) => {
      const targetId  = el.dataset.id;
      const targetNode = nodes[targetId];
      if (!targetNode || targetNode.type === 'qa') return;
      if (_dragSourceIds.includes(targetId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('sidebar__item--drag-over');
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('sidebar__item--drag-over');
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('sidebar__item--drag-over');
      const targetId = el.dataset.id;
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      let dragIds;
      try { dragIds = JSON.parse(raw); } catch { return; }

      let moved = 0;
      for (const dragId of dragIds) {
        try {
          nodeService.moveNode(dragId, targetId);
          moved++;
        } catch (err) {
          toast.error(err.message);
          break;
        }
      }
      if (moved > 0) {
        toast.success(`${moved}개 노드를 이동했습니다.`);
        _selectedIds.clear();
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      }
    });
  });

  // 펼치기/접기 토글
  _container.querySelectorAll('.sidebar__toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.toggle;
      if (_expandedIds.has(id)) _expandedIds.delete(id);
      else _expandedIds.add(id);
      render();
    });
  });

  // 빈 영역 클릭 시 선택 해제 + 캔버스 동기화
  _container.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar__item')) return;
    if (!(_selectedId || _selectedIds.size > 0)) return;
    _selectedIds.clear();
    _selectedId = null;
    render();
    document.dispatchEvent(new CustomEvent('sidebar:multiselect', { detail: { ids: [] } }));
  });
}

// ─── Public select (canvas→sidebar 동기화) ───────────────────────────────────

function refresh() { render(); }

function select(id) {
  _selectedId = id;
  _selectedIds.clear();
  _selectedIds.add(id);

  const nodes = nodeService.getAll();
  let current = nodes[id];
  while (current && current.parentId) {
    _expandedIds.add(current.parentId);
    current = nodes[current.parentId];
  }

  render();

  requestAnimationFrame(() => {
    _container?.querySelector(`.sidebar__item[data-id="${id}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function getSelectedId() { return _selectedId; }

// ─── 인라인 추가 모달 (Task 4) ────────────────────────────────────────────────

function _openAddModal(parentId) {
  const nodes  = nodeService.getAll();
  const parent = nodes[parentId];
  if (!parent) return;

  let forcedType = null;
  if (parent.children.length > 0) {
    forcedType = nodes[parent.children[0]]?.type || null;
  }

  if (forcedType) {
    modal.openNodeForm({
      mode: `create-${forcedType}`,
      onConfirm: (data) => _doAdd(forcedType, parentId, data),
    });
  } else {
    modal.open({
      title: '노드 타입 선택',
      bodyHTML: `
        <p style="color:var(--color-on-surface-variant);font-size:14px;margin-bottom:16px">추가할 노드 유형을 선택하세요.</p>
        <div style="display:flex;gap:12px">
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="sb-ntype" value="category" checked style="display:none">
            <div id="sb-ntype-cat" class="node-type-card node-type-card--active">
              <div style="font-size:22px;margin-bottom:6px">📁</div>
              <div style="font-weight:600;font-size:13px">카테고리</div>
            </div>
          </label>
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="sb-ntype" value="qa" style="display:none">
            <div id="sb-ntype-qa" class="node-type-card">
              <div style="font-size:22px;margin-bottom:6px">❓</div>
              <div style="font-weight:600;font-size:13px">Q&amp;A</div>
            </div>
          </label>
        </div>
      `,
      confirmLabel: '다음 →',
      onConfirm: () => {
        const selected = document.querySelector('input[name="sb-ntype"]:checked')?.value || 'category';
        setTimeout(() => {
          modal.openNodeForm({
            mode: `create-${selected}`,
            onConfirm: (data) => _doAdd(selected, parentId, data),
          });
        }, 60);
      },
    });

    setTimeout(() => {
      const catCard = document.getElementById('sb-ntype-cat');
      const qaCard  = document.getElementById('sb-ntype-qa');
      function syncCards() {
        const val = document.querySelector('input[name="sb-ntype"]:checked')?.value;
        catCard?.classList.toggle('node-type-card--active', val === 'category');
        qaCard ?.classList.toggle('node-type-card--active', val === 'qa');
      }
      catCard?.addEventListener('click', () => {
        document.querySelector('input[name="sb-ntype"][value="category"]').checked = true;
        syncCards();
      });
      qaCard?.addEventListener('click', () => {
        document.querySelector('input[name="sb-ntype"][value="qa"]').checked = true;
        syncCards();
      });
      document.querySelectorAll('input[name="sb-ntype"]').forEach(r => r.addEventListener('change', syncCards));
    }, 60);
  }
}

function _doAdd(type, parentId, data) {
  try {
    if (type === 'category') {
      nodeService.addCategory({ name: data.name, parentId });
    } else {
      nodeService.addQA({ parentId, question: data.question, answer: data.answer, importance: data.importance });
    }
    toast.success('추가되었습니다.');
    render();
    document.dispatchEvent(new CustomEvent('canvas:data-change'));
  } catch (e) { toast.error(e.message); }
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
  _positionPanel(panel, clientX, clientY);

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

  setTimeout(() => {
    document.addEventListener('mousedown', _onOutsideClick, { once: true });
    document.addEventListener('contextmenu', _onOutsideClick, { once: true });
  }, 0);
}

// Task 5: 다중선택 삭제 패널
function _showMultiDeletePanel(clientX, clientY) {
  _hideContextPanel();
  const count = _selectedIds.size;
  const panel = document.createElement('div');
  panel.className = 'sidebar-ctx-panel';
  panel.innerHTML = `
    <div class="sidebar-ctx-panel__name">${count}개 선택됨</div>
    <hr class="sidebar-ctx-panel__divider">
    <button class="sidebar-ctx-panel__item sidebar-ctx-panel__item--danger" data-action="delete-multi">${count}개 삭제</button>
  `;

  document.body.appendChild(panel);
  _ctxPanel = panel;
  _positionPanel(panel, clientX, clientY);

  panel.querySelector('[data-action="delete-multi"]')?.addEventListener('click', () => {
    _hideContextPanel();
    _deleteMultiple([..._selectedIds]);
  });

  setTimeout(() => {
    document.addEventListener('mousedown', _onOutsideClick, { once: true });
    document.addEventListener('contextmenu', _onOutsideClick, { once: true });
  }, 0);
}

function _positionPanel(panel, clientX, clientY) {
  const PW = 180;
  const PH = panel.offsetHeight || 120;
  let left = clientX + 4;
  let top  = clientY;
  if (left + PW > window.innerWidth  - 8) left = clientX - PW - 4;
  if (top  + PH > window.innerHeight - 8) top  = window.innerHeight - PH - 8;
  panel.style.left = `${Math.max(4, left)}px`;
  panel.style.top  = `${Math.max(4, top)}px`;
}

function _onOutsideClick(e) {
  if (_ctxPanel && !_ctxPanel.contains(e.target)) _hideContextPanel();
}

function _hideContextPanel() {
  if (_ctxPanel) { _ctxPanel.remove(); _ctxPanel = null; }
  document.removeEventListener('mousedown', _onOutsideClick);
  document.removeEventListener('contextmenu', _onOutsideClick);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

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
        if (_selectedId === nodeId) { _selectedId = null; }
        _selectedIds.delete(nodeId);
        toast.success('삭제되었습니다.');
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (e) { toast.error(e.message); }
    },
  });
}

// Task 5: 다중선택 일괄 삭제
function _deleteMultiple(ids) {
  modal.open({
    title: `${ids.length}개 노드 삭제`,
    bodyHTML: `<p style="color:var(--color-on-surface-variant);font-size:14px">
      선택한 <strong>${ids.length}개</strong> 노드 및 각 하위 노드를 모두 삭제합니다.<br>이 작업은 되돌릴 수 없습니다.
    </p>`,
    confirmLabel: '삭제',
    onConfirm: () => {
      let deleted = 0;
      for (const id of ids) {
        try { nodeService.remove(id); deleted++; } catch { /* 이미 삭제된 노드 skip */ }
      }
      _selectedIds.clear();
      _selectedId = null;
      toast.success(`${deleted}개 삭제되었습니다.`);
      render();
      document.dispatchEvent(new CustomEvent('canvas:data-change'));
    },
  });
}

export { init, refresh, select, getSelectedId };
