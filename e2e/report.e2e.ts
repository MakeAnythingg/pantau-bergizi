import { devices, expect, type Page, test } from "@playwright/test";

// No geolocation permission is granted, so every report here is sent with location denied.
test.use({ ...devices["Pixel 7"] });

const CODE = /^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/;

async function rateMeal(page: Page, school: string) {
  await page.goto(`/lapor/${school}`);
  await page.getByText("Siswa", { exact: true }).click();
  await page.getByText("Baik", { exact: true }).click();
  await page.getByText("Habis", { exact: true }).click();
  await page.getByText("Tidak ada masalah", { exact: true }).click();
  await page.getByRole("button", { name: "Kirim penilaian" }).click();
}

async function reportSickness(page: Page, school: string): Promise<string> {
  await page.goto(`/lapor/${school}`);
  await page.getByRole("button", { name: /Ada yang sakit setelah makan/ }).click();
  await page.getByText("Orang tua", { exact: true }).click();
  await page.getByText("Mual/muntah", { exact: true }).click();
  await page.getByRole("button", { name: "Kirim laporan" }).click();

  const code = page.getByTestId("tracking-code");
  await expect(code).toHaveText(CODE);

  return (await code.textContent()) ?? "";
}

test("path A on a phone with location denied ends on a tracking code", async ({ page }) => {
  await rateMeal(page, "sdn-cempaka-3");

  await expect(page.getByRole("heading", { name: "Terima kasih, laporan terkirim" })).toBeVisible();
  await expect(page.getByTestId("tracking-code")).toHaveText(CODE);
});

test.describe("with location allowed", () => {
  test.use({ geolocation: { latitude: -6.8994, longitude: 107.6151 }, permissions: ["geolocation"] });

  // Regression: resetting Turnstile while the location request was pending made Chrome fail it.
  test("the submit carries the coordinates", async ({ page }) => {
    const sent = page.waitForRequest((r) => r.method() === "POST" && (r.postData() ?? "").includes("-6.8994"));

    await rateMeal(page, "sdn-cempaka-3");
    await sent;
    await expect(page.getByTestId("tracking-code")).toHaveText(CODE);
  });
});

test("path B success screen shows where to get help", async ({ page }) => {
  await reportSickness(page, "sdn-kenanga-1");

  await expect(page.getByText(/Hubungi UKS \/ Puskesmas terdekat\. Keadaan darurat: 119\./)).toBeVisible();
});

test("the code on /lacak shows the report and accepts an update", async ({ page }) => {
  const code = await reportSickness(page, "sdn-flamboyan-1");

  await page.goto("/lacak");
  await page.getByLabel("Kode lacak").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Lacak" }).click();

  const thread = page.getByRole("region", { name: "Laporan kamu" });
  await expect(thread).toContainText("Keluhan kesehatan · SDN Flamboyan 1");
  await expect(page).toHaveURL(/\/lacak$/); // the code never reaches the URL

  await thread.getByLabel("Tambahkan perkembangan").fill("Anak saya sudah membaik.");
  await thread.getByRole("button", { name: "Kirim perkembangan" }).click();
  await expect(thread.getByRole("listitem")).toContainText(["Perkembangan dari kamu"]);
  await expect(thread).toContainText("Anak saya sudah membaik.");
});

test("a second survey from the same browser for the same school and date is refused", async ({ page }) => {
  await rateMeal(page, "sdn-dahlia-1");
  await expect(page.getByTestId("tracking-code")).toHaveText(CODE);

  await rateMeal(page, "sdn-dahlia-1");
  await expect(page.getByRole("alert").filter({ hasText: "Kamu sudah menilai makanan tanggal ini." })).toHaveText(
    "Kamu sudah menilai makanan tanggal ini. Untuk koreksi, tambahkan perkembangan lewat kode lacak.",
  );
});
