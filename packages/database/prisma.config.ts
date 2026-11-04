import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPattern = path.resolve(__dirname, "schema/*.prisma").replaceAll("\\", "/");

const config: Record<string, unknown> = definePrismaConfig({
  orm: ormConfig({
    contract: schemaPattern,
    output: "./src",
    db: {
      connection:
        (typeof Bun !== "undefined" ? Bun.env.DATABASE_URL : process.env.DATABASE_URL) || "",
    },
    migrations: {
      dir: "migrations",
    },
  }),
});

export default config;
