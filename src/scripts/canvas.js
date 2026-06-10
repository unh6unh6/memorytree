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
let _selectedId  = null;
let _selectedIds = new Set();   // 다중선택 상태
let _tx          = 0;
let _ty          = 0;
let _scale       = 1;
let _positions   = {};   // nodeId → { x, y }

let _didPan           = false;
let _initialized      = false;

// 노드 드래그 상태
let _draggingNodeId    = null;
let _dragStart         = null;
let _dragNodeStartPos  = null;
let _isDraggingNode    = false;
let _dragGroupStartPos = null;   // 그룹 드래그 시 선택 노드들의 시작 위치
let _manualPositions   = {};     // 수동 이동된 노드 위치 오버라이드

// 러버밴드 선택 상태
let _isRubberBanding = false;
let _rubberStart     = null;
let _rubberEl        = null;

// 애니메이션 상태
let _animating = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function init(container) {
  _container = container;
  _setupDOM();
  _bindPanZoom();
  _render();

  if (!_initialized) {
    _initialized = true;
    // 사이드바 단일 선택 → 캔버스 동기화
    document.addEventListener('sidebar:select', (e) => {
      _selectedId = e.detail.id;
      _selectedIds.clear();
      _selectedIds.add(e.detail.id);
      _render();
    });
    // 사이드바 다중선택 → 캔버스 다중선택 동기화
    document.addEventListener('sidebar:multiselect', (e) => {
      _selectedIds = new Set(e.detail.ids);
      _selectedId  = e.detail.ids[e.detail.ids.length - 1] || null;
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
         style="width:100%;height:100%;position:absolute;inset:0;display:block">
      <g id="canvas-g"></g>
      <rect id="canvas-rubber" display="none" pointer-events="none"
            fill="rgba(0,88,190,0.08)" stroke="#0058be" stroke-width="1"
            stroke-dasharray="4 2" rx="2"/>
    </svg>
    <div id="canvas-panel" class="canvas-panel" hidden></div>
    <div class="canvas-controls">
      <button class="canvas-ctrl-btn" id="ctrl-rearrange" title="노드 재배치">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="4" r="1.5"/>
          <circle cx="5"  cy="19" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
          <circle cx="19" cy="19" r="1.5"/>
          <line x1="12" y1="5.5" x2="12"  y2="12"/>
          <line x1="12" y1="12"  x2="5.5" y2="17.5"/>
          <line x1="12" y1="12"  x2="12"  y2="17.5"/>
          <line x1="12" y1="12"  x2="18.5" y2="17.5"/>
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

  _svgEl    = document.getElementById('canvas-svg');
  _gEl      = document.getElementById('canvas-g');
  _panelEl  = document.getElementById('canvas-panel');
  _rubberEl = document.getElementById('canvas-rubber');

  _centerViewInstant();

  document.getElementById('ctrl-center')   .addEventListener('click', (e) => { e.stopPropagation(); _centerView(); });
  document.getElementById('ctrl-rearrange').addEventListener('click', (e) => { e.stopPropagation(); _rearrange(); });
}

// ─── Transform ────────────────────────────────────────────────────────────────

function _centerViewInstant() {
  if (!_container) return;
  _tx    = _container.clientWidth  / 2;
  _ty    = _container.clientHeight / 2;
  _scale = 1;
  _applyTransform();
}

function _centerView() {
  if (!_container) return;
  _animateTo(_container.clientWidth / 2, _container.clientHeight / 2, 1);
}

function _animateTo(targetTx, targetTy, targetScale) {
  const fromTx    = _tx;
  const fromTy    = _ty;
  const fromScale = _scale;
  const duration  = 400;
  const startTime = performance.now();

  function frame(now) {
    const t    = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    _tx    = fromTx    + (targetTx    - fromTx)    * ease;
    _ty    = fromTy    + (targetTy    - fromTy)    * ease;
    _scale = fromScale + (targetScale - fromScale) * ease;
    _applyTransform();
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _applyTransform() {
  if (!_gEl) return;
  _gEl.setAttribute('transform', `translate(${_tx},${_ty}) scale(${_scale})`);
}

// ─── Pan / Zoom events ────────────────────────────────────────────────────────

function _bindPanZoom() {
  // 빈 캔버스 영역 mousedown → 러버밴드 시작
  _svgEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-role="node"]')) return;
    if (e.target.closest('.canvas-controls')) return;
    const rect = _svgEl.getBoundingClientRect();
    _isRubberBanding = true;
    _didPan = false;
    _rubberStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    // 노드 드래그 우선
    if (_draggingNodeId && _dragStart) {
      const dx = (e.clientX - _dragStart.x) / _scale;
      const dy = (e.clientY - _dragStart.y) / _scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _isDraggingNode = true;
      if (_isDraggingNode) {
        if (_selectedIds.has(_draggingNodeId) && _selectedIds.size > 1 && _dragGroupStartPos) {
          // 그룹 드래그: 다중선택된 모든 노드를 동일한 delta로 이동
          for (const id of _selectedIds) {
            if (!_dragGroupStartPos[id]) continue;
            _manualPositions[id] = {
              x: _dragGroupStartPos[id].x + dx,
              y: _dragGroupStartPos[id].y + dy,
            };
            _positions[id] = _manualPositions[id];
          }
        } else {
          _manualPositions[_draggingNodeId] = {
            x: _dragNodeStartPos.x + dx,
            y: _dragNodeStartPos.y + dy,
          };
          _positions[_draggingNodeId] = _manualPositions[_draggingNodeId];
        }
        _render();
      }
      return;
    }
    // 러버밴드 드래그
    if (!_isRubberBanding || !_rubberStart || !_rubberEl) return;
    const rect = _svgEl.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const rw = Math.abs(cx - _rubberStart.x);
    const rh = Math.abs(cy - _rubberStart.y);
    if (rw > 4 || rh > 4) {
      _didPan = true;
      _rubberEl.setAttribute('x', Math.min(_rubberStart.x, cx));
      _rubberEl.setAttribute('y', Math.min(_rubberStart.y, cy));
      _rubberEl.setAttribute('width',  rw);
      _rubberEl.setAttribute('height', rh);
      _rubberEl.setAttribute('display', '');
    }
  });

  window.addEventListener('mouseup', (e) => {
    // 노드 드래그 종료
    _draggingNodeId    = null;
    _dragStart         = null;
    _dragGroupStartPos = null;

    // 러버밴드 종료 → 영역 내 노드 다중선택
    if (_isRubberBanding) {
      _isRubberBanding = false;
      if (_rubberEl && _rubberEl.getAttribute('display') !== 'none') {
        const rx = parseFloat(_rubberEl.getAttribute('x'))      || 0;
        const ry = parseFloat(_rubberEl.getAttribute('y'))      || 0;
        const rw = parseFloat(_rubberEl.getAttribute('width'))  || 0;
        const rh = parseFloat(_rubberEl.getAttribute('height')) || 0;
        if (rw > 4 && rh > 4) {
          _selectedIds.clear();
          Object.entries(_positions).forEach(([id, pos]) => {
            const sx = _tx + pos.x * _scale;
            const sy = _ty + pos.y * _scale;
            if (sx >= rx && sx <= rx + rw && sy >= ry && sy <= ry + rh) {
              _selectedIds.add(id);
            }
          });
          _selectedId = [..._selectedIds][_selectedIds.size - 1] || null;
          _render();
          if (_selectedIds.size > 0) {
            document.dispatchEvent(new CustomEvent('canvas:multiselect', {
              detail: { ids: [..._selectedIds] },
            }));
          }
        }
        _rubberEl.setAttribute('display', 'none');
      }
    }
  });

  // 캔버스 배경 우클릭 시 브라우저 기본 메뉴 방지
  _svgEl.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('[data-role="node"]')) e.preventDefault();
  });

  _svgEl.addEventListener('click', () => {
    if (_didPan) { _didPan = false; return; }
    if (_selectedId || _selectedIds.size) {
      _selectedId = null;
      _selectedIds.clear();
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
  const isSelected = _selectedIds.has(node.id);
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
    // 다중선택 그룹 드래그: 선택된 모든 노드의 시작 위치 캡처
    if (_selectedIds.has(node.id) && _selectedIds.size > 1) {
      _dragGroupStartPos = {};
      for (const id of _selectedIds) {
        if (_positions[id]) _dragGroupStartPos[id] = { ..._positions[id] };
      }
    } else {
      _dragGroupStartPos = null;
    }
  });

  // 좌클릭: 선택 (Shift → 다중선택, 그 외 단일선택)
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_isDraggingNode) { _isDraggingNode = false; return; }
    const addEl = e.target.closest('[data-role="add"]');
    if (addEl) { _openAddModal(addEl.dataset.parent); return; }

    if (e.shiftKey) {
      // Shift 다중선택
      if (_selectedIds.has(node.id)) {
        _selectedIds.delete(node.id);
        if (_selectedId === node.id) _selectedId = [..._selectedIds][_selectedIds.size - 1] || null;
      } else {
        _selectedIds.add(node.id);
        _selectedId = node.id;
      }
      _render();
      document.dispatchEvent(new CustomEvent('canvas:multiselect', {
        detail: { ids: [..._selectedIds] },
      }));
    } else {
      _selectedId = node.id;
      _selectedIds.clear();
      _selectedIds.add(node.id);
      _render();
      document.dispatchEvent(new CustomEvent('canvas:select', { detail: { id: node.id } }));
    }
  });

  // 우클릭: 단일 → 상세 패널 / 다중 → 삭제 패널
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (_selectedIds.size > 1 && _selectedIds.has(node.id)) {
      // 다중선택 상태: 삭제 패널
      _render();
      _showMultiDeletePanel(e.clientX, e.clientY);
    } else {
      _selectedId = node.id;
      _selectedIds.clear();
      _selectedIds.add(node.id);
      _render();
      _showPanel(node.id);
      document.dispatchEvent(new CustomEvent('canvas:select', { detail: { id: node.id } }));
    }
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
  _hideCanvasCtxPanel();
  if (_selectedId || _selectedIds.size) {
    _selectedId = null;
    _selectedIds.clear();
    _render();
  }
}

// ─── 캔버스 다중선택 삭제 패널 (Task 6) ──────────────────────────────────────

let _canvasCtxPanel = null;

function _showMultiDeletePanel(clientX, clientY) {
  _hideCanvasCtxPanel();
  const count = _selectedIds.size;
  const panel = document.createElement('div');
  panel.className = 'sidebar-ctx-panel';
  panel.style.zIndex = 'var(--z-dropdown)';
  panel.innerHTML = `
    <div class="sidebar-ctx-panel__name">${count}개 선택됨</div>
    <hr class="sidebar-ctx-panel__divider">
    <button class="sidebar-ctx-panel__item sidebar-ctx-panel__item--danger" data-action="del-multi">${count}개 삭제</button>
  `;
  document.body.appendChild(panel);
  _canvasCtxPanel = panel;

  const PW = 180;
  const PH = panel.offsetHeight || 80;
  let left = clientX + 4;
  let top  = clientY;
  if (left + PW > window.innerWidth  - 8) left = clientX - PW - 4;
  if (top  + PH > window.innerHeight - 8) top  = window.innerHeight - PH - 8;
  panel.style.left = `${Math.max(4, left)}px`;
  panel.style.top  = `${Math.max(4, top)}px`;

  panel.querySelector('[data-action="del-multi"]')?.addEventListener('click', () => {
    _hideCanvasCtxPanel();
    _deleteMultiple([..._selectedIds]);
  });

  setTimeout(() => {
    document.addEventListener('mousedown', _onCanvasCtxOutside, { once: true });
  }, 0);
}

function _onCanvasCtxOutside(e) {
  if (_canvasCtxPanel && !_canvasCtxPanel.contains(e.target)) _hideCanvasCtxPanel();
}

function _hideCanvasCtxPanel() {
  if (_canvasCtxPanel) { _canvasCtxPanel.remove(); _canvasCtxPanel = null; }
  document.removeEventListener('mousedown', _onCanvasCtxOutside);
}

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
        try { nodeService.remove(id); deleted++; } catch { /* already removed */ }
      }
      _selectedIds.clear();
      _selectedId = null;
      if (_panelEl) _panelEl.hidden = true;
      toast.success(`${deleted}개 삭제되었습니다.`);
      _render();
      document.dispatchEvent(new CustomEvent('canvas:data-change'));
    },
  });
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

// ─── 노드 재배치 ───────────────────────────────────────────────────────────────

function _rearrange() {
  if (_animating) return;
  const nodes = nodeService.getAll();
  const fromPositions = { ..._positions };

  // 재배치 대상 결정: 다중선택이면 해당 노드+하위, 없으면 전체
  let idsToRearrange = null;
  if (_selectedIds.size > 0) {
    idsToRearrange = new Set();
    for (const id of _selectedIds) {
      _collectDescendantsCanvas(nodes, id).forEach(d => idsToRearrange.add(d));
    }
  }

  // 대상 노드의 수동 위치를 임시 제거 후 레이아웃 재계산
  const backupManual = { ..._manualPositions };
  if (idsToRearrange) {
    idsToRearrange.forEach(id => delete _manualPositions[id]);
  } else {
    _manualPositions = {};
  }

  _computeLayout(nodes);
  const toPositions = { ..._positions };

  // 재배치하지 않는 노드의 수동 위치 복원
  _manualPositions = {};
  Object.entries(backupManual).forEach(([id, pos]) => {
    if (!idsToRearrange || !idsToRearrange.has(id)) {
      _manualPositions[id] = pos;
    }
  });

  _animatePositions(fromPositions, toPositions);
}

function _animatePositions(from, to) {
  if (_animating) return;
  _animating = true;
  const duration  = 600;
  const startTime = performance.now();

  function frame(now) {
    const t    = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // 애니메이션 중: 보간된 위치를 manualPositions로 설정하여 _computeLayout 오버라이드 활용
    const interpolated = {};
    Object.keys(to).forEach(id => {
      if (id === ROOT_NODE_ID) return;
      const f = from[id] || to[id];
      interpolated[id] = {
        x: f.x + (to[id].x - f.x) * ease,
        y: f.y + (to[id].y - f.y) * ease,
      };
    });
    _manualPositions = interpolated;
    _render();

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      _animating = false;
      // 최종 위치를 manualPositions로 고정
      _manualPositions = {};
      Object.entries(to).forEach(([id, pos]) => {
        if (id !== ROOT_NODE_ID) _manualPositions[id] = pos;
      });
      _render();
    }
  }
  requestAnimationFrame(frame);
}

function _collectDescendantsCanvas(nodes, id) {
  const result = new Set();
  const queue  = [id];
  while (queue.length) {
    const cur = queue.shift();
    result.add(cur);
    (nodes[cur]?.children ?? []).forEach(c => queue.push(c));
  }
  return result;
}
