/**
 * BoundedCache (유한 메모리 캐시 유틸리티)
 * 
 * 1. Max Items (최대 100개 개수 제한): 101번째 데이터 들어올 시 가장 오래된 찌꺼기 즉시 파기 (LRU)
 * 2. TTL (24시간 자동 소멸): 24시간 지난 도과 메모리 자동 청소
 * 3. GC (가비지 컬렉터 지원): 메모리 힙 100MB 이하 유지
 */

export class BoundedCache {
  constructor(maxItems = 100, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  set(key, value) {
    if (!key) return;

    // 이미 존재하는 키일 경우 LRU 순서 갱신을 위해 삭제
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 최대 용량(100개) 초과 시 가장 오래된 1번째 메모리 찌꺼기 즉시 방출
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    if (!key) return null;
    const item = this.cache.get(key);
    if (!item) return null;

    // TTL (24시간) 만료 체크
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // LRU 순서 갱신
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  // 24시간 도과 찌꺼기 일괄 삭제
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttlMs) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  clear() {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  size() {
    return this.cache.size;
  }
}

// 글로벌 공유 Bounded Cache 인스턴스들
export const globalStockCache = new BoundedCache(100, 24 * 60 * 60 * 1000);
export const globalChartCache = new BoundedCache(100, 24 * 60 * 60 * 1000);
export const globalDetailCache = new BoundedCache(100, 24 * 60 * 60 * 1000);
