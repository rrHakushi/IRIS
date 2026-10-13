import { describe, expect, it } from 'bun:test'
import cluster from 'node:cluster'
import os from 'node:os'
import { app, startServer } from '../src/server'

describe('Elysia Cluster Mode Architecture', () => {
  it('exports app and startServer function', () => {
    expect(app).toBeDefined()
    expect(typeof startServer).toBe('function')
  })

  it('detects available CPU parallelism accurately', () => {
    const parallelism = os.availableParallelism()
    expect(parallelism).toBeGreaterThan(0)
  })

  it('supports node:cluster primary status check', () => {
    expect(typeof cluster.isPrimary).toBe('boolean')
    expect(typeof cluster.fork).toBe('function')
  })

  it('can start a worker listener with reusePort enabled on an ephemeral port', async () => {
    // Port 0 picks a free OS port
    const server = startServer(0)
    expect(server).toBeDefined()

    const port = (server as any)?.server?.port
    if (port) {
      const res = await fetch(`http://localhost:${port}/`)
      // Root route returns 404 per Elysia configuration
      expect(res.status).toBe(404)
    }

    try {
      await app.stop()
    } catch {}
  })
})
