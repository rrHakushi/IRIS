import path from "node:path";
import dotenv from "dotenv";
import { INestiaConfig } from "@nestia/sdk";

// Load root monorepo .env and local .env from cwd and relative locations
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

export const NESTIA_CONFIG: INestiaConfig = {
  input: ["src/modules/**/*.controller.ts"],
  output: "../../packages/api",
  swagger: {
    output: "../../packages/swagger/swagger.json",
    openapi: "3.1",
    beautify: true,
    decompose: true,
    info: {
      title: "IRIS API",
      version: "0.0.1",
      description: "Next-generation entertainment and account management backend API",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Development Server",
      },
    ],
    tags: [
      { name: "auth", description: "Primary authentication, registration, and password lifecycle." },
      { name: "auth/passkey", description: "WebAuthn passwordless passkey login and enrollment." },
      { name: "auth/code", description: "Quick-connect device code and QR code authorization." },
      { name: "account/mfa", description: "Multi-Factor Authentication (TOTP, Email OTP, Backup Codes)." },
    ],
  },
  simulate: true,
  e2e: "test",
};

export default NESTIA_CONFIG;
