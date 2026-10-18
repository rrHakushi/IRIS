import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import fs from 'node:fs'
import path from 'node:path'
import { controllers, isElysiaInstance, scanFiles } from '../../src/plugins/controllers'

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures/controllers')

describe('Controllers Autoload Plugin', () => {
  beforeEach(() => {
    if (fs.existsSync(FIXTURES_DIR)) {
      fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(FIXTURES_DIR)) {
      fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
    }
  })

  it('correctly identifies Elysia instances with isElysiaInstance', () => {
    const valid = new Elysia().get('/test', () => 'ok')
    expect(isElysiaInstance(valid)).toBe(true)

    expect(isElysiaInstance(null)).toBe(false)
    expect(isElysiaInstance({})).toBe(false)
    expect(isElysiaInstance(() => {})).toBe(false)
    expect(isElysiaInstance({ handle: () => {}, use: () => {}, routes: [] })).toBe(true)
  })

  it('discovers files and respects ignore filters', () => {
    fs.writeFileSync(path.join(FIXTURES_DIR, 'user.ctrl.ts'), 'export const user = 1')
    fs.writeFileSync(path.join(FIXTURES_DIR, 'auth.controller.ts'), 'export const auth = 1')
    fs.writeFileSync(path.join(FIXTURES_DIR, 'user.test.ts'), 'test')
    fs.writeFileSync(path.join(FIXTURES_DIR, 'types.d.ts'), 'types')
    fs.writeFileSync(path.join(FIXTURES_DIR, '_internal.ts'), 'internal')

    const files = scanFiles(FIXTURES_DIR)
    const baseNames = files.map((f) => path.basename(f))

    expect(baseNames).toContain('user.ctrl.ts')
    expect(baseNames).toContain('auth.controller.ts')
    expect(baseNames).not.toContain('user.test.ts')
    expect(baseNames).not.toContain('types.d.ts')
    expect(baseNames).not.toContain('_internal.ts')
  })

  it('scans subdirectories recursively', () => {
    const subDir = path.join(FIXTURES_DIR, 'admin')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, 'admin.ctrl.ts'), 'export const admin = 1')

    const files = scanFiles(FIXTURES_DIR, true)
    expect(files.some((f) => f.includes('admin.ctrl.ts'))).toBe(true)
  })

  it('auto-registers existing project controllers (carina/auth.ctrl.ts)', async () => {
    const app = new Elysia({ strictPath: true }).use(
      controllers({
        dir: path.resolve(import.meta.dirname, '../../src/api/controllers'),
        verbose: false,
      })
    )

    // Route /carina/auth/login should be mounted
    const paths = app.routes.map((r) => `${r.method} ${r.path}`)
    expect(paths).toContain('POST /carina/auth/login')
    expect(paths).toContain('POST /carina/auth/register')
    expect(paths).toContain('POST /carina/auth/password/change')
    expect(paths).toContain('POST /carina/auth/password/forgot')
    expect(paths).toContain('POST /carina/auth/password/reset')

    // Calling the endpoint validates body
    const res = await app.handle(
      new Request('http://localhost/carina/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      })
    )
    expect(res.status).toBe(422) // validation error
  })

  it('loads named exports, default exports, and multiple controllers in one file', async () => {
    const ctrlFile = path.join(FIXTURES_DIR, 'mixed.ctrl.ts')
    fs.writeFileSync(
      ctrlFile,
      `
import { Elysia } from 'elysia'

export const firstCtrl = new Elysia({ prefix: '/first' }).get('/hello', () => 'first')
export const secondCtrl = new Elysia({ prefix: '/second' }).get('/world', () => 'second')
export default new Elysia({ prefix: '/default' }).get('/ping', () => 'pong')
`
    )

    const app = new Elysia().use(
      controllers({
        dir: FIXTURES_DIR,
        verbose: false,
      })
    )

    const resFirst = await app.handle(new Request('http://localhost/first/hello'))
    expect(await resFirst.text()).toBe('first')

    const resSecond = await app.handle(new Request('http://localhost/second/world'))
    expect(await resSecond.text()).toBe('second')

    const resDef = await app.handle(new Request('http://localhost/default/ping'))
    expect(await resDef.text()).toBe('pong')
  })

  it('works asynchronously via controllers.async()', async () => {
    const ctrlFile = path.join(FIXTURES_DIR, 'async.ctrl.ts')
    fs.writeFileSync(
      ctrlFile,
      `
import { Elysia } from 'elysia'
export const asyncCtrl = new Elysia({ prefix: '/async' }).get('/data', () => ({ ok: true }))
`
    )

    const app = new Elysia().use(
      await controllers.async({
        dir: FIXTURES_DIR,
        verbose: false,
      })
    )

    const res = await app.handle(new Request('http://localhost/async/data'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('supports global prefix', async () => {
    const ctrlFile = path.join(FIXTURES_DIR, 'prefixed.ctrl.ts')
    fs.writeFileSync(
      ctrlFile,
      `
import { Elysia } from 'elysia'
export const ctrl = new Elysia({ prefix: '/user' }).get('/me', () => 'me')
`
    )

    const app = new Elysia().use(
      controllers({
        dir: FIXTURES_DIR,
        prefix: '/api/v1',
        verbose: false,
      })
    )

    const res = await app.handle(new Request('http://localhost/api/v1/user/me'))
    expect(await res.text()).toBe('me')
  })

  it('integrates seamlessly with OpenAPI plugin', async () => {
    const ctrlFile = path.join(FIXTURES_DIR, 'docs.ctrl.ts')
    fs.writeFileSync(
      ctrlFile,
      `
import { Elysia } from 'elysia'
export const docsCtrl = new Elysia({ prefix: '/items' }).get('/list', () => ['item1', 'item2'])
`
    )

    const app = new Elysia()
      .use(controllers({ dir: FIXTURES_DIR, verbose: false }))
      .use(openapi())

    const res = await app.handle(new Request('http://localhost/openapi/json'))
    expect(res.status).toBe(200)
    const spec = await res.json()
    expect(spec.paths).toHaveProperty('/items/list')
  })
})
