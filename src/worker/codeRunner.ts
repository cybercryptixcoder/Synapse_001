const TIMEOUT_MS = 2000;

self.onmessage = async (e: MessageEvent<{ source: string }>) => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const consoleStub = {
    log: (...args: unknown[]) => stdout.push(args.map(String).join(" ")),
    error: (...args: unknown[]) => stderr.push(args.map(String).join(" ")),
  };

  const run = () => {
    try {
      const fn = new Function("console", e.data.source);
      const res = fn(consoleStub);
      if (res !== undefined) stdout.push(String(res));
      return { stdout, stderr };
    } catch (err: any) {
      return { stdout, stderr, error: err?.message || String(err) };
    }
  };

  const result = await Promise.race([
    new Promise((resolve) => setTimeout(() => resolve({ stdout, stderr, error: "Timed out" }), TIMEOUT_MS)),
    new Promise((resolve) => resolve(run())),
  ]);

  // @ts-ignore
  self.postMessage(result);
};
