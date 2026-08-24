import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryStore } from '../src/core/memory-store';

describe('MemoryStore', () => {
  it('should set and get values', async () => {
    const store = new MemoryStore({ maxItems: 100, defaultTtlSeconds: 10 });
    try {
      await store.set('test:key', { foo: 'bar' });
      const result = await store.get<{ foo: string }>('test:key');
      assert.deepEqual(result, { foo: 'bar' });
    } finally {
      await store.close();
    }
  });

  it('should return null for non-existent keys', async () => {
    const store = new MemoryStore();
    try {
      const result = await store.get('non-existent');
      assert.equal(result, null);
    } finally {
      await store.close();
    }
  });

  it('should check existence with has()', async () => {
    const store = new MemoryStore();
    try {
      await store.set('exists:key', 123);
      assert.equal(await store.has('exists:key'), true);
      assert.equal(await store.has('not:exists'), false);
    } finally {
      await store.close();
    }
  });

  it('should delete keys', async () => {
    const store = new MemoryStore();
    try {
      await store.set('del:key1', 'val1');
      await store.set('del:key2', 'val2');

      const deletedOne = await store.del('del:key1');
      assert.equal(deletedOne, 1);
      assert.equal(await store.get('del:key1'), null);

      const deletedMany = await store.del(['del:key2', 'del:nonexistent']);
      assert.equal(deletedMany, 1);
    } finally {
      await store.close();
    }
  });

  it('should batch mget and mset', async () => {
    const store = new MemoryStore();
    try {
      await store.mset([
        { key: 'm:1', value: 'one' },
        { key: 'm:2', value: 'two' },
      ]);

      const results = await store.mget<string>(['m:1', 'm:2', 'm:missing']);
      assert.deepEqual(results, ['one', 'two', null]);
    } finally {
      await store.close();
    }
  });

  it('should clear with wildcard pattern', async () => {
    const store = new MemoryStore();
    try {
      await store.set('user:1', 'Alice');
      await store.set('user:2', 'Bob');
      await store.set('post:1', 'Post 1');

      await store.clear('user:*');

      assert.equal(await store.get('user:1'), null);
      assert.equal(await store.get('user:2'), null);
      assert.equal(await store.get('post:1'), 'Post 1');
    } finally {
      await store.close();
    }
  });

  it('should respect TTL expiration', async () => {
    const store = new MemoryStore();
    try {
      await store.set('expire:key', 'short-lived', 0.05); // 50ms
      assert.equal(await store.get('expire:key'), 'short-lived');

      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(await store.get('expire:key'), null);
    } finally {
      await store.close();
    }
  });
});
