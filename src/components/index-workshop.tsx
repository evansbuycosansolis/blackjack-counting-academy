"use client";
import {
  builtInIndexProfiles,
  describeProfile,
  indexDecision,
  IndexProfile,
  indexProfileMatches,
  validateIndexProfile,
} from "@/engine/index-profiles";
import { useGame } from "@/stores/game-store";
import { useState } from "react";
import { Button } from "./ui/button";
export function IndexWorkshop() {
  const s = useGame(),
    profiles = [...builtInIndexProfiles, ...s.indexProfiles];
  const [id, setId] = useState("i18-s17"),
    [draft, setDraft] = useState<IndexProfile | null>(null),
    [message, setMessage] = useState(""),
    [mode, setMode] = useState("Decision"),
    [question, setQuestion] = useState(0),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState(""),
    [answered, setAnswered] = useState(false);
  const p = profiles.find((x) => x.id === id) ?? profiles[0],
    entries = p.entries.filter((x) =>
      mode === "Insurance"
        ? x.above === "insurance"
        : mode === "Fab 4"
          ? x.set === "F4"
          : mode === "Illustrious 18"
            ? x.set === "I18"
            : true,
    ),
    entry = entries[question % Math.max(1, entries.length)],
    offset = [-1, 0, 1, 2, -2][question % 5],
    tc = entry ? entry.index + offset : 0,
    rc = tc * 2;
  const check = (choice?: string) => {
    if (!entry || answered) return;
    const expected =
      mode === "Memorize index"
        ? String(entry.index)
        : mode === "Threshold"
          ? String(indexDecision(entry, tc, rc) === entry.above)
          : indexDecision(entry, tc, rc);
    const actual = choice ?? answer;
    const correct = actual.trim().toLowerCase() === expected.toLowerCase();
    s.score(
      correct,
      undefined,
      mode === "Insurance"
        ? "insurance"
        : mode === "Memorize index"
          ? "memory"
          : mode === "Threshold"
            ? "threshold"
            : "deviation",
    );
    setResult(
      `${correct ? "Correct." : "Expected: " + expected + "."} ${entry.explanation}`,
    );
    setAnswered(true);
  };
  return (
    <section className="panel">
      <h2>Index profiles & focused exercises</h2>
      <p>
        Select a source-validated profile or make a clearly labeled custom study
        set. Editing a built-in creates an unvalidated personal copy.
      </p>
      <div className="form-row">
        <label>
          Study profile
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setQuestion(0);
              setAnswered(false);
              setResult("");
            }}
          >
            {profiles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.validated
                  ? " · source validated"
                  : " · custom / unvalidated"}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => {
            s.selectIndex(p.id);
            setMessage(
              indexProfileMatches(p, s.rules)
                ? "Selected for matching live-table rules."
                : "Selected; live overrides remain disabled until the table rules match.",
            );
          }}
        >
          Use profile at table
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setDraft({
              ...structuredClone(p),
              id: crypto.randomUUID(),
              name: p.name + " · personal",
              validated: false,
            })
          }
        >
          Duplicate & edit
        </Button>
        {!p.validated && (
          <Button
            variant="outline"
            onClick={() => setDraft(structuredClone(p))}
          >
            Edit custom profile
          </Button>
        )}
        {!p.validated && (
          <Button variant="outline" onClick={() => s.deleteIndex(p.id)}>
            Delete custom profile
          </Button>
        )}
      </div>
      <p className="micro">
        {p.validated ? "Published source" : "User supplied source"}:{" "}
        <a
          href={p.source.startsWith("https://") ? p.source : undefined}
          target="_blank"
          rel="noreferrer"
        >
          {p.source.startsWith("https://")
            ? "View primary reference"
            : p.source || "Not supplied"}
        </a>{" "}
        · {describeProfile(p)} · nearest {p.precision} deck · {p.rounding} TC.{" "}
        {indexProfileMatches(p, s.rules)
          ? "Matches table."
          : "Does not match table."}
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {draft && (
        <div className="notice">
          <div className="form-row">
            <label>
              Profile name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Source / notes
              <input
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              />
            </label>
          </div>
          <p className="micro">
            Custom profile applicability is copied from the selected source. To
            change it explicitly, edit the rules JSON below. No edit is
            automatically certified.
          </p>
          <label className="compact-label">
            Applicability rules JSON
            <textarea
              defaultValue={JSON.stringify(draft.rules, null, 2)}
              onBlur={(e) => {
                try {
                  setDraft({ ...draft, rules: JSON.parse(e.target.value) });
                } catch {
                  setMessage("Invalid applicability JSON");
                }
              }}
            />
          </label>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hand</th>
                  <th>Dealer</th>
                  <th>Index</th>
                  <th>Condition met</th>
                  <th>Otherwise</th>
                  <th>Hand condition</th>
                  <th>Trigger</th>
                  <th>Explanation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.entries.map((x, i) => (
                  <tr key={x.id}>
                    {(
                      ["hand", "dealer", "index", "above", "below"] as const
                    ).map((k) => (
                      <td key={k}>
                        <input
                          aria-label={`${k} row ${i + 1}`}
                          value={x[k]}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              entries: draft.entries.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      explanation:
                                        "Personal study condition; verify independently.",
                                      [k]: ["hand", "dealer", "index"].includes(
                                        k,
                                      )
                                        ? Number(e.target.value)
                                        : e.target.value,
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          aria-label={`Soft hand row ${i + 1}`}
                          checked={!!x.soft}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              entries: draft.entries.map((v, j) =>
                                j === i ? { ...v, soft: e.target.checked } : v,
                              ),
                            })
                          }
                        />
                        Soft
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          aria-label={`Pair condition row ${i + 1}`}
                          checked={!!x.pair}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              entries: draft.entries.map((v, j) =>
                                j === i ? { ...v, pair: e.target.checked } : v,
                              ),
                            })
                          }
                        />
                        Pair
                      </label>
                    </td>
                    <td>
                      <select
                        aria-label={`Trigger row ${i + 1}`}
                        value={x.trigger ?? "gte"}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            entries: draft.entries.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    trigger: e.target.value as
                                      | "gte"
                                      | "lte"
                                      | "rc-positive"
                                      | "rc-negative",
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        <option value="gte">TC ≥ index</option>
                        <option value="lte">TC ≤ index</option>
                        <option value="rc-positive">RC &gt; 0</option>
                        <option value="rc-negative">RC &lt; 0</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Explanation row ${i + 1}`}
                        value={x.explanation}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            entries: draft.entries.map((v, j) =>
                              j === i
                                ? { ...v, explanation: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            entries: draft.entries.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-row spaced">
            <Button
              variant="outline"
              onClick={() =>
                setDraft({
                  ...draft,
                  entries: [
                    ...draft.entries,
                    {
                      id: crypto.randomUUID(),
                      hand: 16,
                      dealer: 10,
                      index: 0,
                      above: "stand",
                      below: "hit",
                      set: "Extended",
                      explanation: "Personal study entry.",
                    },
                  ],
                })
              }
            >
              Add entry
            </Button>
            <Button
              onClick={() => {
                try {
                  validateIndexProfile(draft);
                  s.saveIndex(draft);
                  setId(draft.id);
                  setDraft(null);
                  setMessage(
                    "Custom profile saved. It is labeled unvalidated.",
                  );
                } catch (e) {
                  setMessage(String(e));
                }
              }}
            >
              Save custom profile
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel editor
            </Button>
          </div>
        </div>
      )}
      <div className="form-row spaced">
        <label>
          Exercise
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setQuestion(0);
              setAnswered(false);
              setResult("");
            }}
          >
            {[
              "Decision",
              "Illustrious 18",
              "Fab 4",
              "Insurance",
              "Memorize index",
              "Threshold",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setQuestion(question + 1);
            setAnswer("");
            setResult("");
            setAnswered(false);
          }}
        >
          Next exercise
        </Button>
      </div>
      {entry ? (
        <div className="lesson-example">
          <span className="eyebrow gold">
            {mode.toUpperCase()} · QUESTION {question + 1}
          </span>
          <h3>
            {entry.hand === 0
              ? "Insurance opportunity"
              : `${entry.soft ? "Soft " : entry.pair ? "Pair total " : "Hard "}${entry.hand}`}{" "}
            vs {entry.dealer === 11 ? "A" : entry.dealer}
          </h3>
          {mode !== "Memorize index" && (
            <p>
              True-count index {tc >= 0 ? "+" : ""}
              {tc}; running count {rc >= 0 ? "+" : ""}
              {rc}.{" "}
              {entry.trigger?.startsWith("rc-")
                ? "This entry uses a strict running-count sign test."
                : ""}
            </p>
          )}
          {mode === "Memorize index" ? (
            <div className="inline-form">
              <input
                aria-label="Index answer"
                type="number"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <Button disabled={answered} onClick={() => check()}>
                Check index
              </Button>
            </div>
          ) : mode === "Threshold" ? (
            <div className="form-row">
              <Button
                disabled={answered}
                variant="outline"
                onClick={() => check("true")}
              >
                Threshold met
              </Button>
              <Button
                disabled={answered}
                variant="outline"
                onClick={() => check("false")}
              >
                Threshold not met
              </Button>
            </div>
          ) : (
            <div className="action-buttons">
              {[...new Set([entry.above, entry.below])].map((a) => (
                <Button
                  key={a}
                  disabled={answered}
                  variant="outline"
                  onClick={() => check(a)}
                >
                  {a}
                </Button>
              ))}
            </div>
          )}
          {result && (
            <p className="notice" role="status">
              {result}
            </p>
          )}
        </div>
      ) : (
        <p className="notice">
          This profile has no entries in the selected exercise set.
        </p>
      )}
      <div className="stat-strip">
        {(["deviation", "insurance", "memory", "threshold"] as const).map(
          (kind) => {
            const checks = s.checks.filter((x) => x.kind === kind);
            return (
              <span key={kind}>
                {kind}
                <b>
                  {checks.length
                    ? `${Math.round((checks.filter((c) => c.correct).length / checks.length) * 100)}% · ${checks.length} attempts`
                    : "No attempts"}
                </b>
              </span>
            );
          },
        )}
      </div>
    </section>
  );
}
