/**
 * Standard typed HTTP exception payload structure returned across IRIS API endpoints.
 */
export interface IExceptionResponse<TError extends string = string> {
  /**
   * HTTP status code corresponding to the error.
   *
   * @example 400
   */
  readonly statusCode: number;

  /**
   * Human-readable description of the error.
   *
   * @example "Validation error occurred."
   */
  readonly message: string;

  /**
   * Standard error classification code.
   *
   * @example "Bad Request"
   */
  readonly error: TError;
}

/**
 * 400 Bad Request exception payload.
 */
export type IBadRequestException = IExceptionResponse<"Bad Request">;

/**
 * 401 Unauthorized exception payload.
 */
export type IUnauthorizedException = IExceptionResponse<"Unauthorized">;

/**
 * 403 Forbidden exception payload.
 */
export type IForbiddenException = IExceptionResponse<"Forbidden">;

/**
 * 404 Not Found exception payload.
 */
export type INotFoundException = IExceptionResponse<"Not Found">;

/**
 * 409 Conflict exception payload.
 */
export type IConflictException = IExceptionResponse<"Conflict">;
