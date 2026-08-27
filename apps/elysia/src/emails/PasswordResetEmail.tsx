import React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

export interface PasswordResetEmailProps {
  resetUrl: string;
  validityMinutes?: number;
  appName?: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  resetUrl,
  validityMinutes = 15,
  appName = "IRIS",
}) => {
  return (
    <Html>
      <Head />
      <Preview>{`Reset your ${appName} password`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Heading style={brandHeading}>{appName}</Heading>
            <Text style={brandSubheading}>Account Security</Text>
          </Section>

          {/* Card */}
          <Section style={cardSection}>
            <Heading as="h3" style={cardHeading}>
              Password Reset Request
            </Heading>
            <Text style={cardText}>
              We received a request to reset your password for your {appName}{" "}
              account. Click the button below to choose a new password.
            </Text>

            <Section style={buttonWrapper}>
              <Button style={resetButton} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            <Text style={expiryText}>
              This link is valid for <strong>{validityMinutes} minutes</strong>.
            </Text>
          </Section>

          {/* Alternative Link */}
          <Section style={fallbackSection}>
            <Text style={fallbackText}>
              If the button above does not work, copy and paste this URL into your
              browser:
            </Text>
            <Text style={urlText}>{resetUrl}</Text>
          </Section>

          {/* Footer Notice */}
          <Section style={footerSection}>
            <Text style={noticeText}>
              <strong>Security Notice:</strong> If you did not request a password
              reset, someone else may have entered your email by mistake. Your
              password will remain unchanged.
            </Text>
            <Hr style={divider} />
            <Text style={copyrightText}>
              &copy; {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

// --- Modern Dark-Themed Styles ---
const main: React.CSSProperties = {
  backgroundColor: "#09090b",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  padding: "40px 16px",
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  backgroundColor: "#09090b",
};

const headerSection: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "28px",
};

const brandHeading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: 800,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  margin: "0 0 4px 0",
};

const brandSubheading: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  margin: 0,
};

const cardSection: React.CSSProperties = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "14px",
  padding: "32px 28px",
  textAlign: "center",
  marginBottom: "20px",
};

const cardHeading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 700,
  margin: "0 0 12px 0",
};

const cardText: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 24px 0",
};

const buttonWrapper: React.CSSProperties = {
  margin: "0 auto 20px auto",
  textAlign: "center",
};

const resetButton: React.CSSProperties = {
  backgroundColor: "#38bdf8",
  color: "#09090b",
  fontSize: "14px",
  fontWeight: 700,
  borderRadius: "8px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
};

const expiryText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  margin: 0,
};

const fallbackSection: React.CSSProperties = {
  backgroundColor: "#111113",
  border: "1px solid #27272a",
  borderRadius: "8px",
  padding: "14px 16px",
  marginBottom: "24px",
};

const fallbackText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "11px",
  margin: "0 0 6px 0",
};

const urlText: React.CSSProperties = {
  color: "#38bdf8",
  fontSize: "11px",
  wordBreak: "break-all",
  margin: 0,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const footerSection: React.CSSProperties = {
  padding: "0 8px",
};

const noticeText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
};

const divider: React.CSSProperties = {
  borderColor: "#27272a",
  margin: "16px 0",
};

const copyrightText: React.CSSProperties = {
  color: "#52525b",
  fontSize: "11px",
  textAlign: "center",
  margin: 0,
};
