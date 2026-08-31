/**
 * Redis Streams helper for services that publish or consume Valkey/Redis jobs.
 *
 * Purpose:
 *   Provides reusable producer and consumer primitives around XADD, consumer
 *   groups, XREADGROUP, XACK, and pending-message recovery.
 *
 * Environment:
 *   createRedisConnection reads REDIS_URL. Local development may use an
 *   insecure redis:// URL supplied by Docker Compose. Stage and production
 *   should provide a secure rediss:// Valkey URL through deployment secrets.
 *
 * Side Effects:
 *   createRedisConnection opens a network connection. Producer and consumer
 *   methods mutate Redis stream and consumer-group state.
 */

/* eslint-disable max-classes-per-file, no-await-in-loop, no-restricted-syntax */

import os from 'node:os';
import process from 'node:process';

/**
 * @typedef {object} RedisStreamMessage
 * @property {string} id Redis stream entry ID.
 * @property {object} payload Parsed message payload.
 * @property {Record<string, string>} fields Raw Redis stream fields.
 */

/**
 * @typedef {object} RedisStreamOptions
 * @property {object} client Redis-compatible client instance.
 * @property {string} stream Stream key.
 * @property {string} [group] Consumer group name.
 * @property {string} [consumer] Consumer name.
 * @property {number} [blockMs] Blocking read duration.
 * @property {number} [batchSize] Maximum messages per read.
 * @property {number} [pendingIdleMs] Idle threshold before claiming pending messages.
 */

/**
 * Create a Redis client from REDIS_URL and connect it.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] Runtime environment.
 * @returns {Promise<object>} Connected Redis client from the `redis` package.
 * @throws {Error} When REDIS_URL is missing.
 * @sideEffects Opens a Redis or Valkey network connection.
 */
export async function createRedisConnection(env = process.env) {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required');
  }

  const { createClient } = await import('redis');
  const client = createClient({ url: env.REDIS_URL });
  await client.connect();
  return client;
}

/**
 * Prefix a stream key with a namespace when REDIS_STREAM_PREFIX is configured.
 *
 * @param {string} stream Base stream key.
 * @param {string} [prefix=''] Optional namespace prefix.
 * @returns {string} Namespaced stream key.
 */
export function streamKey(stream, prefix = '') {
  return prefix ? `${prefix}:${stream}` : stream;
}

/**
 * Convert a Redis command field array into a plain object.
 *
 * @param {string[]} fields Alternating field and value entries.
 * @returns {Record<string, string>} Field object.
 */
export function fieldsToObject(fields = []) {
  const mapped = {};

  for (let index = 0; index < fields.length; index += 2) {
    mapped[fields[index]] = fields[index + 1];
  }

  return mapped;
}

/**
 * Parse a Redis stream entry into the template's message shape.
 *
 * @param {[string, string[]]} entry Redis stream entry tuple.
 * @returns {RedisStreamMessage} Parsed stream message.
 * @throws {SyntaxError} When the payload field contains invalid JSON.
 */
export function parseStreamEntry(entry) {
  const [id, rawFields] = entry;
  const fields = fieldsToObject(rawFields);
  const payload = fields.payload ? JSON.parse(fields.payload) : fields;

  return { id, payload, fields };
}

/**
 * Build a stable consumer name suitable for local and container runtimes.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] Runtime environment.
 * @returns {string} Consumer name.
 */
export function defaultConsumerName(env = process.env) {
  return env.REDIS_CONSUMER_NAME || `${os.hostname()}-${process.pid}`;
}

/**
 * Producer wrapper that writes JSON payloads to a Redis stream.
 */
export class RedisStreamProducer {
  /**
   * @param {RedisStreamOptions} options Producer configuration.
   */
  constructor({ client, stream }) {
    this.client = client;
    this.stream = stream;
  }

  /**
   * Publish a JSON-encoded payload with optional metadata fields.
   *
   * @param {object} payload JSON-serializable message payload.
   * @param {Record<string, string>} [fields={}] Additional string fields.
   * @returns {Promise<string>} Redis stream ID.
   * @sideEffects Calls XADD on the configured stream.
   */
  async publish(payload, fields = {}) {
    return this.client.xadd(
      this.stream,
      '*',
      'payload',
      JSON.stringify(payload),
      ...Object.entries(fields).flat()
    );
  }
}

/**
 * Consumer wrapper for Redis Streams consumer groups.
 */
export class RedisStreamConsumer {
  /**
   * @param {RedisStreamOptions} options Consumer configuration.
   */
  constructor({
    client,
    stream,
    group,
    consumer = defaultConsumerName(),
    blockMs = 5000,
    batchSize = 10,
    pendingIdleMs = 60000
  }) {
    this.client = client;
    this.stream = stream;
    this.group = group;
    this.consumer = consumer;
    this.blockMs = blockMs;
    this.batchSize = batchSize;
    this.pendingIdleMs = pendingIdleMs;
    this.stopped = false;
  }

  /**
   * Create the consumer group if it does not already exist.
   *
   * @returns {Promise<void>}
   * @sideEffects Calls XGROUP CREATE with MKSTREAM.
   */
  async ensureGroup() {
    try {
      await this.client.xgroup(
        'CREATE',
        this.stream,
        this.group,
        '0',
        'MKSTREAM'
      );
    } catch (error) {
      if (!String(error.message || error).includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Read new messages for this consumer.
   *
   * @returns {Promise<RedisStreamMessage[]>} Parsed stream messages.
   * @sideEffects Calls XREADGROUP.
   */
  async read() {
    const response = await this.client.xreadgroup(
      'GROUP',
      this.group,
      this.consumer,
      'COUNT',
      this.batchSize,
      'BLOCK',
      this.blockMs,
      'STREAMS',
      this.stream,
      '>'
    );

    return this.parseReadResponse(response);
  }

  /**
   * Convert XREADGROUP or XAUTOCLAIM responses into parsed messages.
   *
   * @param {Array} response Redis command response.
   * @returns {RedisStreamMessage[]} Parsed stream messages.
   */
  parseReadResponse(response) {
    if (!response) {
      return [];
    }

    const streamResponses = Array.isArray(response[0]?.[1])
      ? response
      : [[this.stream, response[1] || []]];
    return streamResponses.flatMap(([, messages]) =>
      messages.map(parseStreamEntry)
    );
  }

  /**
   * Acknowledge successful processing.
   *
   * @param {string|string[]} ids Redis stream IDs.
   * @returns {Promise<number>} Number of acknowledged entries.
   * @sideEffects Calls XACK.
   */
  async acknowledge(ids) {
    const idsToAck = Array.isArray(ids) ? ids : [ids];
    return this.client.xack(this.stream, this.group, ...idsToAck);
  }

  /**
   * Recover idle pending messages for this consumer.
   *
   * @returns {Promise<RedisStreamMessage[]>} Claimed pending messages.
   * @sideEffects Calls XAUTOCLAIM, or XPENDING/XCLAIM when XAUTOCLAIM is unavailable.
   */
  async recoverPending() {
    if (typeof this.client.xautoclaim === 'function') {
      const response = await this.client.xautoclaim(
        this.stream,
        this.group,
        this.consumer,
        this.pendingIdleMs,
        '0-0',
        'COUNT',
        this.batchSize
      );

      return this.parseReadResponse(response);
    }

    const pending = await this.client.xpending(
      this.stream,
      this.group,
      '-',
      '+',
      this.batchSize
    );
    const ids = pending.map(entry =>
      Array.isArray(entry) ? entry[0] : entry.id
    );

    if (ids.length === 0) {
      return [];
    }

    const claimed = await this.client.xclaim(
      this.stream,
      this.group,
      this.consumer,
      this.pendingIdleMs,
      ...ids
    );

    return claimed.map(parseStreamEntry);
  }

  /**
   * Stop long-running loops that are using this consumer.
   *
   * @returns {void}
   */
  stop() {
    this.stopped = true;
  }

  /**
   * Continuously process messages until stopped.
   *
   * @param {(message: RedisStreamMessage) => Promise<void>} handler Message handler.
   * @returns {Promise<void>}
   * @sideEffects Reads, handles, and acknowledges Redis stream entries.
   */
  async run(handler) {
    await this.ensureGroup();

    while (!this.stopped) {
      const recovered = await this.recoverPending();
      const messages = recovered.length > 0 ? recovered : await this.read();

      for (const message of messages) {
        await handler(message);
        await this.acknowledge(message.id);
      }
    }
  }
}
