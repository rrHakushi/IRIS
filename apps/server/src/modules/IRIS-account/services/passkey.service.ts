import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { PrismaService } from "../../../providers/prisma.service";
import { CacheService } from "@IRIS/cache";
import {
  IPasskeyLoginOptionsResponse,
  IPasskeyRegisterOptionsResponse,
  IPasskeySummary,
} from "../dtos/passkey.dto";

/**
 * Service managing WebAuthn Passkeys (passwordless assertion and registration) using `@simplewebauthn/server`.
 */
@Injectable()
export class PasskeyService {
  /**
   * Relying party display name.
   */
  private readonly rpName = "IRIS";

  /**
   * Relying party identifier / domain.
   */
  private readonly rpId = process.env.RP_ID || "localhost";

  /**
   * Expected WebAuthn Origin.
   */
  private readonly origin = process.env.ORIGIN || "http://localhost:3000";

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Generates WebAuthn authentication options for passkey login.
   *
   * @param identifier - Optional username or email identifier.
   * @returns Challenge options for `navigator.credentials.get()`.
   */
  public async generateLoginOptions(
    identifier?: string,
  ): Promise<IPasskeyLoginOptionsResponse> {
    let allowCredentials: { id: string; type: "public-key"; transports?: ("usb" | "ble" | "nfc" | "internal" | "hybrid")[] }[] | undefined;

    if (identifier) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { username: identifier }],
        },
        include: { passkeys: true },
      });

      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((pk) => ({
          id: pk.id,
          type: "public-key" as const,
          transports: pk.transports as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      allowCredentials,
      userVerification: "preferred",
      timeout: 60000,
    });

    // Store challenge with 5-minute TTL
    await this.cache.set(
      `iris:passkey:challenge:${options.challenge}`,
      options.challenge,
      300,
    );

    return {
      challenge: options.challenge,
      rpId: this.rpId,
      allowCredentials: options.allowCredentials?.map((cred) => ({
        id: cred.id,
        type: "public-key" as const,
        transports: cred.transports,
      })),
      timeout: 60000,
      userVerification: "preferred",
    };
  }

  /**
   * Verifies a WebAuthn authentication assertion response.
   *
   * @param responseJSON - Assertion response from client.
   * @returns User ID of the verified passkey owner.
   */
  public async verifyLogin(
    responseJSON: AuthenticationResponseJSON,
  ): Promise<string> {
    const passkey = await this.prisma.passkey.findUnique({
      where: { id: responseJSON.id },
      include: { user: true },
    });

    if (!passkey) {
      throw new UnauthorizedException("Passkey not recognized.");
    }

    // Retrieve expected challenge from clientDataJSON
    let expectedChallenge: string | null = null;
    try {
      const clientData = JSON.parse(
        Buffer.from(responseJSON.response.clientDataJSON, "base64url").toString("utf8"),
      );
      expectedChallenge = await this.cache.get<string>(
        `iris:passkey:challenge:${clientData.challenge}`,
      );
    } catch {
      throw new BadRequestException("Malformed clientDataJSON.");
    }

    if (!expectedChallenge) {
      throw new UnauthorizedException("Passkey challenge has expired or is invalid.");
    }

    const verification = await verifyAuthenticationResponse({
      response: responseJSON,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
        transports: passkey.transports as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[],
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      throw new UnauthorizedException("Passkey verification failed.");
    }

    // Update credential counter
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
      },
    });

    // Invalidate challenge
    await this.cache.del(`iris:passkey:challenge:${expectedChallenge}`);

    return passkey.userId;
  }

  /**
   * Generates WebAuthn registration options for an enrolled user.
   *
   * @param userId - ID of the authenticated user.
   * @returns Registration options for `navigator.credentials.create()`.
   */
  public async generateRegisterOptions(
    userId: string,
  ): Promise<IPasskeyRegisterOptionsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userID: Buffer.from(user.id, "utf8"),
      userName: user.username,
      userDisplayName: user.username,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.id,
        type: "public-key",
        transports: pk.transports as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60000,
    });

    // Store challenge with 5-minute TTL
    await this.cache.set(
      `iris:passkey:challenge:${options.challenge}`,
      options.challenge,
      300,
    );

    return {
      challenge: options.challenge,
      rp: {
        name: this.rpName,
        id: this.rpId,
      },
      user: {
        id: user.id,
        name: user.username,
        displayName: user.username,
      },
      pubKeyCredParams: options.pubKeyCredParams.map((p) => ({
        alg: p.alg,
        type: "public-key" as const,
      })),
      timeout: 60000,
      authenticatorSelection: options.authenticatorSelection,
    };
  }

  /**
   * Verifies and registers a new passkey.
   *
   * @param userId - ID of the authenticated user.
   * @param responseJSON - Attestation response from client.
   * @param name - Optional label for the passkey.
   * @returns Success boolean.
   */
  public async verifyRegister(
    userId: string,
    responseJSON: RegistrationResponseJSON,
    name?: string | null,
  ): Promise<boolean> {
    let expectedChallenge: string | null = null;
    try {
      const clientData = JSON.parse(
        Buffer.from(responseJSON.response.clientDataJSON, "base64url").toString("utf8"),
      );
      expectedChallenge = await this.cache.get<string>(
        `iris:passkey:challenge:${clientData.challenge}`,
      );
    } catch {
      throw new BadRequestException("Malformed clientDataJSON.");
    }

    if (!expectedChallenge) {
      throw new UnauthorizedException("Passkey registration challenge has expired.");
    }

    const verification = await verifyRegistrationResponse({
      response: responseJSON,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException("Passkey registration verification failed.");
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.passkey.create({
      data: {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: (credential.transports ?? []) as string[],
        name: name ?? "Passkey",
        userId,
      },
    });

    // Invalidate challenge
    await this.cache.del(`iris:passkey:challenge:${expectedChallenge}`);

    return true;
  }

  /**
   * Lists all passkeys registered by the user.
   *
   * @param userId - ID of the user.
   * @returns Array of passkey summaries.
   */
  public async listUserPasskeys(userId: string): Promise<IPasskeySummary[]> {
    const passkeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return passkeys.map((pk) => ({
      id: pk.id,
      name: pk.name,
      createdAt: pk.createdAt.toISOString(),
    }));
  }

  /**
   * Deletes a registered passkey.
   *
   * @param userId - ID of the owner.
   * @param passkeyId - ID of the passkey to delete.
   * @returns Success boolean.
   */
  public async deletePasskey(userId: string, passkeyId: string): Promise<boolean> {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new NotFoundException("Passkey not found.");
    }

    await this.prisma.passkey.delete({
      where: { id: passkeyId },
    });

    return true;
  }
}
