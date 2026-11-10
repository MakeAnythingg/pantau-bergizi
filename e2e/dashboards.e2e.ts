import { expect, type Page, type Request, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { sppg, user } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

async function addDahliaManager() {
  const db = createDb(process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/pantau_bergizi_e2e");
  const email = "sppg-dahlia-e2e@pantaubergizi.id";

  try {
    const kitchen = await db.query.sppg.findFirst({ where: eq(sppg.name, "SPPG Dahlia 03") });

    if (!kitchen) throw new Error("The E2E database must be seeded before running Playwright.");

    await db
      .insert(user)
      .values({
        email,
        role: "sppg_manager",
        sppgId: kitchen.id,
        passwordHash: await hashPassword("demo1234"),
      })
      .onConflictDoNothing({ target: user.email });

    return email;
  } finally {
    await db.$client.end();
  }
}

async function expectActionDenied(page: Page, action: Request) {
  const headers = action.headers();

  const result = await page.request.post("/dasbor", {
    headers: {
      "next-action": headers["next-action"] ?? "",
      "content-type": headers["content-type"] ?? "",
    },
    data: action.postDataBuffer() ?? "",
    maxRedirects: 0,
  });

  expect(result.headers()["x-action-redirect"] ?? result.headers().location).toMatch(/\/masuk/);
}

async function login(page: Page, email: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("demo1234");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dasbor$/);
}

async function complaint(page: Page, school: string, note: string, group = false) {
  await page.goto(`/lapor/${school}`);
  await page.getByRole("button", { name: /Ada yang sakit setelah makan/ }).click();
  await page.getByText(group ? "Guru/UKS" : "Orang tua", { exact: true }).click();
  await page.getByText("Mual/muntah", { exact: true }).click();

  if (group) {
    await page.getByText("Pengamatan kelompok di sekolah").click();
    await page.getByLabel("Perkiraan jumlah terdampak").fill("5");
  }

  await page.getByLabel("Catatan (opsional)").fill(note);
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  const code = page.getByTestId("tracking-code");
  await expect(code).toHaveText(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);

  return code.innerText();
}

test("teacher group review opens Prioritas and the kitchen's episode reply reaches Lacak", async ({ page }) => {
  const note = "UKS mencatat lima anak dengan gejala setelah makan.";
  const reply = "Dapur sedang menelusuri distribusi menu dan berkoordinasi dengan sekolah.";
  const managerEmail = await addDahliaManager();
  const code = await complaint(page, "sdn-dahlia-1", note, true);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /SPPG Dahlia 03/ })).not.toContainText("Prioritas");

  await login(page, "moderator@pantaubergizi.id");
  const queue = page.getByRole("region", { name: "Antrean tinjauan" });
  await expect(queue.getByRole("article").first()).toContainText(note);
  await queue.getByRole("article").filter({ hasText: note }).getByRole("button", { name: "Tinjau" }).click();

  // Reviewing the group observation opens the episode in Dahlia's kitchen group.
  const kitchen = queue.getByRole("region", { name: "SPPG Dahlia 03" });

  await expect(kitchen).toContainText("Ditinjau moderator");
  await kitchen.getByRole("button", { name: "Penerusan" }).click();
  const forwarding = page.getByRole("dialog", { name: "Penerusan episode" });
  await forwarding.getByLabel("Status penerusan").selectOption("simulated_puskesmas");
  await forwarding.getByRole("button", { name: "Simpan penerusan" }).click();
  await expect(forwarding).toBeHidden();
  await expect(kitchen.locator("span", { hasText: /^Simulasi Puskesmas$/ })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /SPPG Dahlia 03/ })).toContainText("Prioritas");

  await login(page, managerEmail);
  await page.getByLabel("Tanggapan episode").fill(reply);
  await page.getByRole("button", { name: "Kirim tanggapan episode" }).click();
  await expect(page.getByRole("region", { name: "Status dapur" })).toContainText(reply);

  await page.goto("/lacak");
  await page.getByLabel("Kode lacak").fill(code);
  await page.getByRole("button", { name: "Lacak", exact: true }).click();
  const status = page.getByRole("region", { name: "Laporan kamu" });
  await expect(status.getByRole("heading", { level: 2 })).toHaveText("SPPG Dahlia 03 sudah menjawab");
  await expect(status).toContainText(reply);
});

test("moderator rejection removes a health report from Rapor", async ({ page }) => {
  const note = "Catatan uji untuk keluhan yang akan ditolak.";
  const metric = page.getByText("keluhan kesehatan dalam 24 jam", { exact: true }).locator("..");
  const count = () => metric.innerText().then((value) => Number.parseInt(value, 10));
  await page.goto("/sppg/4");
  const before = await count();

  const code = await complaint(page, "smpn-9-sukamaju", note);
  await page.goto("/sppg/4");
  await expect.poll(count).toBe(before + 1);

  await login(page, "moderator@pantaubergizi.id");
  const card = page.getByRole("region", { name: "Antrean tinjauan" }).getByRole("article").filter({ hasText: note });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Tolak", exact: true }).click();
  const reject = page.getByRole("dialog", { name: /^Tolak laporan/ });
  await reject.getByLabel("Alasan penolakan").fill("Laporan mengacu pada menu dari dapur lain.");
  await reject.getByRole("button", { name: "Tolak laporan" }).click();
  await expect(card).toHaveCount(0);

  await page.goto("/sppg/4");
  await expect.poll(count).toBe(before);
  await page.goto("/lacak");
  await page.getByLabel("Kode lacak").fill(code);
  await page.getByRole("button", { name: "Lacak", exact: true }).click();
  await expect(page.getByRole("region", { name: "Laporan kamu" })).toContainText(
    "Laporan mengacu pada menu dari dapur lain.",
  );
});

test("server actions refuse missing sessions and wrong roles", async ({ page, browser }) => {
  await login(page, "moderator@pantaubergizi.id");
  const reset = page.getByRole("region", { name: "Reset data demo" });
  await reset.getByRole("textbox").fill("reset");

  const moderatorRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/dasbor"),
  );

  await reset.getByRole("button", { name: "Reset data demo" }).click();
  await expect(reset.getByRole("alert")).toContainText("Ketik RESET");

  const anonymous = await browser.newPage();

  try {
    await expectActionDenied(anonymous, await moderatorRequest);
    await login(page, "sppg-kenanga@pantaubergizi.id");
    await expectActionDenied(page, await moderatorRequest);

    const menu = page.getByRole("region", { name: "Menu hari ini" });
    await menu.getByText("Ubah menu").click();
    await menu.getByLabel("Nama menu").fill(" ");

    const managerRequest = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/dasbor"),
    );

    await menu.getByRole("button", { name: "Simpan menu" }).click();
    await expect(menu.getByRole("alert")).toContainText("Isi teks");

    await expectActionDenied(anonymous, await managerRequest);
    await login(page, "moderator@pantaubergizi.id");
    await expectActionDenied(page, await managerRequest);
  } finally {
    await anonymous.close();
  }
});
