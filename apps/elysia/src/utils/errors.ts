import { ElysiaError, NotFound, InternalServerError, t } from "elysia";

/** RFC 9457 Problem Details Response Schema */
export const ErrorResponseSchema = t.Object({
  type: t.String(),
  title: t.String(),
  status: t.Number(),
  detail: t.Optional(t.String()),
  instance: t.Optional(t.String()),
});

export const BadRequestResponseSchema = ErrorResponseSchema;
export const UnauthorizedResponseSchema = ErrorResponseSchema;
export const ForbiddenResponseSchema = ErrorResponseSchema;
export const NotFoundResponseSchema = ErrorResponseSchema;
export const ConflictResponseSchema = ErrorResponseSchema;

/**
 * Base class for HTTP problem errors in Elysia, adhering to RFC 9457 / RFC 7807.
 * Similar to how `NotFound` and `InternalServerError` function in Elysia.
 */
export class HttpError<Status extends number = number> extends ElysiaError<Status> {
  override status: Status;
  override problemType: string;
  override problemTitle: string;
  override response: string;

  constructor(
    status: Status,
    problemType: string,
    problemTitle: string,
    response: string = problemTitle,
    cause?: Error
  ) {
    super(response, cause);
    this.name = this.constructor.name;
    this.status = status;
    this.problemType = problemType;
    this.problemTitle = problemTitle;
    this.response = response;
  }
}

/** 400 Bad Request */
export class BadRequest extends HttpError<400> {
  constructor(response: string = "Bad Request", cause?: Error) {
    super(400, "bad-request", "Bad Request", response, cause);
  }
}

/** 401 Unauthorized */
export class Unauthorized extends HttpError<401> {
  constructor(response: string = "Unauthorized", cause?: Error) {
    super(401, "unauthorized", "Unauthorized", response, cause);
  }
}

/** 402 Payment Required */
export class PaymentRequired extends HttpError<402> {
  constructor(response: string = "Payment Required", cause?: Error) {
    super(402, "payment-required", "Payment Required", response, cause);
  }
}

/** 403 Forbidden */
export class Forbidden extends HttpError<403> {
  constructor(response: string = "Forbidden", cause?: Error) {
    super(403, "forbidden", "Forbidden", response, cause);
  }
}

/** 404 Not Found (re-exported from elysia for consistency) */
export { NotFound };

/** 405 Method Not Allowed */
export class MethodNotAllowed extends HttpError<405> {
  constructor(response: string = "Method Not Allowed", cause?: Error) {
    super(405, "method-not-allowed", "Method Not Allowed", response, cause);
  }
}

/** 406 Not Acceptable */
export class NotAcceptable extends HttpError<406> {
  constructor(response: string = "Not Acceptable", cause?: Error) {
    super(406, "not-acceptable", "Not Acceptable", response, cause);
  }
}

/** 409 Conflict */
export class Conflict extends HttpError<409> {
  constructor(response: string = "Conflict", cause?: Error) {
    super(409, "conflict", "Conflict", response, cause);
  }
}

/** 410 Gone */
export class Gone extends HttpError<410> {
  constructor(response: string = "Gone", cause?: Error) {
    super(410, "gone", "Gone", response, cause);
  }
}

/** 412 Precondition Failed */
export class PreconditionFailed extends HttpError<412> {
  constructor(response: string = "Precondition Failed", cause?: Error) {
    super(412, "precondition-failed", "Precondition Failed", response, cause);
  }
}

/** 413 Payload Too Large */
export class PayloadTooLarge extends HttpError<413> {
  constructor(response: string = "Payload Too Large", cause?: Error) {
    super(413, "payload-too-large", "Payload Too Large", response, cause);
  }
}

/** 415 Unsupported Media Type */
export class UnsupportedMediaType extends HttpError<415> {
  constructor(response: string = "Unsupported Media Type", cause?: Error) {
    super(415, "unsupported-media-type", "Unsupported Media Type", response, cause);
  }
}

/** 422 Unprocessable Entity */
export class UnprocessableEntity extends HttpError<422> {
  constructor(response: string = "Unprocessable Entity", cause?: Error) {
    super(422, "unprocessable-entity", "Unprocessable Entity", response, cause);
  }
}

/** 429 Too Many Requests */
export class TooManyRequests extends HttpError<429> {
  constructor(response: string = "Too Many Requests", cause?: Error) {
    super(429, "too-many-requests", "Too Many Requests", response, cause);
  }
}

/** 500 Internal Server Error (re-exported from elysia for consistency) */
export { InternalServerError };

/** 501 Not Implemented */
export class NotImplemented extends HttpError<501> {
  constructor(response: string = "Not Implemented", cause?: Error) {
    super(501, "not-implemented", "Not Implemented", response, cause);
  }
}

/** 502 Bad Gateway */
export class BadGateway extends HttpError<502> {
  constructor(response: string = "Bad Gateway", cause?: Error) {
    super(502, "bad-gateway", "Bad Gateway", response, cause);
  }
}

/** 503 Service Unavailable */
export class ServiceUnavailable extends HttpError<503> {
  constructor(response: string = "Service Unavailable", cause?: Error) {
    super(503, "service-unavailable", "Service Unavailable", response, cause);
  }
}

/** 504 Gateway Timeout */
export class GatewayTimeout extends HttpError<504> {
  constructor(response: string = "Gateway Timeout", cause?: Error) {
    super(504, "gateway-timeout", "Gateway Timeout", response, cause);
  }
}

/** Type guard to check if an unknown error is an ElysiaError / HttpError */
export function isHttpError(error: unknown): error is ElysiaError {
  return error instanceof ElysiaError;
}
