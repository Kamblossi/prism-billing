import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import internalLicenseRoutes from "./routes/internal/licenses.js";
import paystackProviderRoutes from "./routes/provider/paystack.js";
import publicCheckoutRoutes from "./routes/public/checkout.js";
import publicPayRoutes from "./routes/public/pay.js";

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        env.ALLOWED_ORIGINS.length === 0 ||
        env.ALLOWED_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);

// Keep provider webhook routes ahead of express.json for future raw-body verification.
app.use(paystackProviderRoutes);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(publicCheckoutRoutes);
app.use(publicPayRoutes);
app.use(internalLicenseRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`prism-billing listening on http://localhost:${env.PORT}`);
});