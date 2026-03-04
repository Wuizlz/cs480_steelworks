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

## Setup and Troubleshooting Notes (macOS)

**Q: Why does `docker` say “command not found”?**  
**A:** That means the Docker CLI isn’t installed or not on your PATH. On macOS, the normal fix is to install and start Docker Desktop, which provides both the CLI and the Linux VM that runs the Docker engine.

**Q: What is Docker Desktop and why is it required on macOS?**  
**A:** Docker Desktop is the macOS app that runs a lightweight Linux VM in the background. The Docker daemon (server) runs inside that VM, and your `docker` CLI talks to it. Containers are created inside the VM and use Linux kernel isolation (namespaces + cgroups).

**Q: Is this OS-level virtualization?**  
**A:** On Linux, yes—containers share the host kernel. On macOS, containers still use OS-level isolation, but they share the Linux kernel inside the Docker Desktop VM (not the macOS kernel).

**Q: What is a “cask” in Homebrew?**  
**A:** A cask is Homebrew’s way of installing GUI apps and large binaries. Docker Desktop is installed via a cask.

## Commands We Ran (and What They Do)

```bash
which docker
```

Shows whether the Docker CLI is available in your PATH.

```bash
ls /Applications/Docker.app
```

Checks whether Docker Desktop is installed in Applications.

```bash
brew install --cask docker
```

Installs Docker Desktop on macOS using Homebrew.

```bash
open -a Docker
```

Launches Docker Desktop (starts the Linux VM and Docker daemon).

```bash
docker version
```

Verifies Docker is running. You should see **Client** (macOS) and **Server** (Linux) output. The server OS/Arch (e.g., `linux/arm64`) confirms the VM is running.

```bash
docker build -t my-app .
```

Builds an image named `my-app` using the Dockerfile in the current directory. This pulls the base image, installs dependencies, and copies your project into the image.

```bash
docker run --rm -p 3000:3000 my-app
```

Runs a container from the `my-app` image, mapping container port 3000 to your host port 3000. `--rm` removes the container when it exits.

## Behavior We Observed

**Q: Why did `docker run` execute tests and exit?**  
**A:** The Dockerfile’s `CMD` is `["npm", "test"]`, so the container runs tests and then stops. If you want it to run a server, set `CMD` to your start command (for example, `["npm", "run", "start"]`) or override it at runtime.

**Q: Do containers affect each other’s environment?**  
**A:** Not by default. Each container has its own filesystem and process namespace. They only share data if you explicitly connect them (shared volumes, networks, or ports).

## Build vs Run Breakdown (Step-by-Step)

**`docker build -t my-app .`**

1. CLI sends the Dockerfile + build context to the Docker daemon.
2. Daemon pulls the base image (e.g., `node:20-alpine`) if missing.
3. Executes Dockerfile steps in order:
   - `WORKDIR /app` sets working directory inside the image.
   - `COPY package*.json ./` copies dependency manifests.
   - `RUN npm ci` installs dependencies **inside the image**.
   - `COPY . .` copies the rest of the project (excluding `.dockerignore`).
4. Produces image layers and stores the image in `Docker.raw`.

**`docker run --rm -p 3000:3000 my-app`**

1. CLI sends a run request to the daemon.
2. Daemon creates a container from the **already-built** image.
3. Sets up namespaces/cgroups and mounts the image filesystem.
4. Executes the image’s `CMD` (or an override).
5. `--rm` removes the container after it exits.
6. `-p 3000:3000` maps container port 3000 to your host.

## Additional Q&A (Polished Notes)

**Q: Is an image an “isolated environment”?**  
**A:** No. An image is just a stored filesystem snapshot plus metadata. Isolation only happens when you **run** an image and create a container.

**Q: What exactly happens during `docker build`?**  
**A:** The Docker CLI sends your Dockerfile and build context to the Docker daemon. The daemon executes the steps (pull base image, set `WORKDIR`, copy files, run `npm ci`, etc.) and stores the resulting image layers in `Docker.raw`.

**Q: What exactly happens during `docker run`?**  
**A:** The CLI sends a request to the daemon. The daemon creates a container from the **already-built** image, sets up namespaces/cgroups, mounts the image filesystem, and executes the image’s `CMD` (or a command you override).

**Q: Does `docker run` re‑install dependencies or re‑copy files?**  
**A:** No. Dependency installs and file copies happen at **build** time. At **run** time, the container just starts from the image’s saved filesystem.

**Q: Where are images stored on macOS?**  
**A:** Inside the Linux VM’s disk image file: `~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw`. This file is managed by Docker Desktop.

**Q: Is `Docker.raw` the Docker Desktop app?**  
**A:** No. Docker Desktop is `/Applications/Docker.app`. `Docker.raw` is the VM’s disk file that stores images, containers, and volumes.

**Q: Why is Docker Desktop needed on macOS?**  
**A:** macOS doesn’t have a Linux kernel. Docker Desktop runs a lightweight Linux VM that provides the kernel and runs the Docker daemon.

**Q: Is this OS‑level virtualization?**  
**A:** Yes—inside the Linux VM. Containers share that VM’s Linux kernel and are isolated via namespaces/cgroups.

**Q: What is Linux vs GNU?**  
**A:** Linux is the **kernel**. GNU is the **userland** (core tools and libraries). Most distros use both (GNU/Linux).

**Q: What userland does Alpine use?**  
**A:** Alpine uses `musl` (C library) and BusyBox (core utilities), not GNU. That’s why Alpine images are small.

## Additional Notes

\*\* https://docs.google.com/document/d/17dEICxjabL-h-PZ8UkHZVdCgH_3KwFEMh7H83i_fDMY/edit?usp=sharing
