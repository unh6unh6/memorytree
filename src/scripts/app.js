import router from './router.js';
import { seedIfEmpty } from './seedData.js';
import * as navbar from './navbar.js';
import * as sidebar from './sidebar.js';
import * as modal from './modal.js';
import * as toast from './toast.js';

// 초기 데이터 삽입 (최초 1회)
seedIfEmpty();

// 공통 컴포넌트 초기화
navbar.init();
modal.init();
toast.init();

router.onRoute('explorer', () => {
  sidebar.init(document.getElementById('sidebar-body'));
});

router.onRoute('list', (params) => {
  // Phase 5에서 구현
  // params.nodeId — 선택된 노드
});

router.onRoute('test', (params) => {
  // Phase 6에서 구현
  // params.nodeId, params.flipped
});

router.init();
