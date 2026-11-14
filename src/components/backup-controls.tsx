"use client";
import { download } from "@/lib/analytics";
import { Backup, makeBackup, validateBackup } from "@/lib/backup";
import { restoreBackup } from "@/lib/restore";
import {
  estimateStorage,
  retryStorage,
  storageHealth,
  subscribeStorage,
} from "@/lib/storage";
import { useGame } from "@/stores/game-store";
import { useLab } from "@/stores/lab-store";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "./ui/button";
export function BackupControls() {
  const health = useSyncExternalStore(
      subscribeStorage,
      storageHealth,
      storageHealth,
    ),
    [candidate, setCandidate] = useState<Backup | null>(null),
    [message, setMessage] = useState(""),
    [usage, setUsage] = useState<{ usage?: number; quota?: number }>({}),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void estimateStorage().then(setUsage);
  }, []);
  const backup = async () => {
    setBusy(true);
    try {
      const data = await makeBackup(
        useGame.getState() as unknown as Record<string, unknown>,
        useLab.getState() as unknown as Record<string, unknown>,
      );
      download(
        data,
        `blackjack-academy-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setMessage(
        `Exported complete backup with ${data.rounds.length} archived rounds.`,
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <h2>Storage, backups & recovery</h2>
      <p>
        IndexedDB keeps full round timelines and simulation history. A
        localStorage mirror preserves compatibility with the MVP. Failed writes
        retain the current state in memory and expose a retry path.
      </p>
      <div className="stat-strip">
        <span>
          IndexedDB<b>{health.indexedDB}</b>
        </span>
        <span>
          Browser mirror<b>{health.mirror}</b>
        </span>
        <span>
          Estimated storage
          <b>
            {usage.usage !== undefined
              ? `${(usage.usage / 1048576).toFixed(1)} MB`
              : "Unavailable"}
          </b>
        </span>
        <span>
          Origin quota
          <b>
            {usage.quota !== undefined
              ? `${(usage.quota / 1048576).toFixed(0)} MB`
              : "Browser managed"}
          </b>
        </span>
      </div>
      {health.message && (
        <p className="notice" role="status">
          {health.message}
        </p>
      )}
      <div className="form-row spaced">
        <Button disabled={busy} onClick={() => void backup()}>
          Export complete backup
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void retryStorage().then((ok) =>
              setMessage(
                ok
                  ? "Storage retry completed."
                  : "Storage is still unavailable. Keep a backup before closing.",
              ),
            )
          }
        >
          Retry persistent storage
        </Button>
        <label>
          Choose backup JSON
          <input
            aria-label="Choose backup JSON"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 100 * 1024 * 1024) {
                setMessage("Backup exceeds the 100 MB import limit.");
                return;
              }
              void file.text().then((text) => {
                try {
                  const parsed = validateBackup(JSON.parse(text));
                  setCandidate(parsed);
                  setMessage("Backup validated. Review it before restoring.");
                } catch (error) {
                  setCandidate(null);
                  setMessage(String(error));
                }
              });
            }}
          />
        </label>
      </div>
      {candidate && (
        <div className="notice">
          <h3>
            Validated backup · {new Date(candidate.created).toLocaleString()}
          </h3>
          <p>
            {candidate.rounds.length} archived rounds. Restoring replaces the
            current session, preferences, training progress and laboratory
            records with the backup, then pauses the table. Export your current
            progress first if you want to retain it separately.
          </p>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void restoreBackup(candidate)
                .then(() => {
                  setMessage(
                    "Backup restored. The table is paused; resume when ready.",
                  );
                  setCandidate(null);
                })
                .catch((e) => setMessage(String(e)))
                .finally(() => setBusy(false));
            }}
          >
            Restore validated backup
          </Button>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
