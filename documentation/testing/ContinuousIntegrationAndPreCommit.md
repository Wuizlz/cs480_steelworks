# Continuous Integration and Pre-Commit Checks

This document describes our local pre-commit workflow, the GitHub Actions CI pipeline, and the security configuration that should be enabled in GitHub.

## Overview

We use a single source of truth for checks:

- Local pre-commit hook runs `npm run license:check` and `npm run precommit:check`.
- CI runs `npm run precommit:check` on pull requests.

This keeps local and CI behavior aligned and prevents surprises at review time.

## Local Pre-Commit Workflow (Husky)

### Where it lives

- Hook file: `.husky/pre-commit`
- Script definitions: `package.json` (under `scripts`)

### What the hook runs

The hook executes these commands in order:

1. `npm run license:check`
2. `npm run precommit:check`

If any command exits with a non-zero status, the commit is blocked.

### What each script means

#### `license:check`

Command:

```
license-checker --production --summary | grep -Ei 'gpl|agpl|lgpl' && (echo "Copyleft license detected" && exit 1) || exit 0
```

Behavior:

1. `license-checker --production --summary` lists licenses for production dependencies only.
2. `grep -Ei 'gpl|agpl|lgpl'` searches for copyleft licenses.
3. If a match is found, it prints an error and exits with code 1.
4. If no match is found, it exits with code 0.

This blocks commits when GPL/AGPL/LGPL dependencies are present in runtime deps.

#### `precommit:check`

Command:

```
prettier . --check && eslint . --ext .ts,.tsx && tsc --noEmit && jest --coverage
```

Behavior:

1. **Prettier** verifies formatting.
2. **ESLint** checks lint rules for TypeScript files.
3. **TypeScript** runs a no-emit type check.
4. **Jest** runs unit tests and generates coverage.

Any failure stops the commit.

## GitHub Actions (CI)

### Workflow location

- `.github/workflows/ci.yml`

### When it runs

- On pull request events: `opened`, `synchronize`, `reopened`

### What it runs

1. `npm ci`
2. `npm run precommit:check`

This ensures the same checks that run locally also run in CI.

## GitHub Security Configuration

Enable these features in GitHub to keep dependencies and code scanning up to date.

### Dependabot

1. GitHub → **Security** → **Dependabot**: enable it.
2. GitHub → **Settings** → **Advanced Security**: enable all of the following:
   - Dependabot alerts
   - Dependabot security updates
   - Grouped security updates

GitHub maintains an advisory database with the latest vulnerabilities and fixes. When it detects that a dependency version in this repo has a known vulnerability, it creates alerts (and optionally automated update PRs).

### Common vulnerabilities to watch for

- SQL Injection
- Path Traversal
- Insecure File Handling (for example, accepting a 100GB file upload)

### Code Scanning (CodeQL)

1. GitHub → **Security** → **Enable code scanning**
2. GitHub → **Settings** → **Advanced Security** → **Code Scanning**
3. For CodeQL analysis, choose the **default setup**.

## How to Verify

Local verification:

```
npm run license:check
npm run precommit:check
```

CI verification:

1. Open a pull request.
2. Check the PR “Checks” tab or the repository “Actions” tab for the CI workflow result.

## Key Files

- `.github/workflows/ci.yml` (CI workflow)
- `.husky/pre-commit` (local pre-commit hook)
- `package.json` (scripts)
- `eslint.config.cjs` (ESLint config)
