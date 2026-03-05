/**
 * E2E tests for the weekly defect reporting UI.
 *
 * These tests use the seeded dataset in db/seed.sql.
 * Make sure the database is seeded and both servers are running:
 *   - API: npm run dev        (http://localhost:3000)
 *   - UI : npm run dev:ui     (http://localhost:5173)
 */

import { expect, test } from "@playwright/test";

test.describe("Weekly Defect Reporting UI", () => {
  test("loads weekly summary data and supports drill-down", async ({
    page,
  }) => {
    // Navigate to the app root. The base URL is configured in playwright.config.ts.
    await page.goto("/");

    // Confirm the application shell is visible before interacting.
    await expect(
      page.getByRole("heading", { name: "Weekly Defect Reporting" }),
    ).toBeVisible();

    // Scope selectors to the Weekly Summary panel so we don't collide with
    // similarly named inputs in other sections.
    const summaryPanel = page
      .locator("section.panel")
      .filter({ has: page.getByRole("heading", { name: "Weekly Summary" }) });

    // Use a fixed date range that matches the seeded sample data.
    // The UI normalizes dates to the Monday of the week.
    await summaryPanel.getByLabel("Start week").fill("2026-01-19");
    await summaryPanel.getByLabel("End week").fill("2026-02-09");

    // Trigger the summary query.
    await summaryPanel.getByRole("button", { name: "Run Summary" }).click();

    // Wait for a known row from the seed data to appear.
    const scratchRow = summaryPanel.getByRole("row", {
      name: /2026-01-19.*Line 1.*Scratch/i,
    });
    await expect(scratchRow).toBeVisible();

    // Click the row to request the drill-down details.
    await scratchRow.click();

    // Scope to the Detail Drill-Down panel for assertions.
    const detailPanel = page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Detail Drill-Down" }),
    });

    // The seed data yields exactly one detail row for this summary cell.
    const detailRows = detailPanel.locator("tbody tr");
    await expect(detailRows).toHaveCount(1);

    // Verify the row reflects a production event and includes a lot ID.
    await expect(detailRows.first()).toContainText("PRODUCTION");
    await expect(detailRows.first()).toContainText("LOT");
  });

  test("shows flag counts for known data-quality issues", async ({ page }) => {
    // Navigate to the app root to start a fresh session.
    await page.goto("/");

    // Scope to the Flagged Record Counts panel.
    const flagsPanel = page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Flagged Record Counts" }),
    });

    // Use the same seeded date range to guarantee flags exist.
    await flagsPanel.getByLabel("Start week").fill("2026-01-19");
    await flagsPanel.getByLabel("End week").fill("2026-02-09");

    // Trigger the flag query.
    await flagsPanel.getByRole("button", { name: "Load Flags" }).click();

    // Assert that the three expected flag types show up in the table.
    const flagTable = flagsPanel.locator("tbody");
    await expect(flagTable).toContainText("UNMATCHED_LOT_ID");
    await expect(flagTable).toContainText("CONFLICT");
    await expect(flagTable).toContainText("INCOMPLETE_DATA");
  });
});
