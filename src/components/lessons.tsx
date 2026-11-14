"use client";
import { useGame } from "@/stores/game-store";
import { Check, ChevronRight, GraduationCap } from "lucide-react";
import { useState } from "react";
import { AcademyExercises, TrainingProgress } from "./training-progress";
import { Button } from "./ui/button";
const lessons = [
  {
    title: "Blackjack fundamentals",
    subtitle: "Learn the table before you learn the count.",
    body: "Cards 2–10 use face value; J, Q and K count as 10. An Ace counts as 11 unless that busts the hand, then it counts as 1. Beat the dealer without exceeding 21. Equal totals push. An original two-card Ace plus a ten-value card is a natural blackjack; split-hand 21 is not.",
    example:
      "A + 7 = soft 18. Add a 9: the Ace becomes 1, producing hard 17. The dealer draws below 17 and follows the selected soft-17 rule.",
    question: "A + A + 9 totals…",
    options: ["11", "21", "31"],
    answer: 1,
    reason: "One Ace counts as 11 and the other as 1.",
    exercise: "play",
    exerciseLabel: "Play a practice hand",
  },
  {
    title: "Basic strategy",
    subtitle: "Use your hand, the dealer upcard, and the rules.",
    body: "Basic strategy maximizes expected return for a stated ruleset. Soft hands contain an Ace counted as 11. Splitting creates separate hands. Doubling adds an equal wager for exactly one final card. Late surrender returns half a wager after dealer blackjack has been excluded.",
    example:
      "Six-deck S17: hard 11 versus 6 doubles when legal; 8 + 8 versus 10 splits. Hard 16 versus 10 surrenders when eligible.",
    question: "Doubling down gives you…",
    options: [
      "Exactly one additional card",
      "Unlimited additional cards",
      "A guaranteed win",
    ],
    answer: 0,
    reason:
      "A double adds one equal wager, draws one card, and ends that hand.",
    exercise: "strategy",
    exerciseLabel: "Practice strategy decisions",
  },
  {
    title: "Hi-Lo card counting",
    subtitle: "Count exposed information, one card at a time.",
    body: "Hi-Lo assigns +1 to 2–6, zero to 7–9, and −1 to tens, face cards and Aces. Start at zero after each shuffle. Add only exposed cards. The count persists between rounds. An unrevealed hole card stays unknown.",
    example:
      "5, K, 3, 8, A has tags +1 −1 +1 0 −1, returning to zero. A complete standard deck also sums to zero.",
    question: "2, 6, K, 9 changes the running count by…",
    options: ["−1", "0", "+1"],
    answer: 2,
    reason: "+1 +1 −1 +0 = +1.",
    exercise: "counting",
    exerciseLabel: "Start a counting drill",
  },
  {
    title: "True count & deck estimation",
    subtitle: "Put the running count in context.",
    body: "True count is running count divided by estimated remaining decks. This application estimates to the nearest half-deck with a half-deck minimum. It floors the quotient for index decisions. Consistent rounding matters, especially for negative counts.",
    example:
      "RC +6 ÷ 3 decks = TC +2. RC −2 ÷ 3 decks = −0.67, floored to index −1.",
    question: "RC +8 with 4 estimated decks gives TC…",
    options: ["+2", "+4", "+8"],
    answer: 0,
    reason: "8 divided by 4 is +2.",
    exercise: "counting",
    exerciseLabel: "Practice true-count checkpoints",
  },
  {
    title: "Betting & variance",
    subtitle: "Understand risk behind a betting ramp.",
    body: "A betting ramp changes exposure with true count, not the outcome of the next hand. Kelly estimates depend on assumed edge and variance. Drawdown measures decline from a prior bankroll peak. A finite bankroll can be exhausted even with a long-term advantage.",
    example:
      "A hypothetical 1% edge on a 20-chip wager means 0.2 chips expected profit per round. Actual results can differ by many wagers.",
    question: "A positive count guarantees…",
    options: ["The next hand wins", "The dealer busts", "Neither outcome"],
    answer: 2,
    reason: "Individual hands remain uncertain.",
    exercise: "betting",
    exerciseLabel: "Explore the betting laboratory",
  },
  {
    title: "Advanced strategy indices",
    subtitle: "Use indices only within a supported profile.",
    body: "An index is a threshold for a count-dependent action. Values depend on counting system, casino rules and conversion convention. I18 covers important playing and insurance deviations; Fab 4 covers surrender. Only legal actions are available.",
    example:
      "In this six-deck S17 Hi-Lo profile, hard 16 versus 10 stands at TC 0 or above when surrender is unavailable and hits below. Pair 8s retains its pair strategy.",
    question: "Can one index table cover every ruleset?",
    options: [
      "Yes, all blackjack is identical",
      "No, check rules and conventions",
      "Only at positive counts",
    ],
    answer: 1,
    reason:
      "Rules, count system, deck estimation and rounding affect applicability.",
    exercise: "deviations",
    exerciseLabel: "Study I18 & Fab 4",
  },
  {
    title: "Casino simulation",
    subtitle: "Bring the skills together without aids.",
    body: "Practice full shoes with counts and coaching hidden. Estimate deck depth and choose actions unaided. Review your session afterward. Counting and decision accuracy measure skill more directly than short-term virtual profit. Pause whenever you need a break.",
    example:
      "Choose Expert in Settings for hidden count, hidden coach and instant animations. Casino view removes training panels. Review your decisions in Analytics.",
    question: "The strongest evidence of learning is…",
    options: [
      "Three consecutive wins",
      "Consistent counting and decision accuracy",
      "Increasing every bet",
    ],
    answer: 1,
    reason: "Short-term outcomes contain substantial variance.",
    exercise: "play",
    exerciseLabel: "Play an unaided session",
  },
];
export function Lessons() {
  const s = useGame(),
    [active, setActive] = useState(0),
    [answer, setAnswer] = useState<number | null>(null),
    l = lessons[active],
    passed = answer === l.answer;
  return (
    <>
      <TrainingProgress />
      <div className="lesson-layout">
        <aside className="panel lesson-nav">
          <div className="eyebrow gold">YOUR LEARNING PATH</div>
          <h2>
            From first hand
            <br />
            to full shoe.
          </h2>
          <p>{s.completed.length} / 7 levels completed</p>
          <div className="progress-track">
            <i style={{ width: `${(s.completed.length / 7) * 100}%` }} />
          </div>
          {lessons.map((x, i) => (
            <button
              key={x.title}
              className={active === i ? "selected" : ""}
              onClick={() => {
                setActive(i);
                setAnswer(null);
              }}
            >
              <span className="lesson-number">
                {s.completed.includes(i) ? <Check size={16} /> : i + 1}
              </span>
              <span>{x.title}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>
        <section className="panel lesson-content">
          <span className="tag">
            LEVEL {active + 1} / 7{" "}
            {s.completed.includes(active) ? "· COMPLETED" : ""}
          </span>
          <h2>{l.title}</h2>
          <h3>{l.subtitle}</h3>
          <p>{l.body}</p>
          <div className="lesson-example">
            <span className="eyebrow gold">WORKED EXAMPLE</span>
            <p>{l.example}</p>
          </div>
          <h3>Check your understanding</h3>
          <p>{l.question}</p>
          <div className="quiz-options">
            {l.options.map((x, i) => (
              <button
                key={x}
                className={
                  answer === i ? (passed ? "correct" : "incorrect") : ""
                }
                disabled={passed}
                onClick={() => {
                  setAnswer(i);
                  if (i === l.answer) s.complete(active);
                }}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {x}
                {answer === i && passed && <Check size={16} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div className="notice" role="status">
              {passed
                ? "Correct. " + l.reason
                : "Try again. Review the example above."}
            </div>
          )}
          <div className="form-row spaced">
            <Button asChild variant="outline">
              <a href={`#${l.exercise}`}>
                {l.exerciseLabel} <ChevronRight size={15} />
              </a>
            </Button>
            {passed && active < 6 && (
              <Button
                onClick={() => {
                  setActive(active + 1);
                  setAnswer(null);
                }}
              >
                Next level <ChevronRight size={15} />
              </Button>
            )}
          </div>
          {s.completed.length === 7 && (
            <div className="achievement">
              <GraduationCap />
              <strong>Academy foundations completed</strong>
              <p>
                Seven levels, one solid foundation. Keep practicing to improve
                your accuracy.
              </p>
            </div>
          )}
        </section>
      </div>
      <AcademyExercises />
    </>
  );
}
