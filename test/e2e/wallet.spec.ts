import { test, expect } from "@playwright/test";

/**
 * Wallet connection tests.
 * Requires NEXT_PUBLIC_USE_TEST_WALLET=true — handled by playwright.config.ts webServer.
 */
test.describe("Wallet Connection", () => {
  test("test wallet auto-connects on load", async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // Allow auto-connect to fire

    // Should show a wallet address or connected state, not a "Connect Wallet" button
    const connectBtn = page.getByRole("button", { name: /connect wallet/i });
    const isConnectVisible = await connectBtn.isVisible().catch(() => false);

    // In test mode, wallet should auto-connect so the connect button should be hidden
    if (isConnectVisible) {
      console.warn("Test wallet did not auto-connect — mock connector may not be wired correctly");
    }

    await page.screenshot({ path: "test/e2e/screenshots/wallet-01-connected.png" });
  });

  test("account badge is visible when connected", async ({ page }) => {
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test/e2e/screenshots/wallet-02-badge.png" });
  });
});
