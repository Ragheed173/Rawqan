import { Router, type Request } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendPosSuccess } from "../../utils/http.js";
import { PosDomainError, posAssert } from "../../domain/pos/errors.js";
import * as commands from "./pos.commands.js";
import * as queries from "./pos.queries.js";
import * as schemas from "./pos.schemas.js";
import * as sync from "./sync.service.js";
import * as devices from "./device.service.js";
import {
  buildSalesReport,
  exportSalesPdf,
  exportSalesXlsx,
} from "./reports.service.js";
import { pinLimiter } from "../../middleware/rateLimit.js";

function context(req: Request): commands.PosActorContext {
  const value = req.header("x-pos-device-id");
  const parsed = schemas.uuid.safeParse(value);
  if (!parsed.success)
    throw new PosDomainError(
      "DEVICE_NOT_AUTHORIZED",
      "x-pos-device-id header is required",
    );
  return {
    actorId: req.admin!.sub,
    deviceId: parsed.data,
    operationId: req.header("x-pos-operation-id") ?? undefined,
    ip: req.ip,
  };
}

const pos = Router();
pos.use(requireAuth, requirePermission("pos:operate"));

pos.get(
  "/bootstrap",
  validate({ query: schemas.bootstrapQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await queries.bootstrap(req.admin!.sub, req.query.deviceId as string),
    ),
  ),
);
pos.get(
  "/tables",
  asyncHandler(async (_req, res) =>
    sendPosSuccess(res, await queries.listTables()),
  ),
);
pos.get(
  "/tables/:id",
  validate({ params: schemas.idParams }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.getTable(req.params.id)),
  ),
);
pos.post(
  "/orders",
  validate({ body: schemas.openOrderBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await commands.openOrder(req.body, context(req)), 201),
  ),
);
pos.get(
  "/orders/:id",
  validate({ params: schemas.idParams }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.getOrder(req.params.id)),
  ),
);
pos.patch(
  "/orders/:id",
  validate({ params: schemas.idParams, body: schemas.orderPatchBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.updateOrder(req.params.id, req.body, context(req)),
    ),
  ),
);
pos.post(
  "/orders/:id/items",
  validate({ params: schemas.idParams, body: schemas.addItemBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.addOrderItem(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);
pos.patch(
  "/orders/:id/items/:itemId",
  validate({ params: schemas.orderItemParams, body: schemas.updateItemBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.updateOrderItem(
        req.params.id,
        req.params.itemId,
        req.body,
        context(req),
      ),
    ),
  ),
);
pos.delete(
  "/orders/:id/items/:itemId",
  validate({ params: schemas.orderItemParams, query: schemas.removeItemQuery }),
  asyncHandler(async (req, res) => {
    await commands.removeOrderItem(
      req.params.id,
      req.params.itemId,
      Number(req.query.expectedVersion),
      context(req),
    );
    return sendPosSuccess(res, { removed: true });
  }),
);
pos.post(
  "/orders/:id/request-bill",
  validate({ params: schemas.idParams, body: schemas.versionBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.requestBill(
        req.params.id,
        req.body.expectedVersion,
        context(req),
      ),
    ),
  ),
);
pos.post(
  "/orders/:id/transfer",
  validate({ params: schemas.idParams, body: schemas.transferBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.transferOrder(req.params.id, req.body, context(req)),
    ),
  ),
);
pos.post(
  "/orders/:id/merge",
  validate({ params: schemas.idParams, body: schemas.mergeBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.mergeOrders(req.params.id, req.body, context(req)),
    ),
  ),
);
pos.post(
  "/orders/:id/discounts",
  requirePermission("pos:discount"),
  validate({ params: schemas.idParams, body: schemas.discountBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.applyOrderDiscount(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);

pos.post(
  "/invoices/finalize",
  validate({ body: schemas.finalizeBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.finalizeInvoice(req.body, context(req)),
      201,
    ),
  ),
);
pos.post(
  "/invoices/finalize-equal-split",
  validate({ body: schemas.equalSplitBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.finalizeEqualSplit(req.body, context(req)),
      201,
    ),
  ),
);
pos.get(
  "/invoices",
  validate({ query: schemas.listInvoicesQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.listInvoices(req.query as never)),
  ),
);
pos.get(
  "/invoices/:id",
  validate({ params: schemas.idParams }),
  asyncHandler(async (req, res) => {
    const invoice = await commands.getInvoice(req.params.id);
    if (!invoice)
      throw new PosDomainError("INVOICE_NOT_FOUND", "Invoice not found");
    return sendPosSuccess(res, invoice);
  }),
);
pos.post(
  "/invoices/:id/payments",
  validate({ params: schemas.idParams, body: schemas.paymentBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.createPayment(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);
pos.post(
  "/invoices/:id/void",
  requirePermission("pos:void"),
  validate({ params: schemas.idParams, body: schemas.voidBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.voidInvoice(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);
pos.post(
  "/invoices/:id/refunds",
  requirePermission("pos:refund"),
  validate({ params: schemas.idParams, body: schemas.refundBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.refundInvoice(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);
pos.get(
  "/invoices/:id/receipt",
  validate({ params: schemas.idParams }),
  asyncHandler(async (req, res) => {
    const invoice = await commands.getInvoice(req.params.id);
    if (!invoice)
      throw new PosDomainError("INVOICE_NOT_FOUND", "Invoice not found");
    return sendPosSuccess(res, invoice);
  }),
);
pos.post(
  "/invoices/:id/print-events",
  validate({ params: schemas.idParams, body: schemas.printBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.recordPrintEvent(req.params.id, req.body, context(req)),
      201,
    ),
  ),
);

pos.get(
  "/shifts/current",
  asyncHandler(async (req, res) => sendPosSuccess(res, await prismaShift(req))),
);
pos.post(
  "/shifts/open",
  validate({ body: schemas.openShiftBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await commands.openShift(req.body, context(req)), 201),
  ),
);
pos.post(
  "/shifts/:id/close",
  validate({ params: schemas.idParams, body: schemas.closeShiftBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.closeShift(req.params.id, req.body, context(req)),
    ),
  ),
);

pos.get(
  "/reservations",
  validate({ query: schemas.reservationsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.listReservations(req.query as never)),
  ),
);
pos.post(
  "/reservations",
  requirePermission("pos:reservation:manage"),
  validate({ body: schemas.reservationBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.createReservation(req.body, context(req)),
      201,
    ),
  ),
);
pos.patch(
  "/reservations/:id",
  requirePermission("pos:reservation:manage"),
  validate({ params: schemas.idParams, body: schemas.reservationPatchBody }),
  asyncHandler(async (req, res) => {
    const { expectedVersion, ...input } = req.body;
    return sendPosSuccess(
      res,
      await commands.updateReservation(
        req.params.id,
        expectedVersion,
        input,
        context(req),
      ),
    );
  }),
);

pos.post(
  "/sync/push",
  validate({ body: schemas.syncPushBody }),
  asyncHandler(async (req, res) => {
    const ctx = context(req);
    posAssert(
      ctx.deviceId === req.body.deviceId,
      "DEVICE_NOT_AUTHORIZED",
      "Header and body device IDs must match",
    );
    return sendPosSuccess(
      res,
      await sync.pushOperations(
        req.admin!.sub,
        ctx.deviceId,
        req.body.operations,
      ),
    );
  }),
);
pos.get(
  "/sync/pull",
  validate({ query: schemas.syncPullQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await sync.pullChanges(
        req.admin!.sub,
        context(req).deviceId,
        req.query.cursor as unknown as bigint,
        Number(req.query.limit),
      ),
    ),
  ),
);

async function prismaShift(req: Request) {
  const ctx = context(req);
  const { prisma } = await import("../../lib/prisma.js");
  return prisma.cashierShift.findFirst({
    where: { userId: ctx.actorId, deviceId: ctx.deviceId, status: "OPEN" },
  });
}

export const adminPosRouter = Router();
adminPosRouter.use(requireAuth);
adminPosRouter.get(
  "/tables",
  requirePermission("pos:table:configure"),
  asyncHandler(async (_req, res) =>
    sendPosSuccess(res, await queries.listTables()),
  ),
);
adminPosRouter.post(
  "/tables",
  requirePermission("pos:table:configure"),
  validate({ body: schemas.tableBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.createTable(req.body, context(req)),
      201,
    ),
  ),
);
adminPosRouter.patch(
  "/tables/:id",
  requirePermission("pos:table:configure"),
  validate({ params: schemas.idParams, body: schemas.tablePatchBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await commands.updateTable(req.params.id, req.body, context(req)),
    ),
  ),
);
adminPosRouter.get(
  "/devices",
  requirePermission("pos:device:manage"),
  asyncHandler(async (_req, res) =>
    sendPosSuccess(res, await devices.listDevices()),
  ),
);
adminPosRouter.post(
  "/devices",
  requirePermission("pos:device:manage"),
  validate({ body: schemas.deviceBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await devices.registerDevice(req.admin!.sub, req.body),
      201,
    ),
  ),
);
adminPosRouter.patch(
  "/devices/:id",
  requirePermission("pos:device:manage"),
  validate({ params: schemas.idParams, body: schemas.devicePatchBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await devices.updateDevice(req.admin!.sub, req.params.id, req.body),
    ),
  ),
);
adminPosRouter.post(
  "/devices/:id/pair",
  pinLimiter,
  requirePermission("pos:device:manage"),
  validate({ params: schemas.idParams, body: schemas.pairBody }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      await devices.pairDevice(
        req.admin!.sub,
        req.params.id,
        req.body.userId,
        req.body.pin,
      ),
    ),
  ),
);
adminPosRouter.get(
  "/invoices",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.adminInvoicesQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.listAdminInvoices(req.query as never)),
  ),
);
adminPosRouter.get(
  "/invoices/:id",
  requirePermission("pos:reports:read"),
  validate({ params: schemas.idParams }),
  asyncHandler(async (req, res) => {
    const invoice = await queries.getAdminInvoice(req.params.id);
    if (!invoice)
      throw new PosDomainError("INVOICE_NOT_FOUND", "Invoice not found");
    return sendPosSuccess(res, invoice);
  }),
);
adminPosRouter.get(
  "/reservations",
  requirePermission("pos:reservation:manage"),
  validate({ query: schemas.reservationsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.listReservations(req.query as never)),
  ),
);
adminPosRouter.get(
  "/audit",
  requirePermission("pos:audit:read"),
  validate({ query: schemas.adminAuditQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await queries.listPosAudit(req.query as never)),
  ),
);
adminPosRouter.get(
  "/reports/sales",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.reportsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, await buildSalesReport(req.query as never)),
  ),
);
adminPosRouter.get(
  "/reports/items",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.reportsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(res, (await buildSalesReport(req.query as never)).topItems),
  ),
);
adminPosRouter.get(
  "/reports/categories",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.reportsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      (await buildSalesReport(req.query as never)).categories,
    ),
  ),
);
adminPosRouter.get(
  "/reports/hours",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.reportsQuery }),
  asyncHandler(async (req, res) =>
    sendPosSuccess(
      res,
      (await buildSalesReport(req.query as never)).salesByHour,
    ),
  ),
);
adminPosRouter.get(
  "/reports/export",
  requirePermission("pos:reports:read"),
  validate({ query: schemas.exportQuery }),
  asyncHandler(async (req, res) => {
    const range = req.query as unknown as {
      from: string;
      to: string;
      format: "pdf" | "xlsx";
    };
    const buffer =
      range.format === "pdf"
        ? await exportSalesPdf(range)
        : await exportSalesXlsx(range);
    res.setHeader(
      "Content-Type",
      range.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rawaqan-sales-${range.from}-${range.to}.${range.format}"`,
    );
    return res.send(buffer);
  }),
);

export default pos;
