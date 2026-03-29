import { test, expect } from "@playwright/test";
import { createRoom } from "../../fixtures/api.ts";

test.describe("P2P Rooms", () => {
  test("create room via UI", async ({ page }) => {
    await page.goto("/p2p");
    await expect(page.locator("h1")).toHaveText("P2P Rooms");

    await page.getByRole("button", { name: "+ New Room" }).click();

    await page.getByPlaceholder("my-room (leave blank for auto UUID)").fill("e2e-test-room");

    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("e2e-test-room")).toBeVisible();
  });

  test("room detail page shows room info", async ({ page }) => {
    const room = await createRoom("e2e-detail-room");

    await page.goto(`/p2p/${room.room_id}`);
    await expect(page.getByText("e2e-detail-room")).toBeVisible();
    await expect(page.getByText("peer")).toBeVisible();
    await expect(page.getByText("shared resource")).toBeVisible();
  });
});
