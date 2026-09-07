import { expect, test } from "@playwright/test";

test("cashier journey: pair, open order, pay, print and queue sync", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-6);
  const tableName = `طاولة اختبار ${suffix}`;
  await page.addInitScript(() => {
    Object.defineProperty(window, "print", {
      value: () => undefined,
      configurable: true,
    });
  });

  await expect
    .poll(
      async () =>
        page.request
          .get("http://localhost:4000/ready")
          .then((response) => response.status())
          .catch(() => 0),
      { timeout: 60_000 },
    )
    .toBe(200);

  await page.goto("/admin/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@rawaqan.local");
  await page.getByLabel("كلمة المرور").fill("Admin@12345");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/)?$/);

  await page.goto("/admin/pos/devices");
  await page.getByLabel(/PIN للإقران/).fill("2468");
  await page.getByRole("button", { name: "إقران هذا المتصفح" }).first().click();
  await expect(page).toHaveURL(/\/pos(?:\/)?$/);

  await page.goto("/admin/pos/tables");
  await page.getByLabel("رمز الطاولة").fill(`E${suffix}`);
  await page.getByLabel("اسم الطاولة").fill(tableName);
  await page.getByRole("button", { name: "إضافة طاولة" }).click();
  await expect(page.getByText(tableName, { exact: true })).toBeVisible();

  await page.goto("/pos");
  // The POS keeps its route outlet gated until the bootstrap snapshot has
  // committed to IndexedDB, so seeing the table proves it is safe to transact.
  const table = page.getByRole("button", { name: new RegExp(tableName) });
  await expect(table).toBeVisible();
  await table.click();
  await expect(page).toHaveURL(/\/pos\/table\//);

  const checkoutButton = page.getByRole("button", {
    name: "تأكيد الطلب والانتقال للدفع",
  });
  await page.getByRole("button", { name: /لاتيه روقان/ }).click();
  const modifierDialog = page.getByRole("dialog");
  // Adding an item without modifiers writes to IndexedDB immediately, while an
  // item with modifiers opens a React dialog first. On a cold CI runner that
  // dialog can take longer than one second to render, so wait for either valid
  // outcome instead of guessing that a short dialog timeout means "no dialog".
  await expect
    .poll(
      async () =>
        (await modifierDialog.isVisible()) ||
        (await checkoutButton.isEnabled()),
      { timeout: 15_000 },
    )
    .toBe(true);
  const hasModifierDialog = await modifierDialog.isVisible();
  if (hasModifierDialog) {
    const groups = modifierDialog.locator("fieldset");
    for (
      let groupIndex = 0;
      groupIndex < (await groups.count());
      groupIndex += 1
    ) {
      const group = groups.nth(groupIndex);
      const label = (await group.locator("legend").textContent()) ?? "";
      const minimumSelections = Number(
        label.match(/\((\d+)\s*[–-]\s*\d+\)/)?.[1] ?? 0,
      );
      const choices = group.getByRole("button");
      expect(await choices.count()).toBeGreaterThanOrEqual(minimumSelections);
      for (
        let choiceIndex = 0;
        choiceIndex < minimumSelections;
        choiceIndex += 1
      )
        await choices.nth(choiceIndex).click();
    }
    await modifierDialog
      .getByRole("button", { name: "إضافة بالخيارات" })
      .click();
    await expect(modifierDialog).toBeHidden();
  }
  await expect(
    page.getByText("لاتيه روقان", { exact: true }).last(),
  ).toBeVisible();
  await expect(checkoutButton).toBeEnabled();
  await checkoutButton.click();
  await expect(page).toHaveURL(/\/pos\/checkout\//);
  await expect(
    page.getByText("لاتيه روقان", { exact: true }).last(),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "تأكيد الدفع وطباعة الإيصال" })
    .click();
  await expect(page).toHaveURL(/\/pos\/invoices\//);
  await expect(page.getByRole("heading", { name: /^RWQ-P01-/ })).toBeVisible();
  await expect(page.getByText(/المتبقي:\s*0/)).toBeVisible();
});
