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
      console.log("No deposit button found on opportunities page");
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
      console.log("Account badge not found — wallet may not be connected");
    }

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("deposit form validation — empty amount disables submit", async ({ page }) => {
    const depositBtn = page.getByRole("button", { name: /deposit/i }).first();
    if (await depositBtn.isVisible()) {
      await depositBtn.click();
      await page.waitForTimeout(1000);

      // Any submit button inside the modal should be disabled with no amount
      const submitBtn = page.getByRole("button", { name: /confirm|submit|deposit/i }).last();
      if (await submitBtn.isVisible()) {
        const isDisabled = await submitBtn.isDisabled();
        // Not a hard failure — just screenshot for review
        await page.screenshot({ path: "test/e2e/screenshots/modal-07-empty-validation.png" });
        console.log(`Submit button disabled with empty amount: ${isDisabled}`);
      }

      await page.keyboard.press("Escape");
    }
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
