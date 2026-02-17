/**
 * Main React component for the Ops Weekly Defect Reporting UI.
 *
 * Provides weekly summaries, drill-down details, and data quality flags,
 * wired to the backend API endpoints.
 */

import React, { useCallback, useEffect, useState } from "react";
import type {
  FlagCountResponse,
  ProcessLogsResponse,
  WeeklyDetailResponse,
  WeeklySummaryResponse
} from "./types";

/**
 * Format a Date object as YYYY-MM-DD in UTC.
 *
 * Time complexity: O(1) because it formats a single date.
 * Space complexity: O(1) because it allocates a fixed-size string.
 */
function toIsoDateUTC(date: Date): string {
  // Use toISOString to ensure UTC output (avoids local timezone offsets).
  return date.toISOString().slice(0, 10);
}

/**
 * Convert a date string to the Monday of its week (UTC).
 *
 * Time complexity: O(1) because it performs constant date math.
 * Space complexity: O(1) because it allocates one Date object.
 */
function toWeekStart(dateString: string): string {
  // Return an empty string if the input is missing.
  if (!dateString) {
    return "";
  }

  // Force UTC parsing to keep week boundaries consistent.
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  // Convert to Monday-based week start.
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);

  return toIsoDateUTC(date);
}

/**
 * Build a query string from optional parameters.
 *
 * Time complexity: O(n) for n parameters.
 * Space complexity: O(n) for the resulting query string.
 */
function buildQuery(params: Record<string, string | undefined>): string {
  // Use URLSearchParams to ensure safe encoding.
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Fetch JSON from the API and surface errors.
 *
 * Time complexity: O(1) in JS, network-bound overall.
 * Space complexity: O(n) for parsing the JSON payload.
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  // Execute the HTTP request.
  const response = await fetch(url, options);

  if (!response.ok) {
    // Attempt to read an error message from the response body.
    const payload = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(payload.error || "Request failed");
  }

  return response.json() as Promise<T>;
}

/**
 * Top-level application component.
 *
 * Time complexity: O(1) for rendering the shell; data-dependent rendering
 * happens inside table maps.
 * Space complexity: O(1) for component state references.
 */
export default function App(): JSX.Element {
  // Weekly summary state.
  const [summaryStart, setSummaryStart] = useState("");
  const [summaryEnd, setSummaryEnd] = useState("");
  const [summaryRows, setSummaryRows] = useState<WeeklySummaryResponse["rows"]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Detail drill-down state.
  const [detailWeek, setDetailWeek] = useState("");
  const [detailLine, setDetailLine] = useState("");
  const [detailDefect, setDetailDefect] = useState("");
  const [detailRows, setDetailRows] = useState<WeeklyDetailResponse["rows"]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Flag count state.
  const [flagsStart, setFlagsStart] = useState("");
  const [flagsEnd, setFlagsEnd] = useState("");
  const [flagRows, setFlagRows] = useState<FlagCountResponse["rows"]>([]);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState(false);

  // Processing job state.
  const [jobBatch, setJobBatch] = useState("");
  const [jobResult, setJobResult] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  /**
   * Load weekly summary rows from the API.
   *
   * Time complexity: O(r) for r rows returned.
   * Space complexity: O(r) for storing rows in state.
   */
  const loadSummary = useCallback(async (range?: { start_week?: string; end_week?: string }) => {
    // Start loading and clear previous errors.
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      // Build the query string from optional range inputs.
      const query = buildQuery({
        start_week: range?.start_week,
        end_week: range?.end_week
      });

      // Fetch the summary data from the backend.
      const data = await fetchJson<WeeklySummaryResponse>(`/reports/weekly-summary${query}`);

      // Update the summary rows in state.
      setSummaryRows(data.rows);
    } catch (error) {
      // Surface error messages to the UI.
      setSummaryRows([]);
      setSummaryError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      // Always end the loading state.
      setSummaryLoading(false);
    }
  }, []);

  /**
   * Load detail rows for a specific summary cell.
   *
   * Time complexity: O(r) for r rows returned.
   * Space complexity: O(r) for storing rows in state.
   */
  const loadDetails = useCallback(async (filters: { week_start: string; line_name: string; defect_type: string }) => {
    // Start loading and clear previous errors.
    setDetailLoading(true);
    setDetailError(null);

    try {
      // Build the query string from required filters.
      const query = buildQuery({
        week_start: filters.week_start,
        line_name: filters.line_name,
        defect_type: filters.defect_type
      });

      // Fetch the detail data from the backend.
      const data = await fetchJson<WeeklyDetailResponse>(`/reports/weekly-details${query}`);

      // Update the detail rows in state.
      setDetailRows(data.rows);
    } catch (error) {
      // Surface error messages to the UI.
      setDetailRows([]);
      setDetailError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      // Always end the loading state.
      setDetailLoading(false);
    }
  }, []);

  /**
   * Load flag counts for the selected week range.
   *
   * Time complexity: O(r) for r rows returned.
   * Space complexity: O(r) for storing rows in state.
   */
  const loadFlags = useCallback(async (range?: { start_week?: string; end_week?: string }) => {
    // Start loading and clear previous errors.
    setFlagLoading(true);
    setFlagError(null);

    try {
      // Build the query string from optional range inputs.
      const query = buildQuery({
        start_week: range?.start_week,
        end_week: range?.end_week
      });

      // Fetch the flag counts from the backend.
      const data = await fetchJson<FlagCountResponse>(`/reports/flags${query}`);

      // Update the flag rows in state.
      setFlagRows(data.rows);
    } catch (error) {
      // Surface error messages to the UI.
      setFlagRows([]);
      setFlagError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      // Always end the loading state.
      setFlagLoading(false);
    }
  }, []);

  /**
   * Trigger the processing job and display a summary.
   *
   * Time complexity: O(1) in JS, network-bound overall.
   * Space complexity: O(1) for the response summary.
   */
  const runJob = useCallback(async (batchSize?: number) => {
    // Start loading and clear previous results/errors.
    setJobLoading(true);
    setJobError(null);
    setJobResult("");

    try {
      // Build the payload only when a batch size is supplied.
      const payload = batchSize ? { batch_size: batchSize } : {};

      // Trigger the job endpoint.
      const data = await fetchJson<ProcessLogsResponse>("/jobs/process-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Summarize processed and flagged counts.
      const processedTotal = data.production.processed + data.shipping.processed;
      const flaggedTotal = data.production.flagged + data.shipping.flagged;
      setJobResult(`Processed: ${processedTotal} | Flagged: ${flaggedTotal}`);
    } catch (error) {
      // Surface error messages to the UI.
      setJobError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      // Always end the loading state.
      setJobLoading(false);
    }
  }, []);

  // Load summary + flags on initial render.
  useEffect(() => {
    void loadSummary();
    void loadFlags();
  }, [loadSummary, loadFlags]);

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Operations Analytics</p>
          <h1>Weekly Defect Reporting</h1>
          <p className="subtitle">
            Generate consistent weekly summaries by production line and defect type. Drill down to
            validate totals and track excluded records.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="meta-label">Default range</p>
            <p className="meta-value">Last 4 weeks</p>
          </div>
          <div>
            <p className="meta-label">Week start</p>
            <p className="meta-value">Monday (UTC)</p>
          </div>
          <div>
            <p className="meta-label">Data quality</p>
            <p className="meta-value">Unmatched / Conflict / Incomplete</p>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Weekly Summary</h2>
          <p className="panel-help">Select a week range, then click a row to drill down.</p>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            // Prevent full page reload on submit.
            event.preventDefault();

            // Normalize input values to week starts.
            const startWeek = toWeekStart(summaryStart);
            const endWeek = toWeekStart(summaryEnd);

            void loadSummary({
              start_week: startWeek || undefined,
              end_week: endWeek || undefined
            });
          }}
        >
          <label>
            <span>Start week</span>
            <input
              type="date"
              value={summaryStart}
              onChange={(event) => setSummaryStart(event.target.value)}
            />
          </label>
          <label>
            <span>End week</span>
            <input type="date" value={summaryEnd} onChange={(event) => setSummaryEnd(event.target.value)} />
          </label>
          <button type="submit" disabled={summaryLoading}>
            {summaryLoading ? "Loading..." : "Run Summary"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSummaryStart("");
              setSummaryEnd("");
              void loadSummary();
            }}
          >
            Use Default Range
          </button>
        </form>

        {summaryError ? <p className="error">{summaryError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Production Line</th>
                <th>Defect Type</th>
                <th>Total Defects</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No summary data for this range.</td>
                </tr>
              ) : (
                summaryRows.map((row) => (
                  <tr
                    key={`${row.week_start_date}-${row.production_line}-${row.defect_type}`}
                    className="clickable"
                    onClick={() => {
                      // Auto-populate detail filters when clicking a summary row.
                      setDetailWeek(row.week_start_date);
                      setDetailLine(row.production_line);
                      setDetailDefect(row.defect_type);

                      void loadDetails({
                        week_start: row.week_start_date,
                        line_name: row.production_line,
                        defect_type: row.defect_type
                      });
                    }}
                  >
                    <td>{row.week_start_date}</td>
                    <td>{row.production_line}</td>
                    <td>{row.defect_type}</td>
                    <td>{row.total_defects}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Detail Drill-Down</h2>
          <p className="panel-help">Use the summary table or enter values below.</p>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            // Prevent full page reload on submit.
            event.preventDefault();

            // Normalize input values before querying.
            const weekStart = toWeekStart(detailWeek);

            void loadDetails({
              week_start: weekStart,
              line_name: detailLine.trim(),
              defect_type: detailDefect.trim()
            });
          }}
        >
          <label>
            <span>Week start</span>
            <input type="date" value={detailWeek} onChange={(event) => setDetailWeek(event.target.value)} required />
          </label>
          <label>
            <span>Production line</span>
            <input
              type="text"
              value={detailLine}
              onChange={(event) => setDetailLine(event.target.value)}
              placeholder="Line 1"
              required
            />
          </label>
          <label>
            <span>Defect type</span>
            <input
              type="text"
              value={detailDefect}
              onChange={(event) => setDetailDefect(event.target.value)}
              placeholder="Scratch"
              required
            />
          </label>
          <button type="submit" disabled={detailLoading}>
            {detailLoading ? "Loading..." : "Load Details"}
          </button>
        </form>

        {detailError ? <p className="error">{detailError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event Date</th>
                <th>Source</th>
                <th>Lot ID</th>
                <th>Qty</th>
                <th>Shift</th>
                <th>Issue Notes</th>
                <th>Ship Status</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No matching detail records.</td>
                </tr>
              ) : (
                detailRows.map((row) => (
                  <tr key={`${row.event_source}-${row.event_date}-${row.lot_id_norm}`}>
                    <td>{row.event_date}</td>
                    <td>{row.event_source}</td>
                    <td>{row.lot_id_norm}</td>
                    <td>{row.qty_impacted}</td>
                    <td>{row.shift || "-"}</td>
                    <td>{row.primary_issue || row.hold_reason || "-"}</td>
                    <td>{row.ship_status || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Flagged Record Counts</h2>
          <p className="panel-help">Monitor excluded records by week and reason.</p>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            // Prevent full page reload on submit.
            event.preventDefault();

            const startWeek = toWeekStart(flagsStart);
            const endWeek = toWeekStart(flagsEnd);

            void loadFlags({
              start_week: startWeek || undefined,
              end_week: endWeek || undefined
            });
          }}
        >
          <label>
            <span>Start week</span>
            <input type="date" value={flagsStart} onChange={(event) => setFlagsStart(event.target.value)} />
          </label>
          <label>
            <span>End week</span>
            <input type="date" value={flagsEnd} onChange={(event) => setFlagsEnd(event.target.value)} />
          </label>
          <button type="submit" disabled={flagLoading}>
            {flagLoading ? "Loading..." : "Load Flags"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFlagsStart("");
              setFlagsEnd("");
              void loadFlags();
            }}
          >
            Use Default Range
          </button>
        </form>

        {flagError ? <p className="error">{flagError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Flag Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {flagRows.length === 0 ? (
                <tr>
                  <td colSpan={3}>No flagged records for this range.</td>
                </tr>
              ) : (
                flagRows.map((row) => (
                  <tr key={`${row.week_start_date}-${row.flag_type}`}>
                    <td>{row.week_start_date}</td>
                    <td>{row.flag_type}</td>
                    <td>{row.flagged_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Process Logs</h2>
          <p className="panel-help">Trigger data-quality processing to refresh the report.</p>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            // Prevent full page reload on submit.
            event.preventDefault();

            const batchValue = Number(jobBatch);
            const batchSize = Number.isFinite(batchValue) && batchValue > 0 ? batchValue : undefined;
            void runJob(batchSize);
          }}
        >
          <label>
            <span>Batch size</span>
            <input
              type="number"
              min={1}
              value={jobBatch}
              onChange={(event) => setJobBatch(event.target.value)}
              placeholder="500"
            />
          </label>
          <button type="submit" disabled={jobLoading}>
            {jobLoading ? "Running..." : "Run Processing Job"}
          </button>
        </form>

        {jobError ? <p className="error">{jobError}</p> : null}
        {jobResult ? <div className="job-result">{jobResult}</div> : null}
      </section>
    </div>
  );
}
