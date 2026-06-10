import { nodeService } from './storage.js';

let _container = null;
let _selectedId = null;
let _expandedIds = new Set();
let _searchQuery = '';
let _initialized = false;

function init(container) {
  _container = container;

  if (!_initialized) {
    _initialized = true;
    document.addEventListener('navbar:search', (e) => {
      _searchQuery = e.detail.query.toLowerCase();
      render();
    });
  }

  render();
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
      const id = el.dataset.id;
      _selectedId = id;
      render();
      document.dispatchEvent(new CustomEvent('sidebar:select', {
        detail: { id, type: el.dataset.type },
      }));
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
  render();
}

function getSelectedId() {
  return _selectedId;
}

export { init, refresh, select, getSelectedId };
