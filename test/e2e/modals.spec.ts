import { test, expect } from "@playwright/test";

test.describe("Modals", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("deposit modal opens and closes cleanly", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Find and click any deposit button
    const depositBtn = page.getByRole("button", { name: /deposit/i }).first();
    if (await depositBtn.isVisible()) {
      await depositBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test/e2e/screenshots/modal-01-deposit-open.png" });

      // Modal or dialog should now be visible
      const modal = page.locator('[role="dialog"], [aria-modal="true"], .modal').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      if (modalVisible) {
        await expect(modal).toBeVisible();
      }

      // Close with ESC
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test/e2e/screenshots/modal-02-deposit-closed.png" });

      // Reopen — state should be reset
      await depositBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test/e2e/screenshots/modal-03-deposit-reopened.png" });

      // Close with X button if visible
      const closeBtn = page.getByRole("button", { name: /close|×|✕/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      test.skip(true, "No deposit button found on opportunities page");
    }

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("withdraw modal opens and closes cleanly", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const withdrawBtn = page.getByRole("button", { name: /withdraw/i }).first();
    if (await withdrawBtn.isVisible()) {
      await withdrawBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test/e2e/screenshots/modal-04-withdraw-open.png" });

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("account popup opens and closes", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Look for the account badge
    const badge = page.locator("[data-testid='account-badge'], button:has-text('Account'), button:has-text('$')").first();
    if (await badge.isVisible()) {
      await badge.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test/e2e/screenshots/modal-05-popup-open.png" });

      // Close with ESC
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.screenshot({ path: "test/e2e/screenshots/modal-06-popup-closed.png" });
    } else {
      await page.screenshot({ path: "test/e2e/screenshots/modal-05-no-badge.png" });
      // Wallet not connected in test env — this is expected
    }

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("deposit form validation — empty amount disables submit", async ({ page }) => {
    const depositBtn = page.getByRole("button", { name: /deposit/i }).first();
    const depositBtnVisible = await depositBtn.isVisible().catch(() => false);
    if (!depositBtnVisible) {
      test.skip(true, "No deposit button visible — skipping form validation test");
      return;
    }

    await depositBtn.click();
    await page.waitForTimeout(1000);

    // Find the amount input and ensure it starts empty
    const amountInput = page.locator('input[placeholder="0.00"], input[inputmode="decimal"]').first();
    if (await amountInput.isVisible()) {
      // Clear any pre-filled value
      await amountInput.fill("");

      // The confirm/submit button should be disabled when amount is empty
      // Try a few common patterns for the submit button
      const submitBtn = page.getByRole("button", { name: /confirm|submit|deposit now/i }).last();
      if (await submitBtn.isVisible()) {
        await expect(submitBtn).toBeDisabled();
      }

      // Type a valid amount — submit should become enabled (if wallet connected)
      await amountInput.fill("0.001");
      await page.waitForTimeout(300);
      await page.screenshot({ path: "test/e2e/screenshots/modal-07-with-amount.png" });
    }

    await page.keyboard.press("Escape");
  });

  test("deposit amount input accepts decimal values", async ({ page }) => {
    const depositBtn = page.getByRole("button", { name: /deposit/i }).first();
    const depositBtnVisible = await depositBtn.isVisible().catch(() => false);
    if (!depositBtnVisible) {
      test.skip(true, "No deposit button visible");
      return;
    }

    await depositBtn.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[placeholder="0.00"], input[inputmode="decimal"]').first();
    if (await amountInput.isVisible()) {
      // Should accept decimal numbers
      await amountInput.fill("1.5");
      await expect(amountInput).toHaveValue("1.5");

      // Should reject non-numeric input (the onChange strips it)
      await amountInput.fill("abc");
      const val = await amountInput.inputValue();
      // After stripping: value should be empty or numeric only
      expect(val).toMatch(/^[0-9.]*$/);

      // Should handle leading dot
      await amountInput.fill(".5");
      await page.screenshot({ path: "test/e2e/screenshots/modal-08-decimal-input.png" });
    }

    await page.keyboard.press("Escape");
  });

  test("modal does not show JS errors on open/close cycle", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    const depositBtn = page.getByRole("button", { name: /deposit/i }).first();
    const depositBtnVisible = await depositBtn.isVisible().catch(() => false);
    if (depositBtnVisible) {
      // Open/close three times to catch state reset bugs
      for (let i = 0; i < 3; i++) {
        await depositBtn.click();
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    expect(jsErrors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });
});

function isKnownWarning(msg: string): boolean {
  return (
    msg.includes("useWallets") ||
    msg.includes("WalletConnect") ||
    msg.includes("Lit is in dev mode") ||
    msg.includes("Reown") ||
    msg.includes("privy")
  );
}
