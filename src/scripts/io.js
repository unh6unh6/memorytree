import { generateId } from './models.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

const EXPORT_VERSION = 1;
const SK = {
  nodes:    'mt_nodes',
  qa:       'mt_qa',
  attempts: 'mt_attempts',
};

// ─── Public API ───────────────────────────────────────────────────────────────

let _initialized = false;

export function init() {
  if (_initialized) return;
  _initialized = true;

  document.getElementById('io-import-btn')
    ?.addEventListener('click', (e) => _showImportMenu(e.currentTarget));

  document.getElementById('io-export-btn')
    ?.addEventListener('click', (e) => _showExportMenu(e.currentTarget));

  document.getElementById('io-file-input')
    ?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) _handleFile(file);
      e.target.value = '';
    });

  document.getElementById('io-file-input-md')
    ?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) _handleFileMD(file);
      e.target.value = '';
    });
}

// ─── Dropdown Menu ────────────────────────────────────────────────────────────

const MENU_ID = 'io-active-menu';

function _showExportMenu(trigger) {
  _showMenu(trigger, [
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 12 17 16 13"/><line x1="12" y1="17" x2="12" y2="9"/></svg>`,
      title: 'JSON',
      desc: '전체 데이터 내보내기 (노드 · Q&A · 풀이 기록 포함)',
      action: _doExport,
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      title: 'Markdown',
      desc: '트리 구조만 내보내기 (풀이 기록 미포함)',
      action: _doExportMD,
    },
  ]);
}

function _showImportMenu(trigger) {
  _showMenu(trigger, [
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 11 12 7 16 11"/><line x1="12" y1="7" x2="12" y2="17"/></svg>`,
      title: 'JSON',
      desc: '전체 데이터 가져오기',
      warn: '기존 데이터가 모두 삭제될 수 있습니다.',
      action: () => document.getElementById('io-file-input')?.click(),
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      title: 'Markdown',
      desc: '트리 구조 가져오기 (풀이 기록 제외)',
      action: () => document.getElementById('io-file-input-md')?.click(),
    },
    { divider: true },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      title: '기타',
      desc: '다른 형식 문서를 AI로 변환하여 가져오기',
      action: _showOtherModal,
    },
  ]);
}

function _showMenu(trigger, items) {
  _closeMenu();

  const menu = document.createElement('div');
  menu.className = 'io-menu';
  menu.id = MENU_ID;

  items.forEach(item => {
    if (item.divider) {
      const hr = document.createElement('hr');
      hr.className = 'io-menu__divider';
      menu.appendChild(hr);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'io-menu__item';
    btn.innerHTML = `
      <span class="io-menu__item-icon">${item.icon}</span>
      <span class="io-menu__item-body">
        <span class="io-menu__item-title">${item.title}</span>
        <span class="io-menu__item-desc">${item.desc}</span>
        ${item.warn ? `<span class="io-menu__item-warn">${item.warn}</span>` : ''}
      </span>
    `;
    btn.addEventListener('click', () => {
      _closeMenu();
      item.action();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  const rect = trigger.getBoundingClientRect();
  menu.style.top   = `${rect.bottom + 6}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;

  // 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('click', _onOutsideClick);
    document.addEventListener('keydown', _onMenuKey);
  }, 0);
}

function _closeMenu() {
  document.getElementById(MENU_ID)?.remove();
  document.removeEventListener('click', _onOutsideClick);
  document.removeEventListener('keydown', _onMenuKey);
}

function _onOutsideClick(e) {
  if (!e.target.closest(`#${MENU_ID}`)) _closeMenu();
}

function _onMenuKey(e) {
  if (e.key === 'Escape') _closeMenu();
}

// ─── 기타: AI 변환 가이드 ──────────────────────────────────────────────────────

const AI_PROMPT = `You are a data converter. Convert the document content I provide into Memory Tree JSON format.
Return ONLY valid JSON — no markdown code blocks, no explanations.

═══════════════════════════════════════════
MEMORY TREE JSON SCHEMA
═══════════════════════════════════════════

{
  "version": 1,
  "exportedAt": <current unix timestamp in ms>,
  "nodes": {
    "<id>": {
      "id": "<unique string>",
      "parentId": "<parent id, or null for root>",
      "name": "<display name, max 60 chars>",
      "type": "category" | "qa",
      "children": ["<child-id>", ...],
      "createdAt": "<ISO 8601 datetime>"
    }
  },
  "qa": {
    "<qa-id>": {
      "id": "<same id as node>",
      "question": "<full question text>",
      "answer": "<full answer text>",
      "importance": <integer 0–5>,
      "createdAt": "<ISO 8601 datetime>"
    }
  },
  "attempts": []
}

═══════════════════════════════════════════
CONVERSION RULES
═══════════════════════════════════════════

1. ROOT NODE  — Exactly one node: { id:"root", parentId:null, name:"My Tree", type:"category" }
2. CATEGORIES — Represent headings/sections (type:"category"). Siblings must all be the same type (all categories OR all Q&As, never mixed).
3. QA NODES   — Represent question-answer pairs (type:"qa"). Always leaf nodes (children:[]). Each QA node must also have an entry in the "qa" object with the full question and answer.
4. name field for QA nodes = question text truncated to 60 characters.
5. importance — Assign based on how fundamental the topic is: 0=skip, 1–2=low, 3=medium (default), 4–5=critical.
6. IDs        — Use short, unique strings. Examples: "root", "cat-os", "cat-network", "qa-001", "qa-002".
7. attempts   — Always set to empty array [].
8. Parse headings/sections from the document as category nodes, and Q&A pairs or key facts as QA nodes.

═══════════════════════════════════════════
DOCUMENT TO CONVERT
═══════════════════════════════════════════

[Paste your document content here]`;

function _showOtherModal() {
  modal.open({
    title: '다른 형식 문서 가져오기',
    confirmLabel: '닫기',
    showCancel: false,
    bodyHTML: `
      <p style="font-size:14px;color:var(--color-on-surface-variant);margin-bottom:16px;line-height:1.6">
        기존 노트, PDF, 텍스트 등 어떤 형식의 문서도 AI를 활용하면 Memory Tree로 가져올 수 있습니다.
      </p>
      <ol class="io-guide__steps">
        <li>아래 <strong>AI 프롬프트</strong>를 복사합니다.</li>
        <li><strong>ChatGPT, Claude</strong> 등 AI 어시스턴트를 엽니다.</li>
        <li>프롬프트를 붙여넣고, 변환할 <strong>문서 내용</strong>을 함께 전달합니다.<br>
            <span style="font-size:12px;color:var(--color-on-surface-variant)">(파일 업로드 또는 텍스트 복사 방식 모두 가능)</span></li>
        <li>AI가 반환한 JSON을 <strong>.json 파일</strong>로 저장합니다.</li>
        <li>Memory Tree의 <strong>Import → JSON</strong>을 선택하여 파일을 불러옵니다.</li>
      </ol>
      <div class="io-guide__prompt-header">
        <span>AI 프롬프트</span>
        <button class="btn btn--ghost io-guide__copy-btn" id="io-copy-prompt-btn">복사</button>
      </div>
      <pre class="io-guide__prompt" id="io-guide-prompt-text">${_escHtml(AI_PROMPT)}</pre>
    `,
    onConfirm: () => {},
  });

  document.getElementById('io-copy-prompt-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      btn.textContent = '복사됨 ✓';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = '복사'; btn.disabled = false; }, 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Export ───────────────────────────────────────────────────────────────────

function _doExport() {
  const nodes    = _raw(SK.nodes)    || {};
  const qa       = _raw(SK.qa)       || {};
  const attempts = _raw(SK.attempts) || [];

  const payload = { version: EXPORT_VERSION, exportedAt: Date.now(), nodes, qa, attempts };
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement('a'), {
    href:     url,
    download: `memory-tree-${_today()}.json`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('내보내기가 완료되었습니다.');
}

// ─── Import ───────────────────────────────────────────────────────────────────

function _handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      toast.error('JSON 파싱 오류: 올바른 파일을 선택해주세요.');
      return;
    }
    const errors = _validate(data);
    if (errors.length) {
      toast.error('유효성 검사 실패: ' + errors[0]);
      return;
    }
    _showImportModal(data);
  };
  reader.onerror = () => toast.error('파일 읽기 오류가 발생했습니다.');
  reader.readAsText(file);
}

function _showImportModal(data) {
  const nodeCount = Object.keys(data.nodes).length;
  const qaCount   = Object.keys(data.qa).length;
  const attCount  = data.attempts.length;

  modal.open({
    title: '가져오기',
    bodyHTML: `
      <p style="color:var(--color-on-surface-variant);font-size:14px;margin-bottom:16px">
        가져올 데이터: 노드 <strong>${nodeCount}개</strong>,
        Q&amp;A <strong>${qaCount}개</strong>,
        풀이 기록 <strong>${attCount}개</strong>
      </p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;
               padding:12px;border:1.5px solid var(--color-outline-variant);border-radius:8px">
          <input type="radio" name="import-mode" value="overwrite" checked style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:14px">덮어쓰기</div>
            <div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:2px">
              기존 데이터를 모두 삭제하고 가져온 데이터로 교체합니다.
            </div>
          </div>
        </label>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;
               padding:12px;border:1.5px solid var(--color-outline-variant);border-radius:8px">
          <input type="radio" name="import-mode" value="merge" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:14px">병합</div>
            <div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:2px">
              기존 데이터를 유지하고 ID가 없는 새 항목만 추가합니다.
            </div>
          </div>
        </label>
      </div>
    `,
    confirmLabel: '가져오기',
    onConfirm: () => {
      const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'overwrite';
      _applyImport(data, mode);
    },
  });
}

function _applyImport(data, mode) {
  try {
    if (mode === 'overwrite') {
      localStorage.setItem(SK.nodes,    JSON.stringify(data.nodes));
      localStorage.setItem(SK.qa,       JSON.stringify(data.qa));
      localStorage.setItem(SK.attempts, JSON.stringify(data.attempts));
    } else {
      const existNodes    = _raw(SK.nodes)    || {};
      const existQA       = _raw(SK.qa)       || {};
      const existAttempts = _raw(SK.attempts) || [];
      const existAttIds   = new Set(existAttempts.map(a => a.id));

      const mergedNodes = { ...existNodes };
      Object.entries(data.nodes).forEach(([id, n]) => { if (!mergedNodes[id]) mergedNodes[id] = n; });

      const mergedQA = { ...existQA };
      Object.entries(data.qa).forEach(([id, q]) => { if (!mergedQA[id]) mergedQA[id] = q; });

      const mergedAttempts = [...existAttempts, ...data.attempts.filter(a => !existAttIds.has(a.id))];

      localStorage.setItem(SK.nodes,    JSON.stringify(mergedNodes));
      localStorage.setItem(SK.qa,       JSON.stringify(mergedQA));
      localStorage.setItem(SK.attempts, JSON.stringify(mergedAttempts));
    }

    toast.success('가져오기 완료. 페이지를 새로고침합니다...');
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    toast.error('가져오기 실패: ' + err.message);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function _validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['유효하지 않은 JSON 형식입니다.'];
  }
  const errors = [];
  if (typeof data.version !== 'number') {
    errors.push('version 필드가 없거나 올바르지 않습니다.');
  }
  if (!data.nodes || typeof data.nodes !== 'object' || Array.isArray(data.nodes)) {
    errors.push('nodes 필드가 없거나 올바르지 않습니다.');
  } else {
    const hasRoot = Object.values(data.nodes).some(n => n.parentId === null);
    if (!hasRoot) errors.push('root 노드가 없습니다.');
    for (const [id, node] of Object.entries(data.nodes)) {
      if (!node.id || typeof node.name !== 'string'
          || !['category', 'qa'].includes(node.type)
          || !Array.isArray(node.children)) {
        errors.push(`노드 구조 오류 (id: ${id})`);
        break;
      }
    }
  }
  if (!data.qa || typeof data.qa !== 'object' || Array.isArray(data.qa)) {
    errors.push('qa 필드가 없거나 올바르지 않습니다.');
  }
  if (!Array.isArray(data.attempts)) {
    errors.push('attempts 필드가 배열이 아닙니다.');
  }
  return errors;
}

// ─── Markdown Export ─────────────────────────────────────────────────────────

function _doExportMD() {
  const nodes = _raw(SK.nodes) || {};
  const qa    = _raw(SK.qa)    || {};

  const rootId = Object.keys(nodes).find(id => nodes[id].parentId === null);
  if (!rootId) { toast.error('내보낼 데이터가 없습니다.'); return; }

  const lines = [];
  _writeMDNode(nodes, qa, rootId, 0, lines);

  const md   = lines.join('\n') + '\n';
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `memory-tree-${_today()}.md`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Markdown 내보내기가 완료되었습니다.');
}

function _writeMDNode(nodes, qa, nodeId, depth, lines) {
  const node = nodes[nodeId];
  if (!node) return;

  if (node.type === 'category') {
    if (depth > 0) lines.push('#'.repeat(depth) + ' ' + node.name);

    let prevWasQA = false;
    for (const childId of (node.children || [])) {
      const child = nodes[childId];
      if (!child) continue;
      if (child.type === 'qa') {
        const q = qa[childId];
        if (!q) continue;
        if (prevWasQA) lines.push('');
        lines.push('- ' + q.question);
        lines.push('\t- ' + q.answer);
        prevWasQA = true;
      } else {
        if (prevWasQA) lines.push('');
        _writeMDNode(nodes, qa, childId, depth + 1, lines);
        prevWasQA = false;
      }
    }
  }
}

// ─── Markdown Import ──────────────────────────────────────────────────────────

function _handleFileMD(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const { nodes, qa, topLevelIds } = _parseMD(e.target.result);
      if (topLevelIds.length === 0) {
        toast.error('가져올 카테고리가 없습니다. 파일 형식을 확인해주세요.');
        return;
      }
      _showMDImportModal(nodes, qa, topLevelIds);
    } catch (err) {
      toast.error('파싱 오류: ' + err.message);
    }
  };
  reader.onerror = () => toast.error('파일 읽기 오류가 발생했습니다.');
  reader.readAsText(file);
}

function _parseMD(text) {
  const lines = text.split('\n');
  const nodes = {};
  const qa    = {};
  const categoryStack = []; // { id, depth }
  let pendingQ = null;
  const now = new Date().toISOString();

  for (const line of lines) {
    const catMatch = line.match(/^(#+) (.+)/);
    if (catMatch) {
      const depth = catMatch[1].length;
      const name  = catMatch[2].trim();
      while (categoryStack.length && categoryStack[categoryStack.length - 1].depth >= depth) {
        categoryStack.pop();
      }
      const parentId = categoryStack.length ? categoryStack[categoryStack.length - 1].id : null;
      const id = generateId();
      nodes[id] = { id, parentId, name, type: 'category', children: [], createdAt: now };
      if (parentId && nodes[parentId]) nodes[parentId].children.push(id);
      categoryStack.push({ id, depth });
      pendingQ = null;
      continue;
    }

    const ansMatch = line.match(/^\t- (.+)/);
    if (ansMatch && pendingQ) {
      const answer   = ansMatch[1].trim();
      const { question, nodeId } = pendingQ;
      qa[nodeId] = { id: nodeId, question, answer, importance: 3, createdAt: now };
      pendingQ = null;
      continue;
    }

    const qMatch = line.match(/^- (.+)/);
    if (qMatch) {
      const question = qMatch[1].trim();
      const parentId = categoryStack.length ? categoryStack[categoryStack.length - 1].id : null;
      const nodeId   = generateId();
      nodes[nodeId]  = { id: nodeId, parentId, name: question.substring(0, 60), type: 'qa', children: [], createdAt: now };
      if (parentId && nodes[parentId]) nodes[parentId].children.push(nodeId);
      pendingQ = { question, nodeId };
      continue;
    }

    if (!line.trim()) pendingQ = null;
  }

  const topLevelIds = Object.values(nodes).filter(n => n.parentId === null).map(n => n.id);
  return { nodes, qa, topLevelIds };
}

function _showMDImportModal(importedNodes, importedQA, topLevelIds) {
  const nodeCount = Object.keys(importedNodes).length;
  const qaCount   = Object.keys(importedQA).length;

  modal.open({
    title: 'Markdown 가져오기',
    bodyHTML: `
      <p style="color:var(--color-on-surface-variant);font-size:14px;margin-bottom:16px">
        가져올 데이터: 노드 <strong>${nodeCount}개</strong>,
        Q&amp;A <strong>${qaCount}개</strong>
      </p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;
               padding:12px;border:1.5px solid var(--color-outline-variant);border-radius:8px">
          <input type="radio" name="md-import-mode" value="overwrite" checked style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:14px">덮어쓰기</div>
            <div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:2px">
              기존 노드/Q&amp;A를 모두 삭제하고 가져온 데이터로 교체합니다. (풀이 기록은 유지)
            </div>
          </div>
        </label>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;
               padding:12px;border:1.5px solid var(--color-outline-variant);border-radius:8px">
          <input type="radio" name="md-import-mode" value="merge" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:14px">병합</div>
            <div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:2px">
              기존 데이터를 유지하고 가져온 카테고리를 루트 아래에 추가합니다.
            </div>
          </div>
        </label>
      </div>
    `,
    confirmLabel: '가져오기',
    onConfirm: () => {
      const mode = document.querySelector('input[name="md-import-mode"]:checked')?.value || 'overwrite';
      _applyMDImport(importedNodes, importedQA, topLevelIds, mode);
    },
  });
}

function _applyMDImport(importedNodes, importedQA, topLevelIds, mode) {
  try {
    const ROOT_ID = 'root';

    if (mode === 'overwrite') {
      const existAttempts = _raw(SK.attempts) || [];
      const now = new Date().toISOString();
      const rootNode = { id: ROOT_ID, parentId: null, name: 'My Tree', type: 'category', children: [...topLevelIds], createdAt: now };
      const newNodes = { [ROOT_ID]: rootNode };
      topLevelIds.forEach(id => {
        importedNodes[id].parentId = ROOT_ID;
      });
      Object.assign(newNodes, importedNodes);
      localStorage.setItem(SK.nodes,    JSON.stringify(newNodes));
      localStorage.setItem(SK.qa,       JSON.stringify(importedQA));
      localStorage.setItem(SK.attempts, JSON.stringify(existAttempts));
    } else {
      const existNodes = _raw(SK.nodes) || {};
      const existQA    = _raw(SK.qa)    || {};

      const rootId = Object.keys(existNodes).find(id => existNodes[id].parentId === null) || ROOT_ID;
      if (!existNodes[rootId]) {
        existNodes[rootId] = { id: rootId, parentId: null, name: 'My Tree', type: 'category', children: [], createdAt: new Date().toISOString() };
      }

      topLevelIds.forEach(id => {
        importedNodes[id].parentId = rootId;
        existNodes[rootId].children.push(id);
      });
      Object.assign(existNodes, importedNodes);
      Object.assign(existQA,    importedQA);

      localStorage.setItem(SK.nodes, JSON.stringify(existNodes));
      localStorage.setItem(SK.qa,    JSON.stringify(existQA));
    }

    toast.success('가져오기 완료. 페이지를 새로고침합니다...');
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    toast.error('가져오기 실패: ' + err.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _raw(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function _today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
