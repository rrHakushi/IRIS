import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import * as otplibModule from "otplib";

interface IOtplibAuthenticator {
  options?: { window?: number; [key: string]: unknown };
  generateSecret(length?: number): string;
  keyuri(user: string, service: string, secret: string): string;
  verify(options: { token: string; secret: string }): boolean;
  check(token: string, secret: string): boolean;
}

const authenticator: IOtplibAuthenticator =
  (otplibModule as unknown as { authenticator?: IOtplibAuthenticator; default?: { authenticator?: IOtplibAuthenticator } }).authenticator ??
  (otplibModule as unknown as { default?: { authenticator?: IOtplibAuthenticator } }).default?.authenticator ??
  (otplibModule as unknown as IOtplibAuthenticator);
import * as QRCode from "qrcode";
import { CacheService } from "@IRIS/cache";
import { PrismaService } from "../../../providers/prisma.service";
import { randomBytes, randomInt } from "node:crypto";
import { CryptoService } from "./crypto.service";
import {
  ITotpSetupResponse,
  ITotpEnableResponse,
} from "../dtos/mfa.dto";

/**
 * Service managing Multi-Factor Authentication (TOTP Authenticator, Email OTPs, and Emergency Backup Codes).
 */
@Injectable()
export class MfaService {
  /**
   * Service name displayed in Authenticator apps.
   */
  private static readonly SERVICE_NAME = "IRIS";

  /**
   * MFA Challenge Ticket validity (5 minutes = 300 seconds).
   */
  private static readonly TICKET_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly crypto: CryptoService,
  ) {
    authenticator.options = {
      window: 1, // Allows 1 step drift (+/- 30s)
    };
  }

  /**
   * Generates a new unconfirmed TOTP secret key and QR code data URL for enrollment.
   *
   * @param userId - ID of the user enrolling in TOTP.
   * @param email - Primary user email for the authenticator label.
   * @returns Object with secret, otpauth URL, and base64 QR code image.
   */
  public async setupTotp(userId: string, email: string): Promise<ITotpSetupResponse> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, MfaService.SERVICE_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Temporarily cache unconfirmed secret for 15 minutes
    await this.cache.set(`iris:mfa:totp_setup:${userId}`, secret, 900);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verifies the user's initial TOTP token, saves the secret, enables TOTP, and returns 10 backup codes.
   *
   * @param userId - ID of the user.
   * @param code - 6-digit confirmation code from the authenticator app.
   * @returns Enablement status and the list of emergency backup codes.
   */
  public async enableTotp(userId: string, code: string): Promise<ITotpEnableResponse> {
    const pendingSecret = await this.cache.get<string>(`iris:mfa:totp_setup:${userId}`);
    if (!pendingSecret) {
      throw new BadRequestException(
        "No pending TOTP setup session found or it has expired. Please initiate setup again.",
      );
    }

    const isValid = authenticator.verify({
      token: code,
      secret: pendingSecret,
    });

    if (!isValid) {
      throw new BadRequestException("Invalid authenticator code.");
    }

    const backupCodes = this.generateBackupCodes();

    // Hash backup codes before saving in database for security
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((bc) => this.crypto.hashPassword(bc)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        TOTPSecret: pendingSecret,
        TOTPEnabled: true,
        backupCodes: hashedBackupCodes,
      },
    });

    // Clear setup cache
    await this.cache.del(`iris:mfa:totp_setup:${userId}`);

    return {
      success: true,
      backupCodes,
    };
  }

  /**
   * Disables TOTP on the user's account after confirming their password.
   *
   * @param userId - ID of the user.
   * @param password - Account password.
   * @returns Success boolean.
   */
  public async disableTotp(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const isValidPassword = await this.crypto.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException("Incorrect password.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        TOTPSecret: null,
        TOTPEnabled: false,
      },
    });

    return true;
  }

  /**
   * Toggles Email MFA for the user.
   *
   * @param userId - ID of the user.
   * @param enabled - Enable or disable flag.
   * @returns Success boolean.
   */
  public async toggleEmailMfa(userId: string, enabled: boolean): Promise<boolean> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailMfaEnabled: enabled,
      },
    });
    return true;
  }

  /**
   * Creates a short-lived MFA challenge ticket stored in cache.
   *
   * @param userId - The user undergoing secondary verification.
   * @param allowedTypes - List of enabled MFA methods.
   * @returns 5-minute MFA ticket string.
   */
  public async createMfaTicket(
    userId: string,
    allowedTypes: ("totp" | "email" | "passkey")[],
  ): Promise<string> {
    const ticket = randomBytes(24).toString("hex");
    await this.cache.set(
      `iris:mfa:ticket:${ticket}`,
      { userId, allowedTypes },
      MfaService.TICKET_TTL,
    );
    return ticket;
  }

  /**
   * Sends a 6-digit email OTP verification code.
   *
   * @param mfaTicket - Valid MFA challenge ticket.
   * @returns Success boolean.
   */
  public async sendEmailMfaCode(mfaTicket: string): Promise<boolean> {
    const ticketData = await this.cache.get<{
      userId: string;
      allowedTypes: string[];
    }>(`iris:mfa:ticket:${mfaTicket}`);

    if (!ticketData) {
      throw new UnauthorizedException("MFA ticket has expired or is invalid.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ticketData.userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const code = String(randomInt(100000, 999999));

    // Cache the email code for 5 minutes
    await this.cache.set(`iris:mfa:email_code:${mfaTicket}`, code, MfaService.TICKET_TTL);

    // Email dispatcher stub (will be integrated with email service/provider)
    console.log(`[AUTH MFA] Sent Email verification code [${code}] to ${user.email}`);

    return true;
  }

  /**
   * Verifies an MFA challenge token (TOTP, Email OTP, or emergency backup code).
   *
   * @param mfaTicket - Challenge ticket from step 1.
   * @param mfaType - Strategy being verified.
   * @param code - 6-digit code or backup code.
   * @returns User ID upon successful verification.
   */
  public async verifyMfaChallenge(
    mfaTicket: string,
    mfaType: "totp" | "email" | "backup_code",
    code: string,
  ): Promise<string> {
    const ticketData = await this.cache.get<{
      userId: string;
      allowedTypes: string[];
    }>(`iris:mfa:ticket:${mfaTicket}`);

    if (!ticketData) {
      throw new UnauthorizedException("MFA ticket has expired or is invalid.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ticketData.userId },
      select: {
        id: true,
        TOTPSecret: true,
        TOTPEnabled: true,
        backupCodes: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (mfaType === "totp") {
      if (!user.TOTPEnabled || !user.TOTPSecret) {
        throw new BadRequestException("TOTP is not enabled for this account.");
      }
      const isValid = authenticator.verify({
        token: code,
        secret: user.TOTPSecret,
      });
      if (!isValid) {
        throw new UnauthorizedException("Invalid authenticator code.");
      }
    } else if (mfaType === "email") {
      const storedEmailCode = await this.cache.get<string>(
        `iris:mfa:email_code:${mfaTicket}`,
      );
      if (!storedEmailCode || storedEmailCode !== code) {
        throw new UnauthorizedException("Invalid or expired email verification code.");
      }
      await this.cache.del(`iris:mfa:email_code:${mfaTicket}`);
    } else if (mfaType === "backup_code") {
      let matchedIndex = -1;
      for (let i = 0; i < user.backupCodes.length; i++) {
        const storedHash = user.backupCodes[i];
        if (storedHash && (await this.crypto.verifyPassword(code, storedHash))) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        throw new UnauthorizedException("Invalid backup code.");
      }

      // Consume single-use backup code
      const remainingCodes = [...user.backupCodes];
      remainingCodes.splice(matchedIndex, 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: remainingCodes },
      });
    }

    // Invalidate ticket after successful verification
    await this.cache.del(`iris:mfa:ticket:${mfaTicket}`);

    return user.id;
  }

  /**
   * Generates fresh single-use emergency backup codes.
   *
   * @param userId - ID of the user.
   * @returns List of plain backup codes.
   */
  public async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes();
    const hashed = await Promise.all(
      backupCodes.map((bc) => this.crypto.hashPassword(bc)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashed },
    });

    return backupCodes;
  }

  /**
   * Generates 10 readable backup codes in format `XXXX-XXXX`.
   */
  private generateBackupCodes(count: number = 10): string[] {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      let part1 = "";
      let part2 = "";
      for (let j = 0; j < 4; j++) {
        part1 += chars[randomInt(0, chars.length)];
        part2 += chars[randomInt(0, chars.length)];
      }
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }
}
