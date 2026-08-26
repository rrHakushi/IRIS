import { Elysia } from "elysia";
import { c } from "../utils/colors";

/**
 * Predefined cron expression patterns and helper builders.
 */
export const Patterns = {
  // Day of week constants
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,

  // Common Constants
  EVERY_SECOND: "* * * * * *",
  EVERY_5_SECONDS: "*/5 * * * * *",
  EVERY_10_SECONDS: "*/10 * * * * *",
  EVERY_30_SECONDS: "*/30 * * * * *",
  EVERY_MINUTE: "*/1 * * * *",
  EVERY_5_MINUTES: "0 */5 * * * *",
  EVERY_10_MINUTES: "0 */10 * * * *",
  EVERY_30_MINUTES: "0 */30 * * * *",
  EVERY_HOUR: "0 0-23/1 * * *",
  EVERY_2_HOURS: "0 0-23/2 * * *",
  EVERY_3_HOURS: "0 0-23/3 * * *",
  EVERY_4_HOURS: "0 0-23/4 * * *",
  EVERY_5_HOURS: "0 0-23/5 * * *",
  EVERY_6_HOURS: "0 0-23/6 * * *",
  EVERY_7_HOURS: "0 0-23/7 * * *",
  EVERY_8_HOURS: "0 0-23/8 * * *",
  EVERY_9_HOURS: "0 0-23/9 * * *",
  EVERY_10_HOURS: "0 0-23/10 * * *",
  EVERY_11_HOURS: "0 0-23/11 * * *",
  EVERY_12_HOURS: "0 0-23/12 * * *",
  EVERY_DAY_AT_1AM: "0 01 * * *",
  EVERY_DAY_AT_2AM: "0 02 * * *",
  EVERY_DAY_AT_3AM: "0 03 * * *",
  EVERY_DAY_AT_4AM: "0 04 * * *",
  EVERY_DAY_AT_5AM: "0 05 * * *",
  EVERY_DAY_AT_6AM: "0 06 * * *",
  EVERY_DAY_AT_7AM: "0 07 * * *",
  EVERY_DAY_AT_8AM: "0 08 * * *",
  EVERY_DAY_AT_9AM: "0 09 * * *",
  EVERY_DAY_AT_10AM: "0 10 * * *",
  EVERY_DAY_AT_11AM: "0 11 * * *",
  EVERY_DAY_AT_NOON: "0 12 * * *",
  EVERY_DAY_AT_1PM: "0 13 * * *",
  EVERY_DAY_AT_2PM: "0 14 * * *",
  EVERY_DAY_AT_3PM: "0 15 * * *",
  EVERY_DAY_AT_4PM: "0 16 * * *",
  EVERY_DAY_AT_5PM: "0 17 * * *",
  EVERY_DAY_AT_6PM: "0 18 * * *",
  EVERY_DAY_AT_7PM: "0 19 * * *",
  EVERY_DAY_AT_8PM: "0 20 * * *",
  EVERY_DAY_AT_9PM: "0 21 * * *",
  EVERY_DAY_AT_10PM: "0 22 * * *",
  EVERY_DAY_AT_11PM: "0 23 * * *",
  EVERY_DAY_AT_MIDNIGHT: "0 0 * * *",
  EVERY_WEEK: "0 0 * * 0",
  EVERY_WEEKDAY: "0 0 * * 1-5",
  EVERY_WEEKEND: "0 0 * * 6,0",
  EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT: "0 0 1 * *",
  EVERY_1ST_DAY_OF_MONTH_AT_NOON: "0 12 1 * *",
  EVERY_2ND_HOUR: "0 */2 * * *",
  EVERY_2ND_HOUR_FROM_1AM_THROUGH_11PM: "0 1-23/2 * * *",
  EVERY_2ND_MONTH: "0 0 1 */2 *",
  EVERY_QUARTER: "0 0 1 */3 *",
  EVERY_6_MONTHS: "0 0 1 */6 *",
  EVERY_YEAR: "0 0 1 1 *",
  EVERY_30_MINUTES_BETWEEN_9AM_AND_5PM: "0 */30 9-17 * * *",
  EVERY_30_MINUTES_BETWEEN_9AM_AND_6PM: "0 */30 9-18 * * *",
  EVERY_30_MINUTES_BETWEEN_10AM_AND_7PM: "0 */30 10-19 * * *",

  // Builder Functions
  everySeconds(seconds: number): string {
    return `*/${Math.max(1, Math.floor(seconds))} * * * * *`;
  },
  everyMinutes(minutes: number): string {
    return `0 */${Math.max(1, Math.floor(minutes))} * * * *`;
  },
  everyHours(hours: number): string {
    return `0 0-23/${Math.max(1, Math.floor(hours))} * * *`;
  },
  everyHoursAt(hours: number, minutes: number): string {
    return `${Math.max(0, Math.min(59, Math.floor(minutes)))} 0-23/${Math.max(1, Math.floor(hours))} * * *`;
  },
  everyDayAt(time: string): string {
    const [h, m] = time.split(":").map((v) => parseInt(v.trim(), 10));
    const validH = isNaN(h!) ? 0 : Math.max(0, Math.min(23, h!));
    const validM = isNaN(m!) ? 0 : Math.max(0, Math.min(59, m!));
    return `${validM} ${validH} * * *`;
  },
  everyWeekOn(dayOfWeek: number | string, time: string = "00:00"): string {
    const [h, m] = time.split(":").map((v) => parseInt(v.trim(), 10));
    const validH = isNaN(h!) ? 0 : Math.max(0, Math.min(23, h!));
    const validM = isNaN(m!) ? 0 : Math.max(0, Math.min(59, m!));
    return `${validM} ${validH} * * ${dayOfWeek}`;
  },
  everyWeekdayAt(time: string = "17:00"): string {
    const [h, m] = time.split(":").map((v) => parseInt(v.trim(), 10));
    const validH = isNaN(h!) ? 17 : Math.max(0, Math.min(23, h!));
    const validM = isNaN(m!) ? 0 : Math.max(0, Math.min(59, m!));
    return `${validM} ${validH} * * 1-5`;
  },
  everyWeekendAt(time: string = "11:00"): string {
    const [h, m] = time.split(":").map((v) => parseInt(v.trim(), 10));
    const validH = isNaN(h!) ? 11 : Math.max(0, Math.min(23, h!));
    const validM = isNaN(m!) ? 0 : Math.max(0, Math.min(59, m!));
    return `${validM} ${validH} * * 6,0`;
  },

  // Function aliases
  everySecond(): string {
    return Patterns.EVERY_SECOND;
  },
  everyMinute(): string {
    return Patterns.EVERY_MINUTE;
  },
  hourly(): string {
    return Patterns.EVERY_HOUR;
  },
  daily(): string {
    return Patterns.EVERY_DAY_AT_MIDNIGHT;
  },
  everyWeekday(): string {
    return Patterns.EVERY_WEEKDAY;
  },
  everyWeekend(): string {
    return Patterns.EVERY_WEEKEND;
  },
  weekly(): string {
    return Patterns.EVERY_WEEK;
  },
  monthly(): string {
    return Patterns.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT;
  },
  everyQuarter(): string {
    return Patterns.EVERY_QUARTER;
  },
  yearly(): string {
    return Patterns.EVERY_YEAR;
  },
};

/**
 * Configuration options for creating a cron job.
 */
export interface CronConfig<Name extends string = string> {
  /**
   * Unique name for the job registered to `store.cron[name]`.
   */
  name: Name;

  /**
   * Cron pattern, e.g. `* * * * * *`, `0 0 * * *`, or from `Patterns`.
   * Also supports human durations like `every 10s`, `every 5m`, `30s`, `1h`.
   */
  pattern: string;

  /**
   * Function to execute on schedule.
   */
  run: (store?: any) => unknown | Promise<unknown>;

  /**
   * Optional timezone (e.g. "UTC" or "America/New_York"). Defaults to system local.
   */
  timezone?: string;

  /**
   * Earliest scheduled start time.
   */
  startAt?: Date | string | number;

  /**
   * Scheduled stop time. The job automatically stops after this time.
   */
  stopAt?: Date | string | number;

  /**
   * Maximum number of times the job can run before stopping automatically.
   */
  maxRuns?: number;

  /**
   * Error handling strategy. Set to `true` to catch and log errors, or pass a custom callback.
   * @default true
   */
  catch?: boolean | ((error: unknown, job: CronJob) => void);

  /**
   * Minimum interval between executions in seconds.
   */
  interval?: number;

  /**
   * Execute the job once immediately when registered.
   * @default false
   */
  runOnInit?: boolean;

  /**
   * Whether the job is initially running.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Public interface of a scheduled Cron Job.
 */
export interface CronJob {
  readonly name: string;
  readonly pattern: string;
  readonly running: boolean;
  readonly runCount: number;

  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  trigger(): Promise<unknown>;
  nextRun(): Date | null;
  previousRun(): Date | null;
}

/**
 * Parses individual cron fields (supporting lists, ranges, steps, and aliases).
 */
function parseCronField(
  field: string,
  min: number,
  max: number,
  aliases?: Record<string, number>
): Set<number> {
  let normalized = field.trim();
  if (aliases) {
    for (const [alias, val] of Object.entries(aliases)) {
      normalized = normalized.replace(new RegExp(alias, "gi"), String(val));
    }
  }

  const allowed = new Set<number>();
  const parts = normalized.split(",");

  for (const part of parts) {
    if (part === "*") {
      for (let i = min; i <= max; i++) allowed.add(i);
    } else if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr || "1", 10);
      let start = min;
      let end = max;
      if (range && range !== "*") {
        if (range.includes("-")) {
          const [r1, r2] = range.split("-").map(Number);
          start = r1 ?? min;
          end = r2 ?? max;
        } else {
          start = Number(range);
        }
      }
      for (let i = start; i <= end; i += step) allowed.add(i);
    } else if (part.includes("-")) {
      const [r1, r2] = part.split("-").map(Number);
      const start = r1 ?? min;
      const end = r2 ?? max;
      for (let i = start; i <= end; i++) allowed.add(i);
    } else {
      const num = Number(part);
      if (!isNaN(num) && num >= min && num <= max) allowed.add(num);
    }
  }

  return allowed;
}

/**
 * Parses human-friendly duration strings like "every 10s", "every 5m", "30s", "1h".
 * Returns duration in milliseconds, or null if not a duration string.
 */
function parseDurationToMs(pattern: string): number | null {
  const clean = pattern.trim().toLowerCase();
  const match = clean.match(/^(?:every\s+)?(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|d|days?)$/);
  if (!match) return null;

  const count = parseInt(match[1]!, 10);
  const unit = match[2]!;

  if (unit.startsWith("s")) return count * 1000;
  if (unit.startsWith("m")) return count * 60 * 1000;
  if (unit.startsWith("h")) return count * 60 * 60 * 1000;
  if (unit.startsWith("d")) return count * 24 * 60 * 60 * 1000;

  return null;
}

/**
 * Calculates the next matching Date for a cron expression from a given starting time.
 */
export function getNextCronDate(pattern: string, fromDate: Date = new Date()): Date | null {
  const durationMs = parseDurationToMs(pattern);
  if (durationMs !== null) {
    return new Date(fromDate.getTime() + durationMs);
  }

  const shortcuts: Record<string, string> = {
    "@yearly": Patterns.EVERY_YEAR,
    "@annually": Patterns.EVERY_YEAR,
    "@monthly": Patterns.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT,
    "@weekly": Patterns.EVERY_WEEK,
    "@daily": Patterns.EVERY_DAY_AT_MIDNIGHT,
    "@midnight": Patterns.EVERY_DAY_AT_MIDNIGHT,
    "@hourly": Patterns.EVERY_HOUR,
  };

  const normalized = shortcuts[pattern.trim().toLowerCase()] ?? pattern.trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) {
    throw new Error(`Invalid cron pattern: "${pattern}". Expected 5 or 6 fields.`);
  }

  const hasSeconds = parts.length === 6;
  const secField = hasSeconds ? parts[0]! : "0";
  const minField = hasSeconds ? parts[1]! : parts[0]!;
  const hourField = hasSeconds ? parts[2]! : parts[1]!;
  const domField = hasSeconds ? parts[3]! : parts[2]!;
  const monField = hasSeconds ? parts[4]! : parts[3]!;
  const dowField = hasSeconds ? parts[5]! : parts[4]!;

  const monthAliases: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  const dowAliases: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  };

  const allowedSec = parseCronField(secField, 0, 59);
  const allowedMin = parseCronField(minField, 0, 59);
  const allowedHour = parseCronField(hourField, 0, 23);
  const allowedDom = parseCronField(domField, 1, 31);
  const allowedMon = parseCronField(monField, 1, 12, monthAliases);
  const allowedDow = parseCronField(dowField, 0, 7, dowAliases);
  if (allowedDow.has(7)) allowedDow.add(0);

  const date = new Date(fromDate.getTime());
  date.setMilliseconds(0);
  date.setSeconds(date.getSeconds() + 1);

  let iterations = 0;
  while (iterations < 100000) {
    iterations++;

    const mon = date.getMonth() + 1;
    if (!allowedMon.has(mon)) {
      date.setMonth(date.getMonth() + 1, 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }

    const dom = date.getDate();
    const dow = date.getDay();
    const domMatch = allowedDom.has(dom);
    const dowMatch = allowedDow.has(dow);

    const isDomRestricted = domField !== "*";
    const isDowRestricted = dowField !== "*";
    let dayMatch = true;
    if (isDomRestricted && isDowRestricted) {
      dayMatch = domMatch || dowMatch;
    } else if (isDomRestricted) {
      dayMatch = domMatch;
    } else if (isDowRestricted) {
      dayMatch = dowMatch;
    }

    if (!dayMatch) {
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }

    const hour = date.getHours();
    if (!allowedHour.has(hour)) {
      date.setHours(date.getHours() + 1, 0, 0, 0);
      continue;
    }

    const min = date.getMinutes();
    if (!allowedMin.has(min)) {
      date.setMinutes(date.getMinutes() + 1, 0, 0);
      continue;
    }

    const sec = date.getSeconds();
    if (!allowedSec.has(sec)) {
      date.setSeconds(date.getSeconds() + 1);
      continue;
    }

    return date;
  }

  return null;
}

/**
 * Concrete implementation of CronJob managing timer cycles and execution state.
 */
export class CronJobInstance implements CronJob {
  readonly name: string;
  readonly pattern: string;
  private config: CronConfig;
  private _running = false;
  private _runCount = 0;
  private _nextRun: Date | null = null;
  private _previousRun: Date | null = null;
  private timer: NodeJS.Timeout | null = null;
  private storeRef: unknown = null;

  constructor(config: CronConfig, storeRef?: unknown) {
    this.name = config.name;
    this.pattern = config.pattern;
    this.config = config;
    this.storeRef = storeRef;

    if (config.enabled !== false) {
      this.start();
    }
  }

  get running(): boolean {
    return this._running;
  }

  get runCount(): number {
    return this._runCount;
  }

  nextRun(): Date | null {
    return this._nextRun;
  }

  previousRun(): Date | null {
    return this._previousRun;
  }

  setStore(store: unknown): void {
    this.storeRef = store;
  }

  start(): void {
    if (this._running) return;
    this._running = true;

    if (this.config.runOnInit && this._runCount === 0) {
      this.execute().catch(() => {});
    }

    this.scheduleNext();
  }

  stop(): void {
    this._running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._nextRun = null;
  }

  pause(): void {
    this.stop();
  }

  resume(): void {
    this.start();
  }

  async trigger(): Promise<unknown> {
    return await this.execute();
  }

  private scheduleNext(): void {
    if (!this._running) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Check max runs
    if (this.config.maxRuns && this._runCount >= this.config.maxRuns) {
      this.stop();
      return;
    }

    const now = new Date();

    // Check stopAt
    if (this.config.stopAt) {
      const stopDate = new Date(this.config.stopAt);
      if (now >= stopDate) {
        this.stop();
        return;
      }
    }

    let next = getNextCronDate(this.pattern, now);
    if (!next) {
      this.stop();
      return;
    }

    // Check startAt
    if (this.config.startAt) {
      const startDate = new Date(this.config.startAt);
      if (next < startDate) {
        next = getNextCronDate(this.pattern, new Date(startDate.getTime() - 1000));
      }
    }

    // Check interval minimum
    if (this.config.interval && this._previousRun) {
      const minNext = this._previousRun.getTime() + this.config.interval * 1000;
      if (next && next.getTime() < minNext) {
        next = new Date(minNext);
      }
    }

    if (!next) {
      this.stop();
      return;
    }

    // Check stopAt against next run
    if (this.config.stopAt) {
      const stopDate = new Date(this.config.stopAt);
      if (next > stopDate) {
        this.stop();
        return;
      }
    }

    this._nextRun = next;
    const delay = Math.max(0, next.getTime() - Date.now());

    // Prevent 32-bit integer overflow for far-future dates (> ~24.8 days)
    const maxTimeout = 2147483647;
    if (delay > maxTimeout) {
      this.timer = setTimeout(() => {
        this.scheduleNext();
      }, maxTimeout);
      return;
    }

    this.timer = setTimeout(async () => {
      await this.execute();
      this.scheduleNext();
    }, delay);
  }

  private async execute(): Promise<unknown> {
    const startTime = performance.now();
    try {
      const result = await this.config.run(this.storeRef);
      this._previousRun = new Date();
      this._runCount++;
      return result;
    } catch (error) {
      const customCatch = this.config.catch ?? true;
      if (typeof customCatch === "function") {
        customCatch(error, this);
      } else if (customCatch) {
        console.error(
          `${c.yellow(c.bold("[Cron]"))} ${c.red(`Execution error in job "${this.name}":`)}`,
          error
        );
      } else {
        throw error;
      }
    }
  }
}

/**
 * Global Cron Manager managing registered jobs.
 */
export class CronManager {
  private jobs = new Map<string, CronJobInstance>();

  /**
   * Adds and starts a new cron job. Replaces and stops any existing job with the same name.
   *
   * @param config - Cron configuration options
   * @param storeRef - Optional reference to Elysia store
   * @returns Instantiated and active CronJobInstance
   */
  add<const Name extends string>(config: CronConfig<Name>, storeRef?: unknown): CronJobInstance {
    const existing = this.jobs.get(config.name);
    if (existing) {
      existing.stop();
    }
    const job = new CronJobInstance(config, storeRef);
    this.jobs.set(config.name, job);
    return job;
  }

  /**
   * Retrieves a registered cron job by its unique name.
   *
   * @param name - Registered job name
   * @returns CronJob instance or undefined if not registered
   */
  get(name: string): CronJob | undefined {
    return this.jobs.get(name);
  }

  /**
   * Stops and unregisters a cron job.
   *
   * @param name - Registered job name
   * @returns True if the job existed and was removed
   */
  remove(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      return this.jobs.delete(name);
    }
    return false;
  }

  /**
   * Returns a summary snapshot of all registered cron jobs and their execution states.
   */
  list(): Array<{
    name: string;
    pattern: string;
    running: boolean;
    runCount: number;
    nextRun: string | null;
    previousRun: string | null;
  }> {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      pattern: job.pattern,
      running: job.running,
      runCount: job.runCount,
      nextRun: job.nextRun()?.toISOString() ?? null,
      previousRun: job.previousRun()?.toISOString() ?? null,
    }));
  }

  /**
   * Pauses / stops execution of a scheduled job by name.
   *
   * @param name - Name of the job to stop
   */
  stop(name: string): void {
    this.jobs.get(name)?.stop();
  }

  /**
   * Starts / resumes execution of a paused job by name.
   *
   * @param name - Name of the job to start
   */
  start(name: string): void {
    this.jobs.get(name)?.start();
  }

  /**
   * Manually triggers a job function immediately on demand.
   *
   * @param name - Name of the job to trigger
   * @returns Result of the job execution
   */
  async trigger(name: string): Promise<unknown> {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Cron job "${name}" not found.`);
    return await job.trigger();
  }

  /**
   * Stops all registered cron jobs.
   */
  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
  }

  /**
   * Starts all registered cron jobs.
   */
  startAll(): void {
    for (const job of this.jobs.values()) {
      job.start();
    }
  }

  /**
   * Convenience method to register and start a scheduled function.
   *
   * @param patternOrConfig - Cron pattern string or full CronConfig object
   * @param run - Callback function to execute when pattern is a string
   * @param name - Optional job name (auto-generated if omitted)
   * @returns Created CronJob instance
   */
  schedule(
    patternOrConfig: string | CronConfig,
    run?: (store?: any) => unknown | Promise<unknown>,
    name?: string
  ): CronJob {
    if (typeof patternOrConfig === "string") {
      if (!run) throw new Error("A run callback is required when pattern is a string.");
      const jobName = name || `inline-${Math.random().toString(36).slice(2, 9)}`;
      return this.add({
        name: jobName,
        pattern: patternOrConfig,
        run,
      });
    }
    return this.add(patternOrConfig);
  }
}

/**
 * Singleton manager instance for programmatic cron access.
 */
export const cronManager = new CronManager();

/**
 * Convenience helper to quickly schedule a task.
 */
export const schedule = (
  patternOrConfig: string | CronConfig,
  run?: (store?: any) => unknown | Promise<unknown>,
  name?: string
): CronJob => {
  return cronManager.schedule(patternOrConfig, run, name);
};

/**
 * Elysia 2.0 Cron Plugin.
 * Registers scheduled tasks to `store.cron[name]` with full TypeScript autocompletion.
 * 
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { cron, Patterns } from "./plugins";
 * 
 * const app = new Elysia()
 *   .use(
 *     cron({
 *       name: "heartbeat",
 *       pattern: Patterns.everySeconds(10),
 *       run() {
 *         console.log("Heartbeat tick");
 *       },
 *     })
 *   )
 *   .get("/stop", ({ store: { cron: { heartbeat } } }) => {
 *     heartbeat.stop();
 *     return "Heartbeat stopped";
 *   });
 * ```
 */
export function cron(): Elysia<
  "",
  "local",
  { decorator: {}; store: { cron: Record<string, CronJob> }; derive: {} }
>;

export function cron<const Name extends string>(
  config: CronConfig<Name>
): Elysia<
  "",
  "local",
  { decorator: {}; store: { cron: { [K in Name]: CronJob } }; derive: {} }
>;

export function cron<const Configs extends readonly CronConfig[]>(
  configs: Configs
): Elysia<
  "",
  "local",
  { decorator: {}; store: { cron: { [K in Configs[number]["name"]]: CronJob } }; derive: {} }
>;

export function cron(
  configOrConfigs?: CronConfig | readonly CronConfig[]
): Elysia<any, any, any> {
  const cronStore: Record<string, CronJob> = {};

  if (Array.isArray(configOrConfigs)) {
    for (const conf of configOrConfigs) {
      const job = cronManager.add(conf);
      cronStore[conf.name] = job;
    }
  } else if (configOrConfigs) {
    const conf = configOrConfigs as CronConfig;
    const job = cronManager.add(conf);
    cronStore[conf.name] = job;
  }

  const nameSuffix = Array.isArray(configOrConfigs)
    ? "multi"
    : (configOrConfigs as CronConfig | undefined)?.name ?? "manager";

  return new Elysia({ name: `cron-${nameSuffix}` })
    .state("cron", cronStore);
}
