import { definePrismaConfig } from "prisma/config";
// @ts-ignore - @prisma/orm-postgres rc.21 does not include types entry in package.json exports["./config"]
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPattern = path.resolve(__dirname, "schema/*.prisma").replaceAll("\\", "/");

function getDbConnection(): string {
  const env = typeof Bun !== "undefined" ? Bun.env : process.env;
  const user = env.POSTGRE_USER;
  const pass = env.POSTGRE_PASS;
  const host = env.POSTGRE_HOST;
  const port = env.POSTGRE_PORT;
  const db = env.POSTGRE_DB;

  if (!user || !pass || !host || !port || !db) {
    const missing = [
      !user && "POSTGRE_USER",
      !pass && "POSTGRE_PASS",
      !host && "POSTGRE_HOST",
      !port && "POSTGRE_PORT",
      !db && "POSTGRE_DB",
    ].filter(Boolean);
    throw new Error(
      `Prisma config database connection failed: missing required environment variable(s): ${missing.join(", ")}`
    );
  }

  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

const config: Record<string, unknown> = definePrismaConfig({
  orm: ormConfig({
    contract: schemaPattern,
    output: "./src",
    db: {
      connection: getDbConnection(),
    },
    migrations: {
      dir: "migrations",
    },
  }),
});

export default config;
