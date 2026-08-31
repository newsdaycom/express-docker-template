/**
 * Unit tests for Redis Streams template helpers.
 *
 * Purpose:
 *   Verifies producer payload encoding, consumer parsing and acknowledgement,
 *   consumer group creation, and pending-message recovery without requiring a
 *   live Redis server.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

/* eslint-disable import/extensions */

import {
  RedisStreamConsumer,
  RedisStreamProducer,
  parseStreamEntry,
  sendRedisCommand,
  streamKey
} from '../lib/redis_streams.mjs';

test('streamKey adds an optional namespace prefix', () => {
  assert.equal(streamKey('jobs', 'local'), 'local:jobs');
  assert.equal(streamKey('jobs'), 'jobs');
});

test('producer writes JSON payloads with XADD', async () => {
  const calls = [];
  const client = {
    async xadd(...args) {
      calls.push(args);
      return '1-0';
    }
  };
  const producer = new RedisStreamProducer({ client, stream: 'jobs' });

  const id = await producer.publish({ contentId: 'abc' }, { source: 'test' });

  assert.equal(id, '1-0');
  assert.deepEqual(calls, [
    ['jobs', '*', 'payload', '{"contentId":"abc"}', 'source', 'test']
  ]);
});

test('sendRedisCommand supports sendCommand-only clients', async () => {
  const calls = [];
  const client = {
    async sendCommand(args) {
      calls.push(args);
      return '1-0';
    }
  };

  const result = await sendRedisCommand(client, 'xadd', 'XADD', [
    'jobs',
    '*',
    'payload',
    '{"ok":true}'
  ]);

  assert.equal(result, '1-0');
  assert.deepEqual(calls, [['XADD', 'jobs', '*', 'payload', '{"ok":true}']]);
});

test('producer falls back to sendCommand when xadd is unavailable', async () => {
  const calls = [];
  const client = {
    async sendCommand(args) {
      calls.push(args);
      return '2-0';
    }
  };
  const producer = new RedisStreamProducer({ client, stream: 'jobs' });

  const id = await producer.publish({ contentId: 'abc' });

  assert.equal(id, '2-0');
  assert.deepEqual(calls, [
    ['XADD', 'jobs', '*', 'payload', '{"contentId":"abc"}']
  ]);
});

test('parseStreamEntry exposes Redis ID, parsed payload, and raw fields', () => {
  const message = parseStreamEntry([
    '2-0',
    ['payload', '{"ok":true}', 'idempotencyKey', 'key-1']
  ]);

  assert.deepEqual(message, {
    id: '2-0',
    payload: { ok: true },
    fields: {
      payload: '{"ok":true}',
      idempotencyKey: 'key-1'
    }
  });
});

test('consumer creates groups idempotently and acknowledges messages', async () => {
  const calls = [];
  const client = {
    async xgroup(...args) {
      calls.push(['xgroup', ...args]);
      throw new Error('BUSYGROUP Consumer Group name already exists');
    },
    async xack(...args) {
      calls.push(['xack', ...args]);
      return 1;
    }
  };
  const consumer = new RedisStreamConsumer({
    client,
    stream: 'jobs',
    group: 'workers',
    consumer: 'worker-1'
  });

  await consumer.ensureGroup();
  const acked = await consumer.acknowledge('3-0');

  assert.equal(acked, 1);
  assert.deepEqual(calls, [
    ['xgroup', 'CREATE', 'jobs', 'workers', '0', 'MKSTREAM'],
    ['xack', 'jobs', 'workers', '3-0']
  ]);
});

test('consumer parses XREADGROUP responses', async () => {
  const client = {
    async xreadgroup() {
      return [
        [
          'jobs',
          [
            ['4-0', ['payload', '{"name":"first"}']],
            ['5-0', ['payload', '{"name":"second"}']]
          ]
        ]
      ];
    }
  };
  const consumer = new RedisStreamConsumer({
    client,
    stream: 'jobs',
    group: 'workers',
    consumer: 'worker-1'
  });

  const messages = await consumer.read();

  assert.deepEqual(
    messages.map(message => [message.id, message.payload.name]),
    [
      ['4-0', 'first'],
      ['5-0', 'second']
    ]
  );
});

test('consumer read falls back to sendCommand when xreadgroup is unavailable', async () => {
  const calls = [];
  const client = {
    async sendCommand(args) {
      calls.push(args);
      return [['jobs', [['8-0', ['payload', '{"name":"fallback"}']]]]];
    }
  };
  const consumer = new RedisStreamConsumer({
    client,
    stream: 'jobs',
    group: 'workers',
    consumer: 'worker-1',
    blockMs: 10,
    batchSize: 1
  });

  const messages = await consumer.read();

  assert.equal(messages[0].payload.name, 'fallback');
  assert.deepEqual(calls, [
    [
      'XREADGROUP',
      'GROUP',
      'workers',
      'worker-1',
      'COUNT',
      '1',
      'BLOCK',
      '10',
      'STREAMS',
      'jobs',
      '>'
    ]
  ]);
});

test('consumer recovers pending messages with XAUTOCLAIM when available', async () => {
  const client = {
    async xautoclaim(...args) {
      assert.deepEqual(args, [
        'jobs',
        'workers',
        'worker-1',
        1000,
        '0-0',
        'COUNT',
        2
      ]);
      return ['0-0', [['6-0', ['payload', '{"pending":true}']]]];
    }
  };
  const consumer = new RedisStreamConsumer({
    client,
    stream: 'jobs',
    group: 'workers',
    consumer: 'worker-1',
    pendingIdleMs: 1000,
    batchSize: 2
  });

  const messages = await consumer.recoverPending();

  assert.deepEqual(messages, [
    {
      id: '6-0',
      payload: { pending: true },
      fields: { payload: '{"pending":true}' }
    }
  ]);
});

test('consumer falls back to XPENDING and XCLAIM recovery', async () => {
  const calls = [];
  const client = {
    async xpending(...args) {
      calls.push(['xpending', ...args]);
      return [['7-0']];
    },
    async xclaim(...args) {
      calls.push(['xclaim', ...args]);
      return [['7-0', ['payload', '{"claimed":true}']]];
    }
  };
  const consumer = new RedisStreamConsumer({
    client,
    stream: 'jobs',
    group: 'workers',
    consumer: 'worker-1',
    pendingIdleMs: 1000,
    batchSize: 2
  });

  const messages = await consumer.recoverPending();

  assert.equal(messages[0].payload.claimed, true);
  assert.deepEqual(calls, [
    ['xpending', 'jobs', 'workers', '-', '+', 2],
    ['xclaim', 'jobs', 'workers', 'worker-1', 1000, '7-0']
  ]);
});
