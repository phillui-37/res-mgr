import { test, expect } from "@playwright/test";
import {
  registerDevice,
  listDevices,
  deleteDevice,
  createResource,
  deleteResource,
  saveProgress,
} from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Device identity", () => {
  test.afterAll(cleanupTestData);

  test("register a new device returns 201 and stores the name", async () => {
    const name = `e2e-device-${Date.now()}`;
    const { status, body } = await registerDevice(name);

    expect(status).toBe(201);
    expect(body.name).toBe(name);
    expect(body.id).toBeGreaterThan(0);

    const devices = await listDevices();
    expect(devices.some((d) => d.name === name)).toBe(true);

    await deleteDevice(name);
  });

  test("re-registering the same device name returns 200 (upsert)", async () => {
    const name = `e2e-device-upsert-${Date.now()}`;

    const first = await registerDevice(name);
    expect(first.status).toBe(201);

    const second = await registerDevice(name);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    await deleteDevice(name);
  });

  test("device list only contains registered devices", async () => {
    const name = `e2e-device-list-${Date.now()}`;
    await registerDevice(name);

    const devices = await listDevices();
    const match = devices.filter((d) => d.name === name);
    expect(match).toHaveLength(1);

    await deleteDevice(name);

    const afterDelete = await listDevices();
    expect(afterDelete.some((d) => d.name === name)).toBe(false);
  });

  test("progress records can reference device name", async () => {
    const deviceName = `e2e-device-progress-${Date.now()}`;
    await registerDevice(deviceName);

    const resource = await createResource({
      name: "e2e-device-progress-ebook",
      plugin: "ebook",
    });

    await saveProgress("ebook", resource.id, {
      device: deviceName,
      current_page: 5,
      total_pages: 100,
      percentage: 5,
    });

    await deleteResource(resource.id);
    await deleteDevice(deviceName);
  });
});
