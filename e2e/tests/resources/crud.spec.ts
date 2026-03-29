import { test, expect } from "@playwright/test";
import { createResource, seedResources } from "../../fixtures/api.ts";

test.describe("Resource CRUD", () => {
  test("list page shows seeded resources", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");

    await expect(page.getByText("test-ebook.epub")).toBeVisible();
    await expect(page.getByText("test-track.mp3")).toBeVisible();
  });

  test("pagination works with many resources", async ({ page }) => {
    await seedResources(55, "ebook");

    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");

    const totalText = page.locator("text=/\\d+ resources/");
    await expect(totalText).toBeVisible();

    await page.getByRole("button", { name: "Next →" }).click();
    await expect(page.getByText("Page 2")).toBeVisible();

    await page.getByRole("button", { name: "← Prev" }).click();
    await expect(page.getByText("Page 1")).toBeVisible();
  });

  test("create resource via form", async ({ page }) => {
    await page.goto("/resources/new");
    await expect(page.locator("h1")).toHaveText("Add Resource");

    await page.locator("#name").fill("e2e-new-resource");
    await page.locator("#plugin").selectOption("music");
    await page.locator("#location").fill("file:///test/new.mp3");

    await page.getByRole("button", { name: "Create" }).click();

    await page.waitForURL("**/resources/music/*");
    await expect(page.getByText("e2e-new-resource")).toBeVisible();
  });

  test("view resource detail page", async ({ page }) => {
    const resource = await createResource({
      name: "e2e-detail-test",
      plugin: "video",
      locations: ["file:///video/detail.mp4"],
    });

    await page.goto(`/resources/${resource.plugin}/${resource.id}`);
    await expect(page.getByText("e2e-detail-test")).toBeVisible();
    await expect(page.getByText("video").first()).toBeVisible();
    await expect(page.getByText("file:///video/detail.mp4")).toBeVisible();
  });

  test("create resource with missing name shows error", async ({ page }) => {
    await page.goto("/resources/new");
    await expect(page.locator("h1")).toHaveText("Add Resource");

    const submitBtn = page.getByRole("button", { name: "Create" });
    await expect(submitBtn).toBeDisabled();
  });

  test("navigate to resource detail from list", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");

    const firstViewLink = page.getByRole("link", { name: "View →" }).first();
    await firstViewLink.click();

    await page.waitForURL("**/resources/**/*");
    const heading = page.locator("h1");
    await expect(heading).not.toHaveText("Resources");
  });
});
