import router from './router.js';
import { initRootNode } from './storage.js';
import { seedIfEmpty } from './seedData.js';
import * as navbar from './navbar.js';
import * as sidebar from './sidebar.js';
import * as modal from './modal.js';
import * as toast from './toast.js';
import * as canvas from './canvas.js';
import * as list from './list.js';
import * as test from './test.js';

// root 노드 보장 → 샘플 데이터 삽입 (최초 1회)
initRootNode();
seedIfEmpty();

// 공통 컴포넌트 초기화
navbar.init();
modal.init();
toast.init();

// canvas에서 데이터가 바뀌면 사이드바 동기화
document.addEventListener('canvas:data-change', () => sidebar.refresh());

// canvas 노드 선택 → 사이드바 노드 선택 동기화 (양방향)
document.addEventListener('canvas:select', (e) => sidebar.select(e.detail.id));

router.onRoute('explorer', () => {
  sidebar.init(document.getElementById('sidebar-body'));
  canvas.init(document.getElementById('canvas-area'));
});

router.onRoute('list', (params) => {
  list.init(document.getElementById('list-container'), params.nodeId);
});

router.onRoute('test', (params) => {
  test.init(document.getElementById('test-container'), params);
});

router.init();
