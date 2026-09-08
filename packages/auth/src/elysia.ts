import { treaty } from "@elysiajs/eden";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ElysiaClient = any;

export const elysia: ElysiaClient = treaty<any>(API_URL);
