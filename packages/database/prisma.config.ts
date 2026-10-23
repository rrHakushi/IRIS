import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: (typeof Bun !== "undefined" ? Bun.env.DATABASE_URL : process.env.DATABASE_URL) || "",
  },
});
