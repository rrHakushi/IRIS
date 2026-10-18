# @Iris/logger

Zero-dependency, high-performance structured logging library for IRIS.

## Features

- **Class-Based Instantiation**: `const logger = new LogFactory("ModuleName")`
- **Standard Log Levels**: `info`, `warn`, `error`, `debug`, and `success`
- **Environment Aware**: `debug()` is strictly suppressed in production (`NODE_ENV === "production"`)
- **Deterministic Color Badging**: ANSI-colored module tags `[Module]` automatically hashed for unique visual identification
- **24-Hour Timestamps**: `[HH:mm:ss]` prefix on every terminal log line
- **Child Scoping**: `logger.child("SubModule")` for nested contextual logging (e.g. `[Auth][OAuth]`)
- **Structured JSON Mode**: Emits single-line JSON strings when `LOG_FORMAT=json` or in production
- **Pluggable Sinks**: Intercept logs via `LogFactory.setSink(entry => ...)` or per-instance options
- **Zero Runtime Dependencies**: Powered entirely by standard runtime built-ins (`node:util` + ANSI escape codes)

## Installation

Within the IRIS monorepo:

```json
{
  "dependencies": {
    "@Iris/logger": "workspace:*"
  }
}
```

## Basic Usage

```typescript
import { LogFactory } from "@Iris/logger"

const logger = new LogFactory("Auth")

logger.info("Service initialized")
// Output: [11:28:16] [Auth] [INFO]    Service initialized

logger.warn("Rate limit threshold approached", { remaining: 5 })
// Output: [11:28:16] [Auth] [WARN]    Rate limit threshold approached { remaining: 5 }

logger.error("Database connection dropped", new Error("Timeout"))
// Output: [11:28:16] [Auth] [ERROR]   Database connection dropped Error: Timeout ...

logger.debug("Decoded JWT payload", { sub: "user-1" })
// Output (only when NODE_ENV=development and LOG_LEVEL=debug):
// [11:28:16] [Auth] [DEBUG]   Decoded JWT payload { sub: 'user-1' }

logger.success("User registered successfully")
// Output: [11:28:16] [Auth] [SUCCESS] User registered successfully
```

## Child Loggers

```typescript
const queueLogger = new LogFactory("MediaQueue")
const anilistLogger = queueLogger.child("AniList")

anilistLogger.info("Fetching sync payload")
// Output: [11:28:16] [MediaQueue][AniList] [INFO]    Fetching sync payload
```

## Custom Sinks

```typescript
LogFactory.setSink((entry) => {
  // Capture or forward structured entries:
  // entry.level, entry.module, entry.message, entry.args, entry.formatted, entry.timestamp
})
```
