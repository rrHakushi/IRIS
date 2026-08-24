import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../providers/prisma.service";
import { CacheService } from "@IRIS/cache";
import { CryptoService } from "./crypto.service";
import { MfaService } from "./mfa.service";
import {
  ILoginRequest,
  ILoginResponse,
  IRegisterRequest,
  IRegisterResponse,
  IPasswordChangeRequest,
  IPasswordForgotRequest,
  IPasswordResetRequest,
  ISuccessResponse,
} from "../dtos/auth.dto";

/**
 * Core authentication service managing login, registration, password lifecycle, and JWT session payloads.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly crypto: CryptoService,
    private readonly mfa: MfaService,
  ) {}

  /**
   * Primary authentication step for username/email and password credentials.
   *
   * @param request - Login credentials.
   * @returns Successful login session or MFA challenge requirements.
   */
  public async login(request: ILoginRequest): Promise<ILoginResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: request.identifier }, { username: request.identifier }],
      },
      include: { passkeys: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid username, email, or password.");
    }

    const isPasswordValid = await this.crypto.verifyPassword(
      request.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid username, email, or password.");
    }

    // Check if any MFA method is enabled
    const allowedMfaTypes: ("totp" | "email" | "passkey")[] = [];
    if (user.TOTPEnabled) {
      allowedMfaTypes.push("totp");
    }
    if (user.emailMfaEnabled) {
      allowedMfaTypes.push("email");
    }
    if (user.passkeys.length > 0) {
      allowedMfaTypes.push("passkey");
    }

    if (allowedMfaTypes.length > 0) {
      const mfaTicket = await this.mfa.createMfaTicket(user.id, allowedMfaTypes);
      return {
        success: false,
        mfaRequired: true,
        mfaTicket,
        allowedMfaTypes,
        user: null,
        token: null,
      };
    }

    const token = this.crypto.generateSecureToken(32);
    const passwordChangedAtSeconds = user.passwordChangedAt
      ? Math.floor(user.passwordChangedAt.getTime() / 1000)
      : null;

    return {
      success: true,
      mfaRequired: false,
      mfaTicket: null,
      allowedMfaTypes: null,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordChangedAt: passwordChangedAtSeconds,
      },
      token,
    };
  }

  /**
   * Registers a new user account with salted password hash and encrypted asymmetric Ed25519 keypair.
   *
   * @param request - Registration parameters.
   * @returns Registered user summary and public key.
   */
  public async register(request: IRegisterRequest): Promise<IRegisterResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: request.username }, { email: request.email }],
      },
      select: { username: true, email: true },
    });

    if (existing) {
      if (existing.username.toLowerCase() === request.username.toLowerCase()) {
        throw new ConflictException("Username is already taken.");
      }
      throw new ConflictException("Email is already in use.");
    }

    // Hash password with salt
    const passwordHash = await this.crypto.hashPassword(request.password);

    // Generate Ed25519 keypair and encrypt private key with user password
    const { publicKey, encryptedPrivateKey } =
      await this.crypto.generateUserKeypair(request.password);

    const user = await this.prisma.user.create({
      data: {
        username: request.username,
        email: request.email,
        passwordHash,
        permissions: [],
        publicKey,
        encryptedPrivateKey,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordChangedAt: null,
        publicKey: user.publicKey,
      },
    };
  }

  /**
   * Completes login after successful MFA verification or Passkey authentication.
   *
   * @param userId - ID of the verified user.
   * @returns Complete login response.
   */
  public async completeMfaLogin(userId: string): Promise<ILoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const token = this.crypto.generateSecureToken(32);
    const passwordChangedAtSeconds = user.passwordChangedAt
      ? Math.floor(user.passwordChangedAt.getTime() / 1000)
      : null;

    return {
      success: true,
      mfaRequired: false,
      mfaTicket: null,
      allowedMfaTypes: null,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordChangedAt: passwordChangedAtSeconds,
      },
      token,
    };
  }

  /**
   * Changes the user's password, re-encrypts their private key with the new password, and sets `passwordChangedAt`.
   *
   * @param userId - ID of the authenticated user.
   * @param request - Current and new passwords.
   * @returns Success response.
   */
  public async changePassword(
    userId: string,
    request: IPasswordChangeRequest,
  ): Promise<ISuccessResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const isCurrentValid = await this.crypto.verifyPassword(
      request.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException("Incorrect current password.");
    }

    // Re-encrypt private key with new password if present
    let updatedEncryptedPrivateKey = user.encryptedPrivateKey;
    if (user.encryptedPrivateKey) {
      try {
        const decryptedPrivatePem = await this.crypto.decryptPrivateKey(
          user.encryptedPrivateKey,
          request.currentPassword,
        );
        updatedEncryptedPrivateKey = await this.crypto.encryptPrivateKey(
          decryptedPrivatePem,
          request.newPassword,
        );
      } catch (error) {
        console.error("[AUTH] Private key re-encryption error:", error);
      }
    }

    const newPasswordHash = await this.crypto.hashPassword(request.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        encryptedPrivateKey: updatedEncryptedPrivateKey,
        passwordChangedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Password changed successfully. All previous active sessions have been revoked.",
    };
  }

  /**
   * Initiates password recovery email link.
   *
   * @param request - Account email address.
   * @returns Success acknowledgment.
   */
  public async forgotPassword(request: IPasswordForgotRequest): Promise<ISuccessResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: request.email },
      select: { id: true, email: true },
    });

    if (user) {
      const resetToken = this.crypto.generateSecureToken(32);
      // Cache reset token for 1 hour (3600 seconds)
      await this.cache.set(`iris:auth:password_reset:${resetToken}`, user.id, 3600);

      console.log(`[AUTH] Password recovery token for ${user.email}: [${resetToken}]`);
    }

    return {
      success: true,
      message: "If an account with that email exists, password reset instructions have been sent.",
    };
  }

  /**
   * Resets password using a valid recovery token.
   *
   * @param request - Recovery token and new password.
   * @returns Success acknowledgment.
   */
  public async resetPassword(request: IPasswordResetRequest): Promise<ISuccessResponse> {
    const userId = await this.cache.get<string>(
      `iris:auth:password_reset:${request.token}`,
    );

    if (!userId) {
      throw new BadRequestException("Password reset token is invalid or has expired.");
    }

    const newPasswordHash = await this.crypto.hashPassword(request.newPassword);
    const { publicKey, encryptedPrivateKey } =
      await this.crypto.generateUserKeypair(request.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        publicKey,
        encryptedPrivateKey,
        passwordChangedAt: new Date(),
      },
    });

    // Invalidate reset token
    await this.cache.del(`iris:auth:password_reset:${request.token}`);

    return {
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
    };
  }
}
