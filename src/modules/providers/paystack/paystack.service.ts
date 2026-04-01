import crypto from "node:crypto";
import { env } from "../../../config/env.js";

type InitializePaystackTransactionInput = {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

type InitializePaystackTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

type VerifyPaystackTransactionResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function getPaystackConfig() {
  return {
    secretKey: env.PAYSTACK_SECRET_KEY,
    callbackUrl: env.PAYSTACK_CALLBACK_URL,
  };
}

export async function initializePaystackTransaction(
  input: InitializePaystackTransactionInput,
): Promise<InitializePaystackTransactionResult> {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl ?? env.PAYSTACK_CALLBACK_URL,
      metadata: input.metadata ?? {},
    }),
  });

  const payload: any = await response.json();

  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    throw new Error(
      payload?.message ?? "Failed to initialize Paystack transaction",
    );
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code,
    reference: payload.data.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<VerifyPaystackTransactionResult> {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  const payload: any = await response.json();

  if (!response.ok || !payload?.status || !payload?.data) {
    throw new Error(payload?.message ?? "Failed to verify Paystack transaction");
  }

  return {
    status: payload.data.status,
    reference: payload.data.reference,
    amount: payload.data.amount,
    currency: payload.data.currency,
    paidAt: payload.data.paid_at ?? null,
    metadata: payload.data.metadata ?? null,
  };
}

export function verifyPaystackWebhookSignature(
  rawBody: Buffer,
  signatureHeader?: string | null,
): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  const provided = signatureHeader.trim();

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(provided, "utf8"),
  );
}

export function buildPaystackEventDedupeKey(
  eventType: string,
  eventReference: string | null,
  rawBody: Buffer,
): string {
  const rawHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  return `paystack:${eventType}:${eventReference ?? "no-reference"}:${rawHash}`;
}
