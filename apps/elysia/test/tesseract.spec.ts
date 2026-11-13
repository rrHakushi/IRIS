import { describe, it, expect, beforeEach, spyOn } from 'bun:test'
import {
  TesseractServ,
  isPrivateLanOrigin,
  isPrivateOrLoopbackIp,
  normalizeIpAddress,
  resolveLanLobbyId,
  type TesseractPeerTransport,
} from '../src/services/tesseract/tesseract.serv'
import { app } from '../src/server'

function createMockTransport() {
  const messages: any[] = []
  let closed: { code?: number; reason?: string } | null = null
  const transport: TesseractPeerTransport = {
    send(serialized: string) {
      messages.push(JSON.parse(serialized))
    },
    close(code?: number, reason?: string) {
      closed = { code, reason }
    },
  }
  return {
    transport,
    messages,
    getClosed: () => closed,
  }
}

describe('Tesseract LAN Grouping, Ghost Prevention & Signaling', () => {
  let serv: TesseractServ

  beforeEach(() => {
    serv = TesseractServ.getInstance()
    serv.resetForTests()
  })

  it('normalizes IPv4-mapped IPv6 and classifies private/loopback LAN addresses into unified lan:local lobby', () => {
    expect(normalizeIpAddress('::ffff:192.168.1.50')).toBe('192.168.1.50')
    expect(normalizeIpAddress('[::1]:3000')).toBe('::1')
    expect(normalizeIpAddress('10.0.0.42:51234')).toBe('10.0.0.42')

    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackIp('192.168.1.88')).toBe(true)
    expect(isPrivateOrLoopbackIp('10.20.30.40')).toBe(true)
    expect(isPrivateOrLoopbackIp('172.16.5.10')).toBe(true)
    expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false)

    expect(resolveLanLobbyId('127.0.0.1')).toEqual({ roomId: 'lan:local', lanScope: 'lan' })
    expect(resolveLanLobbyId('::ffff:192.168.1.50')).toEqual({ roomId: 'lan:local', lanScope: 'lan' })
    expect(resolveLanLobbyId('10.0.0.5')).toEqual({ roomId: 'lan:local', lanScope: 'lan' })

    expect(resolveLanLobbyId('203.0.113.42')).toEqual({
      roomId: 'lan:nat:203.0.113.42',
      lanScope: 'nat',
    })
    expect(resolveLanLobbyId('2001:db8:85a3::8a2e:370:7334')).toEqual({
      roomId: 'lan:nat:2001:0db8:85a3:0000',
      lanScope: 'nat',
    })

    expect(isPrivateLanOrigin('http://192.168.1.20:3000')).toBe(true)
    expect(isPrivateLanOrigin('http://localhost:3000')).toBe(true)
    expect(isPrivateLanOrigin('https://evil.example.com')).toBe(false)
  })

  it('auto-groups LAN guests, blocks guest Direct Send, and cleans up immediately on disconnect', async () => {
    const a = createMockTransport()
    const b = createMockTransport()

    const reqA = new Request('http://localhost:4000/tesseract/ws', {
      headers: { 'x-forwarded-for': '192.168.1.10' },
    })
    const reqB = new Request('http://localhost:4000/tesseract/ws', {
      headers: { 'x-forwarded-for': '192.168.1.25' },
    })

    const connA = await serv.connectPeer({
      transport: a.transport,
      request: reqA,
      alias: 'Desktop Guest',
      deviceId: 'dev-a',
      tabId: 'tab-a',
    })
    const connB = await serv.connectPeer({
      transport: b.transport,
      request: reqB,
      alias: 'Phone Guest',
      deviceId: 'dev-b',
      tabId: 'tab-b',
    })

    expect(connA?.peerId).toBeTruthy()
    expect(connB?.peerId).toBeTruthy()

    expect(a.messages[0].event).toBe('room:joined')
    expect(a.messages[0].data.room.roomId).toBe('lan:local')
    const peerJoinedMsg = a.messages.find((m) => m.event === 'peer:joined')
    expect(peerJoinedMsg).toBeDefined()
    expect(peerJoinedMsg?.data.peer.alias).toBe('Phone Guest')
    expect(peerJoinedMsg?.data.peer.deviceId).toBe('dev-b')

    expect(b.messages[0].event).toBe('room:joined')
    expect(b.messages[0].data.peers.length).toBe(1)
    expect(b.messages[0].data.peers[0].peerId).toBe(connA!.peerId)

    // Guest attempting Direct Send must be rejected server-side
    await serv.handleClientSignal(connA!.peerId, {
      type: 'direct:offer',
      toPeerId: connB!.peerId,
      offerId: 'offer-1',
      items: [{ id: '1', kind: 'file', name: 'secret.txt', size: 12 }],
      totalBytes: 12,
    })

    const errMsg = a.messages[a.messages.length - 1]
    expect(errMsg.event).toBe('room:error')
    expect(errMsg.data.code).toBe('UNAUTHORIZED')
    expect(b.messages.some((m) => m.event === 'direct:offer')).toBe(false)

    // WebRTC signaling relays cleanly within the LAN group
    await serv.handleClientSignal(connA!.peerId, {
      type: 'rtc:offer',
      toPeerId: connB!.peerId,
      sdp: { type: 'offer', sdp: 'v=0...' },
    })
    const rtcMsg = b.messages.find((m) => m.event === 'rtc:offer')
    expect(rtcMsg.data.fromPeerId).toBe(connA!.peerId)

    // Disconnecting A immediately notifies B
    await serv.disconnectPeer(connA!.peerId)
    const leftMsg = b.messages.find((m) => m.event === 'peer:left')
    expect(leftMsg.data.peerId).toBe(connA!.peerId)
  })

  it('prevents ghost peers when transport aborts mid-handshake or same tabId reconnects', async () => {
    const abortedTransport = createMockTransport()
    const abortedKey = {}
    // Simulate WebSocket closing before async auth/connect finishes
    await serv.disconnectPeer(abortedKey)

    const abortedConn = await serv.connectPeer({
      transport: abortedTransport.transport,
      transportKey: abortedKey,
      request: new Request('http://localhost:4000/tesseract/ws'),
      remoteAddress: '127.0.0.1',
      deviceId: 'dev-self',
      tabId: 'tab-1',
    })
    expect(abortedConn).toBeNull()

    // Simulate reload on the same tabId
    const first = createMockTransport()
    await serv.connectPeer({
      transport: first.transport,
      request: new Request('http://localhost:4000/tesseract/ws'),
      remoteAddress: '127.0.0.1',
      deviceId: 'dev-self',
      tabId: 'tab-1',
    })

    const second = createMockTransport()
    await serv.connectPeer({
      transport: second.transport,
      request: new Request('http://localhost:4000/tesseract/ws'),
      remoteAddress: '127.0.0.1',
      deviceId: 'dev-self',
      tabId: 'tab-1',
    })

    expect(second.messages[0].event).toBe('room:joined')
    expect(second.messages[0].data.peers.length).toBe(0)
  })

  it('stamps server-verified userId on Direct Send for authenticated users', async () => {
    const authSpy = spyOn(serv as any, 'resolveAuthenticatedPeerUser').mockImplementation(
      async (req: Request) => {
        const mockUser = req.headers.get('x-test-user')
        if (!mockUser) return null
        return {
          id: mockUser,
          username: mockUser,
          displayName: `User ${mockUser}`,
          avatarUrl: null,
        }
      }
    )

    try {
      const sender = createMockTransport()
      const receiver = createMockTransport()

      const connSender = await serv.connectPeer({
        transport: sender.transport,
        request: new Request('http://localhost:4000/tesseract/ws', {
          headers: { 'x-test-user': 'user-1' },
        }),
        remoteAddress: '192.168.1.10',
        deviceId: 'dev-laptop',
        tabId: 'tab-laptop',
      })
      const connReceiver = await serv.connectPeer({
        transport: receiver.transport,
        request: new Request('http://localhost:4000/tesseract/ws', {
          headers: { 'x-test-user': 'user-1' },
        }),
        remoteAddress: '192.168.1.11',
        deviceId: 'dev-phone',
        tabId: 'tab-phone',
      })

      await serv.handleClientSignal(connSender!.peerId, {
        type: 'direct:offer',
        toPeerId: connReceiver!.peerId,
        offerId: 'offer-auth-1',
        items: [{ id: 'f1', kind: 'file', name: 'build.zip', size: 1024 }],
        totalBytes: 1024,
      })

      const directOffer = receiver.messages.find((m) => m.event === 'direct:offer')
      expect(directOffer).toBeTruthy()
      expect(directOffer.data.fromUserId).toBe('user-1')
      expect(directOffer.data.fromPeerId).toBe(connSender!.peerId)

      const identityRes = await app.handle(
        new Request('http://localhost:4000/tesseract/identity')
      )
      expect(identityRes.status).toBe(200)
    } finally {
      authSpy.mockRestore()
    }
  })
})
