/**
 * @typedef {Object} TreeNode
 * @property {string} id
 * @property {string|null} parentId
 * @property {string} name
 * @property {'category'|'qa'} type
 * @property {string[]} children  - child node IDs
 * @property {number} createdAt   - ms timestamp
 */

/**
 * @typedef {Object} QANode
 * @property {string} id
 * @property {string} question
 * @property {string} answer
 * @property {number} importance  - 0~5
 * @property {number} createdAt   - ms timestamp
 */

/**
 * @typedef {Object} Attempt
 * @property {string} id
 * @property {string} nodeId
 * @property {1.0|0.5|0.0} result
 * @property {number} timestamp   - ms timestamp
 */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * @param {Partial<TreeNode>} fields
 * @returns {TreeNode}
 */
function createTreeNode({ parentId = null, name, type }) {
  if (type !== 'category' && type !== 'qa') {
    throw new Error(`Invalid TreeNode type: ${type}`);
  }
  return {
    id: generateId(),
    parentId,
    name,
    type,
    children: [],
    createdAt: Date.now(),
  };
}

/**
 * @param {Partial<QANode>} fields
 * @returns {QANode}
 */
function createQANode({ question, answer, importance = 3 }) {
  if (importance < 0 || importance > 5) {
    throw new Error(`importance must be 0-5, got: ${importance}`);
  }
  return {
    id: generateId(),
    question,
    answer,
    importance,
    createdAt: Date.now(),
  };
}

/**
 * @param {Partial<Attempt>} fields
 * @returns {Attempt}
 */
function createAttempt({ nodeId, result }) {
  if (result !== 1.0 && result !== 0.5 && result !== 0.0) {
    throw new Error(`result must be 1.0, 0.5, or 0.0, got: ${result}`);
  }
  return {
    id: generateId(),
    nodeId,
    result,
    timestamp: Date.now(),
  };
}

export { generateId, createTreeNode, createQANode, createAttempt };
