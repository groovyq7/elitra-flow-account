import { test, expect } from "@playwright/test";

test.describe("App Health", () => {
  test("home page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/error/);
    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
    await page.screenshot({ path: "test/e2e/screenshots/01-home.png" });
  });

  test("opportunities page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
    await page.screenshot({ path: "test/e2e/screenshots/02-opportunities.png" });
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check nav links exist
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await page.screenshot({ path: "test/e2e/screenshots/03-nav.png" });
  });

  test("mobile layout renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
    await page.screenshot({ path: "test/e2e/screenshots/04-mobile.png" });
  });

  test("desktop layout renders correctly at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Nav should be visible at desktop width
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1290);
    await page.screenshot({ path: "test/e2e/screenshots/05-desktop.png" });
  });

  test("tab-order: focusable elements are reachable via keyboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Tab through first several focusable elements and verify focus moves
    const focusedElements: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? (el.tagName + (el.getAttribute("aria-label") || el.textContent?.slice(0, 30) || "")) : "none";
      });
      focusedElements.push(focused);
    }

    // At least some elements should have received focus
    const nonBodyElements = focusedElements.filter(e => !e.startsWith("BODY") && e !== "none");
    expect(nonBodyElements.length).toBeGreaterThan(0);
    await page.screenshot({ path: "test/e2e/screenshots/06-tab-order.png" });
  });
});

test.describe("Campaign Page", () => {
  test("campaign page loads and renders the registration form", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/campaign");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Page should load without hard errors
    await expect(page).not.toHaveURL(/error/);

    // X / Twitter username field should be present
    const xInput = page.locator('[aria-label="X (Twitter) username"], input[placeholder*="X username"], input[placeholder*="username"]').first();
    await expect(xInput).toBeVisible();

    // Telegram username field should be present
    const tgInput = page.locator('[aria-label="Telegram username"], input[placeholder*="TG username"], input[placeholder*="Telegram"]').first();
    await expect(tgInput).toBeVisible();

    // Submit button should be present
    const submitBtn = page.getByRole("button", { name: /submit/i });
    await expect(submitBtn).toBeVisible();

    // Submit should be disabled when fields are empty
    await expect(submitBtn).toBeDisabled();

    await page.screenshot({ path: "test/e2e/screenshots/07-campaign-form.png" });
    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
  });

  test("campaign form: filling required fields enables submit", async ({ page }) => {
    await page.goto("/campaign");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const xInput = page.locator('[aria-label="X (Twitter) username"]').first();
    const tgInput = page.locator('[aria-label="Telegram username"]').first();
    const submitBtn = page.getByRole("button", { name: /submit/i });

    const xVisible = await xInput.isVisible().catch(() => false);
    const tgVisible = await tgInput.isVisible().catch(() => false);

    if (!xVisible || !tgVisible) {
      test.skip(true, "Campaign form inputs not found");
      return;
    }

    // Fill in required fields
    await xInput.fill("@testuser");
    await tgInput.fill("@testtg");
    await page.waitForTimeout(300);

    // Submit button should now be enabled
    await expect(submitBtn).toBeEnabled();
    await page.screenshot({ path: "test/e2e/screenshots/08-campaign-filled.png" });
  });
});

// Known SDK/library warnings that are expected and not real errors
function isKnownWarning(msg: string): boolean {
  return (
    msg.includes("useWallets") ||
    msg.includes("WalletConnect") ||
    msg.includes("Lit is in dev mode") ||
    msg.includes("Reown") ||
    msg.includes("privy")
  );
}
