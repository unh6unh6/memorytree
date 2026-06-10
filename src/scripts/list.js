import { nodeService, qaService, attemptService } from './storage.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

let _container = null;
let _nodeId    = null;
let _searchQuery = '';
let _sortBy    = 'created';
let _flipped   = false;
let _initialized = false;

const RESULT_EMOJI = { 1: '😄', 0.5: '😐', 0: '😞' };
const RESULT_LABEL = { 1: '성공', 0.5: '부분 성공', 0: '실패' };

const SORT_OPTIONS = [
  { value: 'created',    label: '생성 순' },
  { value: 'random',     label: '랜덤' },
  { value: 'fail',       label: '실패 빈도' },
  { value: 'importance', label: '중요도' },
];

export function init(container, nodeId) {
  _nodeId      = nodeId || null;
  _searchQuery = '';
  _sortBy      = 'created';
  _flipped     = false;

  if (!_initialized || _container !== container) {
    _container   = container;
    _initialized = true;
    _bindContainerEvents();
  }

  render();
}

// ─── Render ──────────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;

  if (!_nodeId) {
    _container.innerHTML = '<div class="list-empty-state"><p>표시할 노드가 없습니다.<br><a href="#explorer">탐색기로 돌아가기</a></p></div>';
    return;
  }

  const nodes = nodeService.getAll();
  const node  = nodes[_nodeId];
  if (!node) {
    _container.innerHTML = '<div class="list-empty-state"><p>노드를 찾을 수 없습니다.<br><a href="#explorer">탐색기로 돌아가기</a></p></div>';
    return;
  }

  const canAddQA = _canAddQA(nodes, _nodeId);

  _container.innerHTML = `
    <div class="list-view">
      <header class="list-header">
        <div class="list-header__top">
          ${_renderBreadcrumb(nodes, _nodeId)}
          <div class="list-header__actions">
            <button
              class="btn btn--ghost list-flip-btn${_flipped ? ' list-flip-btn--active' : ''}"
              id="list-btn-flip"
              aria-pressed="${_flipped}"
              title="질문·답변 반전"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="17 1 21 5 17 9"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              반전${_flipped ? ' 켜짐' : ''}
            </button>
            ${canAddQA ? `<button class="btn btn--ghost" id="list-btn-add">+ Q&amp;A 추가</button>` : ''}
            <button class="btn btn--primary" id="list-btn-test">문제 풀기</button>
          </div>
        </div>
        ${_renderToolbar()}
      </header>
      <div class="list-cards" id="list-cards">
        ${_buildCardsHtml(nodes)}
      </div>
    </div>
  `;
}

function _renderBreadcrumb(nodes, nodeId) {
  const path = [];
  let cur = nodes[nodeId];
  while (cur) {
    path.unshift({ id: cur.id, name: cur.name });
    cur = cur.parentId ? nodes[cur.parentId] : null;
  }

  const crumbs = path.map((crumb, i) => {
    const isLast = i === path.length - 1;
    if (isLast) {
      return `<span class="list-breadcrumb__current">${_escHtml(crumb.name)}</span>`;
    }
    return `
      <a class="list-breadcrumb__link" href="#explorer">${_escHtml(crumb.name)}</a>
      <span class="list-breadcrumb__sep" aria-hidden="true">›</span>
    `;
  }).join('');

  return `
    <nav class="list-breadcrumb" aria-label="경로">
      <a class="list-breadcrumb__back" href="#explorer" aria-label="탐색기로 돌아가기">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </a>
      ${crumbs}
    </nav>
  `;
}

function _renderToolbar() {
  const opts = SORT_OPTIONS.map(o =>
    `<option value="${o.value}" ${_sortBy === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');

  return `
    <div class="list-toolbar">
      <div class="list-toolbar__search-wrap">
        <svg class="list-toolbar__search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          id="list-search"
          class="list-toolbar__search-input"
          placeholder="질문/답변 검색..."
          value="${_escHtml(_searchQuery)}"
          autocomplete="off"
          aria-label="질문/답변 검색"
        />
      </div>
      <select id="list-sort" class="list-toolbar__sort" aria-label="정렬 기준">
        ${opts}
      </select>
    </div>
  `;
}

function _buildCardsHtml(nodes) {
  let items = _collectQAItems(nodes, _nodeId);

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(item => {
      const qa = qaService.get(item.id);
      return qa && (
        (qa.question || '').toLowerCase().includes(q) ||
        (qa.answer   || '').toLowerCase().includes(q)
      );
    });
  }

  items = _sortItems(items);

  if (!items.length) {
    return '<p class="list-empty">Q&A가 없습니다.</p>';
  }
  return items.map(item => _renderCard(nodes, item)).join('');
}

function _renderCard(nodes, treeNode) {
  const qa = qaService.get(treeNode.id);
  if (!qa) return '';

  const latest      = attemptService.getLatestByNode(treeNode.id);
  const categoryPath = _getCategoryPath(nodes, treeNode.id);
  const question    = _flipped ? qa.answer   : qa.question;
  const answer      = _flipped ? qa.question : qa.answer;

  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span class="list-card__star${i < qa.importance ? ' list-card__star--on' : ''}" aria-hidden="true">★</span>`
  ).join('');

  let metaHtml;
  if (latest) {
    const d    = new Date(latest.timestamp);
    const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    const emoji = RESULT_EMOJI[latest.result] ?? '';
    const label = RESULT_LABEL[latest.result] ?? '';
    metaHtml = `
      <span class="list-card__meta-chip">마지막 풀이: ${date}</span>
      <span class="list-card__meta-chip">${emoji} ${label}</span>
    `;
  } else {
    metaHtml = `<span class="list-card__meta-chip list-card__meta-chip--dim">미풀이</span>`;
  }

  return `
    <article class="list-card" data-id="${treeNode.id}">
      <div class="list-card__header">
        <span class="list-card__path">${_escHtml(categoryPath)}</span>
        <div class="list-card__stars" title="중요도 ${qa.importance}점" aria-label="중요도 ${qa.importance}점">${stars}</div>
      </div>
      <p class="list-card__question">${_escHtml(question)}</p>
      <blockquote class="list-card__answer">${_escHtml(answer)}</blockquote>
      <div class="list-card__footer">
        <div class="list-card__meta">${metaHtml}</div>
        <div class="list-card__actions">
          <button class="list-card__action-btn" data-action="edit" data-id="${treeNode.id}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            편집
          </button>
          <button class="list-card__action-btn list-card__action-btn--danger" data-action="delete" data-id="${treeNode.id}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            삭제
          </button>
        </div>
      </div>
    </article>
  `;
}

// ─── Events ──────────────────────────────────────────────────────────────────

function _bindContainerEvents() {
  _container.addEventListener('input', (e) => {
    if (e.target.id === 'list-search') {
      _searchQuery = e.target.value;
      _refreshCards();
    }
  });

  _container.addEventListener('change', (e) => {
    if (e.target.id === 'list-sort') {
      _sortBy = e.target.value;
      _refreshCards();
    }
  });

  _container.addEventListener('click', (e) => {
    const target = e.target;

    if (target.closest('#list-btn-flip')) {
      _flipped = !_flipped;
      const btn = _container.querySelector('#list-btn-flip');
      if (btn) {
        btn.setAttribute('aria-pressed', _flipped);
        btn.classList.toggle('list-flip-btn--active', _flipped);
        // SVG + text 유지하며 텍스트 노드만 교체
        const textNodes = [...btn.childNodes].filter(n => n.nodeType === 3);
        textNodes.forEach(n => n.textContent.trim() && (n.textContent = `반전${_flipped ? ' 켜짐' : ''}`));
      }
      _refreshCards();
      return;
    }

    if (target.closest('#list-btn-test')) {
      window.location.hash = `#test?nodeId=${_nodeId}&flipped=${_flipped}&sort=${_sortBy}`;
      return;
    }

    if (target.closest('#list-btn-add')) {
      _openAddModal();
      return;
    }

    const actionBtn = target.closest('[data-action]');
    if (actionBtn) {
      const id = actionBtn.dataset.id;
      if (actionBtn.dataset.action === 'edit')   _openEditModal(id);
      if (actionBtn.dataset.action === 'delete') _deleteQA(id);
    }
  });
}

function _refreshCards() {
  const cardsEl = document.getElementById('list-cards');
  if (!cardsEl) return;
  const nodes = nodeService.getAll();
  cardsEl.innerHTML = _buildCardsHtml(nodes);
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function _collectQAItems(nodes, nodeId) {
  const items = [];
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift();
    const n  = nodes[id];
    if (!n) continue;
    if (n.type === 'qa') {
      items.push(n);
    } else {
      n.children.forEach(c => queue.push(c));
    }
  }
  return items;
}

function _sortItems(items) {
  const copy = [...items];
  if (_sortBy === 'created') {
    return copy.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  if (_sortBy === 'random') {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  if (_sortBy === 'fail') {
    return copy.sort((a, b) => {
      const fa = attemptService.getByNode(a.id).filter(x => x.result === 0).length;
      const fb = attemptService.getByNode(b.id).filter(x => x.result === 0).length;
      return fb - fa;
    });
  }
  if (_sortBy === 'importance') {
    return copy.sort((a, b) => {
      const ia = qaService.get(a.id)?.importance ?? 0;
      const ib = qaService.get(b.id)?.importance ?? 0;
      return ib - ia;
    });
  }
  return copy;
}

function _getCategoryPath(nodes, qaNodeId) {
  const path = [];
  let cur = nodes[nodes[qaNodeId]?.parentId];
  while (cur) {
    path.unshift(cur.name);
    if (!cur.parentId) break;
    cur = nodes[cur.parentId];
  }
  return path.join(' > ');
}

function _canAddQA(nodes, nodeId) {
  const node = nodes[nodeId];
  if (!node || node.type !== 'category') return false;
  if (node.children.length === 0) return true;
  // 첫 번째 자식이 qa 타입이어야 추가 가능
  return nodes[node.children[0]]?.type === 'qa';
}

// ─── CRUD actions ─────────────────────────────────────────────────────────────

function _openAddModal() {
  modal.openNodeForm({
    mode: 'create-qa',
    onConfirm: (data) => {
      try {
        nodeService.addQA({
          parentId:   _nodeId,
          question:   data.question,
          answer:     data.answer,
          importance: data.importance,
        });
        toast.success('Q&A가 추가되었습니다.');
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (err) { toast.error(err.message); }
    },
  });
}

function _openEditModal(nodeId) {
  const nodes    = nodeService.getAll();
  const treeNode = nodes[nodeId];
  if (!treeNode || treeNode.type !== 'qa') return;

  const qa = qaService.get(nodeId);
  modal.openNodeForm({
    mode: 'edit-qa',
    initial: {
      question:   qa?.question   || treeNode.name,
      answer:     qa?.answer     || '',
      importance: qa?.importance ?? 3,
    },
    onConfirm: (data) => {
      try {
        nodeService.update(nodeId, { name: data.question });
        qaService.update(nodeId, {
          question:   data.question,
          answer:     data.answer,
          importance: data.importance,
        });
        toast.success('수정되었습니다.');
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (err) { toast.error(err.message); }
    },
  });
}

function _deleteQA(nodeId) {
  const nodes = nodeService.getAll();
  const node  = nodes[nodeId];
  if (!node) return;

  modal.open({
    title: 'Q&A 삭제',
    bodyHTML: `<p style="color:var(--color-on-surface-variant);font-size:14px">
      <strong>"${_escHtml(node.name)}"</strong>을 삭제합니다.<br>이 작업은 되돌릴 수 없습니다.
    </p>`,
    confirmLabel: '삭제',
    onConfirm: () => {
      try {
        nodeService.remove(nodeId);
        toast.success('삭제되었습니다.');
        render();
        document.dispatchEvent(new CustomEvent('canvas:data-change'));
      } catch (err) { toast.error(err.message); }
    },
  });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
