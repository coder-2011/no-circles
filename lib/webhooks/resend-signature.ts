import { createHmac, timingSafeEqual } from "node:crypto";

export type ResendSignatureHeaders = {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
};

export function getSvixHeaders(request: Request): ResendSignatureHeaders | null {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null;
  }

  return { svixId, svixTimestamp, svixSignature };
}

function normalizeSecret(secret: string): Buffer {
  if (secret.startsWith("whsec_")) {
    return Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  }

  return Buffer.from(secret, "utf8");
}

function safeCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyResendWebhookSignature(
  rawBody: string,
  headers: ResendSignatureHeaders,
  secret: string
): boolean {
  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", normalizeSecret(secret))
    .update(signedContent)
    .digest("base64");

  const signatures = headers.svixSignature
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(","))
    .filter(([version, sig]) => version === "v1" && Boolean(sig))
    .map(([, sig]) => sig);

  return signatures.some((signature) => safeCompare(expectedSignature, signature));
}
