import { expect, test } from "@playwright/test"

test("runtime error appears in ingest flow", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Web Monitoring Playground" })).toBeVisible()
  await page.getByRole("button", { name: "Throw Runtime Error" }).click()
  await expect(page.getByText("Last flush: success")).toBeVisible()
})
