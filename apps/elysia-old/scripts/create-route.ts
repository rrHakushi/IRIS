#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { c, colorMethod } from "../src/utils/colors";
import { generateRoutes } from "../src/router/generator";
import { generateInsomniumConfig } from "../src/router/insomnium";

interface RouteCliOptions {
  path?: string;
  module?: string;
  methods: string[];
  auth?: boolean;
  admin?: boolean;
  rateLimit?: number;
  force?: boolean;
}

const MODULES_DIR = path.resolve(import.meta.dirname, "../src/modules");
const ROUTER_DIR = path.resolve(import.meta.dirname, "../src/router");

/**
 * Parses CLI arguments.
 */
function parseArgs(args: string[]): RouteCliOptions {
  const options: RouteCliOptions = {
    methods: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "-m" || arg === "--module") {
      options.module = args[++i];
    } else if (arg === "-X" || arg === "--methods" || arg === "--method") {
      const methodsStr = args[++i] || "GET";
      options.methods.push(
        ...methodsStr
          .split(/[,\s]+/)
          .map((m) => m.trim().toUpperCase())
          .filter(Boolean)
      );
    } else if (arg === "-a" || arg === "--auth") {
      options.auth = true;
    } else if (arg === "--admin") {
      options.auth = true;
      options.admin = true;
    } else if (arg === "-r" || arg === "--rate-limit") {
      const val = parseInt(args[++i] || "60", 10);
      options.rateLimit = isNaN(val) ? 60 : val;
    } else if (arg === "-f" || arg === "--force") {
      options.force = true;
    } else if (!arg.startsWith("-") && !options.path) {
      options.path = arg;
    }
  }

  if (options.methods.length === 0) {
    options.methods = ["GET"];
  }

  return options;
}

function printHelp() {
  console.log(`
${c.cyan(c.bold("IRIS Elysia Route Generator"))}
CLI utility to quickly scaffold new file-based Elysia routes in IRIS.

${c.yellow(c.bold("USAGE:"))}
  bun run scripts/create-route.ts [route-path] [options]

${c.yellow(c.bold("OPTIONS:"))}
  ${c.green("route-path")}               Route URL path (e.g. "users/[id]/profile" or "/auth/login")
  ${c.green("-m, --module <name>")}       Target module folder in src/modules (e.g. "IRIS-account", "IRIS-auth")
  ${c.green("-X, --methods <list>")}      Comma-separated HTTP methods (e.g. "GET,POST", "POST,DELETE") [default: GET]
  ${c.green("-a, --auth")}                Enforce authenticated session check
  ${c.green("--admin")}                  Enforce ADMINISTRATOR bitfield permission check
  ${c.green("-r, --rate-limit <cap>")}    Set route-level rate limit capacity per minute (e.g. 20)
  ${c.green("-f, --force")}               Overwrite existing route.ts if already present
  ${c.green("-h, --help")}                Show this help message

${c.yellow(c.bold("EXAMPLES:"))}
  ${c.dim("# Interactive mode")}
  bun run scripts/create-route.ts

  ${c.dim("# Create a simple GET route")}
  bun run scripts/create-route.ts items

  ${c.dim("# Create a protected route with path parameters")}
  bun run scripts/create-route.ts "posts/[id]/comments" -m IRIS-posts -X GET,POST --auth

  ${c.dim("# Create an admin-only route with custom rate limiting")}
  bun run scripts/create-route.ts "admin/settings" -m IRIS-account -X GET,PUT --admin -r 15
`);
}

/**
 * Interactively prompts user for missing route parameters.
 */
async function promptInteractive(options: RouteCliOptions): Promise<RouteCliOptions> {
  const rl = readline.createInterface({ input, output });

  try {
    // 1. Module
    if (!options.module) {
      const existingModules = fs.existsSync(MODULES_DIR)
        ? fs
            .readdirSync(MODULES_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        : [];

      console.log(`${c.yellow(c.bold("Available modules:"))} ${existingModules.join(", ") || "none"}`);
      const moduleAnswer = await rl.question(
        `${c.cyan("? Module name")} ${c.dim(`(default: ${existingModules[0] || "IRIS-core"})`)}: `
      );
      options.module = moduleAnswer.trim() || existingModules[0] || "IRIS-core";
    }

    // 2. Route Path
    if (!options.path) {
      const pathAnswer = await rl.question(
        `${c.cyan("? Route path")} ${c.dim("(e.g. user/[id]/profile or /auth/status)")}: `
      );
      if (!pathAnswer.trim()) {
        console.error(c.red("Error: Route path cannot be empty."));
        process.exit(1);
      }
      options.path = pathAnswer.trim();
    }

    // 3. HTTP Methods
    if (!options.methods || options.methods.length === 0 || (options.methods.length === 1 && options.methods[0] === "GET")) {
      const methodsAnswer = await rl.question(
        `${c.cyan("? HTTP Methods")} ${c.dim("(comma-separated, default: GET)")}: `
      );
      if (methodsAnswer.trim()) {
        options.methods = methodsAnswer
          .split(",")
          .map((m) => m.trim().toUpperCase())
          .filter(Boolean);
      }
    }

    // 4. Auth
    if (options.auth === undefined) {
      const authAnswer = await rl.question(
        `${c.cyan("? Require authenticated session?")} ${c.dim("(y/N)")}: `
      );
      options.auth = /^y(es)?$/i.test(authAnswer.trim());
    }

    // 5. Admin
    if (options.auth && options.admin === undefined) {
      const adminAnswer = await rl.question(
        `${c.cyan("? Require Administrator permissions?")} ${c.dim("(y/N)")}: `
      );
      options.admin = /^y(es)?$/i.test(adminAnswer.trim());
    }
  } finally {
    rl.close();
  }

  return options;
}

/**
 * Extracts dynamic path parameter names from route segments, e.g. [id] -> id.
 */
function extractParams(routePath: string): string[] {
  const matches = routePath.match(/\[([a-zA-Z0-9_]+)\]/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Generates route code content.
 */
function generateRouteCode(
  targetDir: string,
  options: RouteCliOptions
): string {
  const relativeToRouter = path.relative(targetDir, ROUTER_DIR).replace(/\\/g, "/");
  const params = extractParams(options.path!);

  const hasBodyMethods = options.methods.some((m) =>
    ["POST", "PUT", "PATCH", "DELETE"].includes(m)
  );

  const importPermissions = options.admin
    ? `import { IRISFlags } from "@IRIS/permissions";\n`
    : "";

  let schemaLines = "";

  // Schema Params
  if (params.length > 0) {
    const paramFields = params
      .map((p) => {
        if (p.toLowerCase().includes("id")) {
          return `      ${p}: t.Number({ minimum: 1 }),`;
        }
        return `      ${p}: t.String(),`;
      })
      .join("\n");

    schemaLines += `    params: t.Object({\n${paramFields}\n    }),\n`;
  }

  // Schema Query
  if (options.methods.includes("GET")) {
    schemaLines += `    query: t.Optional(\n      t.Object({\n        limit: t.Optional(t.Number({ default: 20 })),\n        page: t.Optional(t.Number({ default: 1 })),\n      })\n    ),\n`;
  }

  // Schema Body for mutation methods
  if (hasBodyMethods) {
    schemaLines += `    body: t.Optional(\n      t.Object({\n        name: t.Optional(t.String()),\n        enabled: t.Optional(t.Boolean({ default: true })),\n      })\n    ),\n`;
  }

  // Schema Response
  schemaLines += `    response: {\n      200: t.Object({\n        success: t.Boolean(),\n        message: t.String(),\n        timestamp: t.String(),\n      }),\n    },\n`;

  // Rate limit
  let rateLimitBlock = "";
  if (options.rateLimit) {
    rateLimitBlock = `  rateLimit: {\n    capacity: ${options.rateLimit},\n    duration: 60_000,\n  },\n\n`;
  }

    // Method Handlers
    const methodHandlers = options.methods.map((method) => {
      const isBodyMethod = ["POST", "PUT", "PATCH", "DELETE", "ALL"].includes(method);
      const ctxArgs = [];
      if (params.length > 0) ctxArgs.push("params");
      if (method === "GET") ctxArgs.push("query");
      if (isBodyMethod) ctxArgs.push("body");
      ctxArgs.push("session");
      ctxArgs.push("prisma");
      ctxArgs.push("cache");
      ctxArgs.push("notifications");

      let authConfig = "";
      if (options.admin) {
        authConfig = `    requirePermissions: [IRISFlags.ADMINISTRATOR],\n`;
      } else if (options.auth) {
        authConfig = `    requireAuth: true,\n`;
      }

      if (authConfig) {
        return `  ${method}: {
${authConfig}    async handler({ ${ctxArgs.join(", ")} }) {
      return {
        success: true,
        message: "${method} ${options.path} handled successfully",
        timestamp: new Date().toISOString(),
      };
    },
  },`;
      }

      return `  async ${method}({ ${ctxArgs.join(", ")} }) {
    return {
      success: true,
      message: "${method} ${options.path} handled successfully",
      timestamp: new Date().toISOString(),
    };
  },`;
    });

  return `import { defineRoute, t } from "${relativeToRouter}";
${importPermissions}
export default defineRoute({
${rateLimitBlock}  schema: {
${schemaLines}  },

${methodHandlers.join("\n\n")}
});
`;
}

/**
 * Main execution.
 */
async function main() {
  let options = parseArgs(process.argv.slice(2));

  // If no path was provided on CLI, trigger interactive mode
  if (!options.path) {
    options = await promptInteractive(options);
  }

  if (!options.module) {
    options.module = "IRIS-core";
  }

  if (!options.path) {
    console.error(c.red("[Error] Route path is required."));
    process.exit(1);
  }

  // Normalize path (strip leading slashes, convert backslashes)
  let cleanPath = options.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleanPath) {
    cleanPath = "index";
  }

  const targetDir = path.join(MODULES_DIR, options.module, cleanPath);
  const targetFile = path.join(targetDir, "route.ts");

  if (fs.existsSync(targetFile) && !options.force) {
    console.error(
      `${c.red(c.bold("[Error]"))} Route file already exists:\n  ${c.dim(targetFile)}\nUse ${c.yellow("--force")} to overwrite.`
    );
    process.exit(1);
  }

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // Generate file content
  const code = generateRouteCode(targetDir, options);
  fs.writeFileSync(targetFile, code, "utf-8");

  console.log(
    `\n${c.green(c.bold("✔ Successfully created route file:"))}\n  ${c.cyan(targetFile)}`
  );

  // Automatically update routes.generated.ts and insomnium.json
  console.log(`${c.dim("Updating route manifests...")}`);
  try {
    await generateRoutes({ modulesDir: MODULES_DIR, silent: true });
    await generateInsomniumConfig({ modulesDir: MODULES_DIR, silent: true });
    console.log(`${c.green("✔ Eden Treaty & Insomnium manifests synchronized.")}\n`);
  } catch (err) {
    console.warn(`${c.yellow("[Warning]")} Failed to sync manifests automatically:`, err);
  }

  // Print helpful summary
  const relativeUrl = "/" + cleanPath.replace(/\[\.\.\.([^\]]+)\]/g, "*").replace(/\[([^\]]+)\]/g, ":$1");
  console.log(`${c.bold("Summary:")}`);
  console.log(`  ${c.bold("URL Path:")}   ${c.cyan(relativeUrl)}`);
  console.log(`  ${c.bold("Module:")}     ${c.magenta(options.module)}`);
  console.log(
    `  ${c.bold("Methods:")}    ${options.methods.map((m) => colorMethod(m)).join(" ")}`
  );
  if (options.auth) {
    console.log(`  ${c.bold("Auth:")}       ${c.yellow(options.admin ? "Administrator" : "Authenticated Session")}`);
  }
  if (options.rateLimit) {
    console.log(`  ${c.bold("Rate Limit:")} ${c.yellow(`${options.rateLimit} req/min`)}`);
  }
}

main().catch((err) => {
  console.error(c.red("[Fatal Error]:"), err);
  process.exit(1);
});
