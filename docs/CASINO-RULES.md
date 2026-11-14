# Casino rules and coaching contracts

## Gameplay

All exposed combinations of 1/2/4/6/8 decks, S17/H17, 3:2/6:5, DAS, any/9–11/10–11 doubling, 2/3/4 split hands, split-Ace restrictions, insurance, late surrender and 50–90% penetration are playable. Restrictions are checked at each transition, including available bankroll. Presets display their actual rules and are examples, not claims about every casino.

Peek deals a hidden dealer card and resolves blackjack before player actions. No-peek reserves a hidden card but delays blackjack resolution. European play draws the second dealer card later. Delayed blackjack can lose all committed wagers or original bets only (OBO); already busted wagers remain lost. Late surrender against a ten/Ace requires a successful peek; against other upcards it can be available in delayed games. Early surrender and other casino-specific protection variants are not implemented.

Amounts are integer cents, with whole-chip initial wagers and configurable whole-chip increments. Surrender/insurance halves and 3:2/6:5 payouts remain exact. Insurance is separately settled at 2:1. Even money is offered for a natural under 3:2. Split 21 is not a natural. A double receives exactly one card. Split hands share the same shoe, bankroll and hand cap. Both children receive their initial cards before the first child is played.

Cut cards trigger reshuffling between rounds. A mid-round exhausted shoe voids/refunds the whole round; no replacement shoe is inserted. Observable RC includes exposed cards only; the hidden card is added once on reveal. The remaining-deck divisor uses physical undealt cards, rounded to the selected estimation increment, with that increment as its minimum.

## Coaching layers

| Layer | Availability | Meaning |
|---|---|---|
| Basic chart | Peek 1/2/4/6/8 decks; delayed all-bets 6/8 decks; four-hand cap; no hitting/resplitting split Aces; restricted double only with no DAS | Published rule-specific chart/fresh-shoe reference; not a complete finite-composition optimum |
| Composition coach | Any exposed rules, when enumeration fits 150,000 states | Optimal legal future decisions for the actual observed multiset, including bankroll and shared split composition |
| Action analysis | Any exposed rules | Exact first at 75,000 states, then explicitly labelled declared-policy Monte Carlo |
| Count deviations | Matching certified or explicitly selected custom profile only | Finite Hi-Lo threshold study set; not universal |

Chart accuracy is separate from composition coaching. No exact recommendation is produced when exact enumeration exceeds its budget. Users can cancel exact coaching by terminating its worker. A rule change or new decision clears the displayed result. The broader gameplay support must not be confused with broader validated chart or automatic simulation coverage.

## Indices

S17: six decks, peek, DAS, unrestricted double, four hands, no split-Ace hit/resplit, nearest half deck and floor TC. Conventional I18/Fab 4 only.

H17: the same conservative gameplay scope, but truncated TC. Includes every numeric deviation in the published BJA H17 study chart, with TC ≥, TC ≤ and strict RC > 0 / RC < 0 handled separately. The chart's ordinary non-deviation plays remain the basic chart's responsibility. Insurance uses its published +3 index. No different deck-count insurance index is inferred.

A selected profile must match rules, precision and rounding. Modified profiles lose their validated label. Threshold data are source-checked study values, not a proof that a single count index is optimal for every possible remaining composition.
