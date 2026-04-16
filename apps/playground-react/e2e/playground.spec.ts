import { expect, test } from "@playwright/test"

test("runtime error appears in ingest flow", async ({ page }) => {
  await page.route("**/api/v1/ingest/batches", async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as {
      batchId: string
      events: Array<{
        appId: string
        id: string
        projectId: string
        type: string
        payload: { message?: string }
      }>
    }

    expect(request.headers()["x-write-key"]).toBe("playground-write-key")
    expect(body.events[0]).toMatchObject({
      appId: "playground-react",
      projectId: "demo-project",
      type: "error",
      payload: { message: "playground runtime error" },
    })

    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        batchId: body.batchId,
        accepted: body.events.map((event) => event.id),
        duplicated: [],
        rejected: [],
      }),
    })
  })

  await page.goto("/")
  const ingestRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/v1/ingest/batches"),
  )

  await expect(page.getByRole("heading", { name: "Web Monitoring Playground" })).toBeVisible()
  await page.getByRole("button", { name: "Throw Runtime Error" }).click()
  await ingestRequest
  await expect(page.getByText("Last flush: success")).toBeVisible()
})
