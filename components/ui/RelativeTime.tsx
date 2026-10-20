"use client";

import { useSyncExternalStore } from "react";
import { formatAbsoluteTime } from "@/lib/format";

function formatRelative(iso: string, now: number): string | null {
  const deltaSeconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (deltaSeconds < 60) return "Just now";

  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(deltaSeconds / 3600);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(deltaSeconds / 86400);
  if (days < 7) return `${days}d ago`;

  return null;
}

function subscribe() {
  return () => {};
}

export function RelativeTime({ iso }: { iso: string }) {
  const absolute = formatAbsoluteTime(iso);
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso, Date.now()) ?? absolute,
    () => absolute,
  );

  return (
    <time dateTime={iso} title={absolute}>
      {label}
    </time>
  );
}
