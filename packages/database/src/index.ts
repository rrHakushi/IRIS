import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import type { Contract } from "./contract.js";
import contractJson from "./contract.json" with { type: "json" };

export const contract = contractFromJson<Contract>(contractJson);

export type PrismaClient = ReturnType<typeof postgres<Contract>>;

const url =
  (typeof Bun !== "undefined" ? Bun.env.DATABASE_URL : process.env.DATABASE_URL) ||
  "postgresql://dummy:dummy@localhost:5432/dummy";

// Mask sensitive info for logging
const maskedUrl = url.replace(/:.+@/, ":****@");
console.info(`[PRISMA] DATABASE_URL: ${maskedUrl}`);

declare global {
  var prismaGlobal: undefined | PrismaClient;
}

export const prisma: PrismaClient =
  globalThis.prismaGlobal ??
  postgres({
    contract,
    url,
  });

if (
  (typeof Bun !== "undefined" ? Bun.env.NODE_ENV : process.env.NODE_ENV) !==
  "production"
) {
  globalThis.prismaGlobal = prisma;
}

export type { Contract };
export type * from "./contract.js";
