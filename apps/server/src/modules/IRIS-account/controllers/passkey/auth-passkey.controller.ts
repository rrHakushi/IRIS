import { Controller, HttpStatus } from "@nestjs/common";
import { TypedRoute, TypedBody, TypedParam, TypedException } from "@nestia/core";
import { PasskeyService } from "../../services/passkey.service";
import { AuthService } from "../../services/auth.service";
import { Public, CurrentUser } from "../../../../common";
import type {
  IPasskeyLoginOptionsRequest,
  IPasskeyLoginOptionsResponse,
  IPasskeyVerifyLoginRequest,
  IPasskeyRegisterOptionsResponse,
  IPasskeyRegisterVerifyRequest,
  IPasskeySummary,
} from "../../dtos/passkey.dto";
import type { ILoginResponse, ISuccessResponse } from "../../dtos/auth.dto";
import type {
  IUnauthorizedException,
  IBadRequestException,
  INotFoundException,
} from "../../dtos/exceptions.dto";

/**
 * Controller managing WebAuthn Passkeys for passwordless authentication and credential enrollment.
 */
@Controller("auth/passkey")
export class AuthPasskeyController {
  public constructor(
    private readonly passkeyService: PasskeyService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Generates WebAuthn authentication challenge options for passkey login.
   *
   * @param body - Optional identifier.
   * @returns Challenge options for `navigator.credentials.get()`.
   */
  @Public()
  @TypedRoute.Post("login-options")
  public async getLoginOptions(
    @TypedBody() body: IPasskeyLoginOptionsRequest,
  ): Promise<IPasskeyLoginOptionsResponse> {
    return this.passkeyService.generateLoginOptions(body.identifier);
  }

  /**
   * Verifies WebAuthn assertion signature and logs in the user.
   *
   * @param body - Assertion response.
   * @returns Successful login session.
   */
  @Public()
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Passkey verification failed or challenge expired.",
  })
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Malformed clientDataJSON.",
  })
  @TypedRoute.Post("verify-login")
  public async verifyLogin(
    @TypedBody() body: IPasskeyVerifyLoginRequest,
  ): Promise<ILoginResponse> {
    const userId = await this.passkeyService.verifyLogin(body.passkeyResponse as never);
    return this.authService.completeMfaLogin(userId);
  }

  /**
   * Generates WebAuthn registration challenge options for an authenticated user.
   *
   * @param userId - ID of the authenticated user.
   * @returns Registration options for `navigator.credentials.create()`.
   */
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "User not found.",
  })
  @TypedRoute.Post("register-options")
  public async getRegisterOptions(
    @CurrentUser("id") userId: string,
  ): Promise<IPasskeyRegisterOptionsResponse> {
    return this.passkeyService.generateRegisterOptions(userId);
  }

  /**
   * Verifies and registers a new passkey.
   *
   * @param userId - ID of the authenticated user.
   * @param body - Attestation response and label.
   * @returns Success acknowledgment.
   */
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Passkey registration challenge has expired.",
  })
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Passkey registration verification failed.",
  })
  @TypedRoute.Post("register-verify")
  public async verifyRegister(
    @CurrentUser("id") userId: string,
    @TypedBody() body: IPasskeyRegisterVerifyRequest,
  ): Promise<ISuccessResponse> {
    await this.passkeyService.verifyRegister(
      userId,
      body.passkeyResponse as never,
      body.name,
    );
    return {
      success: true,
      message: "Passkey registered successfully.",
    };
  }

  /**
   * Lists all passkeys registered on the authenticated user's account.
   *
   * @param userId - ID of the authenticated user.
   * @returns Array of passkey descriptors.
   */
  @TypedRoute.Get("list")
  public async listPasskeys(
    @CurrentUser("id") userId: string,
  ): Promise<IPasskeySummary[]> {
    return this.passkeyService.listUserPasskeys(userId);
  }

  /**
   * Deletes a registered passkey.
   *
   * @param userId - ID of the authenticated user.
   * @param id - ID of the passkey to delete.
   * @returns Success acknowledgment.
   */
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "Passkey not found.",
  })
  @TypedRoute.Delete(":id")
  public async deletePasskey(
    @CurrentUser("id") userId: string,
    @TypedParam("id") id: string,
  ): Promise<ISuccessResponse> {
    await this.passkeyService.deletePasskey(userId, id);
    return {
      success: true,
      message: "Passkey removed successfully.",
    };
  }
}
