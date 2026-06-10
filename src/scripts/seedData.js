import { nodeService, initRootNode, ROOT_NODE_ID } from './storage.js';

const SEED_KEY = 'mt_seeded_v2';
const OLD_SEED_KEY = 'mt_seeded';

/**
 * 최초 실행 시 한 번만 샘플 데이터를 삽입한다.
 * v1 seed(mt_seeded)가 감지되면 구 데이터를 초기화 후 재시드한다.
 */
function seedIfEmpty() {
  if (localStorage.getItem(SEED_KEY)) return;

  // v1 → v2 마이그레이션: 구 seed 데이터 초기화 후 root 재생성
  if (localStorage.getItem(OLD_SEED_KEY)) {
    localStorage.removeItem(OLD_SEED_KEY);
    localStorage.removeItem('mt_nodes');
    localStorage.removeItem('mt_qa');
    localStorage.removeItem('mt_attempts');
    initRootNode();
  }

  // ── CS (root 하위)
  const cs = nodeService.addCategory({ name: 'CS', parentId: ROOT_NODE_ID });

  // ── CS > Data Structures
  const ds = nodeService.addCategory({ name: 'Data Structures', parentId: cs.id });

  nodeService.addQA({
    parentId: ds.id,
    question: 'Stack이란 무엇인가?',
    answer: 'LIFO(Last In First Out) 구조. 마지막에 삽입된 데이터가 가장 먼저 꺼내진다. push/pop 연산이 O(1).',
    importance: 4,
  });
  nodeService.addQA({
    parentId: ds.id,
    question: 'Queue란 무엇인가?',
    answer: 'FIFO(First In First Out) 구조. 먼저 삽입된 데이터가 먼저 꺼내진다. enqueue/dequeue 연산이 O(1).',
    importance: 4,
  });
  nodeService.addQA({
    parentId: ds.id,
    question: 'Binary Search Tree(BST)의 시간복잡도는?',
    answer: '평균 탐색/삽입/삭제 O(log n). 균형이 깨지면 최악 O(n). 균형 트리(AVL, Red-Black)로 O(log n) 보장.',
    importance: 5,
  });
  nodeService.addQA({
    parentId: ds.id,
    question: 'Hash Table 충돌 해결 방법은?',
    answer: '체이닝(Chaining): 같은 버킷에 연결 리스트로 연결. 개방 주소법(Open Addressing): 빈 슬롯을 탐사(linear, quadratic, double hashing).',
    importance: 4,
  });

  // ── CS > Algorithms
  const algo = nodeService.addCategory({ name: 'Algorithms', parentId: cs.id });

  nodeService.addQA({
    parentId: algo.id,
    question: 'Big-O 표기법이란?',
    answer: '알고리즘의 시간·공간 복잡도를 입력 크기 n에 대한 점근적 상한으로 표현. 상수·하위 항은 무시한다.',
    importance: 5,
  });
  nodeService.addQA({
    parentId: algo.id,
    question: '퀵소트의 시간복잡도는?',
    answer: '평균 O(n log n), 최악 O(n²)(피벗이 항상 최솟값/최댓값일 때). 공간복잡도 O(log n)(재귀 스택).',
    importance: 4,
  });
  nodeService.addQA({
    parentId: algo.id,
    question: '동적 프로그래밍(DP)이란?',
    answer: '큰 문제를 중복되는 하위 문제로 분해하고, 결과를 메모이제이션/테이블로 저장해 재계산을 피하는 최적화 기법.',
    importance: 5,
  });
  nodeService.addQA({
    parentId: algo.id,
    question: 'BFS와 DFS의 차이는?',
    answer: 'BFS: 너비 우선 탐색, Queue 사용, 최단 경로 보장. DFS: 깊이 우선 탐색, Stack/재귀 사용, 메모리 효율적.',
    importance: 4,
  });

  localStorage.setItem(SEED_KEY, '1');
}

export { seedIfEmpty };
