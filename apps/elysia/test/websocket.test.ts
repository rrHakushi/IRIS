import { describe, it, expect, beforeEach } from 'bun:test'
import { WsServ, type IrisWebSocket } from '../src/services/ws.serv'
import { app } from '../src/server'

describe('WebSocket Server & WsServ Test Suite', () => {
  let wsServ: WsServ

  beforeEach(() => {
    wsServ = WsServ.getInstance()
  })

  it('registers and unregisters a client connection with userId', () => {
    const sentMessages: string[] = []
    const mockWs: IrisWebSocket = {
      send(data: string) {
        sentMessages.push(data)
      },
    }

    wsServ.register(mockWs, 'user-123')
    expect(wsServ.hasConnection(mockWs)).toBe(true)
    expect(wsServ.getUserId(mockWs)).toBe('user-123')

    // Broadcast to user-123
    wsServ.sendToUser('user-123', 'test:event', { foo: 'bar' })
    expect(sentMessages.length).toBe(1)
    const payload = JSON.parse(sentMessages[0]!)
    expect(payload.event).toBe('test:event')
    expect(payload.data).toEqual({ foo: 'bar' })
    expect(payload.channel).toBe('user:user-123')

    // Unregister
    wsServ.unregister(mockWs)
    expect(wsServ.hasConnection(mockWs)).toBe(false)
  })

  it('handles client subscription and unsubscription to channels', () => {
    const sentMessages: string[] = []
    const mockWs: IrisWebSocket = {
      send(data: string) {
        sentMessages.push(data)
      },
    }

    wsServ.register(mockWs, 'user-456')
    wsServ.subscribe(mockWs, 'media:live')

    wsServ.broadcastChannel('media:live', 'media:update', { id: 100 })
    expect(sentMessages.length).toBe(1)
    const payload = JSON.parse(sentMessages[0]!)
    expect(payload.event).toBe('media:update')
    expect(payload.channel).toBe('media:live')

    // Unsubscribe
    wsServ.unsubscribe(mockWs, 'media:live')
    wsServ.broadcastChannel('media:live', 'media:update', { id: 101 })
    // No new message received
    expect(sentMessages.length).toBe(1)

    wsServ.unregister(mockWs)
  })

  it('handles incoming message frames (auth, ping, subscribe, unsubscribe)', () => {
    const sentMessages: string[] = []
    const mockWs: IrisWebSocket = {
      send(data: string) {
        sentMessages.push(data)
      },
    }

    // Ping frame
    wsServ.handleMessage(mockWs, JSON.stringify({ type: 'ping' }))
    expect(sentMessages.length).toBe(1)
    const pong = JSON.parse(sentMessages[0]!)
    expect(pong.event).toBe('pong')
    expect(typeof pong.data.timestamp).toBe('number')

    // Auth frame
    wsServ.handleMessage(mockWs, JSON.stringify({ type: 'auth', userId: 'user-789' }))
    expect(sentMessages.length).toBe(2)
    const authSuccess = JSON.parse(sentMessages[1]!)
    expect(authSuccess.event).toBe('auth:success')
    expect(authSuccess.data.userId).toBe('user-789')
    expect(wsServ.getUserId(mockWs)).toBe('user-789')

    // Subscribe frame
    wsServ.handleMessage(mockWs, JSON.stringify({ type: 'subscribe', channel: 'notifications' }))
    expect(sentMessages.length).toBe(3)
    const subSuccess = JSON.parse(sentMessages[2]!)
    expect(subSuccess.event).toBe('subscribed')

    // Unsubscribe frame
    wsServ.handleMessage(mockWs, JSON.stringify({ type: 'unsubscribe', channel: 'notifications' }))
    expect(sentMessages.length).toBe(4)
    const unsubSuccess = JSON.parse(sentMessages[3]!)
    expect(unsubSuccess.event).toBe('unsubscribed')

    wsServ.unregister(mockWs)
  })

  it('broadcasts to all active connections', () => {
    const sent1: string[] = []
    const sent2: string[] = []
    const ws1: IrisWebSocket = { send: (d) => sent1.push(d) }
    const ws2: IrisWebSocket = { send: (d) => sent2.push(d) }

    wsServ.register(ws1, 'user-a')
    wsServ.register(ws2, 'user-b')

    wsServ.broadcast('system:alert', { message: 'Maintenance in 5 mins' })

    expect(sent1.length).toBe(1)
    expect(sent2.length).toBe(1)
    expect(JSON.parse(sent1[0]!).event).toBe('system:alert')
    expect(JSON.parse(sent2[0]!).event).toBe('system:alert')

    wsServ.unregister(ws1)
    wsServ.unregister(ws2)
  })
})
