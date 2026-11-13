import { t } from 'elysia'

export const TesseractModel = {
  identityResponse: t.Object({
    isAuthenticated: t.Boolean(),
    user: t.Nullable(
      t.Object({
        id: t.String(),
        username: t.String(),
        displayName: t.String(),
        avatarUrl: t.Nullable(t.String()),
      })
    ),
    lanRoomId: t.String(),
    lanScope: t.Union([t.Literal('lan'), t.Literal('nat')]),
  }),

  eventsQuery: t.Object({
    deviceId: t.Optional(t.String()),
    tabId: t.Optional(t.String()),
    alias: t.Optional(t.String()),
    deviceType: t.Optional(t.String()),
    os: t.Optional(t.String()),
    browser: t.Optional(t.String()),
    approval: t.Optional(t.String()),
  }),

  signalBody: t.Object({
    peerId: t.String({ minLength: 1 }),
    sseSecret: t.String({ minLength: 1 }),
    payload: t.Record(t.String(), t.Any()),
  }),

  signalResponse: t.Object({
    ok: t.Boolean(),
  }),

  unauthorizedError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(401),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  validationError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(422),
    detail: t.String(),
    code: t.String(),
  }),
}

