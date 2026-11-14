# Verification — final local acceptance, 2026-11-13

The tests below ran against the existing application after the final source changes. Node 22.15.1; npm 10.9.2; Windows; Chromium through Playwright 1.65.0. Dates use the user's Toronto date.

| Check | Result |
|---|---|
| npm run lint | Pass, zero warnings |
| npm run typecheck | Pass |
| npm test | 212 tests in 15 files passed; 18.70 seconds in the final full run |
| npm run build | Pass; optimized webpack static export in out/ |
| PLAYWRIGHT_STATIC=1, complete Playwright suite | 20 passed, zero skipped/flaky/unexpected tests, zero retries; 73.83 seconds |
| Million-round worker browser test | Pass; 53.71 seconds for test including browser setup; theme responds during simulation |
| npm audit | Zero reported vulnerabilities |

## Browser acceptance

Controlled full-composition fixtures exercise resplitting non-Aces, resplitting Aces without natural payouts, restricted double after split, surrender, insurance with dealer blackjack, even money and delayed OBO double refunds. Browser checks verify actual persisted bankrolls and round counts. Deliberate repeated actions are spaced beyond the table's 160ms duplicate-click guard.

Other checks cover normal rounds, pause/resume, reload, indexed archives, split/double replay, reconstructed counts, complete backup export/import/restore, named ramps, persisted independent-session studies, custom index editing, insurance exercises, timed sprint deadlines, mastery records, earned achievements and cut-card reshuffling.

Exact composition coaching and matching-policy hit/split EV comparison run in workers at a 390×844 viewport. All eight main navigation sections pass mobile horizontal-overflow checks. Desktop checks use 1280px and 1440px widths. Controlled settlement cases also run with prefers-reduced-motion enabled. The casino view hides action-analysis aids. The complete published H17 study table and its truncated-TC convention are checked in the browser.

Desktop split/double and mobile EV screenshots were visually inspected. Full-page screenshots of scrolled pages can position fixed navigation/modal content at the captured viewport offset; this is a capture characteristic, not an extra navigation state. This is Chromium viewport verification, not certification on physical iOS/Android devices or Safari/Firefox.

## Mathematical acceptance

The 212-test count includes single tests with many assertions. One test visits 34,560 rule combinations; this does not prove optimal strategy for every combination. Additional independent physical-card permutations and an observable-world optimal-decision oracle cover correlated split trees, resplit/hit Aces, restricted DAS, European/no-peek and OBO/all-bets rules. Seeded independent same-policy trials compare hit/split and other actions with exact values.

Published numeric checks cover 56 stand values and 112 hit/double values across 14 profiles, at printed precision. The full 7,700-row reference dataset also supports a coarse chart transcription audit. Published split columns have the author's documented approximation; our separate small-pool split oracle handles cross-hand dependence. See docs/MATHEMATICS.md for methods, source URLs, placeholder exclusions and statistical limitations.

The million-round test is performance/responsiveness evidence, not mathematical proof. Simulation seeds, cancellation and statistical routines also have targeted tests. General policy Monte Carlo remains distinct from exact optimal enumeration.

## Readiness boundary

The static build and documented supported functionality pass local acceptance. Universal chart/index coverage and unlimited exact enumeration remain unsupported. The full master specification is therefore not claimed universally complete. No remote deployment, production-origin browser run, cross-device sync or external mathematical certification was performed.
