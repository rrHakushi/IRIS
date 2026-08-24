import { Controller, HttpStatus } from "@nestjs/common";
import { TypedRoute, TypedBody, TypedQuery, TypedException } from "@nestia/core";
import { CodeService } from "../../services/code.service";
import { CryptoService } from "../../services/crypto.service";
import { Public, CurrentUser } from "../../../../common";
import type { AuthenticatedUser } from "../../../../common";
import type {
  ILoginCodeGenerateRequest,
  ILoginCodeGenerateResponse,
  ILoginCodeStatusQuery,
  ILoginCodeStatusResponse,
  ILoginCodeApproveRequest,
} from "../../dtos/code.dto";
import type { ISuccessResponse } from "../../dtos/auth.dto";
import type { INotFoundException } from "../../dtos/exceptions.dto";

/**
 * Controller managing quick-connect device codes and QR code authentication sessions.
 */
@Controller("auth/code")
export class AuthCodeController {
  public constructor(
    private readonly codeService: CodeService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Generates a 6-character quick-connect code and QR session token with 5-minute TTL.
   *
   * @param body - Request options including optional device name.
   * @returns Generated code and QR session payload.
   */
  @Public()
  @TypedRoute.Post("generate")
  public async generateCode(
    @TypedBody() body: ILoginCodeGenerateRequest,
  ): Promise<ILoginCodeGenerateResponse> {
    return this.codeService.generateCode(body);
  }

  /**
   * Polled by the requesting device to check authorization status.
   *
   * @param query - Query containing the polling session token.
   * @returns Current status and session credentials if approved.
   */
  @Public()
  @TypedRoute.Get("status")
  public async getStatus(
    @TypedQuery() query: ILoginCodeStatusQuery,
  ): Promise<ILoginCodeStatusResponse> {
    return this.codeService.getStatus(query.sessionToken);
  }

  /**
   * Approves a quick-connect code from an authenticated device.
   *
   * @param user - Authenticated user approving the new device.
   * @param body - Code to approve.
   * @returns Success acknowledgment.
   */
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "Login code is invalid or has expired.",
  })
  @TypedRoute.Post("approve")
  public async approveCode(
    @CurrentUser() user: AuthenticatedUser,
    @TypedBody() body: ILoginCodeApproveRequest,
  ): Promise<ISuccessResponse> {
    const token = this.crypto.generateSecureToken(32);
    await this.codeService.approveCode(
      body.code,
      {
        id: user.id,
        username: user.username,
        email: user.email ?? "",
        passwordChangedAt: user.passwordChangedAt,
      },
      token,
    );

    return {
      success: true,
      message: "Device approved successfully.",
    };
  }
}
