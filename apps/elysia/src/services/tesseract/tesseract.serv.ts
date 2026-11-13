import { randomBytes, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import Redis from 'ioredis'
import { prisma } from '@NamelessLiberty/db'
import {
  getProfileCustomization,
  type TesseractClientSignal,
  type TesseractDeviceType,
  type TesseractPeer,
  type TesseractPeerUser,
  type TesseractRoomInfo,
  type TesseractServerEvent,
} from '@NamelessLiberty/shared'
import { LogFactory } from '@NamelessLiberty/logger'
import { resolveSessionFromRequest } from '../../plugins/session'

const logger = new LogFactory('Elysia:Tesseract')

const PEER_TTL_SECONDS = 45
const PEER_HASH_TTL_SECONDS = 60 * 60 * 24
const REDIS_BUS_CHANNEL = 'tesseract:bus'

export interface TesseractPeerTransport {
  send(serialized: string): void
  close?(code?: number, reason?: string): void
}

interface BusEnvelope {
  targetRoomId?: string
  targetPeerId?: string
  excludePeerId?: string
  event: TesseractServerEvent
}

export function normalizeIpAddress(raw?: string | null): string {
  if (!raw) return ''
  let ip = raw.trim()
  if (!ip) return ''

  // Strip enclosing IPv6 brackets and optional :port, e.g. "[::1]:3000"
  if (ip.startsWith('[')) {
    const endBracket = ip.indexOf(']')
    if (endBracket !== -1) {
      ip = ip.slice(1, endBracket)
    }
  } else if (ip.includes('.') && ip.includes(':')) {
    // Strip IPv4 :port (e.g. "192.168.1.50:54321") while leaving IPv6 intact
    const lastColon = ip.lastIndexOf(':')
    if (lastColon > ip.lastIndexOf('.')) {
      ip = ip.slice(0, lastColon)
    }
  }

  // Strip IPv6 zone identifier (e.g. "fe80::1%eth0")
  const zoneIdx = ip.indexOf('%')
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx)
  }

  ip = ip.toLowerCase()

  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }

  return ip
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const val = Number(part)
    if (val < 0 || val > 255) return null
    nums.push(val)
  }
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!]
}

export function isPrivateOrLoopbackIp(rawIp: string): boolean {
  const ip = normalizeIpAddress(rawIp)
  if (!ip) return false

  if (ip === '::1' || ip === 'localhost') return true

  const octets = parseIpv4Octets(ip)
  if (octets) {
    const [a, b] = octets
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 10) return true // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT / Tailscale LAN
    return false
  }

  // IPv6 private / link-local / ULA prefixes
  if (ip.includes(':')) {
    const firstHextet = ip.split(':')[0] || ''
    if (firstHextet.startsWith('fc') || firstHextet.startsWith('fd')) return true
    if (
      firstHextet.startsWith('fe8') ||
      firstHextet.startsWith('fe9') ||
      firstHextet.startsWith('fea') ||
      firstHextet.startsWith('feb')
    ) {
      return true
    }
  }

  return false
}

export function isPrivateLanOrigin(originUrl: string): boolean {
  try {
    const parsed = new URL(originUrl)
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local')) {
      return true
    }
    return isPrivateOrLoopbackIp(host)
  } catch {
    return false
  }
}

export function extractClientIp(request: Request, remoteAddress?: string | null): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    const normalized = normalizeIpAddress(first)
    if (normalized) return normalized
  }

  const cfIp = normalizeIpAddress(request.headers.get('cf-connecting-ip'))
  if (cfIp) return cfIp

  const realIp = normalizeIpAddress(request.headers.get('x-real-ip'))
  if (realIp) return realIp

  return normalizeIpAddress(remoteAddress)
}

function getIpv6Prefix64(ip: string): string {
  // Expand :: shorthand enough to extract first 4 hextets for /64 subnet grouping
  const halves = ip.split('::')
  if (halves.length === 1) {
    return ip
      .split(':')
      .slice(0, 4)
      .map((h) => h.padStart(4, '0'))
      .join(':')
  }
  const left = (halves[0] || '').split(':').filter(Boolean)
  const right = (halves[1] || '').split(':').filter(Boolean)
  const missing = Math.max(0, 8 - left.length - right.length)
  const full = [...left, ...Array(missing).fill('0'), ...right]
  return full
    .slice(0, 4)
    .map((h) => h.padStart(4, '0'))
    .join(':')
}

export function resolveLanLobbyId(rawIp: string): {
  roomId: string
  lanScope: 'lan' | 'nat'
} {
  const ip = normalizeIpAddress(rawIp)
  if (!ip) {
    return {
      roomId: `lan:isolated:${crypto.randomUUID()}`,
      lanScope: 'nat',
    }
  }

  if (isPrivateOrLoopbackIp(ip)) {
    return {
      roomId: 'lan:local',
      lanScope: 'lan',
    }
  }

  if (ip.includes(':')) {
    return {
      roomId: `lan:nat:${getIpv6Prefix64(ip)}`,
      lanScope: 'nat',
    }
  }

  return {
    roomId: `lan:nat:${ip}`,
    lanScope: 'nat',
  }
}

function sanitizeAlias(raw?: string | null, fallback = 'LAN Device'): string {
  const cleaned = (raw || '').replace(/[\r\n\t]+/g, ' ').trim()
  if (!cleaned) return fallback
  return cleaned.slice(0, 40)
}

function sanitizeClientId(raw?: string | null): string | undefined {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned || undefined
}

function normalizeDeviceType(raw?: string | null): TesseractDeviceType {
  if (raw === 'mobile' || raw === 'tablet' || raw === 'desktop') return raw
  return 'desktop'
}

function getRoomPeersKey(roomId: string): string {
  return `tesseract:room:${roomId}:peers`
}

function getPeerAliveKey(peerId: string): string {
  return `tesseract:peer:${peerId}:alive`
}

function getSseSecretKey(peerId: string): string {
  return `tesseract:peer:${peerId}:sse`
}

interface TesseractStore {
  putPeer(roomId: string, peer: TesseractPeer): Promise<void>
  getPeer(roomId: string, peerId: string): Promise<TesseractPeer | null>
  getPeerRoomId(peerId: string): Promise<string | null>
  removePeer(roomId: string, peerId: string): Promise<void>
  refreshPeerAlive(peerId: string, roomId: string): Promise<void>
  listAlivePeers(roomId: string): Promise<{ alive: TesseractPeer[]; prunedPeerIds: string[] }>
  setSseSecret(peerId: string, secret: string): Promise<void>
  getSseSecret(peerId: string): Promise<string | null>
  deleteSseSecret(peerId: string): Promise<void>
  publishBus(envelope: BusEnvelope): Promise<void>
}

class MemoryTesseractStore implements TesseractStore {
  private roomPeers = new Map<string, Map<string, TesseractPeer>>()
  private alivePeers = new Map<string, { roomId: string; expiresAt: number }>()
  private sseSecrets = new Map<string, string>()
  private emitter = new EventEmitter()

  constructor(onBus: (envelope: BusEnvelope) => void) {
    this.emitter.on('bus', onBus)
  }

  reset() {
    this.roomPeers.clear()
    this.alivePeers.clear()
    this.sseSecrets.clear()
  }

  async putPeer(roomId: string, peer: TesseractPeer): Promise<void> {
    let map = this.roomPeers.get(roomId)
    if (!map) {
      map = new Map()
      this.roomPeers.set(roomId, map)
    }
    map.set(peer.peerId, peer)
    await this.refreshPeerAlive(peer.peerId, roomId)
  }

  async getPeer(roomId: string, peerId: string): Promise<TesseractPeer | null> {
    return this.roomPeers.get(roomId)?.get(peerId) ?? null
  }

  async getPeerRoomId(peerId: string): Promise<string | null> {
    const entry = this.alivePeers.get(peerId)
    if (!entry || entry.expiresAt <= Date.now()) return null
    return entry.roomId
  }

  async removePeer(roomId: string, peerId: string): Promise<void> {
    const map = this.roomPeers.get(roomId)
    if (map) {
      map.delete(peerId)
      if (map.size === 0) {
        this.roomPeers.delete(roomId)
      }
    }
    this.alivePeers.delete(peerId)
    this.sseSecrets.delete(peerId)
  }

  async refreshPeerAlive(peerId: string, roomId: string): Promise<void> {
    this.alivePeers.set(peerId, {
      roomId,
      expiresAt: Date.now() + PEER_TTL_SECONDS * 1000,
    })
  }

  async listAlivePeers(
    roomId: string
  ): Promise<{ alive: TesseractPeer[]; prunedPeerIds: string[] }> {
    const map = this.roomPeers.get(roomId)
    if (!map || map.size === 0) return { alive: [], prunedPeerIds: [] }

    const now = Date.now()
    const alive: TesseractPeer[] = []
    const prunedPeerIds: string[] = []

    for (const [peerId, peer] of map.entries()) {
      const entry = this.alivePeers.get(peerId)
      if (!entry || entry.expiresAt <= now) {
        prunedPeerIds.push(peerId)
        map.delete(peerId)
        this.alivePeers.delete(peerId)
      } else {
        alive.push(peer)
      }
    }

    return { alive, prunedPeerIds }
  }

  async setSseSecret(peerId: string, secret: string): Promise<void> {
    this.sseSecrets.set(peerId, secret)
  }

  async getSseSecret(peerId: string): Promise<string | null> {
    return this.sseSecrets.get(peerId) ?? null
  }

  async deleteSseSecret(peerId: string): Promise<void> {
    this.sseSecrets.delete(peerId)
  }

  async publishBus(envelope: BusEnvelope): Promise<void> {
    this.emitter.emit('bus', envelope)
  }
}

class RedisTesseractStore implements TesseractStore {
  private pub: Redis
  private sub: Redis
  private subReady: Promise<void>

  constructor(
    redisConfig: {
      host: string
      port: number
      password?: string
      db: number
    },
    onBus: (envelope: BusEnvelope) => void
  ) {
    const common = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    }

    this.pub = new Redis(common)
    this.sub = new Redis(common)

    this.pub.on('error', (err) => {
      logger.warn(`Tesseract Redis pub error: ${err.message}`)
    })
    this.sub.on('error', (err) => {
      logger.warn(`Tesseract Redis sub error: ${err.message}`)
    })

    this.sub.on('message', (channel, message) => {
      if (channel !== REDIS_BUS_CHANNEL) return
      try {
        const envelope = JSON.parse(message) as BusEnvelope
        onBus(envelope)
      } catch {}
    })

    this.subReady = this.sub.subscribe(REDIS_BUS_CHANNEL).then(() => undefined)
  }

  async putPeer(roomId: string, peer: TesseractPeer): Promise<void> {
    const peersKey = getRoomPeersKey(roomId)
    await this.pub
      .multi()
      .hset(peersKey, peer.peerId, JSON.stringify(peer))
      .expire(peersKey, PEER_HASH_TTL_SECONDS)
      .set(getPeerAliveKey(peer.peerId), roomId, 'EX', PEER_TTL_SECONDS)
      .exec()
  }

  async getPeer(roomId: string, peerId: string): Promise<TesseractPeer | null> {
    const raw = await this.pub.hget(getRoomPeersKey(roomId), peerId)
    if (!raw) return null
    try {
      return JSON.parse(raw) as TesseractPeer
    } catch {
      return null
    }
  }

  async getPeerRoomId(peerId: string): Promise<string | null> {
    return await this.pub.get(getPeerAliveKey(peerId))
  }

  async removePeer(roomId: string, peerId: string): Promise<void> {
    await this.pub
      .multi()
      .hdel(getRoomPeersKey(roomId), peerId)
      .del(getPeerAliveKey(peerId))
      .del(getSseSecretKey(peerId))
      .exec()
  }

  async refreshPeerAlive(peerId: string, roomId: string): Promise<void> {
    await this.pub
      .multi()
      .set(getPeerAliveKey(peerId), roomId, 'EX', PEER_TTL_SECONDS)
      .expire(getRoomPeersKey(roomId), PEER_HASH_TTL_SECONDS)
      .exec()
  }

  async listAlivePeers(
    roomId: string
  ): Promise<{ alive: TesseractPeer[]; prunedPeerIds: string[] }> {
    const peersKey = getRoomPeersKey(roomId)
    const rawEntries = await this.pub.hgetall(peersKey)
    const peerIds = Object.keys(rawEntries)
    if (peerIds.length === 0) return { alive: [], prunedPeerIds: [] }

    const pipeline = this.pub.pipeline()
    for (const id of peerIds) {
      pipeline.exists(getPeerAliveKey(id))
    }
    const existsRes = await pipeline.exec()

    const alive: TesseractPeer[] = []
    const prunedPeerIds: string[] = []

    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i]!
      const existsTuple = existsRes?.[i]
      const isAlive = existsTuple && existsTuple[1] === 1
      if (!isAlive) {
        prunedPeerIds.push(peerId)
        continue
      }
      try {
        alive.push(JSON.parse(rawEntries[peerId]!) as TesseractPeer)
      } catch {
        prunedPeerIds.push(peerId)
      }
    }

    if (prunedPeerIds.length > 0) {
      await this.pub.hdel(peersKey, ...prunedPeerIds)
    }

    return { alive, prunedPeerIds }
  }

  async setSseSecret(peerId: string, secret: string): Promise<void> {
    await this.pub.set(getSseSecretKey(peerId), secret, 'EX', PEER_HASH_TTL_SECONDS)
  }

  async getSseSecret(peerId: string): Promise<string | null> {
    return await this.pub.get(getSseSecretKey(peerId))
  }

  async deleteSseSecret(peerId: string): Promise<void> {
    await this.pub.del(getSseSecretKey(peerId))
  }

  async publishBus(envelope: BusEnvelope): Promise<void> {
    await this.subReady
    await this.pub.publish(REDIS_BUS_CHANNEL, JSON.stringify(envelope))
  }
  async disconnect(): Promise<void> {
    try {
      await this.sub.unsubscribe(REDIS_BUS_CHANNEL)
    } catch {}
    try {
      this.pub.disconnect()
      this.sub.disconnect()
    } catch {}
  }
}

interface LocalPeerSession {
  peer: TesseractPeer
  roomId: string
  transport: TesseractPeerTransport
}

export class TesseractServ {
  private static instance: TesseractServ

  private store: TesseractStore | null = null
  private localPeers = new Map<string, LocalPeerSession>()
  private socketKeyToPeerId = new WeakMap<object, string>()
  private closedTransportKeys = new WeakSet<object>()
  private tabIdToPeerId = new Map<string, string>()
  private peerIdToTabId = new Map<string, string>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  public static getInstance(): TesseractServ {
    if (!TesseractServ.instance) {
      TesseractServ.instance = new TesseractServ()
    }
    return TesseractServ.instance
  }

  private getStore(): TesseractStore {
    if (this.store) return this.store

    const onBus = (envelope: BusEnvelope) => this.handleBusEnvelope(envelope)
    const isTest =
      Bun.env.BUN_ENV === 'test' ||
      Bun.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'test'
    const redisHost = Bun.env.REDIS_HOST
    const redisPort = Bun.env.REDIS_PORT

    if (!isTest && redisHost && redisPort) {
      this.store = new RedisTesseractStore(
        {
          host: redisHost,
          port: Number(redisPort),
          password: Bun.env.REDIS_PASSWORD || undefined,
          db: Bun.env.REDIS_DB ? Number(Bun.env.REDIS_DB) : 0,
        },
        onBus
      )
    } else {
      this.store = new MemoryTesseractStore(onBus)
    }

    if (!this.cleanupTimer && !isTest) {
      this.cleanupTimer = setInterval(() => {
        void this.pruneActiveRooms()
      }, 20_000)
    }

    return this.store
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.store instanceof RedisTesseractStore) {
      await this.store.disconnect()
    }
    this.store = null
  }

  public resetForTests(): void {
    for (const [peerId, session] of this.localPeers.entries()) {
      try {
        session.transport.close?.(1000, 'Reset')
      } catch {}
      this.localPeers.delete(peerId)
    }
    this.tabIdToPeerId.clear()
    this.peerIdToTabId.clear()
    if (this.store instanceof MemoryTesseractStore) {
      this.store.reset()
    } else {
      this.store = null
    }
  }

  private handleBusEnvelope(envelope: BusEnvelope): void {
    // Keep local peer metadata in sync when another cluster worker updates or disconnects a peer
    if (envelope.event.event === 'peer:updated') {
      const updatedPeer = envelope.event.data.peer
      const localSession = this.localPeers.get(updatedPeer.peerId)
      if (localSession) {
        localSession.peer = updatedPeer
      }
    } else if (envelope.event.event === 'peer:left') {
      const leftPeerId = envelope.event.data.peerId
      const localSession = this.localPeers.get(leftPeerId)
      if (localSession) {
        this.localPeers.delete(leftPeerId)
        try {
          localSession.transport.close?.(1000, 'Left')
        } catch {}
      }
    }

    const serialized = JSON.stringify(envelope.event)

    if (envelope.targetPeerId) {
      const session = this.localPeers.get(envelope.targetPeerId)
      if (session) {
        try {
          session.transport.send(serialized)
        } catch (err) {
          logger.warn(`Failed sending to peer ${envelope.targetPeerId}: ${err}`)
        }
      }
      return
    }

    if (envelope.targetRoomId) {
      for (const session of this.localPeers.values()) {
        if (session.roomId !== envelope.targetRoomId) continue
        if (envelope.excludePeerId && session.peer.peerId === envelope.excludePeerId) {
          continue
        }
        try {
          session.transport.send(serialized)
        } catch (err) {
          logger.warn(`Failed broadcasting to peer ${session.peer.peerId}: ${err}`)
        }
      }
    }
  }

  private async pruneActiveRooms(): Promise<void> {
    const store = this.getStore()
    const roomIds = new Set<string>()
    for (const session of this.localPeers.values()) {
      roomIds.add(session.roomId)
    }

    for (const roomId of roomIds) {
      try {
        const { prunedPeerIds } = await store.listAlivePeers(roomId)
        for (const prunedId of prunedPeerIds) {
          await store.publishBus({
            targetRoomId: roomId,
            event: {
              event: 'peer:left',
              data: { peerId: prunedId },
              timestamp: Date.now(),
            },
          })
        }
      } catch {}
    }
  }

  private async resolveAuthenticatedPeerUser(
    request: Request
  ): Promise<TesseractPeerUser | null> {
    try {
      const { user } = await resolveSessionFromRequest(request)
      if (!user) return null

      let displayName = user.username
      let avatarUrl: string | null = null

      try {
        const dbUser = await prisma.orm.public.User
          .select('id', 'username', 'customization')
          .first({ id: user.id })
        if (dbUser) {
          const profile = getProfileCustomization(dbUser.customization)
          displayName = profile.displayName || dbUser.username
          avatarUrl = profile.avatarUrl ?? null
        }
      } catch {
        // Fallback cleanly to session user if profile query is unavailable (e.g., unit tests)
      }

      return {
        id: user.id,
        username: user.username,
        displayName,
        avatarUrl,
      }
    } catch {
      return null
    }
  }

  public async getIdentity(request: Request, remoteAddress?: string | null) {
    const clientIp = extractClientIp(request, remoteAddress)
    const { roomId, lanScope } = resolveLanLobbyId(clientIp)
    const user = await this.resolveAuthenticatedPeerUser(request)

    return {
      isAuthenticated: user !== null,
      user,
      lanRoomId: roomId,
      lanScope,
    }
  }

  public async connectPeer(params: {
    transport: TesseractPeerTransport
    transportKey?: object
    request: Request
    remoteAddress?: string | null
    deviceId?: string | null
    tabId?: string | null
    alias?: string | null
    deviceType?: string | null
    os?: string | null
    browser?: string | null
    requireShelfApproval?: boolean
    issueSseSecret?: boolean
    isAborted?: () => boolean
  }): Promise<{ peerId: string; sseSecret?: string } | null> {
    const isCancelled = () =>
      Boolean(
        params.isAborted?.() ||
          (params.transportKey && this.closedTransportKeys.has(params.transportKey))
      )

    if (isCancelled()) return null

    const store = this.getStore()
    const verifiedUser = await this.resolveAuthenticatedPeerUser(params.request)
    if (isCancelled()) return null

    const clientIp = extractClientIp(params.request, params.remoteAddress)
    const { roomId, lanScope } = resolveLanLobbyId(clientIp)
    const roomInfo: TesseractRoomInfo = {
      roomId,
      lanScope,
    }

    const tabId = sanitizeClientId(params.tabId)
    if (tabId) {
      const previousPeerId = this.tabIdToPeerId.get(tabId)
      if (previousPeerId) {
        await this.disconnectPeer(previousPeerId)
      }
    }
    if (isCancelled()) return null

    const peerId = crypto.randomUUID()
    const deviceId = sanitizeClientId(params.deviceId)
    const defaultAlias = verifiedUser?.displayName
      ? `${verifiedUser.displayName}'s ${params.os || 'Device'}`
      : `${params.os || 'Local'} ${params.browser || 'Browser'}`

    const peer: TesseractPeer = {
      peerId,
      deviceId,
      alias: sanitizeAlias(params.alias, defaultAlias),
      deviceType: normalizeDeviceType(params.deviceType),
      os: (params.os || 'Unknown OS').slice(0, 32),
      browser: (params.browser || 'Browser').slice(0, 32),
      isAuthenticated: verifiedUser !== null,
      user: verifiedUser,
      // Only authenticated users may enable shelf download approval gating
      requireShelfApproval: Boolean(verifiedUser && params.requireShelfApproval),
      joinedAt: Date.now(),
    }

    await store.putPeer(roomInfo.roomId, peer)

    let sseSecret: string | undefined
    if (params.issueSseSecret) {
      sseSecret = randomBytes(24).toString('hex')
      await store.setSseSecret(peerId, sseSecret)
    }

    if (isCancelled()) {
      await store.removePeer(roomInfo.roomId, peerId)
      return null
    }

    this.localPeers.set(peerId, {
      peer,
      roomId: roomInfo.roomId,
      transport: params.transport,
    })

    if (params.transportKey) {
      this.socketKeyToPeerId.set(params.transportKey, peerId)
    }
    if (tabId) {
      this.tabIdToPeerId.set(tabId, peerId)
      this.peerIdToTabId.set(peerId, tabId)
    }

    const { alive, prunedPeerIds } = await store.listAlivePeers(roomInfo.roomId)
    for (const prunedId of prunedPeerIds) {
      await store.publishBus({
        targetRoomId: roomInfo.roomId,
        event: {
          event: 'peer:left',
          data: { peerId: prunedId },
          timestamp: Date.now(),
        },
      })
    }

    const existingPeers = alive.filter((p) => p.peerId !== peerId)

    const joinedEvent: TesseractServerEvent = {
      event: 'room:joined',
      data: {
        selfPeerId: peerId,
        selfPeer: peer,
        room: roomInfo,
        peers: existingPeers,
      },
      timestamp: Date.now(),
    }

    params.transport.send(
      JSON.stringify(sseSecret ? { ...joinedEvent, sseSecret } : joinedEvent)
    )

    await store.publishBus({
      targetRoomId: roomInfo.roomId,
      excludePeerId: peerId,
      event: {
        event: 'peer:joined',
        data: { peer },
        timestamp: Date.now(),
      },
    })

    return { peerId, sseSecret }
  }

  public getPeerIdByTransportKey(key: object): string | undefined {
    return this.socketKeyToPeerId.get(key)
  }

  public async verifySseSignalAccess(peerId: string, secret: string): Promise<boolean> {
    if (!peerId || !secret) return false
    const store = this.getStore()
    const expected = await store.getSseSecret(peerId)
    if (!expected) return false
    const a = Buffer.from(secret)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  public async handleClientSignal(peerId: string, rawMessage: unknown): Promise<void> {
    const store = this.getStore()
    let session = this.localPeers.get(peerId)
    let peer: TesseractPeer | null = session?.peer ?? null
    let roomId: string | null = session?.roomId ?? null

    if (!session) {
      roomId = await store.getPeerRoomId(peerId)
      if (!roomId) return
      peer = await store.getPeer(roomId, peerId)
      if (!peer) return
    }

    if (!peer || !roomId) return

    let parsed: unknown = rawMessage
    if (typeof rawMessage === 'string') {
      try {
        parsed = JSON.parse(rawMessage)
      } catch {
        return
      }
    }

    if (!parsed || typeof parsed !== 'object') return
    const msg = parsed as TesseractClientSignal

    const sendToSelf = async (event: TesseractServerEvent) => {
      if (session) {
        session.transport.send(JSON.stringify(event))
      } else {
        await store.publishBus({ targetPeerId: peerId, event })
      }
    }

    switch (msg.type) {
      case 'ping': {
        await store.refreshPeerAlive(peerId, roomId)
        await sendToSelf({
          event: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        })
        return
      }

      case 'leave': {
        await this.disconnectPeer(peerId)
        return
      }

      case 'peer:update': {
        const updated: TesseractPeer = {
          ...peer,
          alias: msg.alias !== undefined ? sanitizeAlias(msg.alias, peer.alias) : peer.alias,
          requireShelfApproval:
            msg.requireShelfApproval !== undefined
              ? Boolean(peer.isAuthenticated && msg.requireShelfApproval)
              : peer.requireShelfApproval,
        }
        if (session) {
          session.peer = updated
        }
        await store.putPeer(roomId, updated)
        await store.publishBus({
          targetRoomId: roomId,
          event: {
            event: 'peer:updated',
            data: { peer: updated },
            timestamp: Date.now(),
          },
        })
        return
      }

      case 'rtc:offer':
      case 'rtc:answer':
      case 'rtc:ice': {
        if (!msg.toPeerId || typeof msg.toPeerId !== 'string') return
        const target = await store.getPeer(roomId, msg.toPeerId)
        if (!target) return

        const event: TesseractServerEvent =
          msg.type === 'rtc:offer'
            ? {
                event: 'rtc:offer',
                data: { fromPeerId: peerId, sdp: msg.sdp },
                timestamp: Date.now(),
              }
            : msg.type === 'rtc:answer'
              ? {
                  event: 'rtc:answer',
                  data: { fromPeerId: peerId, sdp: msg.sdp },
                  timestamp: Date.now(),
                }
              : {
                  event: 'rtc:ice',
                  data: { fromPeerId: peerId, candidate: msg.candidate },
                  timestamp: Date.now(),
                }

        await store.publishBus({
          targetPeerId: msg.toPeerId,
          event,
        })
        return
      }

      case 'direct:offer': {
        // Server-side enforcement: Direct Send is strictly for logged-in IRIS users
        if (!peer.isAuthenticated || !peer.user) {
          await sendToSelf({
            event: 'room:error',
            data: {
              code: 'UNAUTHORIZED',
              message: 'Sign in to an IRIS account to use Direct Send.',
            },
            timestamp: Date.now(),
          })
          return
        }

        if (!msg.toPeerId || !msg.offerId || !Array.isArray(msg.items)) return
        const target = await store.getPeer(roomId, msg.toPeerId)
        if (!target) return

        await store.publishBus({
          targetPeerId: msg.toPeerId,
          event: {
            event: 'direct:offer',
            data: {
              offerId: String(msg.offerId).slice(0, 64),
              fromPeerId: peerId,
              fromAlias: peer.alias,
              // Always stamped server-side so receivers can trust same-account auto-accept
              fromUserId: peer.user.id,
              fromUser: peer.user,
              toPeerId: msg.toPeerId,
              items: msg.items.slice(0, 500),
              totalBytes: Number(msg.totalBytes) || 0,
              createdAt: Date.now(),
            },
            timestamp: Date.now(),
          },
        })
        return
      }

      case 'direct:response': {
        if (!msg.toPeerId || !msg.offerId) return
        const target = await store.getPeer(roomId, msg.toPeerId)
        if (!target) return

        await store.publishBus({
          targetPeerId: msg.toPeerId,
          event: {
            event: 'direct:response',
            data: {
              offerId: String(msg.offerId).slice(0, 64),
              fromPeerId: peerId,
              toPeerId: msg.toPeerId,
              accepted: Boolean(msg.accepted),
              autoAccepted: Boolean(msg.autoAccepted),
              reason: msg.reason ? String(msg.reason).slice(0, 160) : undefined,
            },
            timestamp: Date.now(),
          },
        })
      }
    }
  }

  public async disconnectPeer(peerIdOrTransportKey: string | object): Promise<void> {
    let peerId: string | undefined
    if (typeof peerIdOrTransportKey === 'string') {
      peerId = peerIdOrTransportKey
    } else {
      this.closedTransportKeys.add(peerIdOrTransportKey)
      peerId = this.socketKeyToPeerId.get(peerIdOrTransportKey)
      this.socketKeyToPeerId.delete(peerIdOrTransportKey)
    }

    if (!peerId) return
    const tabId = this.peerIdToTabId.get(peerId)
    if (tabId) {
      this.peerIdToTabId.delete(peerId)
      if (this.tabIdToPeerId.get(tabId) === peerId) {
        this.tabIdToPeerId.delete(tabId)
      }
    }

    const store = this.getStore()
    const session = this.localPeers.get(peerId)
    let roomId = session?.roomId ?? null
    if (!roomId) {
      roomId = await store.getPeerRoomId(peerId)
    }
    if (!roomId) return

    this.localPeers.delete(peerId)
    await store.removePeer(roomId, peerId)
    await store.publishBus({
      targetRoomId: roomId,
      excludePeerId: peerId,
      event: {
        event: 'peer:left',
        data: { peerId },
        timestamp: Date.now(),
      },
    })
  }
}

export const tesseractServ = TesseractServ.getInstance()
