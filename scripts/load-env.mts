import { readFileSync } from "fs";
import { resolve } from "path";

// Reads .env.local and populates process.env before supabase initializes.
// This file must be the first import in CLI scripts.
try {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const eq = line.indexOf("=");
    if (eq < 1 || line.startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not present — env vars expected from the shell
}
