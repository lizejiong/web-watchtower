import { expect, test } from "@playwright/test"

test("renders the playground trigger controls", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Web Monitoring Playground" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Throw Runtime Error" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Send Failed Request" })).toBeVisible()

  await page.getByRole("button", { name: "Send Failed Request" }).click()
  await page.getByRole("button", { name: "Simulate Offline" }).click()
  await page.getByLabel("Search Input").fill("checkout")
  await expect(page.getByLabel("Search Input")).toHaveValue("checkout")
})
