/** Runs once when the server starts. Node-only work lives in ./instrumentation-node. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
