// @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/stripe-billing@0.2.0. Drift = commit rejected.
//
// Shared billing schemas + types. Client-safe: no server-only imports, no secrets.

import { z } from 'zod';

export const checkoutSessionQuerySchema = z.object({
  session_id: z.string().min(1, 'session_id is required'),
});

export const verifiedPaymentSchema = z.object({
  amount_usd: z.number(),
  customer_email: z.string().email().nullable().optional(),
  product_name: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
});

export const checkoutVerificationResultSchema = z.object({
  verified: z.boolean(),
  payment: verifiedPaymentSchema.optional(),
  error: z.string().optional(),
});

export const subscriptionStatusResultSchema = z.object({
  active: z.boolean(),
  plan: z.string().optional(),
  monthly_amount: z.number().optional(),
  current_period_end: z.string().nullable().optional(),
  customer_email: z.string().email().optional(),
  error: z.string().optional(),
});

// -- Runtime checkout (created from app code through Polsia's proxy) ---------

export const checkoutLineItemSchema = z.object({
  name: z.string().min(1),
  amountUsd: z.number().min(0.5, 'each line item must be at least $0.50'),
  quantity: z.number().int().min(1).optional(),
});

export const createCheckoutSessionInputSchema = z
  .object({
    lineItems: z.array(checkoutLineItemSchema).min(1).optional(),
    amountUsd: z.number().min(1).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    customerEmail: z.string().email().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    /**
     * Force the buyer to enter a shipping address at checkout. Set this when the
     * app ships physical goods — the address comes back on the payment event
     * (`event.shipping`), so you always know where to ship. Leave unset for
     * digital goods, tickets, or subscriptions.
     */
    collectShippingAddress: z.boolean().optional(),
    /** ISO 3166-1 alpha-2 codes the buyer may ship to (default: a broad common set). */
    shippingCountries: z.array(z.string().length(2)).optional(),
  })
  .refine((v) => Boolean(v.lineItems?.length) !== Boolean(v.amountUsd), {
    message: 'provide either lineItems or amountUsd, not both',
  });

export const checkoutSessionResultSchema = z.object({
  id: z.number(),
  stripeSessionId: z.string(),
  url: z.string().url(),
  totalAmountUsd: z.number(),
  companyReceives: z.number(),
  platformFee: z.number(),
});

// -- Payment events feed (cursor-based fulfillment, no inbound callbacks) ----

/** Buyer's shipping address — present only when the checkout collected one. */
export const shippingAddressSchema = z.object({
  name: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
});

export const paymentEventSchema = z.object({
  id: z.number(),
  type: z.string(),
  amountUsd: z.number().nullable(),
  customerEmail: z.string().nullable(),
  description: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  stripeCheckoutSessionId: z.string().nullable(),
  /** Where to ship, when the checkout collected a shipping address; else null. */
  shipping: shippingAddressSchema.nullable(),
  occurredAt: z.string(),
});

export const paymentEventsResultSchema = z.object({
  events: z.array(paymentEventSchema),
  nextCursor: z.number(),
});

export type CheckoutVerificationResult = z.infer<typeof checkoutVerificationResultSchema>;
export type SubscriptionStatusResult = z.infer<typeof subscriptionStatusResultSchema>;
export type CheckoutLineItem = z.infer<typeof checkoutLineItemSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionInputSchema>;
export type CheckoutSessionResult = z.infer<typeof checkoutSessionResultSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type PaymentEventsResult = z.infer<typeof paymentEventsResultSchema>;
