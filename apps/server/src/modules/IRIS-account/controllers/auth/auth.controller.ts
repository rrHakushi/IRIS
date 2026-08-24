import { Controller, HttpStatus } from "@nestjs/common";
import { TypedRoute, TypedBody, TypedException } from "@nestia/core";
import { AuthService } from "../../services/auth.service";
import { Public, CurrentUser } from "../../../../common";
import type {
  ILoginRequest,
  ILoginResponse,
  IRegisterRequest,
  IRegisterResponse,
  IPasswordChangeRequest,
  IPasswordForgotRequest,
  IPasswordResetRequest,
  ISuccessResponse,
} from "../../dtos/auth.dto";
import type {
  IUnauthorizedException,
  IConflictException,
  INotFoundException,
  IBadRequestException,
} from "../../dtos/exceptions.dto";

/**
 * Controller managing primary authentication, user registration, and password lifecycle.
 */
@Controller("auth")
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates user with username or email and plaintext password.
   *
   * @param body - Credentials payload.
   * @returns Successful login session or MFA challenge requirements.
   */
  @Public()
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Invalid username, email, or password.",
  })
  @TypedRoute.Post("login")
  public async login(@TypedBody() body: ILoginRequest): Promise<ILoginResponse> {
    return this.authService.login(body);
  }

  /**
   * Creates a new user account with salted password hash and encrypted Ed25519 keypair.
   *
   * @param body - Registration payload.
   * @returns Created user summary and public key.
   */
  @Public()
  @TypedException<IConflictException>({
    status: HttpStatus.CONFLICT,
    description: "Username is already taken or email is in use.",
  })
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Password or username does not meet complexity requirements.",
  })
  @TypedRoute.Post("register")
  public async register(
    @TypedBody() body: IRegisterRequest,
  ): Promise<IRegisterResponse> {
    return this.authService.register(body);
  }

  /**
   * Changes the user's password and invalidates all existing active sessions.
   *
   * @param userId - ID of the authenticated user.
   * @param body - Current and new password.
   * @returns Success response.
   */
  @TypedException<IUnauthorizedException>({
    status: HttpStatus.UNAUTHORIZED,
    description: "Incorrect current password.",
  })
  @TypedException<INotFoundException>({
    status: HttpStatus.NOT_FOUND,
    description: "User not found.",
  })
  @TypedRoute.Post("password/change")
  public async changePassword(
    @CurrentUser("id") userId: string,
    @TypedBody() body: IPasswordChangeRequest,
  ): Promise<ISuccessResponse> {
    return this.authService.changePassword(userId, body);
  }

  /**
   * Sends password recovery instructions to the specified email address.
   *
   * @param body - Email address payload.
   * @returns Success acknowledgment.
   */
  @Public()
  @TypedRoute.Post("password/forgot")
  public async forgotPassword(
    @TypedBody() body: IPasswordForgotRequest,
  ): Promise<ISuccessResponse> {
    return this.authService.forgotPassword(body);
  }

  /**
   * Completes password reset using a valid recovery token.
   *
   * @param body - Reset token and new password.
   * @returns Success response.
   */
  @Public()
  @TypedException<IBadRequestException>({
    status: HttpStatus.BAD_REQUEST,
    description: "Password reset token is invalid or has expired.",
  })
  @TypedRoute.Post("password/reset")
  public async resetPassword(
    @TypedBody() body: IPasswordResetRequest,
  ): Promise<ISuccessResponse> {
    return this.authService.resetPassword(body);
  }
}
