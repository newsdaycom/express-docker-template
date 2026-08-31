/**
 * Unit tests for the Redis delayed scheduler helper.
 *
 * Purpose:
 *   Protects sorted-set due/not-due behavior, deterministic idempotency keys,
 *   lock-based promotion, and stream publish payloads.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

/* eslint-disable import/extensions */

import {
  RedisDelayedScheduler,
  buildIdempotencyKey,
  serializeDelayedRecord
} from '../lib/redis_delayed_scheduler.mjs';

class FakeRedis {
  constructor() {
    this.sortedSets = new Map();
    this.locks = new Set();
    this.streamEntries = [];
  }

  async zadd(key, score, value) {
    const records = this.sortedSets.get(key) || [];
    records.push({ score, value });
    this.sortedSets.set(key, records);
    return 1;
  }

  async zrangebyscore(key, min, max, limitKeyword, offset, limit) {
    assert.equal(min, '-inf');
    assert.equal(limitKeyword, 'LIMIT');
    return (this.sortedSets.get(key) || [])
      .filter(record => record.score <= max)
      .slice(offset, offset + limit)
      .map(record => record.value);
  }

  async set(key) {
    if (this.locks.has(key)) {
      return null;
    }

    this.locks.add(key);
    return 'OK';
  }

  async xadd(...args) {
    this.streamEntries.push(args);
    return `${this.streamEntries.length}-0`;
  }

  async zrem(key, value) {
    const records = this.sortedSets.get(key) || [];
    this.sortedSets.set(
      key,
      records.filter(record => record.value !== value)
    );
    return 1;
  }

  async del(key) {
    this.locks.delete(key);
    return 1;
  }
}

test('buildIdempotencyKey is deterministic for equivalent scheduled records', () => {
  const record = {
    targetStream: 'jobs',
    payload: { contentId: 'abc', eventType: 'publish' },
    dueAt: 123
  };

  assert.equal(buildIdempotencyKey(record), buildIdempotencyKey(record));
});

test('schedule stores a delayed record and returns the idempotency key', async () => {
  const client = new FakeRedis();
  const scheduler = new RedisDelayedScheduler({
    client,
    scheduledSet: 'scheduled'
  });
  const record = {
    targetStream: 'jobs',
    payload: { ok: true },
    dueAt: 1000
  };

  const key = await scheduler.schedule(record);
  const stored = client.sortedSets.get('scheduled')[0];

  assert.equal(key, buildIdempotencyKey(record));
  assert.equal(stored.score, 1000);
  assert.deepEqual(JSON.parse(stored.value), {
    ...record,
    idempotencyKey: key
  });
});

test('dueRecords returns due records and excludes future records', async () => {
  const client = new FakeRedis();
  const scheduler = new RedisDelayedScheduler({
    client,
    scheduledSet: 'scheduled'
  });
  await scheduler.schedule({
    targetStream: 'jobs',
    payload: { due: true },
    dueAt: 1000
  });
  await scheduler.schedule({
    targetStream: 'jobs',
    payload: { due: false },
    dueAt: 3000
  });

  const records = await scheduler.dueRecords(2000);

  assert.deepEqual(
    records.map(record => record.payload),
    [{ due: true }]
  );
});

test('promoteDue locks, publishes, removes, and reports due records', async () => {
  const client = new FakeRedis();
  const scheduler = new RedisDelayedScheduler({
    client,
    scheduledSet: 'scheduled'
  });
  const record = {
    targetStream: 'jobs',
    payload: { contentId: 'abc' },
    dueAt: 1000
  };
  const key = await scheduler.schedule(record);

  const promoted = await scheduler.promoteDue(1000);

  assert.deepEqual(promoted, [{ idempotencyKey: key, streamId: '1-0' }]);
  assert.deepEqual(client.streamEntries, [
    ['jobs', '*', 'payload', '{"contentId":"abc"}', 'idempotencyKey', key]
  ]);
  assert.deepEqual(client.sortedSets.get('scheduled'), []);
});

test('promoteDue falls back to sendCommand for sorted set and stream commands', async () => {
  const calls = [];
  const serialized = serializeDelayedRecord({
    targetStream: 'jobs',
    payload: { ok: true },
    dueAt: 1000,
    idempotencyKey: 'key-1'
  });
  const client = {
    async sendCommand(args) {
      calls.push(args);
      if (args[0] === 'ZRANGEBYSCORE') {
        return [serialized];
      }
      if (args[0] === 'XADD') {
        return '1-0';
      }
      return 1;
    },
    async set() {
      return 'OK';
    },
    async del() {
      return 1;
    }
  };
  const scheduler = new RedisDelayedScheduler({
    client,
    scheduledSet: 'scheduled'
  });

  const promoted = await scheduler.promoteDue(1000);

  assert.deepEqual(promoted, [{ idempotencyKey: 'key-1', streamId: '1-0' }]);
  assert.deepEqual(calls, [
    ['ZRANGEBYSCORE', 'scheduled', '-inf', '1000', 'LIMIT', '0', '100'],
    ['XADD', 'jobs', '*', 'payload', '{"ok":true}', 'idempotencyKey', 'key-1'],
    ['ZREM', 'scheduled', serialized]
  ]);
});

test('serializeDelayedRecord preserves caller-supplied idempotency keys', () => {
  const serialized = serializeDelayedRecord({
    targetStream: 'jobs',
    payload: { ok: true },
    dueAt: 1000,
    idempotencyKey: 'known-key'
  });

  assert.equal(JSON.parse(serialized).idempotencyKey, 'known-key');
});
