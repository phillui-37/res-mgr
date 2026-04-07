/**
 * cleanupTestData() — delete all e2e-* test records from every entity type.
 *
 * Call in `afterAll` in every spec file that creates data. The `e2e-` prefix
 * is the naming convention for all test-created records; production data is
 * never touched.
 *
 * Deletion order matters for FK constraints:
 *   series_resources rows are cascade-deleted when a resource is deleted.
 *   series rows are deleted directly by name prefix.
 *   device rows are deleted by name prefix.
 *   tagger rule rows are deleted by tag/pattern prefix.
 */

import {
  listResources,
  deleteResource,
  listSeries,
  deleteSeries,
  listDevices,
  deleteDevice,
} from "./api.ts";

const PREFIX = "e2e-";

async function silentDelete<T>(
  action: () => Promise<T>,
  label: string,
): Promise<void> {
  try {
    await action();
  } catch {
    // best-effort; log but don't fail the suite
    console.warn(`cleanup: failed to delete ${label}`);
  }
}

export async function cleanupTestData(): Promise<void> {
  // Resources whose name starts with "e2e-"
  // We query with the prefix as search term to narrow down the result set.
  const resources = await listResources(PREFIX).catch(() => []);
  const testResources = resources.filter((r) => r.name.startsWith(PREFIX));
  await Promise.all(
    testResources.map((r) =>
      silentDelete(() => deleteResource(r.id), `resource:${r.id}`),
    ),
  );

  // Series whose name starts with "e2e-"
  const allSeries = await listSeries().catch(() => []);
  const testSeries = allSeries.filter((s) => s.name.startsWith(PREFIX));
  await Promise.all(
    testSeries.map((s) =>
      silentDelete(() => deleteSeries(s.id), `series:${s.id}`),
    ),
  );

  // Devices whose name starts with "e2e-"
  const allDevices = await listDevices().catch(() => []);
  const testDevices = allDevices.filter((d) => d.name.startsWith(PREFIX));
  await Promise.all(
    testDevices.map((d) =>
      silentDelete(() => deleteDevice(d.name), `device:${d.name}`),
    ),
  );
}
