import { Controller, HttpStatus } from "@nestjs/common";
import { TypedRoute, TypedBody, TypedException } from "@nestia/core";
import { MfaService } from "../../services/mfa.service";
import { AuthService } from "../../services/auth.service";
import { Public, CurrentUser } from "../../../../common";
import type { AuthenticatedUser } from "../../../../common";
import type {
  ITotpSetupResponse,
  ITotpEnableRequest,
  ITotpEnableResponse,
  ITotpDisableRequest,
  IEmailMfaToggleRequest,
  IMfaSendEmailCodeRequest,
  IMfaVerifyRequest,
  IBackupCodesRegenerateResponse,
} from "../../dtos/mfa.dto";
import type { ILoginResponse, ISuccessResponse } from "../../dtos/auth.dto";
import type {
  IUnauthorizedException,
  IBadRequestException,
  INotFoundException,
} from "../../dtos/exceptions.dto";

/**
 * Controller managing Multi-Factor Authentication enrollment, verification, and backup codes.
 */
@Controller("account/mfa")
export class AccountMfaController {
  public constructor(
    private readonly mfaService: MfaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Generates a new TOTP secret key and QR code data URL for enrollment.
   *
   * @param user - Authenticated user context.
   * @returns TOTP setup data.
   */
  @TypedRoute.Post("totp/setup")
  public async setupTotp(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ITotpSetupResponse> {
    return this.mfaService.setupTotp(user.id, user.email ?? `${user.username}@iris.internal`);
  }

  /**
   * Confirms initial TOTP setup with a code from the authenticator app and returns backup codes.
   *
   * @param userId - ID of the authenticated user.
   * @param body - 6-digit confirmation code.
   * @returns Enablement status and backup codes.
   */
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid authenticator code or setup session expired.",
  })
  @TypedRoute.Post("totp/enable")
  public async enableTotp(
    @CurrentUser("id") userId: string,
    @TypedBody() body: ITotpEnableRequest,
  ): Promise<ITotpEnableResponse> {
    return this.mfaService.enableTotp(userId, body.code);
  }

  /**
   * Disables TOTP on the user's account after confirming their password.
   *
   * @param userId - ID of the authenticated user.
   * @param body - Password confirmation.
   * @returns Success acknowledgment.
   */
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Incorrect password.",
  })
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "User not found.",
  })
  @TypedRoute.Post("totp/disable")
  public async disableTotp(
    @CurrentUser("id") userId: string,
    @TypedBody() body: ITotpDisableRequest,
  ): Promise<ISuccessResponse> {
    await this.mfaService.disableTotp(userId, body.password);
    return {
      success: true,
      message: "TOTP authenticator has been disabled.",
    };
  }

  /**
   * Enables or disables Email MFA for the user.
   *
   * @param userId - ID of the authenticated user.
   * @param body - Enable/disable flag.
   * @returns Success acknowledgment.
   */
  @TypedRoute.Post("email/toggle")
  public async toggleEmailMfa(
    @CurrentUser("id") userId: string,
    @TypedBody() body: IEmailMfaToggleRequest,
  ): Promise<ISuccessResponse> {
    await this.mfaService.toggleEmailMfa(userId, body.enabled);
    return {
      success: true,
      message: `Email MFA has been ${body.enabled ? "enabled" : "disabled"}.`,
    };
  }

  /**
   * Dispatches a 6-digit email OTP verification code to the user's registered email during login.
   *
   * @param body - MFA challenge ticket.
   * @returns Success acknowledgment.
   */
  @Public()
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "MFA ticket has expired or is invalid.",
  })
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "User not found.",
  })
  @TypedRoute.Post("email/send-code")
  public async sendEmailMfaCode(
    @TypedBody() body: IMfaSendEmailCodeRequest,
  ): Promise<ISuccessResponse> {
    await this.mfaService.sendEmailMfaCode(body.mfaTicket);
    return {
      success: true,
      message: "Verification code sent to registered email.",
    };
  }

  /**
   * Verifies an MFA challenge token (TOTP, Email OTP, or emergency backup code) to complete login.
   *
   * @param body - Verification parameters.
   * @returns Complete login session.
   */
  @Public()
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Invalid verification code or MFA ticket expired.",
  })
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Specified MFA method is not active for this account.",
  })
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "User not found.",
  })
  @TypedRoute.Post("verify")
  public async verifyMfa(
    @TypedBody() body: IMfaVerifyRequest,
  ): Promise<ILoginResponse> {
    const userId = await this.mfaService.verifyMfaChallenge(
      body.mfaTicket,
      body.mfaType,
      body.code,
    );
    return this.authService.completeMfaLogin(userId);
  }

  /**
   * Generates a fresh set of 10 single-use emergency backup codes.
   *
   * @param userId - ID of the authenticated user.
   * @returns New emergency backup codes.
   */
  @TypedRoute.Post("backup-codes/regenerate")
  public async regenerateBackupCodes(
    @CurrentUser("id") userId: string,
  ): Promise<IBackupCodesRegenerateResponse> {
    const backupCodes = await this.mfaService.regenerateBackupCodes(userId);
    return { backupCodes };
  }
}
