import { Module } from "@nestjs/common";
import { PrismaService } from "../../providers/prisma.service";
import { AuthController } from "./controllers/auth/auth.controller";
import { AuthPasskeyController } from "./controllers/passkey/auth-passkey.controller";
import { AuthCodeController } from "./controllers/code/auth-code.controller";
import { AccountMfaController } from "./controllers/mfa/account-mfa.controller";
import { AuthService } from "./services/auth.service";
import { CryptoService } from "./services/crypto.service";
import { PasskeyService } from "./services/passkey.service";
import { CodeService } from "./services/code.service";
import { MfaService } from "./services/mfa.service";

/**
 * Core user account and security NestJS module.
 *
 * Provides:
 * - Primary credential authentication and registration (/auth/*)
 * - WebAuthn Passkeys (/auth/passkey/*)
 * - Quick-connect device login codes (/auth/code/*)
 * - Multi-Factor Authentication with TOTP, Email OTP, and Backup Codes (/account/mfa/*)
 */
@Module({
  controllers: [
    AuthController,
    AuthPasskeyController,
    AuthCodeController,
    AccountMfaController,
  ],
  providers: [
    PrismaService,
    AuthService,
    CryptoService,
    PasskeyService,
    CodeService,
    MfaService,
  ],
  exports: [
    AuthService,
    CryptoService,
    PasskeyService,
    CodeService,
    MfaService,
  ],
})
export class IrisAccountModule {}
