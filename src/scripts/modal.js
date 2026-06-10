let _backdrop = null;
let _titleEl = null;
let _bodyEl = null;
let _footerEl = null;
let _onConfirm = null;
let _onClose = null;

function init() {
  _backdrop  = document.getElementById('modal-backdrop');
  _titleEl   = document.getElementById('modal-title');
  _bodyEl    = document.getElementById('modal-body');
  _footerEl  = document.getElementById('modal-footer');

  document.getElementById('modal-close').addEventListener('click', close);

  _backdrop.addEventListener('click', (e) => {
    if (e.target === _backdrop) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_backdrop.hidden) close();
  });
}

/**
 * 범용 모달 열기
 * @param {{
 *   title: string,
 *   bodyHTML: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   onConfirm?: () => void,
 *   onClose?: () => void,
 * }} opts
 */
function open({ title, bodyHTML, confirmLabel = '확인', cancelLabel = '취소', onConfirm, onClose } = {}) {
  _titleEl.textContent = title;
  _bodyEl.innerHTML = bodyHTML;
  _onConfirm = onConfirm || null;
  _onClose   = onClose   || null;

  _footerEl.innerHTML = `
    <button class="btn btn--ghost"   id="modal-cancel">${_escapeHtml(cancelLabel)}</button>
    <button class="btn btn--primary" id="modal-confirm">${_escapeHtml(confirmLabel)}</button>
  `;

  _footerEl.querySelector('#modal-cancel').addEventListener('click', close);
  _footerEl.querySelector('#modal-confirm').addEventListener('click', _handleConfirm);

  _backdrop.hidden = false;
  const firstInput = _bodyEl.querySelector('input, select, textarea');
  if (firstInput) firstInput.focus();
}

/**
 * 노드 생성/편집 전용 모달
 * @param {{
 *   mode: 'create-category' | 'create-qa' | 'edit-category' | 'edit-qa',
 *   initial?: { name?: string, question?: string, answer?: string, importance?: number },
 *   onConfirm: (data: object) => void,
 *   onClose?: () => void,
 * }} opts
 */
function openNodeForm({ mode, initial = {}, onConfirm, onClose } = {}) {
  const isCategory = mode === 'create-category' || mode === 'edit-category';
  const isCreate   = mode.startsWith('create');
  const title = isCreate
    ? (isCategory ? '카테고리 추가' : 'Q&A 추가')
    : (isCategory ? '카테고리 편집' : 'Q&A 편집');

  const bodyHTML = isCategory
    ? _categoryFormHTML(initial)
    : _qaFormHTML(initial);

  _titleEl.textContent = title;
  _bodyEl.innerHTML = bodyHTML;
  _onClose = onClose || null;

  _footerEl.innerHTML = `
    <button class="btn btn--ghost"   id="modal-cancel">취소</button>
    <button class="btn btn--primary" id="modal-confirm">${isCreate ? '추가' : '저장'}</button>
  `;

  _footerEl.querySelector('#modal-cancel').addEventListener('click', close);
  _footerEl.querySelector('#modal-confirm').addEventListener('click', () => {
    const data = isCategory ? _collectCategoryForm() : _collectQAForm();
    if (!data) return;
    if (onConfirm) onConfirm(data);
    close();
  });

  _backdrop.hidden = false;
  _bodyEl.querySelector('input')?.focus();
}

function _categoryFormHTML(initial) {
  return `
    <div class="form-group">
      <label class="form-label" for="modal-field-name">카테고리 이름 <span aria-hidden="true">*</span></label>
      <input
        id="modal-field-name"
        class="form-input"
        type="text"
        placeholder="예: 운영체제"
        value="${_escapeHtml(initial.name || '')}"
        maxlength="100"
      />
    </div>
  `;
}

function _qaFormHTML(initial) {
  const stars = Array.from({ length: 6 }, (_, i) => {
    const checked = (initial.importance ?? 3) === i ? 'selected' : '';
    return `<option value="${i}" ${checked}>${'★'.repeat(i) || '없음'}</option>`;
  }).join('');

  return `
    <div class="form-group">
      <label class="form-label" for="modal-field-question">질문 <span aria-hidden="true">*</span></label>
      <textarea
        id="modal-field-question"
        class="form-textarea"
        placeholder="질문을 입력하세요"
        rows="3"
      >${_escapeHtml(initial.question || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="modal-field-answer">답변 <span aria-hidden="true">*</span></label>
      <textarea
        id="modal-field-answer"
        class="form-textarea"
        placeholder="답변을 입력하세요"
        rows="4"
      >${_escapeHtml(initial.answer || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="modal-field-importance">중요도</label>
      <select id="modal-field-importance" class="form-select">${stars}</select>
    </div>
  `;
}

function _collectCategoryForm() {
  const name = _bodyEl.querySelector('#modal-field-name')?.value.trim();
  if (!name) {
    _bodyEl.querySelector('#modal-field-name')?.focus();
    return null;
  }
  return { name };
}

function _collectQAForm() {
  const question   = _bodyEl.querySelector('#modal-field-question')?.value.trim();
  const answer     = _bodyEl.querySelector('#modal-field-answer')?.value.trim();
  const importance = parseInt(_bodyEl.querySelector('#modal-field-importance')?.value ?? '3', 10);
  if (!question) { _bodyEl.querySelector('#modal-field-question')?.focus(); return null; }
  if (!answer)   { _bodyEl.querySelector('#modal-field-answer')?.focus();   return null; }
  return { question, answer, importance };
}

function _handleConfirm() {
  if (_onConfirm) _onConfirm();
  close();
}

function close() {
  _backdrop.hidden = true;
  _titleEl.textContent = '';
  _bodyEl.innerHTML = '';
  _footerEl.innerHTML = '';
  _onConfirm = null;
  const cb = _onClose;
  _onClose = null;
  if (cb) cb();
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { init, open, openNodeForm, close };
