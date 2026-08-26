import util from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";
import { c } from "./colors";

export interface RequestLogItem {
  type: "log" | "info" | "warn" | "error";
  message: string;
}

export interface RequestLogStore {
  logs: RequestLogItem[];
}

export interface RequestLogger {
  (...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export const requestLogStorage = new AsyncLocalStorage<RequestLogStore>();

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let isInterceptorActive = false;

/**
 * Initializes global console interception.
 * When called inside a route execution (with an active AsyncLocalStorage store),
 * console.log/info/warn/error are captured to be grouped under that request's log output.
 * Outside a request, console behaves completely normally.
 */
export function initConsoleInterceptor(): void {
  if (isInterceptorActive) return;
  isInterceptorActive = true;

  const createIntercept = (type: "log" | "info" | "warn" | "error") => {
    return (...args: unknown[]) => {
      const store = requestLogStorage.getStore();
      if (store) {
        store.logs.push({
          type,
          message: util.format(...args),
        });
      } else {
        originalConsole[type](...args);
      }
    };
  };

  console.log = createIntercept("log");
  console.info = createIntercept("info");
  console.warn = createIntercept("warn");
  console.error = createIntercept("error");
}

/**
 * Formats captured request logs as a tree structure branching from the request header.
 */
export function printGroupedRequestLogs(logs: RequestLogItem[]): void {
  if (!logs || logs.length === 0) return;

  for (let i = 0; i < logs.length; i++) {
    const isLast = i === logs.length - 1;
    const branch = c.gray(isLast ? "  └─ " : "  ├─ ");
    const item = logs[i];
    if (!item) continue;

    let prefix = "";
    if (item.type === "warn") prefix = c.yellow(c.bold("[WARN] "));
    if (item.type === "error") prefix = c.red(c.bold("[ERROR] "));

    process.stdout.write(`${branch}${prefix}${item.message}\n`);
  }
}

/**
 * Executes a route handler inside a request log context so any console or ctx.log calls
 * are grouped under the request.
 */
export async function executeWithRequestLogs(
  ctx: unknown,
  handler?: (ctx: unknown) => unknown,
  rateLimiter?: ((ctx: any) => unknown) | null,
): Promise<unknown> {
  if (!handler) return undefined;

  if (rateLimiter) {
    const errorResponse = rateLimiter(ctx);
    if (errorResponse) {
      return errorResponse;
    }
  }

  const req = (ctx as { request?: Request })?.request;
  const store: RequestLogStore = { logs: [] };

  if (req) {
    (req as unknown as { _requestLogs?: RequestLogItem[] })._requestLogs = store.logs;
  }

  (ctx as { log?: RequestLogger }).log = Object.assign(
    (...args: unknown[]) => {
      store.logs.push({ type: "log", message: util.format(...args) });
    },
    {
      info: (...args: unknown[]) => {
        store.logs.push({ type: "info", message: util.format(...args) });
      },
      warn: (...args: unknown[]) => {
        store.logs.push({ type: "warn", message: util.format(...args) });
      },
      error: (...args: unknown[]) => {
        store.logs.push({ type: "error", message: util.format(...args) });
      },
    }
  );

  return await requestLogStorage.run(store, async () => {
    return await handler(ctx);
  });
}
