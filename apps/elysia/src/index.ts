import cluster from 'node:cluster'
import os from 'node:os'
import process from 'node:process'
import { LogFactory } from '@Iris/logger'
import { MediaQueueManager } from './services/borealis/queue'
import { app, type App, startServer } from './server'

export { app, type App, startServer }
export { wsHub, WsServ, type IrisWebSocket } from './services/ws.serv'
export * from './types/media-details'

const logger = new LogFactory('Elysia:Cluster')

const isTest = process.env.NODE_ENV === 'test'
const isClusteringEnabled = !isTest && process.env.CLUSTER !== 'false'

if (isClusteringEnabled && cluster.isPrimary) {
  const availableCpus = os.availableParallelism()
  const numWorkers = process.env.CLUSTER_WORKERS
    ? Math.max(1, parseInt(process.env.CLUSTER_WORKERS, 10))
    : availableCpus

  logger.info(
    `Cluster primary ${process.pid} running on ${os.platform()} (${availableCpus} CPU cores available)`
  )
  logger.info(`Forking ${numWorkers} multi-threaded Elysia worker processes (reusePort enabled)...`)

  // Initialize singleton background media worker & weekly cron in the primary process only
  MediaQueueManager.initWorkerAndSchedule().catch((err) => {
    logger.warn(`MediaQueue initialization notice: ${err?.message || err}`)
  })

  // Spawn cluster workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  // Auto-restart failed workers for high availability
  let isShuttingDown = false
  cluster.on('exit', (worker, code, signal) => {
    if (!isShuttingDown) {
      logger.warn(
        `Worker ${worker.process.pid} exited (code: ${code}, signal: ${signal}). Spawning replacement worker...`
      )
      cluster.fork()
    }
  })

  // Graceful cluster shutdown
  const handlePrimaryShutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true
    logger.info(`Primary ${process.pid} received ${signal}. Stopping all workers gracefully...`)

    try {
      await MediaQueueManager.shutdown()
    } catch {}

    for (const id in cluster.workers) {
      const worker = cluster.workers[id]
      if (worker && !worker.isDead()) {
        worker.kill(signal as NodeJS.Signals)
      }
    }

    process.exit(0)
  }

  process.on('SIGTERM', () => handlePrimaryShutdown('SIGTERM'))
  process.on('SIGINT', () => handlePrimaryShutdown('SIGINT'))
} else if (!isTest) {
  // If in worker process or single-process mode (CLUSTER=false)
  if (!isClusteringEnabled) {
    // In non-clustered mode, initialize background cron directly
    MediaQueueManager.initWorkerAndSchedule().catch((err) => {
      logger.warn(`MediaQueue initialization notice: ${err?.message || err}`)
    })
  }

  startServer()
}