import { devices, expect, type Page, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

/** Nothing on the page is wider than the phone screen (no sideways scrolling). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  expect(overflow).toBeLessThanOrEqual(0);
}

test("Beranda lists every kitchen, most urgent first, on a phone", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kondisi dapur MBG hari ini");
  const rows = page.locator("main ol > li");
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText("Prioritas");
  await expectNoHorizontalScroll(page);
});

test("Rapor dapur opens from Beranda and renders on a phone", async ({ page }) => {
  await page.goto("/");
  await page.locator("main ol > li a").first().click();

  await expect(page).toHaveURL(/\/sppg\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SPPG Melati 01");
  await expect(page.getByRole("region", { name: "Status hari ini" })).toContainText("Prioritas");
  await expectNoHorizontalScroll(page);
});

test("every response carries the security headers", async ({ request }) => {
  for (const path of ["/", "/sppg/1", "/masuk", "/api/cron/top-up"]) {
    const headers = (await request.get(path)).headers();

    expect(headers["strict-transport-security"], path).toContain("max-age=63072000");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
  }
});
