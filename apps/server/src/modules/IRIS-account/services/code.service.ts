import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { CacheService } from "@IRIS/cache";
import { randomBytes, randomInt } from "node:crypto";
import {
  ILoginCodeGenerateRequest,
  ILoginCodeGenerateResponse,
  ILoginCodeStatusResponse,
} from "../dtos/code.dto";

/**
 * Cached login code session state stored in Redis / In-Memory cache.
 */
export interface ILoginCodeSessionState {
  /**
   * 6-character displayed code.
   */
  readonly code: string;

  /**
   * Lifecycle status of the session.
   */
  status: "pending" | "approved" | "expired";

  /**
   * Device label or null.
   */
  readonly deviceName: string | null;

  /**
   * Authenticated user info once approved.
   */
  user: {
    readonly id: string;
    readonly username: string;
    readonly email: string;
    readonly passwordChangedAt: number | null;
  } | null;

  /**
   * JWT session token once approved.
   */
  token: string | null;

  /**
   * UNIX timestamp of creation.
   */
  readonly createdAt: number;
}

/**
 * Service managing quick-connect login codes and QR code authentication sessions via `@IRIS/cache`.
 */
@Injectable()
export class CodeService {
  /**
   * Cache time-to-live for login codes (5 minutes = 300 seconds).
   */
  private static readonly TTL_SECONDS = 300;

  constructor(private readonly cache: CacheService) {}

  /**
   * Generates a new 6-character quick-connect code and QR session token.
   *
   * @param request - Optional device label.
   * @returns Generated code, session token, and QR payload with 5-minute TTL.
   */
  public async generateCode(
    request: ILoginCodeGenerateRequest,
  ): Promise<ILoginCodeGenerateResponse> {
    const code = this.generateReadableCode();
    const sessionToken = randomBytes(24).toString("hex");

    const sessionState: ILoginCodeSessionState = {
      code,
      status: "pending",
      deviceName: request.deviceName ?? null,
      user: null,
      token: null,
      createdAt: Date.now(),
    };

    // Store session state with 5-minute TTL
    await this.cache.set(
      `iris:login_code:session:${sessionToken}`,
      sessionState,
      CodeService.TTL_SECONDS,
    );

    // Map the short code to the session token for reverse lookup
    await this.cache.set(
      `iris:login_code:code:${code.toUpperCase()}`,
      sessionToken,
      CodeService.TTL_SECONDS,
    );

    const qrPayload = `iris://auth/login-code?code=${code}&session=${sessionToken}`;

    return {
      code,
      sessionToken,
      qrPayload,
      expiresIn: CodeService.TTL_SECONDS,
    };
  }

  /**
   * Checks the current approval status of a login code session.
   *
   * @param sessionToken - Polling session token.
   * @returns Current status and user credentials if approved.
   */
  public async getStatus(sessionToken: string): Promise<ILoginCodeStatusResponse> {
    const sessionState = await this.cache.get<ILoginCodeSessionState>(
      `iris:login_code:session:${sessionToken}`,
    );

    if (!sessionState) {
      return {
        status: "expired",
        user: null,
        token: null,
      };
    }

    return {
      status: sessionState.status,
      user: sessionState.user,
      token: sessionState.token,
    };
  }

  /**
   * Approves a quick-connect code from an authenticated device.
   *
   * @param code - The short code or QR token to approve.
   * @param user - The approving user object.
   * @param token - JWT session token to issue to the new device.
   * @returns Success boolean.
   */
  public async approveCode(
    code: string,
    user: {
      readonly id: string;
      readonly username: string;
      readonly email: string;
      readonly passwordChangedAt: number | null;
    },
    token: string,
  ): Promise<boolean> {
    const normalizedCode = code.trim().toUpperCase();

    // Check if the code maps to a session token
    let sessionToken = await this.cache.get<string>(
      `iris:login_code:code:${normalizedCode}`,
    );

    // If not found as short code, check if it's the raw session token itself (from QR scan)
    if (!sessionToken) {
      sessionToken = code;
    }

    const sessionState = await this.cache.get<ILoginCodeSessionState>(
      `iris:login_code:session:${sessionToken}`,
    );

    if (!sessionState || sessionState.status !== "pending") {
      throw new NotFoundException("Login code is invalid or has expired.");
    }

    sessionState.status = "approved";
    sessionState.user = user;
    sessionState.token = token;

    // Save updated approved state in cache
    await this.cache.set(
      `iris:login_code:session:${sessionToken}`,
      sessionState,
      CodeService.TTL_SECONDS,
    );

    // Remove the short code lookup key now that it has been consumed
    await this.cache.del(`iris:login_code:code:${normalizedCode}`);

    return true;
  }

  /**
   * Generates a 6-character user-friendly alphanumeric code in format `ABC-123`.
   *
   * @returns Formatted code.
   */
  private generateReadableCode(): string {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = "23456789";

    let letterPart = "";
    for (let i = 0; i < 3; i++) {
      letterPart += letters[randomInt(0, letters.length)];
    }

    let numberPart = "";
    for (let i = 0; i < 3; i++) {
      numberPart += numbers[randomInt(0, numbers.length)];
    }

    return `${letterPart}-${numberPart}`;
  }
}
