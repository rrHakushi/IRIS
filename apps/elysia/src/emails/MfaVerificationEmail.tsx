import React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";

export interface MfaVerificationEmailProps {
  code: string;
  validityMinutes?: number;
  appName?: string;
}

export const MfaVerificationEmail: React.FC<MfaVerificationEmailProps> = ({
  code,
  validityMinutes = 5,
  appName = "IRIS",
}) => {
  return (
    <Html>
      <Head />
      <Preview>{`Your ${appName} verification code is ${code}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Heading style={brandHeading}>{appName}</Heading>
            <Text style={brandSubheading}>Security Verification</Text>
          </Section>

          {/* Card */}
          <Section style={cardSection}>
            <Heading as="h3" style={cardHeading}>
              Login Verification Code
            </Heading>
            <Text style={cardText}>
              Use the single-use verification code below to complete your sign-in to{" "}
              {appName}.
            </Text>

            <Section style={codeWrapper}>
              <Text style={codeText}>{code}</Text>
            </Section>

            <Text style={expiryText}>
              This code will expire in <strong>{validityMinutes} minutes</strong>.
            </Text>
          </Section>

          {/* Footer Notice */}
          <Section style={footerSection}>
            <Text style={noticeText}>
              <strong>Security Notice:</strong> If you did not initiate this sign-in
              attempt, please disregard this email or update your password
              immediately.
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

export default MfaVerificationEmail;

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
  marginBottom: "24px",
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

const codeWrapper: React.CSSProperties = {
  backgroundColor: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: "10px",
  padding: "16px 24px",
  margin: "0 auto 20px auto",
  display: "inline-block",
};

const codeText: React.CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  color: "#38bdf8",
  fontSize: "36px",
  fontWeight: 800,
  letterSpacing: "0.28em",
  margin: 0,
  textAlign: "center",
};

const expiryText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  margin: 0,
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
