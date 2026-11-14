export interface TimedDrill {
  id: string;
  date: string;
  mode: string;
  cards: number;
  activeMs: number;
  correct: boolean;
  runningError: number;
  trueError?: number;
  cardsPerMinute: number;
}
export interface MasterySettings {
  accuracy: number;
  attempts: number;
  cardsPerMinute: number;
}
export const defaultMastery: MasterySettings = {
  accuracy: 0.9,
  attempts: 20,
  cardsPerMinute: 60,
};
export function mastery(
  checks: { correct: boolean }[],
  records: TimedDrill[],
  settings: MasterySettings,
) {
  const recent = checks.slice(-settings.attempts),
    accuracy = recent.length
      ? recent.filter((c) => c.correct).length / recent.length
      : 0,
    bestSpeed = Math.max(
      0,
      ...records.filter((r) => r.correct).map((r) => r.cardsPerMinute),
    );
  const mastered =
    recent.length >= settings.attempts &&
    accuracy >= settings.accuracy &&
    bestSpeed >= settings.cardsPerMinute;
  const level = mastered
    ? 3
    : recent.length >= 10 && accuracy >= 0.85
      ? 2
      : recent.length >= 5 && accuracy >= 0.7
        ? 1
        : 0;
  return {
    accuracy,
    bestSpeed,
    mastered,
    level,
    label: ["Beginner", "Intermediate", "Advanced", "Expert"][level],
  };
}
export function achievements(
  checks: { kind: string; correct: boolean }[],
  records: TimedDrill[],
  hands: number,
  completed: number[],
) {
  const count = checks.filter((c) => c.kind === "counting"),
    strategy = checks.filter((c) => c.kind === "strategy"),
    insurance = checks.filter((c) => c.kind === "insurance");
  return [
    {
      id: "first-hand",
      name: "First hand",
      description: "Complete one virtual hand.",
      earned: hands >= 1,
    },
    {
      id: "century",
      name: "Table centurion",
      description: "Complete 100 virtual hands.",
      earned: hands >= 100,
    },
    {
      id: "counter",
      name: "Count keeper",
      description: "Answer 20 counting checkpoints with at least 90% accuracy.",
      earned:
        count.length >= 20 &&
        count.slice(-20).filter((c) => c.correct).length >= 18,
    },
    {
      id: "strategy",
      name: "Strategy scholar",
      description: "Answer 20 strategy drills with at least 90% accuracy.",
      earned:
        strategy.length >= 20 &&
        strategy.slice(-20).filter((c) => c.correct).length >= 18,
    },
    {
      id: "speed",
      name: "Minute mile",
      description: "Count at least 52 cards correctly at 60 cards/minute.",
      earned: records.some(
        (r) => r.correct && r.cards >= 52 && r.cardsPerMinute >= 60,
      ),
    },
    {
      id: "insurance",
      name: "Insurance analyst",
      description: "Make 10 correct insurance study decisions.",
      earned: insurance.filter((c) => c.correct).length >= 10,
    },
    {
      id: "academy",
      name: "Academy foundations",
      description: "Complete all seven lesson quizzes.",
      earned: new Set(completed).size === 7,
    },
  ];
}
export function makeTimedDrill(
  input: Omit<TimedDrill, "id" | "date" | "cardsPerMinute">,
): TimedDrill {
  if (
    !Number.isInteger(input.cards) ||
    input.cards < 1 ||
    !Number.isFinite(input.activeMs) ||
    input.activeMs <= 0
  )
    throw Error(
      "A timed result needs observed cards and positive active time.",
    );
  return {
    ...input,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    cardsPerMinute: (input.cards / input.activeMs) * 60000,
  };
}
