import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { session, resolveSessionFromRequest } from '../../src/plugins/session'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { isHttpError, Unauthorized } from '../../src/lib/errors'
import { prisma } from '@IRIS/database'

interface MockUser {
  id: string
  username: string
  email: string | null
  permissions: number[]
  passwordChangedAt: Date | null
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [1, 2],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      passwordChangedAt: new Date(Date.now() + 10000), // Password changed in future relative to old token
    },
  ]

  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }
}

const app = new Elysia()
  .error(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
  })
  .use(session())
  .get('/test/optional', ({ session: userSession }) => {
    return {
      isAuthenticated: userSession.isAuthenticated,
      user: userSession.getUser(),
    }
  })
  .get('/test/required', ({ session: userSession }) => {
    const user = userSession.requireUser()
    return {
      id: user.id,
      username: user.username,
      permissions: user.permissions,
    }
  })

describe('Session Plugin Test Suite', () => {
  const SECRET = 'test-iris-secret-key-at-least-32-chars!'
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET
    setupPrismaMock()
  })

  it('handles unauthenticated requests gracefully', async () => {
    const resOpt = await app.handle(new Request('http://localhost/test/optional'))
    expect(resOpt.status).toBe(200)
    const dataOpt = await resOpt.json()
    expect(dataOpt.isAuthenticated).toBe(false)
    expect(dataOpt.user).toBeNull()

    const resReq = await app.handle(new Request('http://localhost/test/required'))
    expect(resReq.status).toBe(401)
  })

  it('authenticates user via Authorization header Bearer token', async () => {
    const token = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })

    const res = await app.handle(
      new Request('http://localhost/test/required', {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(ALICE_ID)
    expect(data.username).toBe('alice')
    expect(data.permissions).toEqual([1, 2])
  })

  it('authenticates user via next-auth cookie headers', async () => {
    const token = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })

    const res = await app.handle(
      new Request('http://localhost/test/required', {
        headers: { Cookie: `next-auth.session-token=${token}` },
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(ALICE_ID)
  })

  it('invalidates tokens issued before passwordChangedAt', async () => {
    // Bob's passwordChangedAt is set in the future relative to token iat
    const token = await signUserJwt({
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
    })

    const res = await app.handle(
      new Request('http://localhost/test/required', {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects tokens when user does not exist in database', async () => {
    const token = await signUserJwt({
      id: '00000000-0000-0000-0000-999999999999',
      username: 'ghost',
      email: 'ghost@example.com',
    })

    const res = await app.handle(
      new Request('http://localhost/test/required', {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(401)
  })
})
