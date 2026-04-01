import { env } from "../../../config/env.js";

export function getPaystackConfig() {
  return {
    secretKey: env.PAYSTACK_SECRET_KEY,
    callbackUrl: env.PAYSTACK_CALLBACK_URL,
  };
}

export async function initializePaystackTransaction() {
  throw new Error("Not implemented yet");
}

export async function verifyPaystackTransaction() {
  throw new Error("Not implemented yet");
}

export function verifyPaystackWebhookSignature() {
  throw new Error("Not implemented yet");
}
