import crypto from "node:crypto";

export function generateProviderReference(appId: string): string {
  const safeAppId = appId.trim().toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");

  return `${safeAppId}_${timestamp}_${random}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}