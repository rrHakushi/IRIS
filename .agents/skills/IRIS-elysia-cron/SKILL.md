---
name: IRIS-elysia/cron
description: Guide for task scheduling and cron jobs in Elysia 2.0 (@IRIS/elysia) using zero-dependency timers, predefined Patterns, store.cron, and schedule() APIs. Use when creating or managing scheduled background jobs.
---

# IRIS Elysia Cron Plugin Guide

The IRIS Elysia Cron Plugin (`@IRIS/elysia`) is a high-precision, zero-dependency task scheduling plugin engineered specifically for **Elysia 2.0**.

> [!IMPORTANT]
> **Why Not `@elysia/cron`?**
> The official `@elysia/cron` package depends on Elysia v1 lifecycle hooks (`.onStop`) and internal form data symbols (`ELYSIA_FORM_DATA`) that were broken or changed in Elysia 2.0. The IRIS native cron plugin resolves these issues with zero external npm dependencies, exact drift-free timer calculation, full TypeScript IntelliSense on `store.cron[name]`, and standalone programmatic access via `schedule()`.

---

## 1. Core Architecture & Features

- **Zero External Dependencies**: Standalone cron parser supporting 5-field and 6-field (with seconds) cron expressions.
- **Elysia 2.0 State Integration**: Registered jobs are bound to `store.cron[name]` with full TypeScript autocompletion and type inference.
- **Predefined `Patterns`**: Full suite of helper builders (`everySeconds`, `everyMinutes`, `everyDayAt`), aliases (`daily()`, `hourly()`), and constants (`EVERY_10_SECONDS`, `EVERY_DAY_AT_MIDNIGHT`).
- **Human-Friendly Durations**: Supports interval strings like `"every 10s"`, `"every 5m"`, `"30s"`, `"1h"`.
- **Programmatic & Route-Level Control**: Jobs can be started, stopped, paused, resumed, or manually triggered on demand (`job.trigger()`).
- **Global `schedule()` Helper**: Schedule tasks anywhere in your app (controllers, services, background workers) without remounting plugins.
- **Lifecycle & Error Shielding**: Built-in `catch` handler ensures unhandled errors in scheduled functions never crash the Elysia server process.

---

## 2. Quick Start

### Registering with Elysia

```typescript
import { Elysia } from "elysia";
import { cron, Patterns } from "./plugins";

const app = new Elysia()
  // Mount with a single cron job
  .use(
    cron({
      name: "heartbeat",
      pattern: Patterns.everySeconds(10), // or '*/10 * * * * *'
      run() {
        console.log("Heartbeat tick");
      },
    })
  )
  // Control the job inside a route handler
  .get("/cron/stop", ({ store: { cron: { heartbeat } } }) => {
    heartbeat.stop();
    return { status: "stopped", running: heartbeat.running };
  })
  .get("/cron/status", ({ store: { cron: { heartbeat } } }) => {
    return {
      running: heartbeat.running,
      runCount: heartbeat.runCount,
      nextRun: heartbeat.nextRun()?.toISOString(),
    };
  });
```

### Multiple Cron Jobs

```typescript
import { Elysia } from "elysia";
import { cron, Patterns } from "./plugins";

const app = new Elysia().use(
  cron([
    {
      name: "cleanup",
      pattern: Patterns.daily(),
      async run() {
        await cleanupOldSessions();
      },
    },
    {
      name: "syncMetrics",
      pattern: Patterns.everyMinutes(5),
      async run() {
        await syncSystemMetrics();
      },
    },
  ])
);
```

---

## 3. Predefined Patterns Reference (`Patterns`)

The `Patterns` object provides pre-calculated cron expressions and dynamic pattern builders:

### Builder Functions

| Function | Output Pattern | Description |
|---|---|---|
| `Patterns.everySeconds(n)` | `*/n * * * * *` | Every $n$ seconds |
| `Patterns.everyMinutes(n)` | `0 */n * * * *` | Every $n$ minutes |
| `Patterns.everyHours(n)` | `0 0-23/n * * *` | Every $n$ hours |
| `Patterns.everyHoursAt(h, m)` | `m 0-23/h * * *` | Every $h$ hours at minute $m$ |
| `Patterns.everyDayAt("04:19")` | `19 4 * * *` | Every day at 04:19 |
| `Patterns.everyWeekOn(Patterns.MONDAY, "19:30")` | `30 19 * * 1` | Every Monday at 19:30 |
| `Patterns.everyWeekdayAt("17:00")` | `0 17 * * 1-5` | Monday through Friday at 17:00 |
| `Patterns.everyWeekendAt("11:00")` | `0 11 * * 6,0` | Saturday and Sunday at 11:00 |

### Function Aliases

- `Patterns.everySecond()` $\rightarrow$ `* * * * * *`
- `Patterns.everyMinute()` $\rightarrow$ `*/1 * * * *`
- `Patterns.hourly()` $\rightarrow$ `0 0-23/1 * * *`
- `Patterns.daily()` $\rightarrow$ `0 0 * * *`
- `Patterns.everyWeekday()` $\rightarrow$ `0 0 * * 1-5`
- `Patterns.everyWeekend()` $\rightarrow$ `0 0 * * 6,0`
- `Patterns.weekly()` $\rightarrow$ `0 0 * * 0`
- `Patterns.monthly()` $\rightarrow$ `0 0 1 * *`
- `Patterns.everyQuarter()` $\rightarrow$ `0 0 1 */3 *`
- `Patterns.yearly()` $\rightarrow$ `0 0 1 1 *`

### Day Constants

- `Patterns.SUNDAY` = `0`
- `Patterns.MONDAY` = `1`
- `Patterns.TUESDAY` = `2`
- `Patterns.WEDNESDAY` = `3`
- `Patterns.THURSDAY` = `4`
- `Patterns.FRIDAY` = `5`
- `Patterns.SATURDAY` = `6`

### Popular Constants

- `Patterns.EVERY_SECOND`
- `Patterns.EVERY_5_SECONDS`
- `Patterns.EVERY_10_SECONDS`
- `Patterns.EVERY_30_SECONDS`
- `Patterns.EVERY_MINUTE`
- `Patterns.EVERY_5_MINUTES`
- `Patterns.EVERY_10_MINUTES`
- `Patterns.EVERY_30_MINUTES`
- `Patterns.EVERY_HOUR`
- `Patterns.EVERY_DAY_AT_MIDNIGHT`
- `Patterns.EVERY_DAY_AT_NOON`
- `Patterns.EVERY_WEEK`
- `Patterns.EVERY_WEEKDAY`
- `Patterns.EVERY_WEEKEND`
- `Patterns.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT`

---

## 4. Programmatic Scheduling (`schedule` & `cronManager`)

You can schedule tasks dynamically from outside the Elysia plugin declaration (e.g. within services, database seeders, or route handlers):

```typescript
import { schedule, cronManager, Patterns } from "@/plugins";

// Quick one-liner
const job = schedule(Patterns.everyMinutes(15), async () => {
  await aggregateAnalytics();
});

// Access and control
job.stop();
job.start();
job.trigger(); // Runs immediately on demand

// Using the global manager
const allJobs = cronManager.list();
console.log("Registered jobs:", allJobs);

// Stop a specific job by name
cronManager.stop("heartbeat");

// Remove a job completely
cronManager.remove("heartbeat");
```

---

## 5. Advanced Job Options (`CronConfig`)

```typescript
cron({
  name: "custom-job",
  pattern: "0 */2 * * *", // Every 2 hours
  
  // Run callback
  async run(store) {
    // Has access to Elysia store if needed
  },

  // Run once immediately when the server boots
  runOnInit: true,

  // Automatically terminate after 50 executions
  maxRuns: 50,

  // Schedule start & stop window
  startAt: new Date("2026-09-01T00:00:00Z"),
  stopAt: new Date("2026-12-31T23:59:59Z"),

  // Minimum interval between runs in seconds (debouncing/throttling)
  interval: 60,

  // Error handling strategy (prevents server crashes)
  catch(error, job) {
    console.error(`Error executing cron job ${job.name}:`, error);
  },
})
```

---

## 6. Job Methods (`CronJob`)

Each job instance exposes:

| Method | Return Type | Description |
|---|---|---|
| `job.start()` | `void` | Starts or resumes the timer schedule |
| `job.stop()` | `void` | Stops and clears the timer schedule |
| `job.pause()` | `void` | Alias for `stop()` |
| `job.resume()` | `void` | Alias for `start()` |
| `job.trigger()` | `Promise<unknown>` | Manually triggers the job function immediately |
| `job.nextRun()` | `Date \| null` | Returns the next scheduled execution Date |
| `job.previousRun()` | `Date \| null` | Returns the previous execution Date |
| `job.running` | `boolean` | Current running state |
| `job.runCount` | `number` | Total number of executions completed |

---

## 7. Related Backend Skills

- [IRIS-elysia](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia/SKILL.md): Master backend architecture guide covering modules, services, utils, plugins, router, and Elysia 2.0 beta.
- [IRIS-elysia/createRoute](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-createRoute/SKILL.md): Scaffolding file-based routes via CLI (`pnpm route:create`).
- [IRIS-elysia/rateLimiter](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-rateLimiter/SKILL.md): Token Bucket rate limiting.
- [IRIS-elysia/session](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-session/SKILL.md): Authentication and session resolution.

