import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@IRIS/elysia";

const API_URL =
  process.env.NEXT_PUBLIC_ELYSIA_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.ELYSIA_URL ||
  "http://localhost:4000";

export type ElysiaClient = Treaty.Create<App>;

export const elysia: ElysiaClient = (treaty as unknown as (url: string) => ElysiaClient)(API_URL);
