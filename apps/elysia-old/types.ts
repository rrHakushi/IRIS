import { t } from "elysia";

export const ErrorResponseSchema = t.Object({
  type: t.String(),
  title: t.String(),
  status: t.Number(),
  detail: t.Optional(t.String()),
  instance: t.Optional(t.String()),
});

export const NotFoundResponseSchema = t.Union([
  ErrorResponseSchema,
  t.Object({
    error: t.String(),
    message: t.String(),
  }),
]);