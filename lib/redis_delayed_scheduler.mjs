/**
 * Redis sorted-set delayed scheduler for stream-backed services.
 *
 * Purpose:
 *   Stores delayed records in a Redis sorted set and promotes due jobs into
 *   Redis Streams with deterministic idempotency keys.
 *
 * Environment:
 *   Uses the caller-provided Redis client, typically created from REDIS_URL by
 *   lib/redis_streams.mjs. Local Redis may be insecure. Stage and production
 *   should use secure Valkey URLs supplied through environment variables.
 *
 * Side Effects:
 *   Writes scheduler records to Redis sorted sets, creates short-lived lock
 *   keys, removes promoted records, and publishes stream entries.
 */

import crypto from 'node:crypto';

/* eslint-disable no-await-in-loop, no-restricted-syntax */

/**
 * @typedef {object} DelayedRecord
 * @property {string} targetStream Destination Redis stream.
 * @property {object} payload JSON-serializable payload.
 * @property {number} dueAt Epoch milliseconds when the record should promote.
 * @property {string} [idempotencyKey] Stable dedupe key. Generated when absent.
 */

/**
 * Build a deterministic idempotency key for a scheduled record.
 *
 * @param {Pick<DelayedRecord, 'targetStream'|'payload'|'dueAt'>} record Scheduler record.
 * @returns {string} Stable SHA-256 key.
 */
export function buildIdempotencyKey({ targetStream, payload, dueAt }) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ dueAt, payload, targetStream }));
  return hash.digest('hex');
}

/**
 * Serialize a scheduled item for storage in a Redis sorted set.
 *
 * @param {DelayedRecord} record Scheduled record.
 * @returns {string} JSON storage value.
 */
export function serializeDelayedRecord(record) {
  const idempotencyKey = record.idempotencyKey || buildIdempotencyKey(record);
  return JSON.stringify({ ...record, idempotencyKey });
}

/**
 * Delayed scheduler backed by one Redis sorted set and short-lived lock keys.
 */
export class RedisDelayedScheduler {
  /**
   * @param {object} options Scheduler options.
   * @param {object} options.client Redis-compatible client.
   * @param {string} options.scheduledSet Sorted-set key used for delayed jobs.
   * @param {number} [options.lockTtlMs=30000] Lock TTL for promotion attempts.
   */
  constructor({ client, scheduledSet, lockTtlMs = 30000 }) {
    this.client = client;
    this.scheduledSet = scheduledSet;
    this.lockTtlMs = lockTtlMs;
  }

  /**
   * Schedule a record for future stream promotion.
   *
   * @param {DelayedRecord} record Scheduled record.
   * @returns {Promise<string>} Idempotency key.
   * @sideEffects Calls ZADD on the scheduler sorted set.
   */
  async schedule(record) {
    const serialized = serializeDelayedRecord(record);
    const { idempotencyKey } = JSON.parse(serialized);
    await this.client.zadd(this.scheduledSet, record.dueAt, serialized);
    return idempotencyKey;
  }

  /**
   * Read due records without mutating scheduler state.
   *
   * @param {number} [now=Date.now()] Current epoch milliseconds.
   * @param {number} [limit=100] Maximum due records.
   * @returns {Promise<DelayedRecord[]>} Due records.
   */
  async dueRecords(now = Date.now(), limit = 100) {
    const records = await this.client.zrangebyscore(
      this.scheduledSet,
      '-inf',
      now,
      'LIMIT',
      0,
      limit
    );

    return records.map(record => JSON.parse(record));
  }

  /**
   * Promote due records into target streams, using per-record locks to avoid
   * duplicate promotion from concurrent scheduler instances.
   *
   * @param {number} [now=Date.now()] Current epoch milliseconds.
   * @param {number} [limit=100] Maximum due records to promote.
   * @returns {Promise<Array<{idempotencyKey: string, streamId: string}>>} Promotion results.
   * @sideEffects Locks due records, calls XADD, removes promoted sorted-set entries, and clears locks.
   */
  async promoteDue(now = Date.now(), limit = 100) {
    const records = await this.client.zrangebyscore(
      this.scheduledSet,
      '-inf',
      now,
      'LIMIT',
      0,
      limit
    );
    const promoted = [];

    for (const serialized of records) {
      const record = JSON.parse(serialized);
      const lockKey = `${this.scheduledSet}:lock:${record.idempotencyKey}`;
      const locked = await this.client.set(
        lockKey,
        '1',
        'PX',
        this.lockTtlMs,
        'NX'
      );

      if (locked) {
        try {
          const streamId = await this.client.xadd(
            record.targetStream,
            '*',
            'payload',
            JSON.stringify(record.payload),
            'idempotencyKey',
            record.idempotencyKey
          );
          await this.client.zrem(this.scheduledSet, serialized);
          promoted.push({ idempotencyKey: record.idempotencyKey, streamId });
        } finally {
          await this.client.del(lockKey);
        }
      }
    }

    return promoted;
  }
}
