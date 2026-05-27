import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";

const db = createServiceClient();
const names = ["Marguerite Smith", "Brodie Calandro", "Ian Carlos Villarroel"];

for (const name of names) {
  const { data } = await db
    .from("players")
    .select("id, name")
    .ilike("name", `%${name}%`)
    .limit(5);
  console.log(`${name}: ${data && data.length > 0 ? JSON.stringify(data) : "NOT FOUND"}`);
}
