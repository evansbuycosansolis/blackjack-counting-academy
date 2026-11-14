# Contributing to Blackjack Counting Academy

Contributions are welcome. Fork this public repository, create a branch, and open a pull request against `main`. You can also open an issue for a reproducible bug, a proposed improvement or a question about supported rules.

## Get started

1. Fork and clone the repository.
2. Install Node.js 22 and run `npm ci`.
3. Create a branch, for example `git switch -c fix/split-replay`.
4. Run `npm run dev` and open http://127.0.0.1:3000.

## Before submitting

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
```

Run the browser suite against the production export:

```sh
# macOS/Linux
PLAYWRIGHT_STATIC=1 npm run test:e2e
```

```powershell
# Windows PowerShell
$env:PLAYWRIGHT_STATIC='1'
npm run test:e2e
```

The complete browser suite includes a million-round worker test and can take a few minutes. GitHub Actions runs these checks for pull requests. Include your validation results, the problem being fixed, and any changed mathematical assumptions in the PR description.

## Mathematics and compatibility

- Keep game transitions independent of React, and preserve the shared game engine for interactive play and simulations.
- New charts and indices need primary references or an independently checked solver, explicit rule applicability, count conventions and boundary tests. Do not transfer an index between rule families without evidence.
- Separate exact enumeration, declared-policy simulation and observed outcomes. Include units, sample sizes and uncertainty where relevant.
- Preserve integer-money conservation, physical shoe composition, hidden-card counting, split/double settlement and saved-data compatibility.
- Add meaningful regressions for correctness changes. UI changes should remain accessible, responsive and reduced-motion aware.
- Do not commit browser backups, credentials, dependencies, generated builds or downloaded reference pages/images.

Read [current scope](STATUS.md), [casino rules](docs/CASINO-RULES.md) and [mathematical validation](docs/MATHEMATICS.md) before changing coaching behavior. The exact solver has a finite budget, and some automatic chart/index profiles remain unsupported.

## License and references

Project code is MIT licensed; contributions are distributed under the same license. Existing dependencies retain their own licenses. Linked primary reference pages and charts retain their authors' rights; downloaded copies are not distributed with the source. Preserve mathematical provenance when updating numeric fixtures.
