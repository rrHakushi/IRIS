import { ElysiaError, t, type UnwrapSchema } from "elysia"

/**
 * RFC 9457 Problem Details Response Schema for OpenAPI & Eden Treaty
 */
export const ProblemDetailsSchema = t.Object({
    type: t.String({ description: "URI reference or slug identifying the problem type" }),
    title: t.String({ description: "Short human-readable summary of the problem" }),
    status: t.Number({ description: "HTTP status code" }),
    detail: t.Optional(t.String({ description: "Human-readable explanation specific to this occurrence" })),
    instance: t.Optional(t.String({ description: "URI reference identifying the specific occurrence" })),
    code: t.Optional(t.String({ description: "Machine-readable error token" })),
})

export type ProblemDetails = UnwrapSchema<typeof ProblemDetailsSchema>

export interface HttpErrorOptions {
    cause?: Error
    instance?: string
}

/**
 * Base class for HTTP problem errors in Elysia, adhering to RFC 9457 / RFC 7807.
 * Extends `ElysiaError` so Elysia automatically handles `.toResponse()` when returned or thrown.
 */
export class HttpError<Status extends number = number> extends ElysiaError<Status> {
    override status: Status
    override response: string
    override problemType: string
    override problemTitle: string
    readonly code: string
    readonly title: string
    readonly instance?: string

    constructor(
        status: Status,
        code: string,
        title: string,
        response: string = title,
        options?: HttpErrorOptions | Error
    ) {
        const opts = options instanceof Error ? { cause: options } : options
        super(response, opts?.cause)

        this.name = this.constructor.name
        this.status = status
        this.code = code
        this.title = title
        this.problemType = code
        this.problemTitle = title
        this.response = response
        this.instance = opts?.instance
    }

    /**
     * Generates an RFC 9457 compliant Problem Details Response (`application/problem+json`).
     */
    override toResponse(headers?: Record<string, string>): Response {
        const body: Record<string, unknown> = {
            type: this.problemType,
            title: this.problemTitle,
            status: this.status,
            code: this.code,
        }

        if (this.response && this.response !== this.problemTitle) {
            body.detail = this.response
        }

        if (this.instance) {
            body.instance = this.instance
        }

        return new Response(JSON.stringify(body), {
            status: this.status,
            headers: {
                ...headers,
                "content-type": "application/problem+json",
            },
        })
    }
}

// ============================================================================
// 4xx Client Error Classes (RFC 9110 / RFC 9457)
// ============================================================================

/** 400 Bad Request */
export class BadRequest extends HttpError<400> {
    constructor(response: string = "Bad Request", options?: HttpErrorOptions | Error) {
        super(400, "bad-request", "Bad Request", response, options)
    }
}

/** 401 Unauthorized */
export class Unauthorized extends HttpError<401> {
    constructor(response: string = "Unauthorized", options?: HttpErrorOptions | Error) {
        super(401, "unauthorized", "Unauthorized", response, options)
    }
}

/** 402 Payment Required */
export class PaymentRequired extends HttpError<402> {
    constructor(response: string = "Payment Required", options?: HttpErrorOptions | Error) {
        super(402, "payment-required", "Payment Required", response, options)
    }
}

/** 403 Forbidden */
export class Forbidden extends HttpError<403> {
    constructor(response: string = "Forbidden", options?: HttpErrorOptions | Error) {
        super(403, "forbidden", "Forbidden", response, options)
    }
}

/** 404 Not Found */
export class NotFound extends HttpError<404> {
    constructor(response: string = "Not Found", options?: HttpErrorOptions | Error) {
        super(404, "not-found", "Not Found", response, options)
    }
}

/** 405 Method Not Allowed */
export class MethodNotAllowed extends HttpError<405> {
    constructor(response: string = "Method Not Allowed", options?: HttpErrorOptions | Error) {
        super(405, "method-not-allowed", "Method Not Allowed", response, options)
    }
}

/** 406 Not Acceptable */
export class NotAcceptable extends HttpError<406> {
    constructor(response: string = "Not Acceptable", options?: HttpErrorOptions | Error) {
        super(406, "not-acceptable", "Not Acceptable", response, options)
    }
}

/** 407 Proxy Authentication Required */
export class ProxyAuthenticationRequired extends HttpError<407> {
    constructor(response: string = "Proxy Authentication Required", options?: HttpErrorOptions | Error) {
        super(407, "proxy-authentication-required", "Proxy Authentication Required", response, options)
    }
}

/** 408 Request Timeout */
export class RequestTimeout extends HttpError<408> {
    constructor(response: string = "Request Timeout", options?: HttpErrorOptions | Error) {
        super(408, "request-timeout", "Request Timeout", response, options)
    }
}

/** 409 Conflict */
export class Conflict extends HttpError<409> {
    constructor(response: string = "Conflict", options?: HttpErrorOptions | Error) {
        super(409, "conflict", "Conflict", response, options)
    }
}

/** 410 Gone */
export class Gone extends HttpError<410> {
    constructor(response: string = "Gone", options?: HttpErrorOptions | Error) {
        super(410, "gone", "Gone", response, options)
    }
}

/** 411 Length Required */
export class LengthRequired extends HttpError<411> {
    constructor(response: string = "Length Required", options?: HttpErrorOptions | Error) {
        super(411, "length-required", "Length Required", response, options)
    }
}

/** 412 Precondition Failed */
export class PreconditionFailed extends HttpError<412> {
    constructor(response: string = "Precondition Failed", options?: HttpErrorOptions | Error) {
        super(412, "precondition-failed", "Precondition Failed", response, options)
    }
}

/** 413 Payload Too Large */
export class PayloadTooLarge extends HttpError<413> {
    constructor(response: string = "Payload Too Large", options?: HttpErrorOptions | Error) {
        super(413, "payload-too-large", "Payload Too Large", response, options)
    }
}

/** 414 URI Too Long */
export class UriTooLong extends HttpError<414> {
    constructor(response: string = "URI Too Long", options?: HttpErrorOptions | Error) {
        super(414, "uri-too-long", "URI Too Long", response, options)
    }
}

/** 415 Unsupported Media Type */
export class UnsupportedMediaType extends HttpError<415> {
    constructor(response: string = "Unsupported Media Type", options?: HttpErrorOptions | Error) {
        super(415, "unsupported-media-type", "Unsupported Media Type", response, options)
    }
}

/** 416 Range Not Satisfiable */
export class RangeNotSatisfiable extends HttpError<416> {
    constructor(response: string = "Range Not Satisfiable", options?: HttpErrorOptions | Error) {
        super(416, "range-not-satisfiable", "Range Not Satisfiable", response, options)
    }
}

/** 417 Expectation Failed */
export class ExpectationFailed extends HttpError<417> {
    constructor(response: string = "Expectation Failed", options?: HttpErrorOptions | Error) {
        super(417, "expectation-failed", "Expectation Failed", response, options)
    }
}

/** 418 I'm a Teapot */
export class ImATeapot extends HttpError<418> {
    constructor(response: string = "I'm a teapot", options?: HttpErrorOptions | Error) {
        super(418, "im-a-teapot", "I'm a teapot", response, options)
    }
}

/** 421 Misdirected Request */
export class MisdirectedRequest extends HttpError<421> {
    constructor(response: string = "Misdirected Request", options?: HttpErrorOptions | Error) {
        super(421, "misdirected-request", "Misdirected Request", response, options)
    }
}

/** 422 Unprocessable Content */
export class UnprocessableContent extends HttpError<422> {
    constructor(response: string = "Unprocessable Content", options?: HttpErrorOptions | Error) {
        super(422, "unprocessable-content", "Unprocessable Content", response, options)
    }
}
export { UnprocessableContent as UnprocessableEntity }

/** 423 Locked */
export class Locked extends HttpError<423> {
    constructor(response: string = "Locked", options?: HttpErrorOptions | Error) {
        super(423, "locked", "Locked", response, options)
    }
}

/** 424 Failed Dependency */
export class FailedDependency extends HttpError<424> {
    constructor(response: string = "Failed Dependency", options?: HttpErrorOptions | Error) {
        super(424, "failed-dependency", "Failed Dependency", response, options)
    }
}

/** 425 Too Early */
export class TooEarly extends HttpError<425> {
    constructor(response: string = "Too Early", options?: HttpErrorOptions | Error) {
        super(425, "too-early", "Too Early", response, options)
    }
}

/** 426 Upgrade Required */
export class UpgradeRequired extends HttpError<426> {
    constructor(response: string = "Upgrade Required", options?: HttpErrorOptions | Error) {
        super(426, "upgrade-required", "Upgrade Required", response, options)
    }
}

/** 428 Precondition Required */
export class PreconditionRequired extends HttpError<428> {
    constructor(response: string = "Precondition Required", options?: HttpErrorOptions | Error) {
        super(428, "precondition-required", "Precondition Required", response, options)
    }
}

/** 429 Too Many Requests */
export class TooManyRequests extends HttpError<429> {
    constructor(response: string = "Too Many Requests", options?: HttpErrorOptions | Error) {
        super(429, "too-many-requests", "Too Many Requests", response, options)
    }
}

/** 431 Request Header Fields Too Large */
export class RequestHeaderFieldsTooLarge extends HttpError<431> {
    constructor(response: string = "Request Header Fields Too Large", options?: HttpErrorOptions | Error) {
        super(431, "request-header-fields-too-large", "Request Header Fields Too Large", response, options)
    }
}

/** 451 Unavailable For Legal Reasons */
export class UnavailableForLegalReasons extends HttpError<451> {
    constructor(response: string = "Unavailable For Legal Reasons", options?: HttpErrorOptions | Error) {
        super(451, "unavailable-for-legal-reasons", "Unavailable For Legal Reasons", response, options)
    }
}

// ============================================================================
// 5xx Server Error Classes (RFC 9110 / RFC 9457)
// ============================================================================

/** 500 Internal Server Error */
export class InternalServerError extends HttpError<500> {
    constructor(response: string = "Internal Server Error", options?: HttpErrorOptions | Error) {
        super(500, "internal-server-error", "Internal Server Error", response, options)
    }
}

/** 501 Not Implemented */
export class NotImplemented extends HttpError<501> {
    constructor(response: string = "Not Implemented", options?: HttpErrorOptions | Error) {
        super(501, "not-implemented", "Not Implemented", response, options)
    }
}

/** 502 Bad Gateway */
export class BadGateway extends HttpError<502> {
    constructor(response: string = "Bad Gateway", options?: HttpErrorOptions | Error) {
        super(502, "bad-gateway", "Bad Gateway", response, options)
    }
}

/** 503 Service Unavailable */
export class ServiceUnavailable extends HttpError<503> {
    constructor(response: string = "Service Unavailable", options?: HttpErrorOptions | Error) {
        super(503, "service-unavailable", "Service Unavailable", response, options)
    }
}

/** 504 Gateway Timeout */
export class GatewayTimeout extends HttpError<504> {
    constructor(response: string = "Gateway Timeout", options?: HttpErrorOptions | Error) {
        super(504, "gateway-timeout", "Gateway Timeout", response, options)
    }
}

/** 505 HTTP Version Not Supported */
export class HttpVersionNotSupported extends HttpError<505> {
    constructor(response: string = "HTTP Version Not Supported", options?: HttpErrorOptions | Error) {
        super(505, "http-version-not-supported", "HTTP Version Not Supported", response, options)
    }
}

/** 506 Variant Also Negotiates */
export class VariantAlsoNegotiates extends HttpError<506> {
    constructor(response: string = "Variant Also Negotiates", options?: HttpErrorOptions | Error) {
        super(506, "variant-also-negotiates", "Variant Also Negotiates", response, options)
    }
}

/** 507 Insufficient Storage */
export class InsufficientStorage extends HttpError<507> {
    constructor(response: string = "Insufficient Storage", options?: HttpErrorOptions | Error) {
        super(507, "insufficient-storage", "Insufficient Storage", response, options)
    }
}

/** 508 Loop Detected */
export class LoopDetected extends HttpError<508> {
    constructor(response: string = "Loop Detected", options?: HttpErrorOptions | Error) {
        super(508, "loop-detected", "Loop Detected", response, options)
    }
}

/** 510 Not Extended */
export class NotExtended extends HttpError<510> {
    constructor(response: string = "Not Extended", options?: HttpErrorOptions | Error) {
        super(510, "not-extended", "Not Extended", response, options)
    }
}

/** 511 Network Authentication Required */
export class NetworkAuthenticationRequired extends HttpError<511> {
    constructor(response: string = "Network Authentication Required", options?: HttpErrorOptions | Error) {
        super(511, "network-authentication-required", "Network Authentication Required", response, options)
    }
}

/** Type guard to test whether an unknown error is an ElysiaError / HttpError */
export function isHttpError(error: unknown): error is HttpError {
    return error instanceof ElysiaError
}
