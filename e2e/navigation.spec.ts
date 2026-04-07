import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page loads without errors", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  });

  test("register page loads without errors", async ({ page }) => {
    const response = await page.goto("/register");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  });

  test("protected routes redirect to login", async ({ page }) => {
    const protectedRoutes = [
      "/dashboard",
      "/contacts",
      "/campaigns",
      "/inbox",
      "/analytics",
      "/billing",
      "/settings",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, {
        timeout: 5000,
      });
    }
  });

  test("webhook endpoints accept POST", async ({ request }) => {
    // Status webhook should accept POST (even if it returns error for bad data)
    const statusRes = await request.post("/api/webhooks/twilio/status", {
      form: { MessageSid: "test", MessageStatus: "delivered" },
    });
    expect(statusRes.status()).toBeLessThan(500);

    // Inbound webhook requires orgId param
    const inboundRes = await request.post("/api/webhooks/twilio/inbound", {
      form: { From: "+15551234567", Body: "test" },
    });
    expect(inboundRes.status()).toBe(400); // Missing orgId
  });
});
