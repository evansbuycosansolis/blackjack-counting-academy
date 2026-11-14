# Blackjack Counting Academy

Browser-local blackjack play, counting education and statistical research with virtual chips. Built with Next.js 16, React 19, strict TypeScript, Tailwind 4, Radix/shadcn-style controls, Zustand, Motion and Recharts. No game APIs, accounts, payments or real-money integration.

Public development project: forks, issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, validation and mathematical contribution requirements. Project code is available under the [MIT license](LICENSE).

Follow the [public GitHub Project](https://github.com/users/evansbuycosansolis/projects/4) for the development roadmap.

## Run

Use Node.js 22 and npm. Dependencies are pinned by package-lock.json.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Navigation uses hashes, such as /#counting and /#betting. Progress is local to the browser profile and origin.

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run build
$env:PLAYWRIGHT_STATIC='1'
npm run test:e2e
npm start
```

The production export is out/. Serve it over HTTP; file URLs do not support the worker/module workflow. npm start uses scripts/serve.mjs on port 3000. Dev/build deliberately use webpack: workers must be reverified before changing bundlers.

## Features

- Persistent 1/2/4/6/8-deck shoes, cut cards, exact virtual money, S17/H17 and configurable split/double/insurance/surrender/blackjack policies.
- Visible-card Hi-Lo counting; hidden hole cards remain excluded until reveal. Guided, unaided, countdown, challenge and timed drills.
- Rule-scoped basic charts, actual-action review, a separate exact composition coach, editable index profiles and deviation/insurance/memory/threshold exercises.
- Exact finite-composition action/dealer/insurance EV; documented policy Monte Carlo when the exact tree is too large. Same-optimal-policy hit/split comparisons, confidence intervals and EV convergence curves when enumeration succeeds.
- Named betting ramps, discipline scoring, flat/ramp simulations, empirically calibrated fractional Kelly and saved run comparisons.
- Independent-session ruin/survival studies, final-bankroll/drawdown distributions, whole-session bootstrap comparisons and reproducible seeds.
- IndexedDB round archives, quota/failure status, validated full backup/restore, event replay with split/double/count reconstruction and CSV/JSON exports.
- Seven academy levels, quizzes, applied exercises, mastery, speed records, progression, achievements, goals, keyboard controls and reduced-motion-aware table movement.

## Mathematical scope

Gameplay supports every exposed configuration. Validated total-dependent charts are narrower: peek games with 1/2/4/6/8 decks and delayed all-bets games with 6/8 decks, four-hand split cap, no hitting/resplitting split Aces, and restricted doubling only without DAS. Unrestricted doubling supports DAS or no DAS. Other combinations have an on-demand composition solver; if its finite state budget is exceeded, no certified advice is issued. Automatic chart drills and large basic-policy simulations remain disabled outside chart scope.

The six-deck S17 I18/Fab 4 profile uses half-deck estimation and floor TC. The complete published BJA H17 study table uses half-deck estimation and truncated TC, with strict RC sign tests where specified. It is a finite published study set, not every possible blackjack index. Other deck/rule index profiles are not certified. Custom copies are always labelled unvalidated.

Exact composition coaching optimizes future legal decisions using observed-card information. It can differ from a fresh-shoe or total-dependent chart and is not included in basic-chart accuracy. Fallback Monte Carlo evaluates a declared continuation policy; it does not establish optimal strategy. Statistical intervals are approximate. Kelly calibration is empirical and can miss unsampled tail losses. No count, simulation or bet size guarantees profit.

## Persistence

Existing blackjack-academy-v1 progress is retained and mirrored while IndexedDB holds state and full round archives. Recent summaries/checkpoints are capped at 5,000; timed records at 1,000; saved simulations at 10; risk reports at 5; calibration models at 10. Load full archived history from Analytics. Round events are recorded for interactive play, not million-round simulations. Legacy rounds without events cannot be replayed retroactively.

Settings exports/restores a versioned complete JSON backup, validates it before applying, and pauses restored play. Import is capped at 100 MB. Browser storage can be evicted; export backups. Failure notices and retry preserve pending data in memory while the page remains open. There is no cloud synchronization.

## Documentation

- [Current status](STATUS.md) and [checklist](docs/COMPLETION-CHECKLIST.md)
- [Casino rules and supported coaching](docs/CASINO-RULES.md)
- [Mathematics, validation and sources](docs/MATHEMATICS.md)
- [Production acceptance evidence](VERIFICATION.md)
- [Deployment](docs/DEPLOYMENT.md)

Game mathematics live in src/engine, UI in src/components, Zustand state in src/stores, durable backup/storage code in src/lib, and long-running jobs in src/workers. Unit/integration/property/reference tests are in src/tests; browser tests are in tests. The game engine powers both table and sampled gameplay; the independent combinatorial solver and physical-card enumeration tests check it separately.
