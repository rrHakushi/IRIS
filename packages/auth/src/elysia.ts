import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@IRIS/elysia";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL!


export type ElysiaClient = Treaty.Create<App>;

export const elysia: ElysiaClient = treaty<App>(API_URL);
