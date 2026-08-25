import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalOrderItem } from "../types";
import CheckoutPage from "./CheckoutPage";

const liveState = vi.hoisted(() => ({
  items: [] as LocalOrderItem[],
}));

vi.mock("../hooks/usePosLive", () => ({
  usePosLive: (_query: unknown, initial: unknown) =>
    Array.isArray(initial) ? liveState.items : initial,
}));

function checkoutRoute() {
  return (
    <MemoryRouter initialEntries={["/pos/checkout/order-1"]}>
      <Routes>
        <Route path="/pos/checkout/:orderId" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CheckoutPage", () => {
  afterEach(() => {
    liveState.items = [];
  });

  it("updates the untouched cash input when order items load asynchronously", async () => {
    const view = render(checkoutRoute());
    const input = screen.getByLabelText("المبلغ النقدي المستلم");

    await waitFor(() => expect(input).toHaveValue("0"));

    liveState.items = [
      {
        id: "item-1",
        orderId: "order-1",
        menuItemId: "latte",
        itemNameSnapshot: "لاتيه روقان",
        unitPriceMinor: "1500",
        quantity: 1,
        lineTotalMinor: "1500",
        sortOrder: 0,
      },
    ];
    view.rerender(checkoutRoute());

    await waitFor(() => expect(input).toHaveValue("15"));
  });
});
