import { nodeService, qaService, attemptService } from './storage.js';

let _container   = null;
let _nodeId      = null;
let _items       = [];       // 현재 세션의 QA 목록
let _index       = 0;        // 현재 문제 인덱스
let _flipped     = false;    // 질문/답변 반전 여부
let _showAnswer  = false;    // 정답 표시 여부
let _results     = [];       // { nodeId, result } 세션 결과
let _initialized = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function init(container, params = {}) {
  _nodeId     = params.nodeId || null;
  _flipped    = params.flipped === 'true' || params.flipped === true;
  _showAnswer = false;
  _index      = 0;
  _results    = [];

  if (!_initialized || _container !== container) {
    _container   = container;
    _initialized = true;
    _container.addEventListener('click', _onContainerClick);
  }
  _container = container;

  const sortBy   = params.sort || 'created';
  const nodes    = nodeService.getAll();
  const rawItems = _collectQAItems(nodes, _nodeId);
  _items         = _sortItems(rawItems, sortBy);

  _render();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  if (!_container) return;

  if (!_nodeId || _items.length === 0) {
    _container.innerHTML = `
      <div class="test-view test-view--empty">
        <p class="test-empty__msg">테스트할 Q&amp;A가 없습니다.</p>
        <a href="#list?nodeId=${_nodeId || ''}" class="btn btn--primary">모아보기로 돌아가기</a>
      </div>
    `;
    return;
  }

  _container.innerHTML = `
    <div class="test-view">
      ${_renderHeader()}
      <div class="test-body">
        ${_renderCard()}
        ${_renderEvalButtons()}
      </div>
      ${_renderProgress()}
    </div>
  `;
}

function _renderHeader() {
  return `
    <header class="test-header">
      <a href="#list?nodeId=${_nodeId}" class="test-header__back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        모아보기
      </a>
      <span class="test-header__counter">${_index + 1} / ${_items.length}</span>
    </header>
  `;
}

function _renderCard() {
  const item = _items[_index];
  if (!item) return '';
  const qa = qaService.get(item.id);
  if (!qa) return '';

  const question = _flipped ? qa.answer   : qa.question;
  const answer   = _flipped ? qa.question : qa.answer;

  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span class="test-card__star${i < qa.importance ? ' test-card__star--on' : ''}" aria-hidden="true">★</span>`
  ).join('');

  return `
    <div class="test-card">
      <div class="test-card__importance">${stars}</div>
      <div class="test-card__question">${_escHtml(question)}</div>
      <div class="test-card__reveal-section">
        <button class="test-card__reveal-btn${_showAnswer ? ' test-card__reveal-btn--active' : ''}"
                id="test-reveal-btn">
          ${_showAnswer ? '정답 가리기' : '정답 보기'}
        </button>
        <div class="test-card__answer${_showAnswer ? '' : ' test-card__answer--hidden'}"
             id="test-answer-box"
             aria-hidden="${!_showAnswer}">
          ${_escHtml(answer)}
        </div>
      </div>
    </div>
  `;
}

function _renderEvalButtons() {
  const dis = _showAnswer ? '' : 'disabled';
  return `
    <div class="test-eval" role="group" aria-label="자기 평가">
      <button class="test-eval__btn test-eval__btn--fail"    data-result="0"   ${dis}>
        <span class="test-eval__emoji">😞</span>
        <span class="test-eval__label">실패</span>
      </button>
      <button class="test-eval__btn test-eval__btn--partial" data-result="0.5" ${dis}>
        <span class="test-eval__emoji">😐</span>
        <span class="test-eval__label">부분 성공</span>
      </button>
      <button class="test-eval__btn test-eval__btn--success" data-result="1"   ${dis}>
        <span class="test-eval__emoji">😄</span>
        <span class="test-eval__label">성공</span>
      </button>
    </div>
  `;
}

function _renderProgress() {
  const done  = _index;
  const total = _items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return `
    <footer class="test-progress">
      <div class="test-progress__track"
           role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="진행률">
        <div class="test-progress__fill" style="width:${pct}%"></div>
      </div>
      <div class="test-progress__nav">
        <button class="btn btn--ghost test-nav-btn" id="test-prev" ${_index === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          이전
        </button>
        <span class="test-progress__label">${done} / ${total} 완료</span>
        <button class="btn btn--ghost test-nav-btn" id="test-next" ${_index >= total - 1 ? 'disabled' : ''}>
          다음
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </footer>
  `;
}

function _renderComplete() {
  const total   = _results.length;
  const success = _results.filter(r => r.result === 1).length;
  const partial = _results.filter(r => r.result === 0.5).length;
  const fail    = _results.filter(r => r.result === 0).length;
  const score   = total > 0 ? Math.round((success + partial * 0.5) / total * 100) : 0;
  const icon    = score >= 80 ? '🎉' : score >= 50 ? '💪' : '📚';

  _container.innerHTML = `
    <div class="test-view test-view--complete">
      <div class="test-complete">
        <div class="test-complete__icon">${icon}</div>
        <h2 class="test-complete__title">테스트 완료!</h2>
        <div class="test-complete__score">${score}<span class="test-complete__score-unit">점</span></div>
        <div class="test-complete__stats">
          <div class="test-complete__stat">😄 성공&nbsp;<strong>${success}</strong></div>
          <div class="test-complete__stat">😐 부분 성공&nbsp;<strong>${partial}</strong></div>
          <div class="test-complete__stat">😞 실패&nbsp;<strong>${fail}</strong></div>
        </div>
        <div class="test-complete__actions">
          <button class="btn btn--ghost" id="test-restart">다시 풀기</button>
          <a href="#list?nodeId=${_nodeId}" class="btn btn--primary">모아보기로 이동</a>
        </div>
      </div>
    </div>
  `;
}

// ─── Events ───────────────────────────────────────────────────────────────────

function _onContainerClick(e) {
  // 정답 보기 / 가리기
  if (e.target.closest('#test-reveal-btn')) {
    _showAnswer = !_showAnswer;
    _updateRevealUI();
    return;
  }

  // 자기 평가 버튼 (answer 표시 중일 때만 활성)
  const evalBtn = e.target.closest('[data-result]');
  if (evalBtn && !evalBtn.disabled) {
    _doEval(parseFloat(evalBtn.dataset.result));
    return;
  }

  // 이전
  if (e.target.closest('#test-prev')) {
    if (_index > 0) { _index--; _showAnswer = false; _render(); }
    return;
  }

  // 다음
  if (e.target.closest('#test-next')) {
    if (_index < _items.length - 1) { _index++; _showAnswer = false; _render(); }
    return;
  }

  // 다시 풀기 (완료 화면)
  if (e.target.closest('#test-restart')) {
    _index      = 0;
    _showAnswer = false;
    _results    = [];
    _render();
  }
}

function _updateRevealUI() {
  const revealBtn = document.getElementById('test-reveal-btn');
  const answerBox = document.getElementById('test-answer-box');
  const evalBtns  = _container?.querySelectorAll('[data-result]');

  if (revealBtn) {
    revealBtn.textContent = _showAnswer ? '정답 가리기' : '정답 보기';
    revealBtn.classList.toggle('test-card__reveal-btn--active', _showAnswer);
  }
  if (answerBox) {
    answerBox.classList.toggle('test-card__answer--hidden', !_showAnswer);
    answerBox.setAttribute('aria-hidden', String(!_showAnswer));
  }
  evalBtns?.forEach(btn => { btn.disabled = !_showAnswer; });
}

function _doEval(result) {
  const item = _items[_index];
  if (!item) return;

  attemptService.add({ nodeId: item.id, result });
  _results.push({ nodeId: item.id, result });

  if (_index >= _items.length - 1) {
    _renderComplete();
  } else {
    _index++;
    _showAnswer = false;
    _render();
  }
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

function _sortItems(items, sortBy) {
  const copy = [...items];
  if (sortBy === 'created') {
    return copy.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  if (sortBy === 'random') {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  if (sortBy === 'fail') {
    return copy.sort((a, b) => {
      const fa = attemptService.getByNode(a.id).filter(x => x.result === 0).length;
      const fb = attemptService.getByNode(b.id).filter(x => x.result === 0).length;
      return fb - fa;
    });
  }
  if (sortBy === 'importance') {
    return copy.sort((a, b) => {
      const ia = qaService.get(a.id)?.importance ?? 0;
      const ib = qaService.get(b.id)?.importance ?? 0;
      return ib - ia;
    });
  }
  return copy;
}

function _escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
