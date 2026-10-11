import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Elysia } from 'elysia'

const req = createRequire(import.meta.url)

export interface ControllerInfo {
  filePath: string
  fileName: string
  exportName: string
  routesCount: number
  prefix?: string
}

export interface ControllersOptions<Prefix extends string = string> {
  /**
   * Directory containing controllers to scan.
   * Can be an absolute path or relative to project root or current file.
   * Defaults to auto-resolving `src/api/controllers` or `./api/controllers`.
   */
  dir?: string

  /**
   * Regex, glob-like string, or predicate function to match controller files.
   * Defaults to matching *.ctrl.*, *.controller.*, or any .ts/.js file that is not a test/d.ts.
   */
  pattern?: RegExp | string | ((fileName: string, fullPath: string) => boolean)

  /**
   * Array of patterns or filenames to exclude.
   * Defaults to excluding *.test.*, *.spec.*, *.d.ts, and files starting with _ or .
   */
  ignore?: (RegExp | string)[] | ((fileName: string, fullPath: string) => boolean)

  /**
   * Whether to recursively scan subdirectories.
   * @default true
   */
  recursive?: boolean

  /**
   * Optional global URL prefix for all registered controllers.
   * Example: `prefix: "/api"`
   */
  prefix?: Prefix

  /**
   * Custom logger instance with info/warn/error/debug methods.
   * Example: LogFactory from @Iris/logger or console.
   */
  logger?: {
    info?: (...args: any[]) => void
    warn?: (...args: any[]) => void
    error?: (...args: any[]) => void
    debug?: (...args: any[]) => void
  }

  /**
   * Whether to log discovered controllers on startup.
   * @default true
   */
  verbose?: boolean

  /**
   * Throw an error if no controllers were discovered in the directory.
   * @default false
   */
  failIfEmpty?: boolean

  /**
   * Hook called whenever a controller is successfully loaded and mounted.
   */
  onLoad?: (info: ControllerInfo) => void

  /**
   * Optionally generate a static TypeScript manifest file that statically imports
   * and chains all scanned controllers, preserving 100% full Eden Treaty types.
   * Can be `true` or an object with `{ outputFile?: string }`.
   */
  generateTypes?: boolean | { outputFile?: string }
}

/**
 * Checks if a value is an Elysia instance.
 * Checks instanceof Elysia as well as duck typing for cross-version/cross-realm compatibility.
 */
export function isElysiaInstance(val: unknown): val is Elysia {
  if (!val || typeof val !== 'object') return false
  if (val instanceof Elysia) return true
  const candidate = val as Record<string, unknown>
  return (
    typeof candidate.handle === 'function' &&
    typeof candidate.use === 'function' &&
    Array.isArray(candidate.routes)
  )
}

/**
 * Resolves the controller directory path reliably across different execution contexts
 * (e.g., monorepo root, package root, or bun run).
 */
export function resolveControllerDir(specifiedDir?: string): string {
  if (specifiedDir) {
    if (path.isAbsolute(specifiedDir)) {
      if (fs.existsSync(specifiedDir)) return specifiedDir
    } else {
      const fromCwd = path.resolve(process.cwd(), specifiedDir)
      if (fs.existsSync(fromCwd)) return fromCwd

      const fromFile = path.resolve(import.meta.dirname, specifiedDir)
      if (fs.existsSync(fromFile)) return fromFile
    }
    // Return resolved path even if it does not exist yet so caller can throw informative error
    return path.resolve(process.cwd(), specifiedDir)
  }

  // Candidate paths to search when no explicit dir is provided
  const candidates = [
    path.resolve(process.cwd(), 'src/api/controllers'),
    path.resolve(process.cwd(), 'api/controllers'),
    path.resolve(process.cwd(), 'apps/elysia2/src/api/controllers'),
    path.resolve(import.meta.dirname, '../api/controllers'),
    path.resolve(import.meta.dirname, '../../api/controllers'),
    path.resolve(import.meta.dirname, '../../src/api/controllers'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }
  }

  // Default fallback
  return path.resolve(process.cwd(), 'src/api/controllers')
}

/**
 * Recursively scans a directory for files matching criteria.
 */
export function scanFiles(
  dir: string,
  recursive = true,
  pattern?: ControllersOptions['pattern'],
  ignore?: ControllersOptions['ignore']
): string[] {
  if (!fs.existsSync(dir)) return []

  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (
        recursive &&
        entry.name !== 'node_modules' &&
        !entry.name.startsWith('.')
      ) {
        results.push(...scanFiles(fullPath, recursive, pattern, ignore))
      }
      continue
    }

    if (!entry.isFile()) continue

    const name = entry.name

    // Default ignore rules
    if (
      name.startsWith('.') ||
      name.startsWith('_') ||
      name.endsWith('.d.ts') ||
      name.includes('.test.') ||
      name.includes('.spec.')
    ) {
      continue
    }

    // Custom ignore
    if (ignore) {
      if (typeof ignore === 'function' && ignore(name, fullPath)) continue
      if (Array.isArray(ignore)) {
        const isIgnored = ignore.some((ig) => {
          if (typeof ig === 'string') return name.includes(ig) || fullPath.includes(ig)
          return ig.test(name) || ig.test(fullPath)
        })
        if (isIgnored) continue
      }
    }

    // Pattern matching
    if (pattern) {
      if (typeof pattern === 'function') {
        if (!pattern(name, fullPath)) continue
      } else if (pattern instanceof RegExp) {
        if (!pattern.test(name) && !pattern.test(fullPath)) continue
      } else if (typeof pattern === 'string') {
        if (!name.includes(pattern) && !fullPath.includes(pattern)) continue
      }
    } else {
      // Default matching: *.ctrl.*, *.controller.*, or any .ts/.js/.mjs in the directory
      const isControllerFile =
        /\.(ctrl|controller)\.[cm]?[jt]sx?$/.test(name) ||
        /\.[cm]?[jt]sx?$/.test(name)

      if (!isControllerFile) continue
    }

    results.push(fullPath)
  }

  return results.sort()
}

interface LoadedControllerItem {
  exportName: string
  instance: Elysia | ((app: Elysia) => any)
  filePath: string
  fileName: string
  routesCount: number
  prefix?: string
}

function extractControllersFromModule(
  mod: Record<string, any>,
  fullPath: string
): LoadedControllerItem[] {
  const fileName = path.basename(fullPath)
  const results: LoadedControllerItem[] = []
  const seenInstances = new Set<unknown>()

  for (const [key, val] of Object.entries(mod)) {
    if (isElysiaInstance(val)) {
      if (!seenInstances.has(val)) {
        seenInstances.add(val)
        const routes = (val as any).routes || []
        const prefix = (val as any).config?.prefix || (val as any).prefix || undefined
        results.push({
          exportName: key,
          instance: val,
          filePath: fullPath,
          fileName,
          routesCount: Array.isArray(routes) ? routes.length : 0,
          prefix,
        })
      }
    } else if (
      key === 'default' &&
      typeof val === 'function' &&
      !String(val).startsWith('class ')
    ) {
      if (!seenInstances.has(val)) {
        seenInstances.add(val)
        results.push({
          exportName: key,
          instance: val as (app: Elysia) => any,
          filePath: fullPath,
          fileName,
          routesCount: 0,
        })
      }
    }
  }

  return results
}

/**
 * Generates a static TypeScript manifest file importing and chaining all discovered controllers.
 * Useful for 100% full compile-time Eden Treaty type inference.
 */
function generateStaticManifest(
  controllers: LoadedControllerItem[],
  outputFile: string
) {
  const outputDir = path.dirname(outputFile)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const importStatements: string[] = ["import { Elysia } from 'elysia'"]
  const chainCalls: string[] = []

  controllers.forEach((item, index) => {
    const relativePath = path
      .relative(outputDir, item.filePath)
      .replace(/\.[cm]?[jt]sx?$/, '')
      .replace(/\\/g, '/')
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
    const varName = `_ctrl_${index}`

    if (item.exportName === 'default') {
      importStatements.push(`import ${varName} from '${importPath}'`)
    } else {
      importStatements.push(`import { ${item.exportName} as ${varName} } from '${importPath}'`)
    }
    chainCalls.push(`.use(${varName})`)
  })

  const code = [
    '// [AUTO-GENERATED] DO NOT EDIT MANUALLY',
    '// Generated by @IRIS/elysia controllers plugin for Eden Treaty static typing.',
    ...importStatements,
    '',
    `export const controllers = new Elysia({ name: 'controllers' })${chainCalls.length > 0 ? '\n  ' + chainCalls.join('\n  ') : ''}`,
    '',
    'export type ControllersApp = typeof controllers',
    '',
  ].join('\n')

  // Only write if contents changed to prevent infinite watch loops
  if (fs.existsSync(outputFile)) {
    const current = fs.readFileSync(outputFile, 'utf-8')
    if (current === code) return
  }
  fs.writeFileSync(outputFile, code, 'utf-8')
}

/**
 * Scans and registers controllers synchronously into an Elysia plugin.
 * Recommended for Bun and environments supporting synchronous module resolution.
 *
 * @example
 * ```typescript
 * import { Elysia } from 'elysia'
 * import { controllers } from './plugins/controllers'
 *
 * export const app = new Elysia()
 *   .use(controllers())
 *   .listen(4000)
 * ```
 */
export interface ControllersPlugin {
  <Prefix extends string = ''>(options?: ControllersOptions<Prefix>): Elysia<Prefix>
  async<Prefix extends string = ''>(options?: ControllersOptions<Prefix>): Promise<Elysia<Prefix>>
}

function controllersSync<Prefix extends string = ''>(
  options: ControllersOptions<Prefix> = {}
): Elysia<Prefix> {
  const targetDir = resolveControllerDir(options.dir)
  const plugin = new Elysia({
    name: 'controllers-scanner',
    ...(options.prefix ? { prefix: options.prefix } : {}),
  }) as Elysia<Prefix>

  if (!fs.existsSync(targetDir)) {
    if (options.failIfEmpty) {
      throw new Error(`Controller directory not found: ${targetDir}`)
    }
    if (options.logger?.warn) {
      options.logger.warn(`[Controllers] Directory does not exist: ${targetDir}`)
    } else {
      console.warn(`[Controllers] Directory does not exist: ${targetDir}`)
    }
    return plugin
  }

  const files = scanFiles(
    targetDir,
    options.recursive ?? true,
    options.pattern,
    options.ignore
  )

  if (files.length === 0 && options.failIfEmpty) {
    throw new Error(`No controllers found in ${targetDir}`)
  }

  const loadedItems: LoadedControllerItem[] = []

  for (const filePath of files) {
    try {
      const mod = req(filePath)
      const items = extractControllersFromModule(mod, filePath)
      for (const item of items) {
        plugin.use(item.instance as any)
        loadedItems.push(item)
        options.onLoad?.({
          filePath: item.filePath,
          fileName: item.fileName,
          exportName: item.exportName,
          routesCount: item.routesCount,
          prefix: item.prefix,
        })
      }
    } catch (err: any) {
      const msg = `[Controllers] Failed to load controller at ${filePath}: ${err?.message || err}`
      if (options.logger?.error) {
        options.logger.error(msg, err)
      } else {
        console.error(msg, err)
      }
      throw err
    }
  }

  // Handle optional type generation
  if (options.generateTypes) {
    const outFile =
      typeof options.generateTypes === 'object' && options.generateTypes.outputFile
        ? path.resolve(process.cwd(), options.generateTypes.outputFile)
        : path.join(targetDir, 'controllers.generated.ts')
    generateStaticManifest(loadedItems, outFile)
  }

  if (options.verbose !== false && loadedItems.length > 0) {
    const totalRoutes = loadedItems.reduce((acc, c) => acc + c.routesCount, 0)
    const details = loadedItems
      .map(
        (c) =>
          `  - ${c.exportName} (${c.fileName})${c.prefix ? ` [${c.prefix}]` : ''}: ${c.routesCount} route(s)`
      )
      .join('\n')
    const header = `Registered ${loadedItems.length} Controllers | ${totalRoutes} Routes total`
    const message = details ? `${header}\n${details}` : header
    if (options.logger?.info) {
      options.logger.info(message)
    } else {
      console.log(message)
    }
  }

  return plugin
}

async function controllersAsync<Prefix extends string = ''>(
  options: ControllersOptions<Prefix> = {}
): Promise<Elysia<Prefix>> {
  const targetDir = resolveControllerDir(options.dir)
  const plugin = new Elysia({
    name: 'controllers-scanner',
    ...(options.prefix ? { prefix: options.prefix } : {}),
  }) as Elysia<Prefix>

  if (!fs.existsSync(targetDir)) {
    if (options.failIfEmpty) {
      throw new Error(`Controller directory not found: ${targetDir}`)
    }
    if (options.logger?.warn) {
      options.logger.warn(`[Controllers] Directory does not exist: ${targetDir}`)
    } else {
      console.warn(`[Controllers] Directory does not exist: ${targetDir}`)
    }
    return plugin
  }

  const files = scanFiles(
    targetDir,
    options.recursive ?? true,
    options.pattern,
    options.ignore
  )

  if (files.length === 0 && options.failIfEmpty) {
    throw new Error(`No controllers found in ${targetDir}`)
  }

  const loadedItems: LoadedControllerItem[] = []

  for (const filePath of files) {
    try {
      const fileUrl = pathToFileURL(filePath).href
      const mod = await import(fileUrl)
      const items = extractControllersFromModule(mod, filePath)
      for (const item of items) {
        plugin.use(item.instance as any)
        loadedItems.push(item)
        options.onLoad?.({
          filePath: item.filePath,
          fileName: item.fileName,
          exportName: item.exportName,
          routesCount: item.routesCount,
          prefix: item.prefix,
        })
      }
    } catch (err: any) {
      const msg = `[Controllers] Failed to async load controller at ${filePath}: ${err?.message || err}`
      if (options.logger?.error) {
        options.logger.error(msg, err)
      } else {
        console.error(msg, err)
      }
      throw err
    }
  }

  // Handle optional type generation
  if (options.generateTypes) {
    const outFile =
      typeof options.generateTypes === 'object' && options.generateTypes.outputFile
        ? path.resolve(process.cwd(), options.generateTypes.outputFile)
        : path.join(targetDir, 'controllers.generated.ts')
    generateStaticManifest(loadedItems, outFile)
  }

  if (options.verbose !== false && loadedItems.length > 0) {
    const totalRoutes = loadedItems.reduce((acc, c) => acc + c.routesCount, 0)
    const details = loadedItems
      .map(
        (c) =>
          `  - ${c.exportName} (${c.fileName})${c.prefix ? ` [${c.prefix}]` : ''}: ${c.routesCount} route(s)`
      )
      .join('\n')
    const header = `Registered ${loadedItems.length} Controllers | ${totalRoutes} Routes total`
    const message = details ? `${header}\n${details}` : header
    if (options.logger?.info) {
      options.logger.info(message)
    } else {
      console.log(message)
    }
  }

  return plugin
}

export const controllers: ControllersPlugin = Object.assign(controllersSync, {
  async: controllersAsync,
})

/**
 * Convenient alias for `controllers`.
 */
export const autoloadControllers = controllers
export default controllers
