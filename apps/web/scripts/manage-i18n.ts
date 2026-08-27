import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, "../locales");
const SOURCE_DIRS = [
  path.resolve(__dirname, "../app"),
  path.resolve(__dirname, "../components"),
  path.resolve(__dirname, "../lib"),
  path.resolve(__dirname, "../hooks"),
];
const BASE_LOCALE = "en";

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

interface CodeKeyReference {
  fullKey: string;
  subKey: string;
  namespace: string;
  file: string;
  line: number;
}

/**
 * Flattens a nested object into dot-separated paths (e.g., "auth.login.welcomeBack").
 */
function flattenKeys(obj: TranslationObject, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as TranslationObject, fullPath));
    } else if (typeof value === "string") {
      result[fullPath] = value;
    }
  }
  return result;
}

/**
 * Unflattens dot-separated paths back into a structured nested JSON object.
 */
function unflattenKeys(flat: Record<string, string>): TranslationObject {
  const result: TranslationObject = {};
  for (const [pathKey, value] of Object.entries(flat)) {
    const segments = pathKey.split(".");
    let current: any = result;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (i === segments.length - 1) {
        current[segment] = value;
      } else {
        current[segment] = current[segment] || {};
        current = current[segment];
      }
    }
  }
  return result;
}

/**
 * Recursively scans directory for TypeScript / TSX files.
 */
function getSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(res));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(res);
    }
  }
  return files;
}

/**
 * Parses each code file to find exact translation key calls and their namespaces.
 */
function extractKeysFromCode(sourceFiles: string[]): CodeKeyReference[] {
  const references: CodeKeyReference[] = [];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const relativePath = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");

    // 1. Detect translation hook bindings in the file
    // e.g.: const t = useTranslations("auth.register");
    // e.g.: const t = await getTranslations("auth.login");
    // e.g.: const authT = useTranslations("auth");
    const varNamespaces: Record<string, string> = {};

    // Standard pattern: const varName = useTranslations("namespace")
    const bindingRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:["']([^"']+)["'])?\s*\)/g;
    let bMatch;
    while ((bMatch = bindingRegex.exec(content)) !== null) {
      const varName = bMatch[1]!;
      const ns = bMatch[2] || "";
      varNamespaces[varName] = ns;
    }

    // Default fallback if "t" is used with useTranslations
    if (!Object.keys(varNamespaces).length && /useTranslations|getTranslations/.test(content)) {
      varNamespaces["t"] = "";
    }

    // 2. Scan lines for variable invocations like t("key") or varName("key")
    lines.forEach((lineText, lineIdx) => {
      const lineNum = lineIdx + 1;

      for (const [varName, ns] of Object.entries(varNamespaces)) {
        // Matches varName("key") or varName('key')
        const callRegex = new RegExp(`\\b${varName}\\(\\s*["']([^"']+)["']`, "g");
        let cMatch;
        while ((cMatch = callRegex.exec(lineText)) !== null) {
          const subKey = cMatch[1]!;
          // If subKey is already a full path (e.g. starts with ns or contains dots without ns)
          const fullKey = ns ? `${ns}.${subKey}` : subKey;
          references.push({
            fullKey,
            subKey,
            namespace: ns,
            file: relativePath,
            line: lineNum,
          });
        }
      }
    });
  }

  return references;
}

function loadLocaleFile(locale: string): { filePath: string; data: TranslationObject; flat: Record<string, string> } {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Locale file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  return { filePath, data, flat: flattenKeys(data) };
}

function saveLocaleFile(filePath: string, data: TranslationObject) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function runI18nManager() {
  const args = process.argv.slice(2);
  const isSync = args.includes("--sync");
  const isPrune = args.includes("--prune");
  const addLangIndex = args.indexOf("--add-lang");
  const addLang = addLangIndex !== -1 ? args[addLangIndex + 1] : null;

  console.log("🌐 [IRIS i18n Manager] Starting translation audit...\n");

  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true });
  }

  // Find all locale files in locales dir
  const localeFiles = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"));

  if (!localeFiles.includes(BASE_LOCALE)) {
    console.error(`❌ Base locale '${BASE_LOCALE}.json' not found in ${LOCALES_DIR}`);
    process.exit(1);
  }

  // Handle adding new languages
  if (addLang) {
    const newLangs = addLang.split(",").map((l) => l.trim().toLowerCase());
    const base = loadLocaleFile(BASE_LOCALE);

    for (const lang of newLangs) {
      const targetPath = path.join(LOCALES_DIR, `${lang}.json`);
      if (fs.existsSync(targetPath)) {
        console.log(`ℹ️ Language file already exists: ${lang}.json`);
        continue;
      }
      const newFlat: Record<string, string> = {};
      for (const [k, v] of Object.entries(base.flat)) {
        newFlat[k] = `[${lang.toUpperCase()}] ${v}`;
      }
      saveLocaleFile(targetPath, unflattenKeys(newFlat));
      console.log(`✅ Created new language file: ${lang}.json with ${Object.keys(newFlat).length} keys.`);
      localeFiles.push(lang);
    }
  }

  const base = loadLocaleFile(BASE_LOCALE);
  const baseKeys = Object.keys(base.flat);
  console.log(`📖 Base dictionary (${BASE_LOCALE}.json): ${baseKeys.length} keys loaded.`);

  // 1. Scan source code and verify all called keys exist in base dictionary
  console.log("\n🔍 Scanning source code for translation calls...");
  const sourceFiles = SOURCE_DIRS.flatMap(getSourceFiles);
  console.log(`📁 Scanned ${sourceFiles.length} source code files.`);

  const codeReferences = extractKeysFromCode(sourceFiles);
  const usedKeySet = new Set<string>();

  // Deduplicate and group missing keys
  const missingFromBase: Record<string, CodeKeyReference[]> = {};

  for (const ref of codeReferences) {
    usedKeySet.add(ref.fullKey);
    if (!(ref.fullKey in base.flat)) {
      if (!missingFromBase[ref.fullKey]) {
        missingFromBase[ref.fullKey] = [];
      }
      missingFromBase[ref.fullKey]!.push(ref);
    }
  }

  let codeErrorCount = 0;
  const missingKeyEntries = Object.entries(missingFromBase);
  if (missingKeyEntries.length > 0) {
    codeErrorCount = missingKeyEntries.length;
    console.log(`\n❌ ERROR: Found ${codeErrorCount} missing translation key(s) called in code:`);
    for (const [missingKey, refs] of missingKeyEntries) {
      console.log(`\n   🔑 "${missingKey}"`);
      for (const r of refs) {
        console.log(`      ↳ called at ${r.file}:${r.line} via t("${r.subKey}")`);
      }

      if (isSync) {
        // Auto-add key to base dictionary
        base.flat[missingKey] = `[TODO] ${missingKey.split(".").pop()}`;
      }
    }

    if (isSync) {
      saveLocaleFile(base.filePath, unflattenKeys(base.flat));
      console.log(`\n   ✅ Automatically stubbed missing keys in ${BASE_LOCALE}.json!`);
    } else {
      console.log(`\n   💡 Run with '--sync' to automatically add placeholders for these keys.`);
    }
  } else {
    console.log("✅ All keys called in source code exist in base dictionary!");
  }

  // 2. Check & Sync other languages against base dictionary
  let totalMissingInLocales = 0;
  const refreshedBase = loadLocaleFile(BASE_LOCALE);
  const currentBaseKeys = Object.keys(refreshedBase.flat);

  for (const locale of localeFiles) {
    if (locale === BASE_LOCALE) continue;
    const target = loadLocaleFile(locale);
    const missingKeys = currentBaseKeys.filter((k) => !(k in target.flat));
    const extraKeys = Object.keys(target.flat).filter((k) => !(k in refreshedBase.flat));

    if (missingKeys.length > 0) {
      totalMissingInLocales += missingKeys.length;
      console.log(`\n⚠️  [${locale}.json] Missing ${missingKeys.length} translation keys:`);
      missingKeys.slice(0, 10).forEach((k) => console.log(`   - ${k}`));
      if (missingKeys.length > 10) console.log(`   ...and ${missingKeys.length - 10} more`);

      if (isSync) {
        for (const k of missingKeys) {
          target.flat[k] = `[${locale.toUpperCase()}] ${refreshedBase.flat[k]}`;
        }
        saveLocaleFile(target.filePath, unflattenKeys(target.flat));
        console.log(`   ✅ Synced missing keys to ${locale}.json.`);
      }
    } else {
      console.log(`✅ [${locale}.json] 100% complete (0 missing keys).`);
    }

    if (extraKeys.length > 0) {
      console.log(`ℹ️  [${locale}.json] Has ${extraKeys.length} extra keys not in base.`);
      if (isPrune) {
        for (const k of extraKeys) {
          delete target.flat[k];
        }
        saveLocaleFile(target.filePath, unflattenKeys(target.flat));
        console.log(`   ✂️ Pruned extra keys from ${locale}.json.`);
      }
    }
  }

  // 3. Detect and optionally prune unused keys
  const unusedKeys = currentBaseKeys.filter((k) => !usedKeySet.has(k));
  if (unusedKeys.length > 0) {
    console.log(`\n⚠️  Found ${unusedKeys.length} unused translation keys in dictionary:`);
    unusedKeys.slice(0, 15).forEach((k) => console.log(`   - ${k}`));
    if (unusedKeys.length > 15) console.log(`   ...and ${unusedKeys.length - 15} more`);

    if (isPrune) {
      for (const locale of localeFiles) {
        const item = loadLocaleFile(locale);
        for (const k of unusedKeys) {
          delete item.flat[k];
        }
        saveLocaleFile(item.filePath, unflattenKeys(item.flat));
      }
      console.log(`✂️ Successfully pruned ${unusedKeys.length} unused keys from all locale files.`);
    } else {
      console.log("\n💡 Run with '--prune' to automatically remove unused keys.");
    }
  } else {
    console.log("✅ All dictionary keys are actively in use!");
  }

  console.log("\n✨ [IRIS i18n Manager] Finished.");

  // Exit with failure code if there are missing keys in code and not in sync mode
  if (codeErrorCount > 0 && !isSync) {
    process.exit(1);
  }
}

// Run directly
runI18nManager();
