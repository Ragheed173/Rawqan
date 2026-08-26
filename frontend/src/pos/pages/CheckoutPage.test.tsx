import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalOrderItem } from "../types";
import CheckoutPage from "./CheckoutPage";

const liveState = vi.hoisted(() => ({
  items: [] as LocalOrderItem[],
}));
const commandMocks = vi.hoisted(() => ({
  checkout: vi.fn(),
  recordPrint: vi.fn(),
  loadReceipt: vi.fn(),
  reservePrintFrame: vi.fn(),
  releasePrintTarget: vi.fn(),
  print: vi.fn(),
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ admin: { id: "cashier-1", name: "الكاشير" } }),
}));

vi.mock("../commands/localCommands", () => ({
  checkoutLocal: commandMocks.checkout,
  recordLocalPrintEvent: commandMocks.recordPrint,
}));

vi.mock("../printing/receiptData", () => ({
  loadReceiptData: commandMocks.loadReceipt,
}));

vi.mock("../printing/ReceiptPrinter", () => ({
  BrowserReceiptPrinter: class {
    reservePrintFrame = commandMocks.reservePrintFrame;
    releasePrintTarget = commandMocks.releasePrintTarget;
    print = commandMocks.print;
  },
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
    vi.clearAllMocks();
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

  it("reserves printing before payment and prints the paid invoice automatically", async () => {
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
    const printTarget = {} as HTMLIFrameElement;
    const invoice = { id: "invoice-1" };
    const receipt = { invoice };
    commandMocks.reservePrintFrame.mockReturnValue(printTarget);
    commandMocks.checkout.mockResolvedValue({ result: invoice });
    commandMocks.loadReceipt.mockResolvedValue(receipt);
    commandMocks.print.mockResolvedValue(undefined);
    commandMocks.recordPrint.mockResolvedValue(undefined);

    render(checkoutRoute());
    await waitFor(() =>
      expect(screen.getByLabelText("المبلغ النقدي المستلم")).toHaveValue("15"),
    );
    fireEvent.click(screen.getByRole("button", { name: "تأكيد الدفع محلياً" }));

    await waitFor(() => expect(commandMocks.checkout).toHaveBeenCalledOnce());
    expect(commandMocks.reservePrintFrame).toHaveBeenCalledOnce();
    expect(
      commandMocks.reservePrintFrame.mock.invocationCallOrder[0],
    ).toBeLessThan(commandMocks.checkout.mock.invocationCallOrder[0]!);
    await waitFor(() =>
      expect(commandMocks.print).toHaveBeenCalledWith(
        receipt,
        "80mm",
        printTarget,
      ),
    );
    expect(commandMocks.recordPrint).toHaveBeenCalledWith(
      "invoice-1",
      "INITIAL",
      "80mm",
    );
  });
});
