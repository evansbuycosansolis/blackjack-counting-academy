# Deployment

This repository produces a static browser application. It needs no backend, database service, secrets or environment variables. A supported Node.js 22 build environment and npm are sufficient.

## Release gate

Run npm ci, npm run lint, npm run typecheck, npm test, npm run build, then the complete Playwright suite against that build (PLAYWRIGHT_STATIC=1). Review VERIFICATION.md for actual results and supported mathematical scope. A successful build alone does not establish product acceptance.

## Vercel

Import the repository into Vercel. Use npm ci as the install command, npm run build as the build command, and out as the output directory for the static export. Keep next.config.ts output set to export and retain the webpack build flag. No environment variables are required. Review the generated preview before promoting it to production.

Check the deployed origin for initial load, hash navigation, all worker jobs, IndexedDB reload, backup download/restore, mobile navigation and reduced-motion play. Worker bundles must be served as JavaScript from the same origin. Avoid rewrites that return index.html for missing worker/chunk assets. HTTPS is recommended for browser APIs. Versioned Next chunks may be cached immutably; avoid indefinite caching of index.html.

Data belong to the browser origin/profile. Moving from localhost or a preview to production does not transfer progress; export/import a backup. Cloud synchronization and cross-device accounts are not included.

## Local production preview

```powershell
npm run build
npm start
```

Open http://127.0.0.1:3000. scripts/serve.mjs serves out with appropriate content types and path validation. Stop it with Ctrl+C. It is a development preview server; a managed static host handles public TLS and hosting.

No hosted deployment or deployed-origin verification has been performed as part of this local repository task.
