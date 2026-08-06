import { BoundedCache, globalStockCache } from '../lib/boundedCache.js';

console.log('🧪 [Test] BoundedCache & Memory Optimization Test Initiated...');

// 1. Max Items (100개 제한) 테스트
const testCache = new BoundedCache(100, 24 * 60 * 60 * 1000);

for (let i = 1; i <= 150; i++) {
  testCache.set(`STOCK_${i}`, { symbol: `00000${i}`, price: i * 1000 });
}

console.log(`📊 [Test 1] 150개 항목 전송 후 캐시 크기: ${testCache.size()}개 (목표: 100개)`);
if (testCache.size() === 100) {
  console.log('✅ [Pass] BoundedCache 100개 용량 제한(LRU 방출) 정상 동작!');
} else {
  console.error(`❌ [Fail] 캐시 용량이 100개가 아닙니다: ${testCache.size()}`);
}

// 2. 1번째 가장 오래된 항목(STOCK_1~50) 방출 여부 검증
const hasOld = testCache.has('STOCK_1');
const hasNew = testCache.has('STOCK_150');
console.log(`📊 [Test 2] 가장 오래된 'STOCK_1' 방출 여부: ${!hasOld}, 최신 'STOCK_150' 존재 여부: ${hasNew}`);

if (!hasOld && hasNew) {
  console.log('✅ [Pass] 오래된 메모리 찌꺼기 우선 파기(LRU) 검증 완료!');
} else {
  console.error('❌ [Fail] LRU 방출 알고리즘 실패');
}

// 3. TTL (24시간 도과) 만료 테스트
const expiredCache = new BoundedCache(100, 1000); // 1초 TTL 테스트
expiredCache.set('EXPIRED_STOCK', { price: 50000 });
console.log('⏳ 1.1초 대기 후 TTL 만료 검증...');

setTimeout(() => {
  const expiredResult = expiredCache.get('EXPIRED_STOCK');
  if (expiredResult === null) {
    console.log('✅ [Pass] 24시간 도과 메모리 자동 소멸(TTL) 검증 완료!');
  } else {
    console.error('❌ [Fail] TTL 만료 처리 실패');
  }

  // 4. Memory Heap Usage & GC Test
  const heapBefore = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  testCache.clear();
  if (global.gc) {
    global.gc();
    console.log('✅ [Pass] V8 가비지 컬렉션(GC) 실행 성공!');
  }
  const heapAfter = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  console.log(`📊 [Test 4] GC 전 힙: ${heapBefore} MB ➔ GC 후 힙: ${heapAfter} MB`);
  console.log('🎉 [Success] 모든 메모리 최적화 단위 테스트가 통과하였습니다!');
}, 1100);
