import type { CatalogChangeAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface CatalogChangeInput {
  entityType:
    | "Category"
    | "MenuItem"
    | "Tag"
    | "ItemTag"
    | "ItemImage"
    | "ModifierGroup"
    | "ModifierOption"
    | "MenuItemModifierGroup"
    | "Catalog";
  entityId: string;
  action: CatalogChangeAction;
  payload?: Prisma.InputJsonValue;
}

export type CatalogChangeClient =
  | Pick<PrismaClient, "catalogChange">
  | Pick<Prisma.TransactionClient, "catalogChange">;

/** Writes the next append-only catalog revision using the caller's transaction. */
export function recordCatalogChange(
  client: CatalogChangeClient,
  input: CatalogChangeInput,
) {
  return client.catalogChange.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload,
    },
  });
}

/** Current pull cursor; an empty change feed is revision 0. */
export async function getCurrentCatalogRevision(
  client: CatalogChangeClient = prisma,
): Promise<bigint> {
  const latest = await client.catalogChange.findFirst({
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  return latest?.revision ?? 0n;
}
