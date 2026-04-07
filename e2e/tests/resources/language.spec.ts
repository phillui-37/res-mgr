import { test, expect } from "@playwright/test";
import { createResource, deleteResource } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Resource language field", () => {
  test.afterAll(cleanupTestData);

  test("create resource with language and verify it appears in detail", async ({
    page,
  }) => {
    const resource = await createResource({
      name: "e2e-language-ebook",
      plugin: "ebook",
      type: "ebook",
      locations: ["file:///books/ja-novel.epub"],
      language: "ja",
    });

    await page.goto(`/resources/${resource.plugin}/${resource.id}`);
    await expect(page.getByTestId("resource-language")).toHaveText("ja");

    await deleteResource(resource.id);
  });

  test("filter resources by language returns only matching resources", async ({
    page,
  }) => {
    const ja = await createResource({
      name: "e2e-lang-filter-ja",
      plugin: "ebook",
      language: "ja",
    });
    const en = await createResource({
      name: "e2e-lang-filter-en",
      plugin: "ebook",
      language: "en",
    });

    await page.goto("/resources");
    await page.getByTestId("language-filter-input").fill("ja");
    await page.getByTestId("language-filter-input").press("Enter");
    await expect(page.getByText("e2e-lang-filter-ja").first()).toBeVisible();
    await expect(page.getByText("e2e-lang-filter-en").first()).not.toBeVisible();

    await deleteResource(ja.id);
    await deleteResource(en.id);
  });

  test("language filter chip on list page filters results", async ({
    page,
  }) => {
    const r = await createResource({
      name: "e2e-lang-chip-zh",
      plugin: "ebook",
      language: "zh",
    });

    await page.goto("/resources");
    await page.getByTestId("language-filter-input").fill("zh");
    await page.getByTestId("language-filter-input").press("Enter");

    await expect(page.getByText("e2e-lang-chip-zh").first()).toBeVisible();
    await expect(page.getByTestId("active-language-filter")).toContainText("zh");

    await deleteResource(r.id);
  });
});
