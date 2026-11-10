import { devices, expect, test } from "@playwright/test";
import { NATIONAL_FIGURES } from "../src/content/national";
import { PRIORITY_MIN_HEALTH_REPORTS, PRIORITY_MIN_SCHOOLS } from "../src/lib/thresholds";

test.use({ ...devices["Pixel 7"] });

test("Metode shows the current Prioritas rule and emergency number", async ({ page }) => {
  await page.goto("/metode");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Metode");
  await expect(
    page.getByText(`≥${PRIORITY_MIN_HEALTH_REPORTS} keluhan kesehatan dari ≥${PRIORITY_MIN_SCHOOLS} sekolah`, {
      exact: false,
    }),
  ).toBeVisible();
  const help = page.getByRole("link", { name: "119", exact: true });
  await expect(help).toBeVisible();
  await expect(help).toHaveAttribute("href", "tel:119");
});

test("Data nasional lists every figure with its period and dated source", async ({ page }) => {
  await page.goto("/data");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data nasional");

  for (const figure of NATIONAL_FIGURES) {
    const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: figure.label }) });
    await expect(card.getByText(figure.value, { exact: true })).toBeVisible();
    await expect(card.getByText(figure.period, { exact: true })).toBeVisible();
    await expect(card).toContainText(`${figure.publishedOn} · diakses ${figure.accessedOn}`);

    const source = card.getByRole("link", { name: figure.source });
    await expect(source).toHaveAttribute("href", figure.url);
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
  }

  await page.getByRole("link", { name: "halaman Metode" }).click();
  await expect(page).toHaveURL(/\/metode$/);
});
