import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "demo1234";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("logged-out /dasbor redirects to /masuk", async ({ page }) => {
  await page.goto("/dasbor");

  await expect(page).toHaveURL(/\/masuk$/);
});

const accounts = [
  { email: "moderator@pantaubergizi.id", heading: "Moderator" },
  { email: "sppg-melati@pantaubergizi.id", heading: "Pengelola SPPG · SPPG Melati 01" },
  { email: "sppg-kenanga@pantaubergizi.id", heading: "Pengelola SPPG · SPPG Kenanga 02" },
];

for (const { email, heading } of accounts) {
  test(`${email} logs in, sees only their own dashboard, and logs out`, async ({ page }) => {
    await login(page, email);

    await expect(page).toHaveURL(/\/dasbor$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);

    await page.getByRole("button", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/masuk$/);
    await page.goto("/dasbor");
    await expect(page).toHaveURL(/\/masuk$/);
  });
}

test.describe("login throttling", () => {
  // Own IP so these failures can't throttle the other specs (limits are per email+IP and per IP).
  test.use({ extraHTTPHeaders: { "x-real-ip": "198.51.100.23" } });

  test("blocks after 5 failures, even with the right password", async ({ page }) => {
    const email = "sppg-melati@pantaubergizi.id";

    for (let i = 0; i < 5; i++) {
      await login(page, email, "salah");
      await expect(page.locator("form [role=alert]")).toHaveText("Email atau kata sandi salah");
    }

    await login(page, email);
    await expect(page.locator("form [role=alert]")).toHaveText(/Terlalu banyak percobaan gagal/);
    await expect(page).toHaveURL(/\/masuk$/);
  });
});
