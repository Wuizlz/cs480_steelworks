# Understanding the Dockerfile

This document explains why this project uses Docker, what the current [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile) is doing, and how to build and run the container correctly.

## Why We Need Docker

This app is not a single Python script or a single Node script.

It is a full web application with two build/runtime parts:

- a TypeScript + Express backend
- a React frontend built with Vite

That means the app needs an environment that can:

- install Node dependencies
- compile TypeScript into JavaScript
- build the frontend into static assets
- run the backend server in production
- serve the built frontend from the backend

Docker gives us a reproducible environment for all of that.

Why that is useful:

- everyone builds the app the same way
- the container pins the Node runtime instead of depending on whatever version is on a laptop or server
- the image contains the exact compiled backend and frontend artifacts the app needs
- deployment becomes simpler because the image is the unit we ship

So the Dockerfile is not just “a way to run npm in a container.”

It defines the production environment for the application.

## The Current Dockerfile

Current code:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Disable Husky during container builds.
ENV HUSKY=0

# Frontend Vite env vars are baked into the bundle at build time.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

# Install dependencies first to maximize Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the full repo after dependencies are cached.
COPY . .

# Build the backend and frontend, then remove devDependencies.
RUN npm run build \
  && npm run build:ui \
  && npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only the files needed at runtime.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## High-Level Structure

This Dockerfile is a multi-stage build.

That means it uses two different container stages:

- `builder`
- `runner`

This is important because building the app and running the app are not the same thing.

The builder stage needs:

- TypeScript
- Vite
- dev dependencies
- source code

The runner stage only needs:

- production dependencies
- compiled backend output
- compiled frontend output

This separation keeps the final image smaller and cleaner.

## Stage 1: `FROM node:20-alpine AS builder`

```dockerfile
FROM node:20-alpine AS builder
```

This starts the build stage from the official Node 20 Alpine image.

What this means:

- `node:20-alpine` gives us Node.js version 20
- `alpine` is a small Linux base image
- `AS builder` gives this stage a name so we can copy files from it later

Why this image was chosen:

- the project is a Node/TypeScript app, so it needs Node, not Python
- pining to Node 20 makes builds more predictable
- Alpine keeps the base image small

## `WORKDIR /app`

```dockerfile
WORKDIR /app
```

This sets the working directory inside the container.

After this line:

- `COPY . .` copies into `/app`
- `RUN npm ci` runs in `/app`
- `CMD ["node", "dist/index.js"]` runs from `/app`

Why this matters:

- it keeps the container layout predictable
- every later command can use relative paths cleanly

## `ENV HUSKY=0`

```dockerfile
ENV HUSKY=0
```

This disables Husky during the Docker build.

Why this is needed:

- this repo has `"prepare": "husky"` in [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json)
- `npm ci` can trigger lifecycle scripts
- inside a Docker image build, Git hooks are not useful

So this environment variable prevents Husky from trying to set up Git hooks inside the container.

## `ARG VITE_SENTRY_DSN=""`

```dockerfile
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
```

This is one of the most important Docker details in this project.

Why it exists:

- the frontend uses Vite
- Vite frontend variables are injected at build time
- `VITE_SENTRY_DSN` is a frontend variable

That means the React bundle needs this value when `npm run build:ui` runs.

It is not enough to provide `VITE_SENTRY_DSN` only when the container starts.

Why:

- the browser bundle is static output
- once built, the value is already baked into the generated frontend files

So the Dockerfile exposes `VITE_SENTRY_DSN` as a build argument and then makes it available as an environment variable during the build stage.

Short version:

- backend config is runtime config
- Vite frontend config is build-time config

## Dependency Installation Layer

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
```

This is the Docker equivalent of dependency installation with layer caching in mind.

Why the files are copied first:

- Docker caches layers
- if only source code changes, Docker can reuse the `npm ci` layer
- dependencies are only reinstalled when `package.json` or `package-lock.json` changes

Why `npm ci` is used instead of `npm install`:

- it uses the lockfile exactly
- it is designed for reproducible installs
- it is preferred in CI and container builds

So this block makes builds faster and more deterministic.

## Copy The Full Repo

```dockerfile
COPY . .
```

After dependencies are installed, the full project source is copied into the container.

Why this comes later:

- source code changes happen often
- dependencies change less often
- copying source after `npm ci` helps Docker reuse the dependency cache

The `.dockerignore` file prevents unnecessary local files from being copied, such as:

- `.env`
- `.git`
- `node_modules`
- `coverage`
- `dist`
- `frontend/dist`

That keeps the Docker build context smaller and avoids shipping local junk into the image.

## Build And Prune

```dockerfile
RUN npm run build \
  && npm run build:ui \
  && npm prune --omit=dev
```

This line does three jobs.

### Part 1: `npm run build`

This runs the backend TypeScript build.

In this repo, that means:

- compile `src/**/*.ts`
- output runtime JS into `dist/`

Without this step, the final image would not have the compiled server entrypoint:

```text
dist/index.js
```

### Part 2: `npm run build:ui`

This runs the Vite frontend production build.

In this repo, that means:

- bundle the React app
- write static files into `frontend/dist/`

Without this step, the Express server would have nothing to serve for the UI in production.

### Part 3: `npm prune --omit=dev`

This removes development dependencies after the build is complete.

Why this is safe:

- dev dependencies were only needed to compile and bundle
- once the build outputs exist, the runtime only needs production dependencies

Why this helps:

- smaller final runtime footprint
- fewer unnecessary packages shipped into production

## Stage 2: `FROM node:20-alpine AS runner`

```dockerfile
FROM node:20-alpine AS runner
```

This starts a fresh runtime stage.

Important idea:

- the final container does not keep the entire builder filesystem
- it starts from a clean Node image
- then copies in only the files needed at runtime

That is the main benefit of a multi-stage build.

## Runtime Working Directory

```dockerfile
WORKDIR /app
```

Same idea as before: all runtime files will live under `/app`.

## Runtime Environment

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```

These are default runtime environment values.

### `NODE_ENV=production`

This tells the app it should run in production mode.

In this repo, that affects things like:

- logging defaults
- behavior of production-oriented configuration

### `PORT=3000`

This sets the container’s default listening port.

The backend already expects port `3000` by default, so this matches the app.

You can still override it at runtime if needed.

## Copy Runtime Files From The Builder

```dockerfile
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
```

This is the heart of the multi-stage pattern.

Each line copies built artifacts from the `builder` stage into the `runner` stage.

### `package.json` and `package-lock.json`

These are copied mainly for completeness and runtime package metadata.

### `node_modules`

These are copied after `npm prune --omit=dev`, so they should contain runtime dependencies only.

### `dist`

This is the compiled backend server output.

This is what `node dist/index.js` will run.

### `frontend/dist`

This is the built React frontend.

The backend serves this directory in production through [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts).

So this copy is what makes the container a full-stack image instead of an API-only image.

## `EXPOSE 3000`

```dockerfile
EXPOSE 3000
```

This documents that the container listens on port `3000`.

Important detail:

- `EXPOSE` does not publish the port to your machine by itself
- it is documentation for the image

To actually reach the app from your machine, you still need `-p 3000:3000` when you run the container.

## `CMD ["node", "dist/index.js"]`

```dockerfile
CMD ["node", "dist/index.js"]
```

This is the container start command.

When the container starts, Docker runs:

```bash
node dist/index.js
```

That starts the compiled backend server, which in production also serves the built frontend from `frontend/dist`.

So one container runs the full deployed app.

## How To Build The Image

Use:

```bash
docker build \
  --build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN" \
  -t markdown-demo .
```

### What this command means

#### `docker build`

This tells Docker to build an image from the current directory.

#### `--build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN"`

This passes the frontend Sentry DSN into the build stage.

Why this is needed:

- Vite reads frontend env vars during the frontend build
- the React bundle needs the DSN while `npm run build:ui` runs

If you do not care about frontend Sentry in a local Docker build, you can leave this blank.

#### `-t markdown-demo`

This tags the resulting image with the name `markdown-demo`.

That makes it easier to run later.

#### `.`

This final dot means:

- use the current directory as the Docker build context

That is why `.dockerignore` matters.

It controls what from the current directory is sent into the Docker build.

## How To Run The Container

Use:

```bash
docker run --rm -p 3000:3000 --env-file .env markdown-demo
```

### What this command means

#### `docker run`

Start a container from an image.

#### `--rm`

Automatically remove the container when it stops.

This is useful for local development/testing because it avoids leaving stopped containers around.

#### `-p 3000:3000`

Map:

- host port `3000`
- container port `3000`

So visiting:

```text
http://localhost:3000
```

on your machine reaches the app inside the container.

#### `--env-file .env`

Load runtime environment variables from your local `.env` file.

This is how the container gets backend config such as:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSL`
- `SENTRY_DSN`

Important distinction:

- runtime backend env vars come from `--env-file .env`
- frontend `VITE_SENTRY_DSN` must already have been injected during `docker build`

#### `markdown-demo`

This is the image name to run.

It must match the tag you used during `docker build`.

## Full Local Docker Workflow

If you want to run the app locally in Docker, the normal flow is:

1. Make sure `.env` contains your real backend database credentials and backend `SENTRY_DSN`.
2. Export the frontend Sentry variable if you want it included in the frontend build:

```bash
export VITE_SENTRY_DSN="your_frontend_dsn"
```

3. Build the image:

```bash
docker build --build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN" -t markdown-demo .
```

4. Run the container:

```bash
docker run --rm -p 3000:3000 --env-file .env markdown-demo
```

5. Open:

```text
http://localhost:3000
```

## Why This Dockerfile Fits This Repo

This Dockerfile is appropriate for this project because it matches the actual app architecture:

- Node runtime, not Python
- TypeScript backend that must be compiled
- React frontend that must be built
- Express serving the built UI in production
- backend env vars loaded at runtime
- frontend Vite env baked in at build time

So the Dockerfile is not generic boilerplate.

It is specifically shaped around how this repo actually works.
