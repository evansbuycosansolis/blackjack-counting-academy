# Development status — 2026-11-13

Final local acceptance results, superseding the MVP status. The documented supported release passes local checks and can be deployed as a static application. The original requirement for unrestricted automatic mathematical coaching remains partial.

## Implemented

- Pure blackjack engine and shared worker simulations; all exposed rules work in gameplay.
- Rule-scoped basic charts for peek 1/2/4/6/8 decks and delayed all-bets 6/8 decks, with documented restrictions.
- Six-deck S17 I18/Fab 4, complete published BJA H17 study table (27 numeric conditions), editable user-defined profiles and focused exercises. H17 requires truncated TC; RC-sign conditions remain separate.
- Finite-composition optimal action solver and on-demand coach, labelled policy Monte Carlo fallback, dealer/insurance probabilities, same-optimal-policy hit/split comparisons and convergence curves.
- Independent-session risk studies, session-level uncertainty, calibrated fractional Kelly, named ramps and saved comparisons.
- IndexedDB, failure recovery, validated backups, event history, count reconstruction and split/double replay.
- Timed drills, speed records, mastery, progression, achievements, academy exercises and responsive dashboards.

## Acceptance results

- Lint: passed with zero warnings. Strict TypeScript: passed.
- Unit/integration/property/reference suite: 212 tests in 15 files passed.
- Production static build: passed. Browser suite against that export: 20/20 passed, no retries/skips, desktop/mobile and reduced-motion scenarios included.
- Million-round responsiveness test: passed in 53.71 seconds including browser setup for that test. Full browser suite: 73.83 seconds.
- npm audit: zero reported vulnerabilities. Local Node 22.15.1/npm 10.9.2.
- Documentation updated: README, checklist, rule/math/deployment contracts and final report.

## Remaining mathematical scope

Automatic total-dependent charts and high-volume chart-policy simulations remain unsupported for smaller split caps, hitting/resplitting split Aces, restricted doubling with DAS, delayed OBO games and delayed 1/2/4-deck games. The separate exact composition coach can solve these rules when its 150,000-state budget permits; large trees can remain unavailable. No heuristic result is promoted to certified advice.

No validated index profiles are supplied for additional deck counts or other rule families. The complete H17 published study set is not every possible Hi-Lo index. Custom edits remain unvalidated. Exact versus sampled optimal comparisons require a completed exact tree; general fallback sampling evaluates its explicitly declared policy.

These limits mean the full universal-coaching master brief is not claimed complete. No hosted deployment or deployed-origin verification has been performed. See [final report](docs/FINAL-REPORT.md) and [verification](VERIFICATION.md).
