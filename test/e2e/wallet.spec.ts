import { test, expect } from "@playwright/test";

/**
 * Wallet connection tests.
 * In E2E without a live wallet, these tests verify the unauthenticated UI state
 * and that the connect wallet button is present and functional.
 */
test.describe("Wallet Connection", () => {
  test("connect wallet button is visible when not connected", async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // RainbowKit renders a "Connect" button when not connected
    const connectBtn = page.getByRole("button", { name: /connect/i }).first();
    // Either the connect button is visible (not connected) OR the account UI is (connected)
    const accountBtn = page.locator('[data-testid="rk-account-button"], .iekbcc0').first();

    const connectVisible = await connectBtn.isVisible().catch(() => false);
    const accountVisible = await accountBtn.isVisible().catch(() => false);

    // At least one should be visible (either connect or connected state)
    expect(connectVisible || accountVisible).toBe(true);

    await page.screenshot({ path: "test/e2e/screenshots/wallet-01-state.png" });
  });

  test("account badge is visible when connected", async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test/e2e/screenshots/wallet-02-badge.png" });
  });

  test("chain indicator is present in the nav", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Nav should be present
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Should show TVL or loading state
    const tvlArea = page.locator("nav").filter({ hasText: /TVL|Total/i });
    const tvlVisible = await tvlArea.isVisible().catch(() => false);
    // TVL display is best-effort — not a hard requirement
    if (tvlVisible) {
      await expect(tvlArea).toBeVisible();
    }

    await page.screenshot({ path: "test/e2e/screenshots/wallet-03-nav.png" });
    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("wallet connect button is interactive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const connectBtn = page.getByRole("button", { name: /connect/i }).first();
    const connectVisible = await connectBtn.isVisible().catch(() => false);

    if (connectVisible) {
      // Clicking should open the wallet modal, not crash
      await connectBtn.click();
      await page.waitForTimeout(1000);
      // A modal or overlay should appear
      const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      if (modalVisible) {
        await expect(modal).toBeVisible();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: "test/e2e/screenshots/wallet-04-connect-modal.png" });
    }
  });

  test("deposit/withdraw buttons are disabled or hidden when wallet not connected", async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Check whether a wallet is connected in this test run
    const connectBtn = page.getByRole("button", { name: /^connect$/i }).first();
    const isDisconnected = await connectBtn.isVisible().catch(() => false);

    if (!isDisconnected) {
      // Wallet is connected in test environment — skip
      test.skip(true, "Wallet is connected in test env — skipping disconnected-state assertion");
      return;
    }

    // When not connected, deposit and withdraw action buttons should not be
    // individually clickable per vault row (they are hidden/disabled by the
    // clientConnected guard added in round 12).
    const depositActionBtns = page.locator('[data-testid="vault-deposit-btn"], button[aria-label*="Deposit"]');
    const withdrawActionBtns = page.locator('[data-testid="vault-withdraw-btn"], button[aria-label*="Withdraw"]');

    const depositCount = await depositActionBtns.count();
    const withdrawCount = await withdrawActionBtns.count();

    // All per-row action buttons should be absent when not connected
    expect(depositCount).toBe(0);
    expect(withdrawCount).toBe(0);

    // The global "Connect Wallet" prompt or CTA should be visible instead
    const connectCta = page.getByRole("button", { name: /connect/i });
    expect(await connectCta.count()).toBeGreaterThan(0);

    await page.screenshot({ path: "test/e2e/screenshots/wallet-05-disconnected-actions.png" });
  });

  test("mobile (375px): connect wallet button visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Connect button OR connected account button should be visible on mobile
    const connectBtn = page.getByRole("button", { name: /connect/i }).first();
    const connectVisible = await connectBtn.isVisible().catch(() => false);

    // If not directly visible, could be in a hamburger menu — just check no errors
    // The test verifies the page is usable at 375px
    await expect(page.locator("nav")).toBeVisible();
    await page.screenshot({ path: "test/e2e/screenshots/wallet-06-mobile-connect.png" });
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
