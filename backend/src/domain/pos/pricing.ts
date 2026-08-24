import { sumMinorUnits } from "../money.js";
import { posAssert } from "./errors.js";

export type ModifierGroupKind = "VARIANT" | "ADD_ON";
export type ModifierPriceKind = "DELTA" | "REPLACEMENT";

export interface SelectedModifier {
  id: string;
  groupId: string;
  groupType: ModifierGroupKind;
  priceType: ModifierPriceKind;
  priceMinor: bigint;
  quantity?: number;
}

export interface ModifierGroupRule {
  id: string;
  type: ModifierGroupKind;
  minSelections: number;
  maxSelections: number;
}

export interface PriceLineInput {
  basePriceMinor: bigint;
  promotionalPriceMinor?: bigint | null;
  quantity: number;
  groups?: readonly ModifierGroupRule[];
  modifiers?: readonly SelectedModifier[];
}

export interface PriceLineResult {
  catalogBaseMinor: bigint;
  pricedBaseMinor: bigint;
  addOnsMinor: bigint;
  unitPriceMinor: bigint;
  lineTotalMinor: bigint;
}

export function priceOrderLine(input: PriceLineInput): PriceLineResult {
  posAssert(Number.isInteger(input.quantity) && input.quantity > 0, "INVALID_QUANTITY", "Quantity must be a positive integer");
  posAssert(input.basePriceMinor >= 0n, "INVALID_MODIFIER_SELECTION", "Base price cannot be negative");
  const catalogBaseMinor = input.promotionalPriceMinor ?? input.basePriceMinor;
  posAssert(catalogBaseMinor >= 0n, "INVALID_MODIFIER_SELECTION", "Promotional price cannot be negative");

  const modifiers = input.modifiers ?? [];
  const groupRules = new Map((input.groups ?? []).map((group) => [group.id, group]));
  for (const rule of groupRules.values()) {
    const selected = modifiers.filter((modifier) => modifier.groupId === rule.id);
    posAssert(
      selected.length >= rule.minSelections && selected.length <= rule.maxSelections,
      "INVALID_MODIFIER_SELECTION",
      `Modifier group ${rule.id} requires ${rule.minSelections}-${rule.maxSelections} selections`,
    );
    posAssert(selected.every((modifier) => modifier.groupType === rule.type), "INVALID_MODIFIER_SELECTION", "Modifier group type mismatch");
  }
  posAssert(modifiers.every((modifier) => groupRules.has(modifier.groupId)), "INVALID_MODIFIER_SELECTION", "Unknown modifier group");
  posAssert(new Set(modifiers.map((modifier) => modifier.id)).size === modifiers.length, "INVALID_MODIFIER_SELECTION", "Duplicate modifier option");

  let pricedBaseMinor = catalogBaseMinor;
  const variantDeltas: bigint[] = [];
  const replacements = modifiers.filter(
    (modifier) => modifier.groupType === "VARIANT" && modifier.priceType === "REPLACEMENT",
  );
  posAssert(replacements.length <= 1, "INVALID_MODIFIER_SELECTION", "Only one replacement variant may be selected");
  if (replacements[0]) pricedBaseMinor = replacements[0].priceMinor;
  for (const modifier of modifiers) {
    posAssert(modifier.priceMinor >= 0n || modifier.priceType === "DELTA", "INVALID_MODIFIER_SELECTION", "Replacement/add-on prices cannot be negative");
    const quantity = modifier.quantity ?? 1;
    posAssert(Number.isInteger(quantity) && quantity > 0, "INVALID_MODIFIER_SELECTION", "Modifier quantity must be positive");
    if (modifier.groupType === "VARIANT" && modifier.priceType === "DELTA") {
      variantDeltas.push(modifier.priceMinor * BigInt(quantity));
    }
  }
  pricedBaseMinor += sumMinorUnits(variantDeltas);
  posAssert(pricedBaseMinor >= 0n, "INVALID_MODIFIER_SELECTION", "Variant pricing cannot make the item price negative");

  const addOnsMinor = sumMinorUnits(
    modifiers
      .filter((modifier) => modifier.groupType === "ADD_ON")
      .map((modifier) => modifier.priceMinor * BigInt(modifier.quantity ?? 1)),
  );
  const unitPriceMinor = pricedBaseMinor + addOnsMinor;
  return {
    catalogBaseMinor,
    pricedBaseMinor,
    addOnsMinor,
    unitPriceMinor,
    lineTotalMinor: unitPriceMinor * BigInt(input.quantity),
  };
}
