import { useEffect, useRef, useState } from "react";
import type { Dataset } from "../types";
import { checkPreviewAccess } from "../services/access-check";

type CheckState = {
  status: "idle" | "checking" | "available" | "unavailable";
  reason: string;
  checkedAt: string | null;
};
export function useAccessCheck(dataset: Dataset, reason: string) {
  const [state, setState] = useState<CheckState>({
    status: "idle",
    reason,
    checkedAt: null,
  });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function recheck() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...previous, status: "checking" }));
    try {
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(30000),
      ]);
      await checkPreviewAccess(dataset, signal);
      if (!controller.signal.aborted)
        setState({
          status: "available",
          reason: "",
          checkedAt: new Date().toISOString(),
        });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({
          status: "unavailable",
          reason: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString(),
        });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  return { ...state, recheck };
}
