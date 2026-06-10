import { createTreeNode, createQANode, createAttempt } from './models.js';

const KEYS = {
  nodes: 'mt_nodes',
  qa: 'mt_qa',
  attempts: 'mt_attempts',
};

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── nodeService ──────────────────────────────────────────────────────────────

const nodeService = {
  /** @returns {Record<string, import('./models.js').TreeNode>} */
  getAll() {
    return load(KEYS.nodes) || {};
  },

  /** @param {string} id @returns {import('./models.js').TreeNode|null} */
  get(id) {
    return this.getAll()[id] ?? null;
  },

  /**
   * 새 카테고리 노드 생성.
   * parentId가 있으면 부모의 children 배열에도 추가한다.
   * @param {{ name: string, parentId?: string|null }} opts
   * @returns {import('./models.js').TreeNode}
   */
  addCategory({ name, parentId = null }) {
    const nodes = this.getAll();
    const node = createTreeNode({ name, type: 'category', parentId });
    nodes[node.id] = node;
    if (parentId && nodes[parentId]) {
      this._assertChildTypeConsistency(nodes, parentId, 'category');
      nodes[parentId].children.push(node.id);
    }
    save(KEYS.nodes, nodes);
    return node;
  },

  /**
   * 새 Q&A 노드 생성 (TreeNode 메타 + QANode 컨텐츠 분리 저장).
   * @param {{ parentId: string, question: string, answer: string, importance?: number }} opts
   * @returns {{ treeNode: import('./models.js').TreeNode, qaNode: import('./models.js').QANode }}
   */
  addQA({ parentId, question, answer, importance = 3 }) {
    const nodes = this.getAll();
    if (parentId && nodes[parentId]) {
      this._assertChildTypeConsistency(nodes, parentId, 'qa');
    }
    const treeNode = createTreeNode({ name: question, type: 'qa', parentId });
    const qaNode = createQANode({ question, answer, importance });
    // QANode id를 TreeNode id와 일치시켜 1:1 연결
    qaNode.id = treeNode.id;
    nodes[treeNode.id] = treeNode;
    if (parentId && nodes[parentId]) {
      nodes[parentId].children.push(treeNode.id);
    }
    save(KEYS.nodes, nodes);
    qaService.save(qaNode);
    return { treeNode, qaNode };
  },

  /**
   * 노드 이름(또는 Q&A 필드) 업데이트.
   * @param {string} id
   * @param {Partial<import('./models.js').TreeNode>} fields
   */
  update(id, fields) {
    const nodes = this.getAll();
    if (!nodes[id]) throw new Error(`Node not found: ${id}`);
    Object.assign(nodes[id], fields);
    save(KEYS.nodes, nodes);
  },

  /**
   * 노드와 그 하위 트리 전체 삭제.
   * @param {string} id
   */
  remove(id) {
    const nodes = this.getAll();
    const toDelete = this._collectDescendants(nodes, id);
    toDelete.forEach((nid) => {
      const n = nodes[nid];
      if (n.type === 'qa') qaService.remove(nid);
      attemptService.removeByNode(nid);
      delete nodes[nid];
    });
    // 부모의 children에서 제거
    const target = nodes[id]; // already deleted, keep ref before delete above
    if (!target) {
      // 이미 삭제됨 — 부모 children 클린업만 수행
      Object.values(nodes).forEach((n) => {
        n.children = n.children.filter((c) => c !== id);
      });
    } else {
      Object.values(nodes).forEach((n) => {
        n.children = n.children.filter((c) => !toDelete.has(c));
      });
    }
    save(KEYS.nodes, nodes);
  },

  /** 부모 아래 첫 번째 자식이 이미 있을 때 새 자식 타입 충돌 여부 체크 */
  _assertChildTypeConsistency(nodes, parentId, newType) {
    const parent = nodes[parentId];
    if (!parent || parent.children.length === 0) return;
    const firstChildType = nodes[parent.children[0]]?.type;
    if (firstChildType && firstChildType !== newType) {
      throw new Error(
        `형제 노드 타입 충돌: 이미 '${firstChildType}' 타입 자식이 있는 부모에 '${newType}'을 추가할 수 없습니다.`
      );
    }
  },

  /** id를 포함한 모든 하위 노드 id Set 반환 */
  _collectDescendants(nodes, id) {
    const result = new Set();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      result.add(cur);
      (nodes[cur]?.children ?? []).forEach((c) => queue.push(c));
    }
    return result;
  },
};

// ─── qaService ────────────────────────────────────────────────────────────────

const qaService = {
  getAll() {
    return load(KEYS.qa) || {};
  },
  get(id) {
    return this.getAll()[id] ?? null;
  },
  save(qaNode) {
    const all = this.getAll();
    all[qaNode.id] = qaNode;
    save(KEYS.qa, all);
  },
  update(id, fields) {
    const all = this.getAll();
    if (!all[id]) throw new Error(`QANode not found: ${id}`);
    Object.assign(all[id], fields);
    save(KEYS.qa, all);
  },
  remove(id) {
    const all = this.getAll();
    delete all[id];
    save(KEYS.qa, all);
  },
};

// ─── attemptService ───────────────────────────────────────────────────────────

const attemptService = {
  getAll() {
    return load(KEYS.attempts) || [];
  },

  /** @param {{ nodeId: string, result: 1.0|0.5|0.0 }} opts */
  add({ nodeId, result }) {
    const attempts = this.getAll();
    const attempt = createAttempt({ nodeId, result });
    attempts.push(attempt);
    save(KEYS.attempts, attempts);
    return attempt;
  },

  /** 특정 nodeId에 해당하는 Attempt 목록 반환 */
  getByNode(nodeId) {
    return this.getAll().filter((a) => a.nodeId === nodeId);
  },

  /** 특정 nodeId의 마지막 Attempt 반환 */
  getLatestByNode(nodeId) {
    const list = this.getByNode(nodeId);
    return list.length ? list[list.length - 1] : null;
  },

  removeByNode(nodeId) {
    const attempts = this.getAll().filter((a) => a.nodeId !== nodeId);
    save(KEYS.attempts, attempts);
  },
};

export { nodeService, qaService, attemptService };
