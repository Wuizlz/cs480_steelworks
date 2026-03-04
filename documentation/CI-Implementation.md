# CI Implementation (GitHub Actions + Husky)

This document records how we implemented CI and pre-commit checks for this repo, and how we consolidated changes so `main` has the complete working app and CI going forward.

## Goals

- Add GitHub Actions CI to run on pull requests.
- Add local pre-commit checks so formatting and linting are enforced before commits.
- Keep the full working backend + frontend in `main` (not just the CI changes).

## What We Added

### 1. GitHub Actions workflow

We added a workflow at:

- `.github/workflows/ci.yml`

It runs on PR events and executes:

- `npm ci`
- `npx prettier . --check`
- `npx eslint . --ext .ts,.tsx`
- `npx tsc --noEmit`
- `npx jest --coverage`

This ensures formatting, linting, type checks, and tests all run on PRs.

### 2. Husky + lint-staged

We added Husky to run checks locally on commit, and lint-staged to run only on staged files:

- `.husky/pre-commit`

The hook runs:

- `npx lint-staged`

The `lint-staged` config in `package.json` runs:

- ESLint + Prettier on staged `*.ts` and `*.tsx`
- Prettier on staged `*.js`, `*.jsx`, `*.json`, and `*.md`

This keeps local commits clean and prevents pushing obvious formatting/lint issues.

### 3. ESLint config

We added ESLint configuration at:

- `eslint.config.cjs`

This sets up TypeScript parsing and rules for TS/TSX files, and ignores `node_modules` and `dist`.

### 4. Dependency updates

We installed these dev dependencies to support the tooling:

- `husky`
- `lint-staged`
- `prettier`
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`

These live in `package.json` and are captured in `package-lock.json`.

## Why We Avoided a Full Merge Initially

We had a branch (`feature-workflow`) that only contained CI-related changes and did not include the full app (frontend + backend). A full merge would have deleted or overridden working code in `prototype`.

Instead, we selectively applied the CI-related files and merged only the required config into `package.json`.

## Issues We Hit (and Fixes)

### 1. Prettier failures on generated files

Coverage output was being staged, and Prettier flagged it. We fixed this by ignoring `coverage/` in `.gitignore`.

### 2. ESLint warnings on non-TS files

ESLint was being run on JSON files and produced warnings. We narrowed the lint-staged rule so ESLint only runs on `*.ts` and `*.tsx`.

### 3. ESLint warnings in build output

ESLint picked up `dist/`. We ignored `dist/` in the ESLint config and `.gitignore`.

### 4. Prettier formatting on merge

Before the merge commit, Prettier blocked the commit because several files were not formatted. We ran:

```
prettier --write
```

on the files listed by the error, then re-attempted the commit.

## Final Merge Strategy

We decided to make `main` the complete, working branch (frontend + backend + CI). The final approach was:

1. Ensure `prototype` was clean and passing tests.
2. Merge `prototype` into `main` so the full working app lives in `main`.
3. Keep CI and Husky in `main` so all future PRs into `main` trigger GitHub Actions.

## How to Verify CI

- Open a PR targeting `main`.
- Check the PR "Checks" tab or the repository "Actions" tab.
- You should see the `CI` workflow run and report status.

## Key Files

- `.github/workflows/ci.yml` (CI workflow)
- `.husky/pre-commit` (local pre-commit hook)
- `eslint.config.cjs` (ESLint config)
- `package.json` (scripts, lint-staged config, devDependencies)

## Notes for Future Work

- If CI should run on push (not just PR), add a `push` trigger in `ci.yml`.
- If you want faster local commits, keep pre-commit limited to lint/format and let CI run full tests.
