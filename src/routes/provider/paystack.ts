import express, { Router } from "express";
import { prisma } from "../../db/prisma.js";
import {
  PaymentProvider,
  ProviderEventProcessingStatus,
} from "@prisma/client";
import { processSuccessfulPayment } from "../../modules/payments/payments.service.js";
import {
  buildPaystackEventDedupeKey,
  verifyPaystackWebhookSignature,
} from "../../modules/providers/paystack/paystack.service.js";

const router = Router();

router.post(
  "/providers/paystack/webhook",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body ?? "");

    const signature = req.get("x-paystack-signature");

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({
        error: "InvalidJSON",
        message: "Webhook payload is not valid JSON",
      });
    }

    const signatureValid = verifyPaystackWebhookSignature(rawBody, signature);

    if (!signatureValid) {
      return res.status(401).json({
        error: "InvalidSignature",
      });
    }

    const eventType = payload?.event ?? "unknown";
    const reference = payload?.data?.reference ?? null;
    const dedupeKey = buildPaystackEventDedupeKey(eventType, reference, rawBody);

    let providerEvent: { id: string } | undefined;

    try {
      providerEvent = await prisma.providerEvent.create({
        data: {
          provider: PaymentProvider.PAYSTACK,
          eventType,
          eventReference: reference,
          dedupeKey,
          signatureValid: true,
          payloadJson: payload,
          processingStatus: ProviderEventProcessingStatus.RECEIVED,
        },
        select: { id: true },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return res.status(200).json({
          received: true,
          duplicate: true,
        });
      }
      return next(error);
    }

    if (eventType !== "charge.success" || !reference) {
      await prisma.providerEvent.update({
        where: { id: providerEvent.id },
        data: {
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          processedAt: new Date(),
        },
      });

      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    try {
      await processSuccessfulPayment(reference);

      await prisma.providerEvent.update({
        where: { id: providerEvent.id },
        data: {
          processingStatus: ProviderEventProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      return res.status(200).json({
        received: true,
        processed: true,
        reference,
      });
    } catch (error) {
      await prisma.providerEvent.update({
        where: { id: providerEvent.id },
        data: {
          processingStatus: ProviderEventProcessingStatus.FAILED,
          processedAt: new Date(),
        },
      });

      return next(error);
    }
  },
);

export default router;
