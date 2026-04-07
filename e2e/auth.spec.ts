import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page for unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page has required fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("register page has required fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="orgName"]')).toBeVisible();
  });

  test("register page validates password length", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "short");
    await page.fill('input[name="orgName"]', "Test Org");
    await page.getByRole("button", { name: /create account/i }).click();
    // Should show validation error (password too short)
    await expect(page.locator("text=12 characters")).toBeVisible({ timeout: 5000 });
  });

  test("admin routes redirect non-admin users", async ({ page }) => {
    await page.goto("/admin/orgs");
    // Should redirect to login (unauthenticated) or dashboard (non-admin)
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
