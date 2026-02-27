# DockerLearn.md

This document explains the `Dockerfile` in this repo and the core Docker concepts it uses.

**What Docker Is**
Docker packages your app and its runtime dependencies into an image. You can then run that image as a container. This makes the app consistent across machines.

**Key Concepts**

- Image: A built, read‑only package that contains the filesystem, runtime, and app files needed to run your software. Images are created by `docker build`.
- Container: A running instance of an image. Containers are created by `docker run`.
- Registry: A remote store for images. Docker Hub is the default registry.

**Dockerfile Breakdown**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]
```

**`FROM node:20-alpine`**

This selects a base image. `node:20-alpine` is the official Node.js image with:
- Node.js v20
- npm
- Alpine Linux as the underlying operating system

If the image is not already on your machine, Docker will download it from Docker Hub. So yes, Docker pulls that specific environment.

**What is Alpine Linux?**

Alpine is a lightweight Linux distribution. It is small and fast, which keeps Docker images small. The trade‑off is that some native dependencies behave differently because Alpine uses `musl` instead of `glibc`. For most Node apps this is fine, but it can matter when compiling native modules.

**`WORKDIR /app`**

This sets the working directory inside the container. All commands that follow run relative to `/app`.
If `/app` does not exist, Docker creates it.

**`COPY package.json package-lock.json ./`**

This copies only those two files into the image. The `./` means “copy them into the current working directory” (which is `/app` because of `WORKDIR`).

Why copy only these first? It allows Docker to cache the dependency install layer so future builds are faster. Docker will reuse the `npm ci` layer if `package*.json` does not change.

**`RUN npm ci`**

`npm ci` installs dependencies exactly as listed in `package-lock.json`. It is:
- faster
- more deterministic
- fails if the lockfile and `package.json` are out of sync

Why not `npm install`? `npm install` can modify the lockfile and is less consistent for repeatable builds. `npm ci` is preferred in CI and Docker builds.

**`COPY . .`**

This copies the rest of the project into the image, from your repo root to `/app`.
The `.dockerignore` file prevents unwanted files (like `node_modules` and `.env`) from being copied.

**`CMD ["npm", "test"]`**

This is the default command when you run the container. It means the container will execute `npm test` and then stop.

Important: `CMD` is a default. You can override it at runtime:

```bash
docker run --rm markdown-demo npm run build
```

So yes, with the current `CMD`, the container only runs tests unless you override it.

**What Is an Image (Plain Language)**

An image is a snapshot of a filesystem plus instructions for how to run it. Think of it like a packaged app environment. You build an image once, then run many containers from it.

**How to Use This Repo’s Docker Setup**

```bash
docker build -t markdown-demo .
docker run --rm markdown-demo
```

This builds the image and runs the tests in a container.
