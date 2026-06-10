import { nodeService, qaService, attemptService, ROOT_NODE_ID } from './storage.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOT_R       = 42;
const NODE_W       = 164;
const NODE_H       = 48;
const LEVEL_SPACE  = 210;
const ADD_BTN_R    = 12;

// ─── State ────────────────────────────────────────────────────────────────────
let _container  = null;
let _svgEl      = null;
let _gEl        = null;
let _panelEl    = null;
let _selectedId = null;
let _tx         = 0;
let _ty         = 0;
let _scale      = 1;
let _positions  = {};   // nodeId → { x, y }

let _isPanning        = false;
let _panStart         = null;
let _didPan           = false;
let _initialized      = false;

// 노드 드래그 상태
let _draggingNodeId   = null;
let _dragStart        = null;
let _dragNodeStartPos = null;
let _isDraggingNode   = false;
let _manualPositions  = {};   // 수동 이동된 노드 위치 오버라이드

// ─── Public API ───────────────────────────────────────────────────────────────

export function init(container) {
  _container = container;
  _setupDOM();
  _bindPanZoom();
  _render();

  if (!_initialized) {
    _initialized = true;
    // 사이드바 선택 → 캔버스 노드 선택 (패널 미표시)
    document.addEventListener('sidebar:select', (e) => {
      _selectedId = e.detail.id;
      _render();
    });
    // 사이드바 리사이즈 → _tx 보정으로 노드 화면 위치 고정
    document.addEventListener('sidebar:resize', (e) => {
      _tx -= e.detail.delta;
      _applyTransform();
    });
  }
}

export function refresh() {
  _render();
  if (_selectedId) _showPanel(_selectedId);
}

// ─── DOM Setup ────────────────────────────────────────────────────────────────

function _setupDOM() {
  _container.innerHTML = `
    <svg id="canvas-svg" xmlns="http://www.w3.org/2000/svg"
         style="width:100%;height:100%;position:absolute;inset:0;cursor:grab;display:block">
      <g id="canvas-g"></g>
    </svg>
    <div id="canvas-panel" class="canvas-panel" hidden></div>
    <div class="canvas-controls">
      <button class="canvas-ctrl-btn" id="ctrl-zoom-in" title="확대">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="canvas-ctrl-btn" id="ctrl-zoom-out" title="축소">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="canvas-ctrl-btn canvas-ctrl-btn--primary" id="ctrl-center" title="중앙으로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
  `;

  _svgEl   = document.getElementById('canvas-svg');
  _gEl     = document.getElementById('canvas-g');
  _panelEl = document.getElementById('canvas-panel');

  _centerView();

  document.getElementById('ctrl-zoom-in') .addEventListener('click', (e) => { e.stopPropagation(); _zoom(1.25); });
  document.getElementById('ctrl-zoom-out').addEventListener('click', (e) => { e.stopPropagation(); _zoom(0.8); });
  document.getElementById('ctrl-center')  .addEventListener('click', (e) => { e.stopPropagation(); _centerView(); });
}

// ─── Transform ────────────────────────────────────────────────────────────────

function _centerView() {
  if (!_container) return;
  _tx    = _container.clientWidth  / 2;
  _ty    = _container.clientHeight / 2;
  _scale = 1;
  _applyTransform();
}

function _zoom(factor) {
  if (!_container) return;
  const newScale = Math.max(0.2, Math.min(3, _scale * factor));
  const cx = _container.clientWidth  / 2;
  const cy = _container.clientHeight / 2;
  _tx    = cx - (cx - _tx) * (newScale / _scale);
  _ty    = cy - (cy - _ty) * (newScale / _scale);
  _scale = newScale;
  _applyTransform();
}

function _applyTransform() {
  if (!_gEl) return;
  _gEl.setAttribute('transform', `translate(${_tx},${_ty}) scale(${_scale})`);
}

// ─── Pan / Zoom events ────────────────────────────────────────────────────────

function _bindPanZoom() {
  _svgEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-role="node"]')) return;
    if (e.target.closest('.canvas-controls')) return;
    _isPanning = true;
    _didPan    = false;
    _panStart  = { x: e.clientX, y: e.clientY, tx: _tx, ty: _ty };
    _svgEl.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    // 노드 드래그 우선
    if (_draggingNodeId && _dragStart) {
      const dx = (e.clientX - _dragStart.x) / _scale;
      const dy = (e.clientY - _dragStart.y) / _scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _isDraggingNode = true;
      if (_isDraggingNode) {
        _manualPositions[_draggingNodeId] = {
          x: _dragNodeStartPos.x + dx,
          y: _dragNodeStartPos.y + dy,
        };
        _positions[_draggingNodeId] = _manualPositions[_draggingNodeId];
        _render();
      }
      return;
    }
    // 캔버스 팬
    if (!_isPanning || !_panStart) return;
    const dx = e.clientX - _panStart.x;
    const dy = e.clientY - _panStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _didPan = true;
    _tx = _panStart.tx + dx;
    _ty = _panStart.ty + dy;
    _applyTransform();
  });

  window.addEventListener('mouseup', () => {
    _draggingNodeId = null;
    _dragStart      = null;
    _isPanning      = false;
    _panStart       = null;
    if (_svgEl) _svgEl.style.cursor = 'grab';
  });

  // 캔버스 배경 우클릭 시 브라우저 기본 메뉴 방지
  _svgEl.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('[data-role="node"]')) e.preventDefault();
  });

  _svgEl.addEventListener('click', () => {
    if (_didPan) { _didPan = false; return; }
    if (_selectedId) {
      _selectedId = null;
      _hidePanel();
      _render();
    }
  });

  _svgEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = _container.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const factor   = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.2, Math.min(3, _scale * factor));
    _tx    = mx - (mx - _tx) * (newScale / _scale);
    _ty    = my - (my - _ty) * (newScale / _scale);
    _scale = newScale;
    _applyTransform();
  }, { passive: false });
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function _computeLayout(nodes) {
  _positions = {};
  const root = nodes[ROOT_NODE_ID] || Object.values(nodes).find(n => n.parentId === null);
  if (!root) return;

  // Count leaves in each subtree
  const leafCount = {};
  function countLeaves(id) {
    const n = nodes[id];
    if (!n || n.children.length === 0) return (leafCount[id] = 1);
    let s = 0;
    for (const c of n.children) s += countLeaves(c);
    return (leafCount[id] = s);
  }
  countLeaves(root.id);

  _positions[root.id] = { x: 0, y: 0 };

  function place(id, centerAngle, spread, depth) {
    const n = nodes[id];
    if (!n || n.children.length === 0) return;
    const r = depth * LEVEL_SPACE;
    let angle = centerAngle - spread / 2;
    for (const childId of n.children) {
      if (!nodes[childId]) continue;
      const fraction   = leafCount[childId] / leafCount[id];
      const childSpread = Math.max(fraction * spread, 0.9);
      const midAngle   = angle + childSpread / 2;
      const p = _positions[id];
      _positions[childId] = {
        x: p.x + r * Math.cos(midAngle),
        y: p.y + r * Math.sin(midAngle),
      };
      place(childId, midAngle, childSpread, depth + 1);
      angle += childSpread;
    }
  }

  place(root.id, -Math.PI / 2, 2 * Math.PI, 1);

  // 수동으로 이동된 노드 위치 오버라이드 적용
  Object.entries(_manualPositions).forEach(([id, pos]) => {
    if (id in _positions) _positions[id] = pos;
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  if (!_gEl) return;
  const nodes = nodeService.getAll();
  _computeLayout(nodes);
  _gEl.innerHTML = '';

  const edgesG = _ns('g');
  const nodesG = _ns('g');
  _gEl.appendChild(edgesG);
  _gEl.appendChild(nodesG);

  Object.values(nodes).forEach(node => {
    const pos = _positions[node.id];
    if (!pos) return;
    if (node.parentId && _positions[node.parentId]) {
      edgesG.appendChild(_makeEdge(_positions[node.parentId], pos));
    }
    nodesG.appendChild(_makeNode(node, pos));
  });
}

function _makeEdge(from, to) {
  const dx  = to.x - from.x;
  const path = _ns('path');
  path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x + dx * 0.5} ${from.y}, ${to.x - dx * 0.5} ${to.y}, ${to.x} ${to.y}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#c2c6d6');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  return path;
}

function _makeNode(node, pos) {
  const isRoot     = node.parentId === null;
  const isSelected = node.id === _selectedId;
  const isQA       = node.type === 'qa';

  const g = _ns('g');
  g.setAttribute('data-role', 'node');
  g.setAttribute('data-id', node.id);
  g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
  g.style.cursor = 'pointer';

  if (isRoot) {
    // Root — large filled circle
    const circle = _ns('circle');
    _attr(circle, { r: ROOT_R, fill: '#0058be',
      stroke: isSelected ? '#adc6ff' : 'none',
      'stroke-width': 3,
      filter: 'drop-shadow(0 4px 14px rgba(0,88,190,0.35))',
    });
    g.appendChild(circle);

    const inner = _ns('text');
    _attr(inner, { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#ffffff', 'font-family': 'Inter,sans-serif',
      'font-size': '11', 'font-weight': '700', 'pointer-events': 'none',
    });
    inner.textContent = _trunc(node.name, 8);
    g.appendChild(inner);

    const label = _ns('text');
    _attr(label, { 'text-anchor': 'middle', y: ROOT_R + 20,
      fill: '#191c1e', 'font-family': 'Inter,sans-serif',
      'font-size': '13', 'font-weight': '600', 'pointer-events': 'none',
    });
    label.textContent = _trunc(node.name, 16);
    g.appendChild(label);

  } else {
    // Non-root — rounded rect
    const W = NODE_W, H = NODE_H;

    const rect = _ns('rect');
    _attr(rect, {
      x: -W / 2, y: -H / 2, width: W, height: H, rx: 10,
      fill: '#ffffff',
      stroke: isSelected ? '#0058be' : '#c2c6d6',
      'stroke-width': isSelected ? 2 : 1,
      filter: isSelected
        ? 'drop-shadow(0 4px 14px rgba(0,88,190,0.2))'
        : 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))',
    });
    g.appendChild(rect);

    // Icon pill
    const iconBg = _ns('rect');
    _attr(iconBg, {
      x: -W / 2 + 8, y: -H / 2 + 9, width: 30, height: 30, rx: 6,
      fill: isQA ? '#d0e1fb' : '#eceef0', 'pointer-events': 'none',
    });
    g.appendChild(iconBg);

    const icon = _ns('text');
    _attr(icon, {
      x: -W / 2 + 23, y: -H / 2 + 24,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '14', 'pointer-events': 'none',
    });
    icon.textContent = isQA ? '?' : '▸';
    g.appendChild(icon);

    // Node name
    const nameT = _ns('text');
    _attr(nameT, {
      x: -W / 2 + 46, y: 1,
      'dominant-baseline': 'middle',
      fill: isSelected ? '#0058be' : '#191c1e',
      'font-family': 'Inter,sans-serif',
      'font-size': '13',
      'font-weight': isSelected ? '600' : '500',
      'pointer-events': 'none',
    });
    nameT.textContent = _trunc(node.name, 13);
    g.appendChild(nameT);
  }

  // Add (+) 버튼: QA 노드는 리프노드이므로 비표시
  if (!isQA) {
    const btnX = isRoot ? ROOT_R * 0.72 : NODE_W / 2 + 2;
    const btnY = isRoot ? -ROOT_R * 0.72 : -NODE_H / 2 - 2;

    const addG = _ns('g');
    addG.setAttribute('class', 'canvas-add-btn');
    addG.setAttribute('data-role', 'add');
    addG.setAttribute('data-parent', node.id);
    addG.style.cursor = 'pointer';

    const addC = _ns('circle');
    _attr(addC, { cx: btnX, cy: btnY, r: ADD_BTN_R, fill: '#0058be', stroke: '#ffffff', 'stroke-width': 2 });
    addG.appendChild(addC);

    const plusT = _ns('text');
    _attr(plusT, {
      x: btnX, y: btnY + 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#ffffff', 'font-size': '16', 'font-weight': '700', 'pointer-events': 'none',
    });
    plusT.textContent = '+';
    addG.appendChild(plusT);

    g.appendChild(addG);
  }

  // 마우스다운: 드래그 시작 준비 (좌클릭만)
  g.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-role="add"]')) return;
    e.stopPropagation();
    _draggingNodeId   = node.id;
    _dragStart        = { x: e.clientX, y: e.clientY };
    _dragNodeStartPos = { ..._positions[node.id] };
    _isDraggingNode   = false;
  });

  // 좌클릭: 선택만 (드래그가 아닌 경우)
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_isDraggingNode) { _isDraggingNode = false; return; }
    const addEl = e.target.closest('[data-role="add"]');
    if (addEl) { _openAddModal(addEl.dataset.parent); return; }
    _selectedId = node.id;
    _render();
    // 캔버스→사이드바 동기화 이벤트
    document.dispatchEvent(new CustomEvent('canvas:select', { detail: { id: node.id } }));
  });

  // 우클릭: 플로팅 상세 패널 표시
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    _selectedId = node.id;
    _render();
    _showPanel(node.id);
    document.dispatchEvent(new CustomEvent('canvas:select', { detail: { id: node.id } }));
  });

  return g;
}

// ─── Floating panel ───────────────────────────────────────────────────────────

function _showPanel(nodeId) {
  if (!_panelEl) return;
  const nodes = nodeService.getAll();
  const node  = nodes[nodeId];
  if (!node || !_positions[nodeId]) { _panelEl.hidden = true; return; }

  const pos = _positions[nodeId];
  const sx  = _tx + pos.x * _scale;
  const sy  = _ty + pos.y * _scale;

  const isRoot   = node.parentId === null;
  const typeLabel = node.type === 'category' ? '카테고리' : 'Q&A';

  // Memory strength (Q&A only)
  let memHTML = '';
  if (node.type === 'qa') {
    const attempts = attemptService.getByNode(nodeId);
    const pct = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.result, 0) / attempts.length * 100)
      : 0;
    memHTML = `
      <div class="canvas-panel__memory">
        <span class="canvas-panel__memory-label">메모리 강도</span>
        <div class="canvas-panel__memory-track">
          <div class="canvas-panel__memory-fill" style="width:${pct}%"></div>
        </div>
        <span class="canvas-panel__memory-pct">${pct}%</span>
      </div>
    `;
  }

  _panelEl.innerHTML = `
    <button class="canvas-panel__close" aria-label="닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div class="canvas-panel__header">
      <div class="canvas-panel__name">${_esc(node.name)}</div>
      <span class="canvas-panel__type-badge canvas-panel__type-badge--${node.type}">${typeLabel}</span>
    </div>
    ${memHTML}
    <div class="canvas-panel__actions">
      ${!isRoot ? `<button class="btn btn--primary  canvas-panel__action-btn" data-action="edit">편집</button>` : ''}
      <button class="btn btn--ghost canvas-panel__action-btn" data-action="view">
        ${node.type === 'category' ? '모아보기' : '카드 보기'}
      </button>
      ${!isRoot ? `<button class="btn btn--danger canvas-panel__action-btn" data-action="delete">삭제</button>` : ''}
    </div>
  `;

  // Position panel (prefer right of node, flip if it overflows)
  const PW  = 240;
  const PH  = node.type === 'qa' ? 210 : 165;
  const cW  = _container.clientWidth;
  const cH  = _container.clientHeight;
  let left  = sx + 44;
  let top   = sy - PH / 2;
  if (left + PW > cW - 12) left = sx - PW - 44;
  if (top  < 12) top = 12;
  if (top + PH > cH - 12) top = cH - PH - 12;
  if (left < 12) left = 12;
  _panelEl.style.left  = `${left}px`;
  _panelEl.style.top   = `${top}px`;
  _panelEl.hidden = false;

  _panelEl.querySelector('.canvas-panel__close')
    ?.addEventListener('click', _hidePanel);

  _panelEl.querySelector('[data-action="edit"]')
    ?.addEventListener('click', () => _openEditModal(nodeId));

  _panelEl.querySelector('[data-action="view"]')
    ?.addEventListener('click', () => {
      const target = node.type === 'category' ? nodeId : (node.parentId || nodeId);
      window.location.hash = `#list?nodeId=${target}`;
    });

  _panelEl.querySelector('[data-action="delete"]')
    ?.addEventListener('click', () => _deleteNode(nodeId));
}

function _hidePanel() {
  if (_panelEl) _panelEl.hidden = true;
  if (_selectedId) { _selectedId = null; _render(); }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function _openAddModal(parentId) {
  const nodes  = nodeService.getAll();
  const parent = nodes[parentId];
  if (!parent) return;

  // Determine allowed type from existing children
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
    // Ask user for type
    modal.open({
      title: '노드 타입 선택',
      bodyHTML: `
        <p style="color:var(--color-on-surface-variant);font-size:14px;margin-bottom:16px">
          추가할 노드 유형을 선택하세요.
        </p>
        <div style="display:flex;gap:12px">
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="ntype" value="category" checked style="display:none">
            <div id="ntype-cat" class="node-type-card node-type-card--active">
              <div style="font-size:22px;margin-bottom:6px">📁</div>
              <div style="font-weight:600;font-size:13px">카테고리</div>
              <div style="color:var(--color-on-surface-variant);font-size:11px;margin-top:2px">하위 분류</div>
            </div>
          </label>
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="ntype" value="qa" style="display:none">
            <div id="ntype-qa" class="node-type-card">
              <div style="font-size:22px;margin-bottom:6px">❓</div>
              <div style="font-weight:600;font-size:13px">Q&amp;A</div>
              <div style="color:var(--color-on-surface-variant);font-size:11px;margin-top:2px">질문/답변</div>
            </div>
          </label>
        </div>
      `,
      confirmLabel: '다음 →',
      onConfirm: () => {
        const selected = document.querySelector('input[name="ntype"]:checked')?.value || 'category';
        setTimeout(() => {
          modal.openNodeForm({
            mode: `create-${selected}`,
            onConfirm: (data) => _doAdd(selected, parentId, data),
          });
        }, 60);
      },
    });

    // Visual radio-card toggle
    setTimeout(() => {
      const catCard = document.getElementById('ntype-cat');
      const qaCard  = document.getElementById('ntype-qa');
      function sync() {
        const val = document.querySelector('input[name="ntype"]:checked')?.value;
        catCard?.classList.toggle('node-type-card--active', val === 'category');
        qaCard ?.classList.toggle('node-type-card--active', val === 'qa');
      }
      catCard?.addEventListener('click', () => {
        document.querySelector('input[name="ntype"][value="category"]').checked = true;
        sync();
      });
      qaCard?.addEventListener('click', () => {
        document.querySelector('input[name="ntype"][value="qa"]').checked = true;
        sync();
      });
      document.querySelectorAll('input[name="ntype"]').forEach(r => r.addEventListener('change', sync));
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
    _render();
    document.dispatchEvent(new CustomEvent('canvas:data-change'));
  } catch (e) {
    toast.error(e.message);
  }
}

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
          _render();
          if (_selectedId === nodeId) _showPanel(nodeId);
          document.dispatchEvent(new CustomEvent('canvas:data-change'));
        } catch (e) { toast.error(e.message); }
      },
    });
  } else {
    const qa = qaService.get(nodeId);
    modal.openNodeForm({
      mode: 'edit-qa',
      initial: {
        question: qa?.question || node.name,
        answer:   qa?.answer   || '',
        importance: qa?.importance ?? 3,
      },
      onConfirm: (data) => {
        try {
          nodeService.update(nodeId, { name: data.question });
          qaService.update(nodeId, { question: data.question, answer: data.answer, importance: data.importance });
          toast.success('수정되었습니다.');
          _render();
          if (_selectedId === nodeId) _showPanel(nodeId);
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
      <strong>"${_esc(node.name)}"</strong> 및 하위 노드를 모두 삭제합니다.<br>
      이 작업은 되돌릴 수 없습니다.
    </p>`,
    confirmLabel: '삭제',
    onConfirm: () => {
      try {
        nodeService.remove(nodeId);
        if (_selectedId === nodeId) { _selectedId = null; _panelEl.hidden = true; }
        toast.success('삭제되었습니다.');
        _render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (e) { toast.error(e.message); }
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _ns(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function _attr(el, attrs) {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;') .replace(/"/g, '&quot;');
}

function _trunc(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
