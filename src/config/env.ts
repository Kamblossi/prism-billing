import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const port = Number(process.env.PORT ?? 8787);

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port,

  DATABASE_URL: requireEnv("DATABASE_URL"),
  DIRECT_URL: process.env.DIRECT_URL ?? requireEnv("DATABASE_URL"),

  BACKEND_BASE_URL:
    process.env.BACKEND_BASE_URL ?? `http://localhost:${port}`,

  PAYSTACK_SECRET_KEY: requireEnv("PAYSTACK_SECRET_KEY"),
  INTERNAL_API_ACCESS_KEY: requireEnv("INTERNAL_API_ACCESS_KEY"),

  FRONTEND_BASE_URL:
    process.env.FRONTEND_BASE_URL ?? "https://rieko.prismtechco.com",

  DESKTOP_PRICING_URL:
    process.env.DESKTOP_PRICING_URL ?? "https://rieko.prismtechco.com/pricing",

  PAYSTACK_CALLBACK_URL:
    process.env.PAYSTACK_CALLBACK_URL ??
    "https://rieko.prismtechco.com/pay/success",

  PAYSTACK_WEBHOOK_PATH:
    process.env.PAYSTACK_WEBHOOK_PATH ?? "/providers/paystack/webhook",

  ALLOWED_ORIGINS: parseCsv(process.env.ALLOWED_ORIGINS),
};

export function getPaystackWebhookUrl(): string {
  return new URL(env.PAYSTACK_WEBHOOK_PATH, env.BACKEND_BASE_URL).toString();
}