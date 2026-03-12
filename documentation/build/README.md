# Build Documentation

This folder explains how source code becomes runtime artifacts in this repo.

## Document Map

- [BuildArtifactsAndOutputPaths.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/BuildArtifactsAndOutputPaths.md)
  Explains where backend and frontend build output goes, and why backend output belongs in `dist/`.
- [DockerBuildAndRuntime.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/DockerBuildAndRuntime.md)
  Explains how the Docker image is built and what the runtime container actually starts.
- [TestDevContainerAnalysis.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/TestDevContainerAnalysis.md)
  Explains the local app-container and Postgres-container workflow, the port/env confusion we debugged, and how the log stream maps to actual code paths.

## Source File Map

- [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json)
  Declares `build`, `build:ui`, and `start`.
- [tsconfig.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tsconfig.json)
  Controls backend TypeScript output into `dist/`.
- [frontend/tsconfig.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/tsconfig.json)
  Keeps frontend TypeScript in no-emit mode.
- [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts)
  Tells Vite to build the frontend into `frontend/dist`.
- [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile)
  Packages backend and frontend artifacts into the final image.
- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
  Backend runtime entrypoint started by `node dist/index.js`.
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
  Serves `frontend/dist` when the built UI exists.

## Example Workflow: `docker build -t markdown-demo .`

This is the main production build path for the repo.

1. [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile) installs dependencies with `npm ci`.
2. The builder stage runs `npm run build`, which maps to [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json) and executes `tsc -p tsconfig.json`.
3. [tsconfig.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tsconfig.json) emits backend JavaScript into `dist/`.
4. The builder stage runs `npm run build:ui`, which maps to [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json) and executes Vite.
5. [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts) sends the frontend bundle to `frontend/dist`.
6. The runtime stage copies `/app/dist` and `/app/frontend/dist` into the final image.
7. The container starts `node dist/index.js`.
8. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) creates the Express app, and [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) serves the built frontend if `frontend/dist` exists.

## Practical Rule

- Backend build output lives in `dist/`.
- Frontend build output lives in `frontend/dist/`.
- Source files in `src/` and `frontend/src/` are the files you edit.
