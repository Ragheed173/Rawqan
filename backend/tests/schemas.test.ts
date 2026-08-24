import { describe, it, expect } from "vitest";
import {
  createItemSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from "../src/modules/menu/item.schemas.js";
import { updateSettingsSchema } from "../src/modules/settings/settings.schemas.js";
import { finalizeBody, paymentBody } from "../src/modules/pos/pos.schemas.js";

describe("POS payment schemas — cash-only policy", () => {
  it("accepts cash and rejects new Visa payments", () => {
    expect(paymentBody.parse({
      method: "CASH",
      amountMinor: "1497",
      tenderedMinor: "1500",
    })).toMatchObject({ method: "CASH", amountMinor: 1497n });
    expect(() => paymentBody.parse({
      method: "VISA",
      amountMinor: "1497",
    })).toThrow();
    expect(() => finalizeBody.parse({
      orderId: "429fab37-0d0c-4d7f-b4c1-3d69b167fc5d",
      expectedVersion: 1,
      payments: [{ method: "VISA", amountMinor: "1497" }],
    })).toThrow();
  });
});

describe("menu item schemas — whole-shekel pricing", () => {
  const item = {
    categoryId: "cm0rawaqan000000000000001",
    name: "لاتيه روقان",
    price: 15,
    discountPrice: 10,
  };

  it("accepts whole prices and rejects fractional base or discount prices", () => {
    expect(createItemSchema.parse(item)).toMatchObject(item);
    expect(() => createItemSchema.parse({ ...item, price: 14.97 })).toThrow();
    expect(() => createItemSchema.parse({ ...item, discountPrice: 9.5 })).toThrow();
    expect(() => updateItemSchema.parse({ price: 88.25 })).toThrow();
  });
});

describe("listItemsQuerySchema — query boolean coercion (regression: archived=false)", () => {
  it('parses "false" as false (NOT true)', () => {
    const parsed = listItemsQuerySchema.parse({ archived: "false" });
    expect(parsed.archived).toBe(false);
  });

  it('parses "true" as true', () => {
    expect(listItemsQuerySchema.parse({ archived: "true" }).archived).toBe(
      true,
    );
  });

  it('parses "1"/"0" correctly', () => {
    expect(listItemsQuerySchema.parse({ featured: "1" }).featured).toBe(true);
    expect(listItemsQuerySchema.parse({ featured: "0" }).featured).toBe(false);
  });

  it("leaves omitted booleans undefined", () => {
    const parsed = listItemsQuerySchema.parse({});
    expect(parsed.archived).toBeUndefined();
    expect(parsed.featured).toBeUndefined();
  });

  it("coerces limit and rejects invalid sort", () => {
    expect(listItemsQuerySchema.parse({ limit: "10" }).limit).toBe(10);
    expect(() => listItemsQuerySchema.parse({ sort: "nope" })).toThrow();
  });
});

describe("updateSettingsSchema — optional URL fields (regression: empty string 400)", () => {
  it("normalizes empty string to null", () => {
    const parsed = updateSettingsSchema.parse({
      facebook: "",
      instagram: "",
      tiktok: "",
      googleMapsUrl: "",
    });
    expect(parsed.facebook).toBeNull();
    expect(parsed.instagram).toBeNull();
    expect(parsed.tiktok).toBeNull();
    expect(parsed.googleMapsUrl).toBeNull();
  });

  it("accepts null and undefined", () => {
    expect(updateSettingsSchema.parse({ facebook: null }).facebook).toBeNull();
    expect(updateSettingsSchema.parse({}).facebook).toBeUndefined();
  });

  it("accepts a valid URL", () => {
    expect(
      updateSettingsSchema.parse({ facebook: "https://facebook.com/rawaqan" })
        .facebook,
    ).toBe("https://facebook.com/rawaqan");
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      updateSettingsSchema.parse({ facebook: "not-a-url" }),
    ).toThrow();
  });

  it("rejects an out-of-range latitude but allows null", () => {
    expect(() => updateSettingsSchema.parse({ latitude: 200 })).toThrow();
    expect(updateSettingsSchema.parse({ latitude: null }).latitude).toBeNull();
  });
});

describe("updateSettingsSchema — POS business clock foundation", () => {
  it("accepts the confirmed Rawaqan settings", () => {
    const parsed = updateSettingsSchema.parse({
      timezone: "Asia/Hebron",
      businessDayCutoff: "04:00",
      posCurrency: "ILS",
    });
    expect(parsed).toMatchObject({
      timezone: "Asia/Hebron",
      businessDayCutoff: "04:00",
      posCurrency: "ILS",
    });
  });

  it("rejects invalid time zones and cutoff times", () => {
    expect(() =>
      updateSettingsSchema.parse({ timezone: "Hebron-ish" }),
    ).toThrow();
    expect(() =>
      updateSettingsSchema.parse({ businessDayCutoff: "4am" }),
    ).toThrow();
    expect(() =>
      updateSettingsSchema.parse({ businessDayCutoff: "24:00" }),
    ).toThrow();
  });
});
