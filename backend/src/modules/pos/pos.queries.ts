import { prisma } from "../../lib/prisma.js";
import { ROLE_PERMISSIONS } from "../../config/permissions.js";
import { getCurrentCatalogRevision } from "../menu/catalogRevision.js";
import { PosDomainError } from "../../domain/pos/errors.js";

export async function bootstrap(actorId: string, deviceId: string) {
  const [
    actor,
    device,
    settings,
    shift,
    tables,
    categories,
    menuItems,
    modifierGroups,
    modifierLinks,
    reservations,
    catalogRevision,
  ] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: actorId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
    prisma.posDevice.findUnique({ where: { id: deviceId } }),
    prisma.restaurantSettings.findFirst({
      select: {
        name: true,
        footerText: true,
        posCurrency: true,
        timezone: true,
        businessDayCutoff: true,
        updatedAt: true,
      },
    }),
    prisma.cashierShift.findFirst({
      where: { userId: actorId, deviceId, status: "OPEN" },
    }),
    prisma.diningTable.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        orderAssignments: {
          where: { releasedAt: null },
          include: { order: { include: { items: true } } },
        },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { isArchived: false },
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.modifierGroup.findMany({
      include: { options: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItemModifierGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.reservation.findMany({
      where: {
        startsAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
      },
      include: { tables: true },
      orderBy: { startsAt: "asc" },
      take: 200,
    }),
    getCurrentCatalogRevision(),
  ]);
  if (!actor?.isActive || !device?.isActive)
    throw new PosDomainError(
      "DEVICE_NOT_AUTHORIZED",
      "User or device is inactive",
    );
  await prisma.posDevice.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date() },
  });
  return {
    device,
    user: { ...actor, permissions: ROLE_PERMISSIONS[actor.role] },
    settings,
    currentShift: shift,
    tables,
    catalog: {
      revision: catalogRevision,
      categories,
      menuItems,
      modifierGroups,
      menuItemModifierGroups: modifierLinks,
    },
    reservations,
  };
}

export const listTables = () =>
  prisma.diningTable.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      orderAssignments: {
        where: { releasedAt: null },
        include: { order: { include: { items: true } } },
      },
      reservations: { include: { reservation: true } },
    },
  });
export const getTable = (id: string) =>
  prisma.diningTable.findUnique({
    where: { id },
    include: {
      orderAssignments: {
        orderBy: { assignedAt: "desc" },
        take: 20,
        include: {
          order: { include: { items: { include: { modifiers: true } } } },
        },
      },
      reservations: { include: { reservation: true } },
    },
  });
export const getOrder = (id: string) =>
  prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { modifiers: true }, orderBy: { sortOrder: "asc" } },
      tables: { include: { table: true }, orderBy: { assignedAt: "asc" } },
      discounts: true,
      invoiceLinks: { include: { invoice: true } },
    },
  });
export const listInvoices = (query: {
  businessDate?: string;
  status?: "OPEN" | "PAID" | "VOIDED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  cursor?: string;
  limit: number;
}) =>
  prisma.invoice.findMany({
    where: {
      businessDate: query.businessDate
        ? new Date(`${query.businessDate}T00:00:00Z`)
        : undefined,
      status: query.status,
    },
    include: { tableSnapshots: true, payments: true },
    orderBy: { issuedAt: "desc" },
    take: query.limit,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
export const listReservations = (query: {
  from?: Date;
  to?: Date;
  status?:
    "PENDING" | "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}) =>
  prisma.reservation.findMany({
    where: {
      startsAt: { gte: query.from, lt: query.to },
      status: query.status,
    },
  include: { tables: { include: { table: true } } },
    orderBy: { startsAt: "asc" },
  });

export interface AdminInvoiceQuery {
  invoiceNumber?: string;
  from?: string;
  to?: string;
  table?: string;
  cashier?: string;
  paymentMethod?: "CASH" | "VISA";
  status?: "OPEN" | "PAID" | "VOIDED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  limit: number;
}
export const listAdminInvoices = (query: AdminInvoiceQuery) =>
  prisma.invoice.findMany({
    where: {
      invoiceNumber: query.invoiceNumber
        ? { contains: query.invoiceNumber, mode: "insensitive" }
        : undefined,
      businessDate:
        query.from || query.to
          ? {
              gte: query.from ? new Date(`${query.from}T00:00:00Z`) : undefined,
              lte: query.to ? new Date(`${query.to}T00:00:00Z`) : undefined,
            }
          : undefined,
      cashierNameSnapshot: query.cashier
        ? { contains: query.cashier, mode: "insensitive" }
        : undefined,
      status: query.status,
      tableSnapshots: query.table
        ? {
            some: {
              OR: [
                {
                  tableCodeSnapshot: {
                    contains: query.table,
                    mode: "insensitive",
                  },
                },
                {
                  tableDisplayNameSnapshot: {
                    contains: query.table,
                    mode: "insensitive",
                  },
                },
              ],
            },
          }
        : undefined,
      payments: query.paymentMethod
        ? { some: { method: query.paymentMethod } }
        : undefined,
    },
    include: { tableSnapshots: true, payments: true },
    orderBy: { issuedAt: "desc" },
    take: query.limit,
  });

export const getAdminInvoice = (id: string) =>
  prisma.invoice.findUnique({
    where: { id },
    include: {
      tableSnapshots: true,
      lines: { include: { modifiers: true }, orderBy: { sortOrder: "asc" } },
      allocationLines: {
        include: { modifiers: true },
        orderBy: { sortOrder: "asc" },
      },
      discounts: true,
      payments: true,
      refunds: {
        include: { lines: true, payments: true },
        orderBy: { refundedAt: "desc" },
      },
      void: true,
      printEvents: { orderBy: { createdAt: "desc" } },
    },
  });

export const listPosAudit = (query: { search?: string; limit: number }) =>
  prisma.activityLog.findMany({
    where: {
      AND: [
        {
          OR: [
            "Order",
            "Invoice",
            "Payment",
            "Refund",
            "Reservation",
            "CashierShift",
            "DiningTable",
            "PosDevice",
            "SyncOperation",
            "OrderDiscount",
            "InvoiceDiscount",
            "ReceiptPrintEvent",
          ].map((entityType) => ({ entityType })),
        },
        ...(query.search
          ? [
              {
                OR: [
                  {
                    summary: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    actorNameSnapshot: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    entityId: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });
