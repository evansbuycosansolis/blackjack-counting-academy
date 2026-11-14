"use client";
import { useSyncExternalStore } from "react";
import { storageHealth, subscribeStorage } from "@/lib/storage";
export function StorageNotice() {
  const health = useSyncExternalStore(
    subscribeStorage,
    storageHealth,
    storageHealth,
  );
  return health.indexedDB === "failed" || health.indexedDB === "unavailable" ? (
    <div className="error" role="alert">
      {health.message} <a href="#settings">Open storage & backups</a>
    </div>
  ) : null;
}
