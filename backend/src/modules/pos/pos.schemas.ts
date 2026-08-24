import { z } from "zod";

export const uuid = z.string().uuid();
export const idParams = z.object({ id: uuid });
export const orderItemParams = z.object({ id: uuid, itemId: uuid });
export const minorUnits = z
  .string()
  .regex(/^\d+$/, "Expected non-negative integer minor units")
  .transform(BigInt);
const nullableText = z.string().trim().max(1000).nullable().optional();

export const tableBody = z.object({
  id: uuid.optional(),
  code: z.string().trim().min(1).max(30),
  displayName: z.string().trim().max(100).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const tablePatchBody = tableBody.omit({ id: true }).partial();
export const openOrderBody = z.object({
  id: uuid.optional(),
  tableId: uuid,
  guestCount: z.number().int().positive().nullable().optional(),
  notes: nullableText,
});
export const orderPatchBody = z.object({
  expectedVersion: z.number().int().positive(),
  guestCount: z.number().int().positive().nullable().optional(),
  notes: nullableText,
});
export const addItemBody = z.object({
  id: uuid.optional(),
  expectedVersion: z.number().int().positive(),
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: nullableText,
  modifierOptionIds: z.array(uuid).default([]),
});
export const updateItemBody = z.object({
  expectedVersion: z.number().int().positive(),
  quantity: z.number().int().positive(),
  notes: nullableText,
});
export const versionBody = z.object({
  expectedVersion: z.number().int().positive(),
});
export const removeItemQuery = z.object({
  expectedVersion: z.coerce.number().int().positive(),
});
export const transferBody = versionBody.extend({ destinationTableId: uuid });
export const mergeBody = versionBody.extend({
  sourceOrderIds: z.array(uuid).min(1),
});
export const discountBody = z.discriminatedUnion("type", [
  versionBody.extend({
    type: z.literal("PERCENTAGE"),
    percentageBasisPoints: z.number().int().min(1).max(10_000),
    reason: z.string().trim().min(1).max(500),
  }),
  versionBody.extend({
    type: z.literal("FIXED"),
    fixedAmountMinor: minorUnits,
    reason: z.string().trim().min(1).max(500),
  }),
]);
const payment = z.object({
  id: uuid.optional(),
  method: z.literal("CASH"),
  amountMinor: minorUnits,
  tenderedMinor: minorUnits,
});
export const finalizeBody = z.object({
  id: uuid.optional(),
  orderId: uuid,
  expectedVersion: z.number().int().positive(),
  invoiceNumber: z
    .string()
    .regex(/^RWQ-[A-Z0-9_-]+-\d{4}-\d{6}$/)
    .optional(),
  lines: z
    .array(
      z.object({ orderItemId: uuid, quantity: z.number().int().positive() }),
    )
    .optional(),
  payments: z.array(payment).optional(),
  split: z
    .object({
      groupId: uuid,
      index: z.number().int().positive(),
      count: z.number().int().min(2),
    })
    .refine(
      (value) => value.index <= value.count,
      "Split index must not exceed count",
    )
    .optional(),
});
export const equalSplitBody = z
  .object({
    orderId: uuid,
    expectedVersion: z.number().int().positive(),
    splitGroupId: uuid.optional(),
    splitCount: z.number().int().min(2).max(50),
    invoices: z
      .array(
        z.object({
          id: uuid.optional(),
          invoiceNumber: z
            .string()
            .regex(/^RWQ-[A-Z0-9_-]+-\d{4}-\d{6}$/)
            .optional(),
          payments: z.array(payment).optional(),
          allocations: z
            .array(
              z.object({
                orderItemId: uuid,
                quantityNumerator: minorUnits,
                quantityDenominator: minorUnits,
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.invoices && value.invoices.length !== value.splitCount)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["invoices"],
        message: "Invoice request count must match splitCount",
      });
  });
export const paymentBody = payment;
export const voidBody = z.object({
  id: uuid.optional(),
  reason: z.string().trim().min(1).max(500),
});
export const refundBody = z.object({
  id: uuid.optional(),
  amountMinor: minorUnits,
  reason: z.string().trim().min(1).max(500),
  lines: z
    .array(
      z.object({
        id: uuid.optional(),
        invoiceLineId: uuid,
        quantity: z.number().int().positive(),
        amountMinor: minorUnits,
      }),
    )
    .optional(),
  payments: z
    .array(
      z.object({
        id: uuid.optional(),
        paymentId: uuid,
        amountMinor: minorUnits,
      }),
    )
    .optional(),
});
export const openShiftBody = z.object({
  id: uuid.optional(),
  openingCashMinor: minorUnits,
});
export const closeShiftBody = z.object({ actualClosingCashMinor: minorUnits });
export const reservationBody = z.object({
  id: uuid.optional(),
  customerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  guestCount: z.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  notes: nullableText,
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "SEATED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ])
    .optional(),
  tableIds: z.array(uuid).default([]),
});
export const reservationPatchBody = reservationBody
  .omit({ id: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const printBody = z.object({
  id: uuid.optional(),
  type: z.enum(["INITIAL", "REPRINT"]),
  paperWidthMm: z.union([z.literal(58), z.literal(80)]),
  profileName: z.string().trim().max(80).optional(),
});
export const listInvoicesQuery = z.object({
  businessDate: z.string().date().optional(),
  status: z
    .enum(["OPEN", "PAID", "VOIDED", "PARTIALLY_REFUNDED", "REFUNDED"])
    .optional(),
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const adminInvoicesQuery = z.object({
  invoiceNumber: z.string().trim().max(80).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  table: z.string().trim().max(80).optional(),
  cashier: z.string().trim().max(120).optional(),
  paymentMethod: z.enum(["CASH", "VISA"]).optional(),
  status: z
    .enum(["OPEN", "PAID", "VOIDED", "PARTIALLY_REFUNDED", "REFUNDED"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const adminAuditQuery = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const reservationsQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "SEATED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ])
    .optional(),
});
export const bootstrapQuery = z.object({ deviceId: uuid });
export const reportsQuery = z.object({
  from: z.string().date(),
  to: z.string().date(),
});
export const exportQuery = reportsQuery.extend({
  format: z.enum(["pdf", "xlsx"]),
});

export const deviceBody = z.object({
  id: uuid.optional(),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{1,20}$/),
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
});
export const devicePatchBody = deviceBody
  .omit({ id: true, code: true })
  .partial();
export const pairBody = z.object({
  userId: z.string().min(1),
  pin: z.string().regex(/^\d{4,12}$/),
});

export const syncOperationSchema = z.object({
  operationId: uuid,
  localSequence: minorUnits,
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  operationType: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()),
  dependencies: z.array(uuid).default([]),
});
export const syncPushBody = z.object({
  deviceId: uuid,
  operations: z.array(syncOperationSchema).min(1).max(100),
});
export const syncPullQuery = z.object({
  cursor: z.coerce.string().regex(/^\d+$/).default("0").transform(BigInt),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
