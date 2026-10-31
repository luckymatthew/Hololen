"use client";

import { useEffect, useState } from "react";
import { japanDateAt, msUntilNextJapanDate } from "@/lib/card-release-status.mjs";

const maxRecheckDelay = 60 * 60 * 1000;

/** Refresh the Japan calendar day at midnight and when the page resumes. */
export default function useJapanDate() {
  const [today, setToday] = useState(() => japanDateAt());
  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      setToday(japanDateAt(now));
      // One timer handles midnight and bounded checks after a device-clock change.
      const boundary = msUntilNextJapanDate(now);
      timer = window.setTimeout(refresh, boundary === null ? maxRecheckDelay : Math.min(boundary + 25, maxRecheckDelay));
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    refresh();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return today;
}
