import router from './router.js';

router.onRoute('explorer', () => {
  // Phase 4에서 Explorer 화면 렌더링
});

router.onRoute('list', (params) => {
  // Phase 5에서 Question List 화면 렌더링
  // params.nodeId — 선택된 노드
});

router.onRoute('test', (params) => {
  // Phase 6에서 Test Mode 렌더링
  // params.nodeId, params.flipped
});

router.init();
