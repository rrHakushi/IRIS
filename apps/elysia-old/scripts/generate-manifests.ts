#!/usr/bin/env bun
import path from "node:path";
import { generateRoutes } from "../src/router/generator";
import { generateInsomniumConfig } from "../src/router/insomnium";
import { c } from "../src/utils/colors";

const MODULES_DIR = path.resolve(import.meta.dirname, "../src/modules");

async function main() {
  const silent = process.argv.includes("--silent") || process.argv.includes("-s");

  if (!silent) {
    console.log(
      `${c.blue(c.bold("[Router]"))} ${c.dim("Synchronizing Eden Treaty and Insomnium route manifests...")}`
    );
  }

  try {
    await generateRoutes({ modulesDir: MODULES_DIR, silent });
    await generateInsomniumConfig({ modulesDir: MODULES_DIR, silent });
    if (!silent) {
      console.log(`${c.green(c.bold("✔ Manifests synchronized successfully."))}\n`);
    }
  } catch (err) {
    console.error(`${c.red(c.bold("[Router] Manifest synchronization failed:"))}`, err);
    process.exit(1);
  }
}

main();
