# API Contract

## Purpose

This document describes the starter HTTP contract included with the template. Generated services should replace it with their real public, internal, queue, file, or data contracts.

## Routes

### `GET /`

Returns a simple HTML readiness response:

```html
<h1>Microservice is running</h1>
```

### `GET /api`

Returns the starter JSON availability response:

```json
{
  "success": true,
  "message": "API Up!"
}
```

## Shared API Headers

`lib/api_headers.js` adds:

- `Content-Type: application/json`
- `Cache-Control: public, max-age=120, s-maxage=120`
- `x-build-version: <BUILD_VERSION>`

When `ENV=local`, `Cache-Control` becomes `no-cache`.

If the request origin contains `newsday`, the middleware also adds permissive CORS headers for that origin. Generated services with public or partner APIs should replace this starter behavior with their real CORS policy.

## Redis Stream Contract

Generated queue services should document their stream names in this file. The template helper writes a `payload` field containing JSON and may include metadata fields such as `idempotencyKey`.

Consumers should use:

- `REDIS_URL` for Redis or secure Valkey connection.
- `REDIS_STREAM_PREFIX` when a namespace is needed.
- `REDIS_CONSUMER_GROUP` for the service consumer group.
- `REDIS_CONSUMER_NAME` for the specific instance name.
- `REDIS_BLOCK_MS`, `REDIS_BATCH_SIZE`, and `REDIS_PENDING_IDLE_MS` for read and recovery behavior.

Delayed jobs should document the sorted set named by `REDIS_SCHEDULED_SET`, the target stream, payload shape, due timestamp semantics, and idempotency-key fields.

## Error Envelope

`lib/api_errors.js` responds with:

```json
{
  "success": false,
  "error": {}
}
```

The HTTP status comes from `err.statusCode` when available, otherwise `500`. Generated services should document any stable error shape they expose to consumers.
