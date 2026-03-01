# Frontend Notes (Ops Weekly Defect Reporting)

These notes describe everything inside `frontend/` and capture the questions you asked while learning the code.

## Frontend Folder Overview

`frontend/index.html`

- Static HTML entry point for Vite.
- Provides the `<div id="root"></div>` mount target and loads `/src/main.tsx` as the module entry.

`frontend/vite.config.ts`

- Vite configuration for the React + TypeScript UI.
- Sets the Vite root to the `frontend/` folder.
- Enables React fast refresh with `@vitejs/plugin-react`.
- Proxies `/reports`, `/jobs`, and `/health` to `http://localhost:3000` during dev so the frontend can call the backend without CORS issues.
- Builds to `frontend/dist`.

`frontend/tsconfig.json`

- TypeScript settings for the frontend only.
- `strict: true` ensures full type checking.
- `noEmit: true` because Vite handles bundling, not tsc output.
- `jsx: react-jsx` for React 17+ JSX transform.

`frontend/src/main.tsx`

- React entry point.
- Finds `#root`, creates a React 18 root, and renders `<App />` inside `React.StrictMode`.

`frontend/src/App.tsx`

- Main UI component.
- Defines helper functions for dates and API calls.
- Owns state for:
  - Weekly summary table
  - Drill-down details table
  - Flagged records table
  - Process logs job status
- Fetches data from the backend using `fetchJson<T>()` and updates UI state.

`frontend/src/types.ts`

- TypeScript interfaces for the API response shapes used by `App.tsx`.
- These types keep the UI consistent with backend responses.

`frontend/src/styles.css`

- Global styles and layout.
- Uses `Space Grotesk` for body copy and `Fraunces` for headings.
- Defines CSS variables for the palette and consistent UI spacing.
- Adds card styling, forms, tables, and responsive tweaks.

## App.tsx Structure and Data Flow

**Helper functions**

- `toIsoDateUTC(date)`
  - Formats a Date into `YYYY-MM-DD` in UTC.
- `toWeekStart(dateString)`
  - Normalizes any date to the Monday of that week in UTC.
  - Used before querying the backend.
- `buildQuery(params)`
  - Converts optional params to a query string using `URLSearchParams`.
- `fetchJson<T>(url, options?)`
  - Generic JSON fetcher that throws a readable error if the response fails.

**State and API functions**

- `loadSummary(range?)`
  - Calls `/reports/weekly-summary` and fills `summaryRows`.
- `loadDetails(filters)`
  - Calls `/reports/weekly-details` and fills `detailRows`.
- `loadFlags(range?)`
  - Calls `/reports/flags` and fills `flagRows`.
- `runJob(batchSize?)`
  - Calls `/jobs/process-logs` to trigger a background job and shows a summary string.

**Initial load**

- `useEffect(() => { void loadSummary(); void loadFlags(); }, [loadSummary, loadFlags]);`
- This triggers the default data load on mount (summary + flags) without needing user input.

## API Endpoints Used by the UI

- `GET /reports/weekly-summary` (summary table)
- `GET /reports/weekly-details` (drill-down details)
- `GET /reports/flags` (flagged record counts)
- `POST /jobs/process-logs` (processing job)

## Your Questions and Answers

1. Question: "what does <T> mean"
   Answer: It’s a TypeScript generic type parameter. In `fetchJson<T>()`, it means the function returns `Promise<T>`, so callers decide the response type.

2. Question: "const [summaryRows, setSummaryRows] = useState<WeeklySummaryResponse["rows"]>([])
   what this mean"
   Answer: The state is typed as the `rows` property from `WeeklySummaryResponse`, not the whole response object.

3. Question: "so summary rows should be of type WeeklySummaryResponse"
   Answer: Not the full response. It should match the `rows` property type inside `WeeklySummaryResponse`.

4. Question: "so summaryRows should fit the object structure of WeeklySummaryResponse"
   Answer: It should fit the structure of `WeeklySummaryResponse.rows`, not the whole response.

5. Question: "so this means run only on mount"
   Answer: `useCallback` does not run anything. It only memoizes the function. Running on mount happens when `useEffect` calls it.

6. Question: "oh yea because useCallBack memoize it so even on refresh it detects nothing change or no new input so it keeps the same object or function instead of stripping it and creating a new one?"
   Answer: During a single mount, yes. On a full refresh, everything is recreated from scratch.

7. Question: "but on initial render it creates that function and only generates a new one when its dependicies change"
   Answer: Correct. With `[]`, it stays stable for that mount.

8. Question: "what is range? : im assuming thats the type hint of range parameters should be of an object structured as start week and end week as strings ?"
   Answer: Yes. `range?` is optional, and the object may include optional `start_week` and `end_week` strings.

9. Question: "why do we use call back for this? why do we memoize the function, what would re mounting cause? the callers of these functions would they repeatedly be called because of a new function creation or something"
   Answer: Memoizing keeps a stable function reference so `useEffect` (or memoized children) won’t re-run/re-render just because the parent re-rendered.

10. Question: "do any useEffects currently depend on my useCallBacks or find the root problem of making them useCallBacks"
    Answer: Yes. The initial `useEffect` depends on `loadSummary` and `loadFlags`. Without `useCallback`, the effect would run on every render.

11. Question: "what is the voiding do"
    Answer: `void loadSummary()` calls the async function and explicitly ignores the returned promise.

12. Question: "why?"
    Answer: Effects can’t be `async`, and lint rules often require you to handle or explicitly ignore promises.

13. Question: "what does the useEffect even do for us"
    Answer: It runs side effects after render. Here it triggers the initial data fetch on mount.

14. Question: "so it calls the functions but it doesnt retrun the promise in the useEffect?"
    Answer: Correct. The effect function should return `void` or a cleanup function, not a promise.

15. Question: "soooo this is for what, no data will be return either because no parameters is inserted>"
    Answer: Calling with no params uses the backend default range. Data still comes back and fills state.

16. Question: "so since its not inside useEffect it just populates where the data is reqired so happening in the same cycle of useEffect that fields that showcase the data will update accordinaly"
    Answer: The fetch runs after the first render, then state updates trigger a later render with data.

17. Question: "so why does the inital use effect call loadSummary and loadFlags"
    Answer: To populate the UI with default summary data and flag counts when the page first loads.

18. Question: "so it cals the function the function calls the api it sees it has no values so then it populats it with its standard data?"
    Answer: Yes. No query params means the backend uses its default date range.
