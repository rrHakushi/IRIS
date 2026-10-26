import { describe, it, beforeEach, afterEach, expect } from "bun:test"
import assert from "node:assert/strict"
import { LogFactory, type LogEntry } from "../src/index.js"

describe("LogFactory (@Iris/logger)", () => {
  const originalEnv = { ...Bun.env }

  beforeEach(() => {
    Object.assign(Bun.env, originalEnv)
    LogFactory.clearSink()
    LogFactory.setLevel("debug")
  })

  afterEach(() => {
    Object.assign(Bun.env, originalEnv)
    LogFactory.clearSink()
  })

  it("instantiates LogFactory with module name and exposes info, warn, error, debug, success, json", () => {
    const logger = new LogFactory("Auth")
    assert.equal(logger.module, "Auth")
    assert.equal(logger.fullModulePath, "Auth")
    assert.equal(typeof logger.info, "function")
    assert.equal(typeof logger.warn, "function")
    assert.equal(typeof logger.error, "function")
    assert.equal(typeof logger.debug, "function")
    assert.equal(typeof logger.success, "function")
    assert.equal(typeof logger.child, "function")
    assert.equal(typeof logger.json, "function")
    assert.equal(typeof logger.json.info, "function")
    assert.equal(typeof logger.json.warn, "function")
    assert.equal(typeof logger.json.error, "function")
    assert.equal(typeof logger.json.debug, "function")
    assert.equal(typeof logger.json.success, "function")
  })

  it("supports static LogFactory.create() factory method", () => {
    const logger = LogFactory.create("Database")
    assert.equal(logger.module, "Database")
    assert.equal(logger.fullModulePath, "Database")
  })

  it("captures structured entries via LogFactory.setSink", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    const logger = new LogFactory("Auth")
    logger.info("User logged in", { userId: "user-123" })

    assert.equal(captured.length, 1)
    const entry = captured[0]!
    assert.equal(entry.level, "info")
    assert.equal(entry.module, "Auth")
    assert.match(entry.formatted, /User logged in/)
    assert.match(entry.formatted, /user-123/)
    assert.ok(entry.timestamp instanceof Date)
  })

  it("creates hierarchical child loggers with nested module paths", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    const rootLogger = new LogFactory("MediaQueue")
    const childLogger = rootLogger.child("AniList")

    assert.equal(childLogger.module, "AniList")
    assert.equal(childLogger.fullModulePath, "MediaQueue][AniList")

    childLogger.warn("Rate limited, backing off")
    assert.equal(captured.length, 1)
    assert.equal(captured[0]!.module, "MediaQueue][AniList")
    assert.equal(captured[0]!.level, "warn")
  })

  it("supports parentModule option with string name or parent logger instance", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    // String parentModule
    const subLogger1 = new LogFactory("SubModule", {
      parentModule: "ElysiaMain",
    })
    assert.equal(subLogger1.fullModulePath, "ElysiaMain][SubModule")

    // Instance parentModule
    const parentLogger = new LogFactory("ElysiaMain")
    const subLogger2 = new LogFactory("Controller", {
      parentModule: parentLogger,
    })
    assert.equal(subLogger2.fullModulePath, "ElysiaMain][Controller")

    subLogger2.info("Loaded routes")
    assert.equal(captured[0]!.module, "ElysiaMain][Controller")
  })

  it("logs formatted JSON using logger.json() and sub-levels", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    const logger = new LogFactory("Api")
    logger.json({ msg: "Test", count: 42 })

    assert.equal(captured.length, 1)
    assert.equal(captured[0]!.level, "info")
    assert.match(captured[0]!.formatted, /"msg"/)
    assert.match(captured[0]!.formatted, /"Test"/)
    assert.match(captured[0]!.formatted, /42/)

    // With title
    logger.json("Payload data", { status: "ok" })
    assert.equal(captured.length, 2)
    assert.match(captured[1]!.formatted, /Payload data/)
    assert.match(captured[1]!.formatted, /"status"/)

    // With error level
    logger.json.error({ error: "Unauthorized" })
    assert.equal(captured.length, 3)
    assert.equal(captured[2]!.level, "error")
    assert.match(captured[2]!.formatted, /"Unauthorized"/)
  })

  it("respects log level filtering", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    LogFactory.setLevel("error")
    const logger = new LogFactory("Test")

    logger.debug("Debug msg")
    logger.info("Info msg")
    logger.warn("Warn msg")
    assert.equal(captured.length, 0)

    logger.error("Error msg")
    assert.equal(captured.length, 1)
    assert.equal(captured[0]!.level, "error")
  })

  it("debug() only outputs when NODE_ENV is development or unset", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    LogFactory.setLevel("debug")

    // In development -> should log
    Bun.env.NODE_ENV = "development"
    const devLogger = new LogFactory("DevModule")
    devLogger.debug("Dev debug message")
    expect(captured.length).toBe(1)

    // In production -> should NOT log debug even if level is debug
    Bun.env.NODE_ENV = "production"
    const prodLogger = new LogFactory("ProdModule")
    prodLogger.debug("Prod debug message")
    expect(captured.length).toBe(1) // unchanged

    // Info should still log in production
    prodLogger.info("Prod info message")
    assert.equal(captured.length, 2)
  })

  it("formats Error objects with stack traces", () => {
    const captured: LogEntry[] = []
    LogFactory.setSink((entry) => captured.push(entry))

    const logger = new LogFactory("Database")
    const testError = new Error("Connection timed out")
    logger.error("Query failed", testError)

    assert.equal(captured.length, 1)
    assert.match(captured[0]!.formatted, /Query failed/)
    assert.match(captured[0]!.formatted, /Connection timed out/)
    assert.match(captured[0]!.formatted, /Error: Connection timed out/)
  })

  it("supports instance-level sink option with success level", () => {
    const instanceCaptured: LogEntry[] = []
    const logger = new LogFactory("Scoped", {
      sink: (entry) => instanceCaptured.push(entry),
    })

    logger.success("Operation completed")
    assert.equal(instanceCaptured.length, 1)
    assert.equal(instanceCaptured[0]!.level, "success")
    assert.match(instanceCaptured[0]!.formatted, /Operation completed/)
  })
})
