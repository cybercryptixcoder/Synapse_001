import { useEffect, useMemo, useRef } from "react";

type RunnerMessage = { source: string };
type RunnerResult = { stdout: string[]; stderr: string[]; error?: string };

export function useWorkerRunner(onResult: (result: RunnerResult) => void) {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/codeRunner.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<RunnerResult>) => {
      onResult(e.data);
    };
    return () => {
      worker.terminate();
    };
  }, [onResult]);

  const runCode = useMemo(
    () => (source: string) => {
      workerRef.current?.postMessage({ source } satisfies RunnerMessage);
    },
    [],
  );

  return { runCode };
}
