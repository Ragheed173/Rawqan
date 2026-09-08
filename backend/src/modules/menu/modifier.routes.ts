import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendCreated, sendSuccess } from "../../utils/http.js";
import * as service from "./modifier.service.js";

const uuid = z.string().uuid();
const cuid = z.string().cuid();
const groupParams = z.object({ id: uuid });
const optionParams = z.object({ id: uuid });
const groupOptionParams = z.object({ id: uuid });
const itemParams = z.object({ itemId: cuid });
const groupFields = z.object({
  type: z.enum(["VARIANT", "ADD_ON"]),
  name: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(100).nullable().optional(),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(1).max(20).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const validateSelectionRange = (value: { minSelections?: number; maxSelections?: number }, context: z.RefinementCtx) => {
  if (value.minSelections !== undefined && value.maxSelections !== undefined && value.minSelections > value.maxSelections) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["minSelections"], message: "Minimum selections cannot exceed maximum" });
  }
};
const groupBody = groupFields.superRefine(validateSelectionRange);
const groupPatchBody = groupFields.partial().superRefine(validateSelectionRange);
const optionBody = z.object({
  name: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(100).nullable().optional(),
  priceType: z.enum(["DELTA", "REPLACEMENT"]).optional(),
  price: z.string().regex(/^\d+$/, "Price must be a whole shekel amount").optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const assignmentsBody = z.object({
  assignments: z.array(z.object({ groupId: uuid, sortOrder: z.number().int() }))
    .refine((rows) => new Set(rows.map((row) => row.groupId)).size === rows.length, "Duplicate modifier group"),
});

const router = Router();
router.use(requireAuth, requirePermission("menu:write"));
router.get("/", asyncHandler(async (_req, res) => sendSuccess(res, await service.listModifierGroups())));
router.post("/", validate({ body: groupBody }), asyncHandler(async (req, res) => sendCreated(res, await service.createModifierGroup(req.body))));
router.patch("/:id", validate({ params: groupParams, body: groupPatchBody }), asyncHandler(async (req, res) => sendSuccess(res, await service.updateModifierGroup(req.params.id, req.body))));
router.delete("/:id", requirePermission("menu:delete"), validate({ params: groupParams }), asyncHandler(async (req, res) => sendSuccess(res, await service.deactivateModifierGroup(req.params.id))));
router.post("/:id/options", validate({ params: groupOptionParams, body: optionBody }), asyncHandler(async (req, res) => sendCreated(res, await service.createModifierOption(req.params.id, req.body))));
router.patch("/options/:id", validate({ params: optionParams, body: optionBody.partial() }), asyncHandler(async (req, res) => sendSuccess(res, await service.updateModifierOption(req.params.id, req.body))));
router.delete("/options/:id", requirePermission("menu:delete"), validate({ params: optionParams }), asyncHandler(async (req, res) => sendSuccess(res, await service.deactivateModifierOption(req.params.id))));
router.put("/items/:itemId/assignments", validate({ params: itemParams, body: assignmentsBody }), asyncHandler(async (req, res) => sendSuccess(res, await service.replaceMenuItemModifierGroups(req.params.itemId, req.body.assignments))));

export default router;
