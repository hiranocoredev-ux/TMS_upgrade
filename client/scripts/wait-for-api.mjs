// Waits until the API server answers before the Vite dev server starts, so the
// first page load does not hit the proxy while the API is still booting.
// Usage: node scripts/wait-for-api.mjs   (API_PROXY_TARGET overrides the URL)
const target = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:3003').replace(/\/+$/, '');
const timeoutMs = Number(process.env.API_WAIT_TIMEOUT_MS) || 90_000;
const started = Date.now();

const isUp = async () => {
  try {
    const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
};

let announced = false;
while (!(await isUp())) {
  if (Date.now() - started > timeoutMs) {
    console.log(`API at ${target} did not answer within ${Math.round(timeoutMs / 1000)}s; starting the client anyway.`);
    process.exit(0);
  }
  if (!announced) {
    console.log(`Waiting for the API at ${target} ...`);
    announced = true;
  }
  await new Promise((r) => setTimeout(r, 500));
}
if (announced) console.log('API is up; starting the client.');
