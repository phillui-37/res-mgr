import { test, expect } from "@playwright/test";
import {
  createRoom,
  createResource,
  shareResource,
} from "../../fixtures/api.ts";

test.describe("P2P Resource Sharing", () => {
  test("share a resource into a room", async ({ page }) => {
    const room = await createRoom("e2e-share-room");
    const resource = await createResource({
      name: "e2e-share-target",
      plugin: "ebook",
      locations: ["file:///books/share.epub"],
    });

    await shareResource(room.room_id, resource.id);

    await page.goto(`/p2p/${room.room_id}`);
    await expect(page.getByText("e2e-share-target")).toBeVisible();
    await expect(page.getByText("shared").first()).toBeVisible();
  });

  test("revoke a shared resource via UI", async ({ page }) => {
    const room = await createRoom("e2e-revoke-room");
    const resource = await createResource({
      name: "e2e-revoke-target",
      plugin: "music",
      locations: ["file:///music/revoke.mp3"],
    });

    await shareResource(room.room_id, resource.id);

    await page.goto(`/p2p/${room.room_id}`);
    await expect(page.getByText("e2e-revoke-target")).toBeVisible();

    const row = page.locator("tr", { hasText: "e2e-revoke-target" });
    await row.getByRole("button", { name: "Revoke" }).click();

    await expect(row.getByText("not shared")).toBeVisible();
  });
});
