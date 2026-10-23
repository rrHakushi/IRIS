import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

const config: Record<string, unknown> = definePrismaConfig({
  orm: ormConfig({
    contract: "./schema/*.prisma",
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
