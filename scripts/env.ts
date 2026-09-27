// Load .env / .env.local for CLI scripts (Next.js loads them itself for the app).
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
