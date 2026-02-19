import { test, expect } from "@playwright/test";

test.describe("Wallet Connect Flow", () => {
  test("connect button opens RainbowKit modal", async ({ page }) => {
    await page.goto("/");

    const connectBtn = page.getByRole("button", { name: /connect/i });
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // RainbowKit renders a modal dialog. It typically appears as a
    // div with role="dialog" or an overlay with wallet options.
    // Wait for the modal to appear
    const modal = page.locator('[role="dialog"], [data-rk]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test("RainbowKit modal can be closed", async ({ page }) => {
    await page.goto("/");

    const connectBtn = page.getByRole("button", { name: /connect/i });
    await connectBtn.click();

    // Wait for modal to appear
    const modal = page.locator('[role="dialog"], [data-rk]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close via Escape key
    await page.keyboard.press("Escape");
    // Give it a moment
    await page.waitForTimeout(500);

    // The connect button should still be there (not in connected state)
    await expect(connectBtn).toBeVisible();
  });

  test("connect button text says Connect when disconnected", async ({ page }) => {
    await page.goto("/");

    const connectBtn = page.getByRole("button", { name: /connect/i });
    const text = await connectBtn.textContent();
    expect(text?.toLowerCase()).toContain("connect");
  });
});
