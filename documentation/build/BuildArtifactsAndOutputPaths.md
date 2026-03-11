# Build Artifacts and Output Paths

This note explains why the repo had both `.ts` and `.js` files in `src/`, what was changed, and how backend and frontend builds differ.

## Problem

The backend TypeScript build was generating JavaScript files directly inside `src/`.

Examples:

- `src/types.ts` and `src/types.js`
- `src/app.ts` and `src/app.js`

That happened because the backend TypeScript compiler had no `outDir` configured. When `npm run build` ran `tsc -p tsconfig.json`, TypeScript used its default emit behavior and wrote compiled `.js` files beside the source `.ts` files.

This was a problem because the repo already expected production backend output to live in `dist/`:

- `package.json` uses `main: "dist/index.js"`
- `package.json` uses `start: "node dist/index.js"`
- `Dockerfile` copies `/app/dist` and starts `node dist/index.js`

So the intended runtime location and the actual compiler output location did not match.

## What Changed

The backend build was updated to emit compiled files into `dist/` instead of `src/`.

Changes:

- backend `tsconfig.json` now sets `rootDir: "src"`
- backend `tsconfig.json` now sets `outDir: "dist"`
- backend `tsconfig.json` now excludes backend test files from production output
- generated backend `.js` files were removed from `src/`
- `.gitignore` now ignores `dist/`

## Current Behavior

### Backend

`npm run build` runs:

```bash
tsc -p tsconfig.json
```

The backend compiler now:

- reads TypeScript source from `src/`
- compiles it to JavaScript in `dist/`
- produces the runtime entrypoint `dist/index.js`

This matches the Docker runtime expectation.

### Frontend

The frontend works differently.

- `frontend/tsconfig.json` uses `noEmit: true`
- `npm run build:ui` runs `vite build --config frontend/vite.config.ts`
- Vite bundles the frontend and writes output to `frontend/dist/`

So the frontend does still become JavaScript, but it does not create sibling `.js` files beside `frontend/src/*.ts` or `frontend/src/*.tsx`.

## Why `frontend/dist` Exists But `frontend/src` Stays Clean

The frontend build output location is controlled by Vite config:

- `frontend/vite.config.ts` sets `root` to the `frontend/` folder
- `frontend/vite.config.ts` sets `build.outDir` to `dist`

That means the frontend build always goes to `frontend/dist`.

Also, `emptyOutDir: true` tells Vite to clear old frontend build artifacts before writing new ones.

## Docker Impact

The Docker build expects:

- backend runtime files in `dist/`
- frontend static assets in `frontend/dist/`

After the backend build fix, `npm run build` now creates the `dist/` folder that Docker copies into the runtime image.

## Practical Rule

- Edit `.ts` and `.tsx` files only.
- Do not edit generated `.js` files.
- Backend production output belongs in `dist/`.
- Frontend production output belongs in `frontend/dist/`.
