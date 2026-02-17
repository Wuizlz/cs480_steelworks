/**
 * Date utility helpers for week-based reporting.
 *
 * All functions in this module operate in UTC to avoid timezone drift
 * that could shift week boundaries for analysts in different locales.
 */

/**
 * Convert a Date to an ISO YYYY-MM-DD string in UTC.
 *
 * Time complexity: O(1) because it formats a single date.
 * Space complexity: O(1) because it allocates a constant-size string.
 */
export function toIsoDateUTC(date: Date): string {
  // Use toISOString to ensure UTC, then slice to keep only the date part.
  return date.toISOString().slice(0, 10);
}

/**
 * Get the week start (Monday) for a given Date in UTC.
 *
 * Time complexity: O(1) because it performs constant arithmetic.
 * Space complexity: O(1) because it creates a single Date object.
 */
export function getWeekStartUTC(date: Date): Date {
  // JavaScript getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  const utcDay = date.getUTCDay();

  // Compute how many days have passed since Monday (0 if Monday).
  const daysSinceMonday = (utcDay + 6) % 7;

  // Create a new Date at midnight UTC for deterministic week starts.
  const weekStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday
  ));

  return weekStart;
}

/**
 * Add or subtract whole weeks from a Date in UTC.
 *
 * Time complexity: O(1) because it adjusts the date once.
 * Space complexity: O(1) because it creates a single Date object.
 */
export function addWeeksUTC(date: Date, weeks: number): Date {
  // Clone the input date to avoid mutating the caller's object.
  const next = new Date(date.getTime());

  // Each week is exactly 7 days.
  next.setUTCDate(next.getUTCDate() + weeks * 7);

  return next;
}

/**
 * Safely parse a YYYY-MM-DD string into a Date (UTC midnight).
 * Returns null when the input is not a valid ISO date.
 *
 * Time complexity: O(1) because it parses a fixed-size string.
 * Space complexity: O(1) because it creates at most one Date object.
 */
export function parseIsoDateUTC(value: string): Date | null {
  // Enforce strict YYYY-MM-DD format to avoid ambiguous parsing.
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) {
    return null;
  }

  // Construct an ISO string with an explicit UTC timezone offset.
  const parsed = new Date(`${value}T00:00:00.000Z`);

  // Reject invalid dates such as 2026-02-30.
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Compute a default week range that ends at the current week start.
 *
 * Time complexity: O(1) because it performs constant arithmetic.
 * Space complexity: O(1) because it creates a constant number of objects.
 */
export function defaultWeekRangeUTC(weeksBack: number): { start: string; end: string } {
  // Get the current time in UTC.
  const now = new Date();

  // Anchor the range end at the current week's Monday.
  const endWeekStart = getWeekStartUTC(now);

  // Move backwards by (weeksBack - 1) weeks to include the current week.
  const startWeekStart = addWeeksUTC(endWeekStart, -(weeksBack - 1));

  return {
    start: toIsoDateUTC(startWeekStart),
    end: toIsoDateUTC(endWeekStart)
  };
}
