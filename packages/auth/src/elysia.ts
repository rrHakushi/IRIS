import { treaty } from "@elysia/eden";
import type { App } from "@IRIS/elysia";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const elysia = treaty<App>(API_URL);
export type ElysiaClient = typeof elysia;
