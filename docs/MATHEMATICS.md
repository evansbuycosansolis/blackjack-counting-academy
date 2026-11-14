# Mathematics and validation

## Distinct quantities

A basic chart is a published rule-specific policy; delayed games may use a published initial-composition reference. It is not an exact optimum for every depleted shoe. The composition coach instead solves the observable finite multiset and actual bankroll/hand limits. Hi-Lo indices compress composition into a count and are finite study sets. These recommendations can differ legitimately.

Money is integer cents; initial bets are whole virtual chips. Action EV is final round net profit divided by the original round wager, including all split/double wagers and any insurance already committed. It is not EV per resulting split hand or per total wager. Positive EV is expectation under assumptions, not a guaranteed outcome.

## Exact calculation

The unknown pool contains undealt cards plus the hidden hole card. Exposed cards are excluded. Actual hole identity and future order are discarded as information. In a reserved-hole game with N unknown cards and c(v) cards of value v, the hole posterior is proportional to c(v), excluding a blackjack-completing value after successful peek. Player draw probability is (c(v) − P(hole=v))/(N−1). In European play it is c(v)/N. Each visible draw updates the posterior.

Dealer recursion draws without replacement and follows S17/H17. Outcomes are natural blackjack, bust, 17–21 or exhaustion. Memoized Bellman recursion maximizes future legal action EV, carrying all hands, shared composition, bankroll, original-bet attribution, split cap, DAS/double restrictions and split-Ace status. It follows the engine's initial split-child dealing order. Delayed all-bets/OBO settlement and exhaustion refunds agree with the game engine. Probabilities use JavaScript floating-point arithmetic: exact means enumeration rather than sampling, not symbolic rational arithmetic.

Action analysis budgets 75,000 states; the exact coach budgets 150,000. A budget exception is not an estimate. The coach reports unavailability without advice. General analysis can then run labelled policy Monte Carlo. Large trees, particularly full-shoe splits, remain uncertified within interactive limits.

Insurance EV per insurance chip is 3p−1, where p is observable dealer blackjack probability with an Ace upcard. Insurance is favorable only above p=1/3. Count indices approximate composition-based p. After a successful Ace-up peek, p=0. Insurance is unavailable without an Ace upcard.

## Independent action trials and curves

Each trial independently resamples the observable pool, samples a peek-conditioned hole if reserved, and shuffles the rest without replacement. All candidate actions use the same trial shoe (paired comparisons); later trials are independent. The game engine resolves future actions and all wagers.

When exact enumeration succeeds, its optimal observable-state action map is retained. Hit, split, stand, double and surrender validation trials use that same map for future decisions. Keys contain observable composition, hands and bankroll, not hidden future identities. A missing policy state throws instead of switching policy. This also supports multiple remaining hands. Convergence charts show cumulative observed EV, exact EV, pointwise 95% intervals and sample counts, with JSON export.

Without an enumerated map, rollouts use the supported basic chart, or explicitly hit below hard 17/soft 19 and stand otherwise for unsupported charts. These results evaluate that policy and do not certify optimal play. Action means use sample variance and approximate 1.96-standard-error intervals. These are pointwise normal intervals, not simultaneous ranking guarantees or sequential confidence bounds. Repeatedly inspecting a curve does not establish significance.

## Risk and calibrated Kelly

Long runs preserve shoe dependence. Mean-return intervals use approximate whole-shoe cluster sandwich variance; fewer than two shoes yields no interval. Bankroll-dependent wagers and stopping complicate interpretation. Independent-session studies start a fresh bankroll/shoe and derived seed per replication, preserving dependence within each session. Ruin is inability to afford the smallest legal increment wager, not necessarily zero. Wilson intervals quantify ruin/survival uncertainty. Mean session profit and paired differences use 1,000-resample percentile bootstraps of whole sessions. Zero observed ruins does not prove zero population risk. Cancellation includes completed sessions only.

Flat calibration groups original-wager unit returns by pre-bet TC, pooling tails at ≤−10 and ≥+10. It tracks contributing shoes, empirical return histograms and shoe-cluster intervals. Empirical Kelly solves sum p(x)·x/(1+f·x)=0 for log growth by bounded bisection, then applies fraction and limits. Models must match rules and full playing-policy signatures. Bins with fewer than 100 rounds or five shoes use a declared fixed-unit fallback. Empirical distributions can miss extreme losses: this is not certified population-optimal sizing. Generic count-to-edge and heuristic ruin formulas have been removed.

## Validation evidence and limits

- Transition/conservation/counting/dealer/peek/split/double/payout/exhaustion regressions.
- One rule-grid test visits 34,560 combinations; it is one test, not 34,560 proved strategies. Seeded fast-check sequences exercise legal paths and money/shoe invariants.
- Independent physical-card permutations and an observable-world decision-tree oracle compare action EV. The oracle groups indistinguishable worlds before choosing future actions, avoiding knowledge of hidden future cards. Cases include smaller split caps, resplit/hit Aces, restricted DAS, European/no-peek and OBO/all-bets.
- Same-policy independent trials compare every legal root action against exact results on small pools. The deterministic envelope is conservative, not a statistical proof from one seed.
- Four stand cases in each of 14 published profiles provide 56 checks. Further hit/double checks use four upcards per profile, compared to printed precision. European checks use hard-16 hit and soft-19 double cells because some dominated hard-total actions are unavailable in those reference tables.
- The bundled 7,700 situations (14 × 550) support fresh-shoe reference/chart auditing. The broad chart audit rejects gross EV regret over 0.07; this permits composition-versus-total differences and is not a precision proof for every cell. The author's split reference values approximate dependence on draws in other split hands; those columns are not exact correlated split EV. Our small-pool split oracle includes that dependence explicitly.
- Large worker runs test throughput, cancellation, repeatability and responsiveness. A million rounds is not mathematical proof. Browser evidence is separate in VERIFICATION.md.

## Primary references

Inspected 2026-11-12/13; app runtime needs no external requests.

- [Single-deck strategy](https://wizardofodds.com/games/blackjack/strategy/1-deck/) and [double-deck strategy](https://wizardofodds.com/games/blackjack/strategy/2-decks/).
- [European strategy](https://wizardofodds.com/games/blackjack/strategy/european/) and [Appendix 9](https://wizardofodds.com/games/blackjack/appendix/9/). Each numeric profile embeds its own primary URL in reference-values.json.
- [Conventional Hi-Lo I18/Fab 4](https://wizardofodds.com/games/blackjack/card-counting/high-low/).
- [BJA H17 chart](https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf): every numeric condition transcribed, including negative/surrender triggers. Ordinary basic-chart cells are not duplicated as indices.
- [BJA conversion guide](https://www.blackjackapprenticeship.com/true-count-conversion-guide/): truncation. Half-deck estimation is the selected app convention; matching gates automatic application.

scripts/fetch-reference-values.py regenerates fixtures using scripts/reference_parser.py. It caches author pages in ignored reference files, requires 550 situations/profile, maps N/V to null and normalizes a source double-minus typo. Older European hard-total tables use −1 for suppressed hit/double cells where newer tables use N/V: hard totals above 11 have their double column excluded, and hard totals of at least 17 have their hit column excluded. These are not interpreted as true EV. Stored numeric facts do not replace independent solver tests. Custom profiles remain unvalidated.
