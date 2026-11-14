"use client";
import { useGame } from "@/stores/game-store";
import { useLab } from "@/stores/lab-store";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  Club,
  FlaskConical,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Moon,
  PanelLeftClose,
  Settings2,
  Spade,
  Sun,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";

import { summarize } from "@/lib/analytics";
import { money, signed } from "@/lib/format";
import dynamic from "next/dynamic";
import { Metric } from "./metric";
import { PlayTable } from "./play-table";
import { StorageNotice } from "./storage-notice";
import { CountingTrainer, DeviationsPanel, StrategyTrainer } from "./trainers";
const Analytics = dynamic(() => import("./panels").then((m) => m.Analytics));
const BettingLab = dynamic(() => import("./panels").then((m) => m.BettingLab));
const SettingsPanel = dynamic(() =>
  import("./settings-panel").then((m) => m.SettingsPanel),
);
const Lessons = dynamic(() => import("./lessons").then((m) => m.Lessons));
const navigation = [
  { id: "play", label: "Play blackjack", icon: Spade },
  { id: "counting", label: "Counting trainer", icon: Layers },
  { id: "strategy", label: "Basic strategy", icon: Target },
  { id: "betting", label: "Betting laboratory", icon: FlaskConical },
  { id: "deviations", label: "Strategy deviations", icon: ChartNoAxesCombined },
  { id: "analytics", label: "Statistics & analytics", icon: LayoutDashboard },
  { id: "academy", label: "Learning academy", icon: GraduationCap },
  { id: "settings", label: "Table settings", icon: Settings2 },
];
export function AcademyApp() {
  const s = useGame();
  const [ready, setReady] = useState(false),
    [page, setPage] = useState("play"),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      useGame.persist.rehydrate(),
      useLab.persist.rehydrate(),
    ]).then(() => {
      if (alive) {
        s.init();
        setReady(true);
      }
    });
    const hash = location.hash.slice(1);
    if (navigation.some((n) => n.id === hash)) setPage(hash);
    const fn = () => {
      const id = location.hash.slice(1);
      if (navigation.some((n) => n.id === id)) setPage(id);
    };
    addEventListener("hashchange", fn);
    return () => {
      alive = false;
      removeEventListener("hashchange", fn);
    };
  }, []);
  if (!ready || !s.game)
    return (
      <div className="loading">
        <Spade /> Preparing your table…
      </div>
    );
  const sessionProfit =
    (["playing", "insurance"].includes(s.game.phase)
      ? s.game.roundStart
      : s.game.bankroll) - s.game.startingBankroll;
  const todayHands = summarize(
    s.history.filter(
      (r) => new Date(r.date).toDateString() === new Date().toDateString(),
    ),
  ).hands;
  const stats = summarize(s.history),
    title = navigation.find((n) => n.id === page)!.label;
  const go = (id: string) => {
    setPage(id);
    location.hash = id;
    setMenu(false);
  };
  return (
    <div className={`app ${s.light ? "light" : ""}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#play" onClick={() => go("play")}>
          <span className="brand-mark">
            <Spade size={24} />
          </span>
          <span>
            BLACKJACK<small>COUNTING ACADEMY</small>
          </span>
        </a>
        <div className="workspace-label">YOUR TRAINING SPACE</div>
        <nav>
          {navigation.map((n, i) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={page === n.id ? "nav-active" : ""}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {i === 0 && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-course">
          <div className="eyebrow">
            <GraduationCap size={16} /> THE LEARNING PATH
          </div>
          <h3>
            Build your edge.
            <br />
            One decision at a time.
          </h3>
          <div className="progress-track">
            <i style={{ width: `${(s.completed.length / 7) * 100}%` }} />
          </div>
          <p>{s.completed.length} of 7 levels completed</p>
          <button onClick={() => go("academy")}>
            Continue learning <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">P</span>
          <div>
            Practice account<small>Local progress · Virtual chips</small>
          </div>
          <Settings2 size={16} />
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
            >
              <PanelLeftClose size={18} />
            </button>
            Academy <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="header-tools">
            <span className="local-badge">
              <i /> LOCAL SESSION
            </span>
            <button
              aria-label="Toggle theme"
              className="icon-btn"
              onClick={() => s.toggle("light")}
            >
              {s.light ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <span className="avatar small-avatar">P</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow gold">
                <span className="tiny-line" />{" "}
                {page === "play"
                  ? "THE PRACTICE TABLE"
                  : "YOUR BLACKJACK LABORATORY"}
              </div>
              <h1>{page === "play" ? "Every hand is a lesson." : title}</h1>
              <p>
                {page === "play"
                  ? "Sharpen your strategy. Keep the count. Play with confidence."
                  : "Turn focused practice into measurable progress."}
              </p>
            </div>
            {page === "play" ? (
              <div className="view-switch">
                <button
                  className={!s.casino ? "selected" : ""}
                  onClick={() => s.casino && s.toggle("casino")}
                >
                  <BookOpen size={15} /> Training view
                </button>
                <button
                  className={s.casino ? "selected" : ""}
                  onClick={() => !s.casino && s.toggle("casino")}
                >
                  <Club size={15} /> Casino view
                </button>
              </div>
            ) : (
              <span className="educational">
                EDUCATIONAL · VIRTUAL CHIPS ONLY
              </span>
            )}
          </div>
          <StorageNotice />
          {s.error && (
            <div className="error" role="alert">
              {s.error}
            </div>
          )}
          {page === "play" && (
            <>
              <div className="metric-grid">
                <Metric
                  label="VIRTUAL BANKROLL"
                  value={money(s.game.bankroll)}
                  detail={`${signed(sessionProfit)} settled P/L this session`}
                  accent
                />
                <Metric
                  label="HANDS PLAYED"
                  value={String(stats.hands).padStart(2, "0")}
                  detail="Across your saved sessions"
                />
                <Metric
                  label="STRATEGY ACCURACY"
                  value={
                    stats.accuracy === null
                      ? "—"
                      : `${Math.round(stats.accuracy * 100)}%`
                  }
                  detail={
                    stats.decisionCount
                      ? `${stats.decisionCount} decisions reviewed`
                      : "Your next decision starts here"
                  }
                />
                <Metric
                  label="SESSION PROFIT / LOSS"
                  value={signed(sessionProfit)}
                  detail="Observed result · virtual chips"
                />
              </div>
              <PlayTable />
              <div className="below-table">
                <div>
                  <Target size={17} />
                  <strong>Your daily practice goal</strong>
                  <span>
                    {Math.min(todayHands, s.goal)} / {s.goal} hands
                  </span>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${Math.min(100, (todayHands / s.goal) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <button onClick={() => go("analytics")}>
                  View your progress <ArrowUpRight size={16} />
                </button>
              </div>
            </>
          )}
          {page === "counting" && <CountingTrainer />}
          {page === "strategy" && <StrategyTrainer />}
          {page === "deviations" && <DeviationsPanel />}
          {page === "betting" && <BettingLab />}
          {page === "analytics" && <Analytics />}
          {page === "academy" && <Lessons />}
          {page === "settings" && <SettingsPanel />}
          <footer>
            <span>
              <Spade size={13} /> BLACKJACK COUNTING ACADEMY
            </span>
            <span>Practice with purpose. All chips are virtual.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
