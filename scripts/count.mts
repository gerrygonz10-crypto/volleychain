import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";

const db = createServiceClient();
const [p, m] = await Promise.all([
  db.from("players").select("id", { count: "exact", head: true }),
  db.from("matches").select("id", { count: "exact", head: true }),
]);
console.log(`Players: ${p.count?.toLocaleString()}`);
console.log(`Matches: ${m.count?.toLocaleString()}`);
