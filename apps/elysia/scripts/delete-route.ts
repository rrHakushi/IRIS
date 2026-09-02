#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { c } from "../src/utils/colors";
import { findRouteFiles, parseRoutePath, generateRoutes } from "../src/router/generator";
import { generateInsomniumConfig } from "../src/router/insomnium";

interface DeleteCliOptions {
  path?: string;
  module?: string;
  force?: boolean;
}

const MODULES_DIR = path.resolve(import.meta.dirname, "../src/modules");

function parseArgs(args: string[]): DeleteCliOptions {
  const options: DeleteCliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "-m" || arg === "--module") {
      options.module = args[++i];
    } else if (arg === "-f" || arg === "--force" || arg === "-y" || arg === "--yes") {
      options.force = true;
    } else if (!arg.startsWith("-") && !options.path) {
      options.path = arg;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${c.cyan(c.bold("IRIS Elysia Route Deletion CLI"))}
CLI utility to safely delete Elysia file routes and synchronize manifests.

${c.yellow(c.bold("USAGE:"))}
  bun run scripts/delete-route.ts [route-path] [options]

${c.yellow(c.bold("OPTIONS:"))}
  ${c.green("route-path")}               Route URL or filesystem path to delete
  ${c.green("-m, --module <name>")}       Target module folder in src/modules
  ${c.green("-f, --force, -y, --yes")}    Skip confirmation prompt
  ${c.green("-h, --help")}                Show this help message

${c.yellow(c.bold("EXAMPLES:"))}
  ${c.dim("# Interactive selection")}
  bun run scripts/delete-route.ts

  ${c.dim("# Delete specific route")}
  bun run scripts/delete-route.ts "media/games/[id]/refresh" -m IRIS-media --force
`);
}

function removeEmptyDirsRecursively(dirPath: string, stopAt: string) {
  if (dirPath === stopAt || !dirPath.startsWith(stopAt)) return;
  try {
    const files = fs.readdirSync(dirPath);
    if (files.length === 0) {
      fs.rmdirSync(dirPath);
      removeEmptyDirsRecursively(path.dirname(dirPath), stopAt);
    }
  } catch {
    // ignore
  }
}

async function main() {
  let options = parseArgs(process.argv.slice(2));

  const allRouteFiles = findRouteFiles(MODULES_DIR);

  if (allRouteFiles.length === 0) {
    console.log(`${c.yellow("[Notice]")} No routes found in ${MODULES_DIR}`);
    return;
  }

  let targetFile: string | null = null;

  if (options.path) {
    let cleanPath = options.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");

    // 1. Try direct file path match
    for (const f of allRouteFiles) {
      const rel = path.relative(MODULES_DIR, f).replace(/\\/g, "/");
      const urlPath = parseRoutePath(rel);

      if (
        rel === cleanPath ||
        rel === `${cleanPath}/route.ts` ||
        rel.includes(cleanPath) ||
        urlPath === `/${cleanPath}` ||
        urlPath === cleanPath
      ) {
        if (!options.module || rel.startsWith(options.module)) {
          targetFile = f;
          break;
        }
      }
    }

    if (!targetFile) {
      console.error(`${c.red(c.bold("[Error]"))} Could not find route matching "${options.path}"`);
      process.exit(1);
    }
  } else {
    // Interactive route picker
    const rl = readline.createInterface({ input, output });
    try {
      console.log(`\n${c.cyan(c.bold("Discovered Routes:"))}`);
      const routeList = allRouteFiles.map((f, idx) => {
        const rel = path.relative(MODULES_DIR, f).replace(/\\/g, "/");
        const urlPath = parseRoutePath(rel);
        const modName = rel.split("/")[0] || "";
        return { idx: idx + 1, file: f, rel, urlPath, modName };
      });

      for (const r of routeList) {
        console.log(`  ${c.dim(`[${r.idx}]`)} ${c.magenta(`[${r.modName}]`)} ${c.cyan(r.urlPath)} ${c.dim(`(${r.rel})`)}`);
      }

      const answer = await rl.question(`\n${c.yellow("? Enter route number or path to delete")} ${c.dim("(or 'q' to cancel)")}: `);
      const trimmed = answer.trim();

      if (!trimmed || trimmed.toLowerCase() === "q") {
        console.log("Operation cancelled.");
        process.exit(0);
      }

      const selectedIdx = parseInt(trimmed, 10);
      if (!isNaN(selectedIdx) && selectedIdx >= 1 && selectedIdx <= routeList.length) {
        targetFile = routeList[selectedIdx - 1]!.file;
      } else {
        const match = routeList.find((r) => r.urlPath === trimmed || r.rel.includes(trimmed));
        if (match) {
          targetFile = match.file;
        }
      }

      if (!targetFile) {
        console.error(c.red("Invalid selection."));
        process.exit(1);
      }
    } finally {
      rl.close();
    }
  }

  const relativePath = path.relative(MODULES_DIR, targetFile).replace(/\\/g, "/");
  const targetDir = path.dirname(targetFile);

  if (!options.force) {
    const rl = readline.createInterface({ input, output });
    try {
      const confirm = await rl.question(
        `${c.yellow(c.bold("⚠️  Are you sure you want to delete:"))} ${c.cyan(relativePath)}? ${c.dim("(y/N)")}: `
      );
      if (!/^y(es)?$/i.test(confirm.trim())) {
        console.log("Deletion cancelled.");
        process.exit(0);
      }
    } finally {
      rl.close();
    }
  }

  // Remove the route file or whole directory if it only contains the route file
  try {
    const filesInDir = fs.readdirSync(targetDir);
    const hasOnlyRouteRelatedFiles = filesInDir.every(
      (f) => f === "route.ts" || f === "route.js" || f === "types.ts"
    );

    if (hasOnlyRouteRelatedFiles) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      const moduleRoot = path.join(MODULES_DIR, relativePath.split("/")[0]!);
      removeEmptyDirsRecursively(path.dirname(targetDir), moduleRoot);
    } else {
      fs.unlinkSync(targetFile);
    }

    console.log(`\n${c.green(c.bold("✔ Successfully deleted route:"))} ${c.dim(relativePath)}`);
  } catch (err) {
    console.error(c.red(`Failed to delete route file: ${targetFile}`), err);
    process.exit(1);
  }

  // Synchronize manifests
  console.log(`${c.dim("Updating route manifests...")}`);
  try {
    await generateRoutes({ modulesDir: MODULES_DIR, silent: true });
    await generateInsomniumConfig({ modulesDir: MODULES_DIR, silent: true });
    console.log(`${c.green("✔ Eden Treaty & Insomnium manifests synchronized.")}\n`);
  } catch (err) {
    console.warn(`${c.yellow("[Warning]")} Failed to sync manifests:`, err);
  }
}

main().catch((err) => {
  console.error(c.red("[Fatal Error]:"), err);
  process.exit(1);
});
