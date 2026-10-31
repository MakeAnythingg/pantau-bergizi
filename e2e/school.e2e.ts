import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

test("school page shows its kitchen, a QR, and a WhatsApp link to the form", async ({ page }) => {
  await page.goto("/sekolah/sdn-harapan-1");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SDN Harapan 1");
  await expect(page.getByRole("link", { name: /SPPG Melati 01: Prioritas/ })).toHaveAttribute("href", /\/sppg\/\d+$/);
  await expect(page.getByRole("img", { name: "QR form lapor SDN Harapan 1" })).toHaveAttribute(
    "src",
    /^data:image\/svg\+xml/,
  );

  const share = await page.getByRole("link", { name: "Bagikan ke grup WhatsApp" }).getAttribute("href");
  expect(new URL(share ?? "").searchParams.get("text")).toContain("/lapor/sdn-harapan-1");

  await page.getByRole("link", { name: /Lapor makan siang hari ini/ }).click();
  await expect(page).toHaveURL(/\/lapor\/sdn-harapan-1$/);
});

// The page streams (cacheComponents), so the status is already 200 when notFound() runs; Next renders the
// not-found page with noindex instead (docs: guides/streaming#status-codes). Same as /sppg/[id].
test("an unknown school code shows the not-found page", async ({ page }) => {
  await page.goto("/sekolah/tidak-ada");

  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
