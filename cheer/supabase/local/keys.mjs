// Prints local-only API keys (legacy-style HS256 JWTs) for the local stack.
// The real project uses sb_publishable_… keys; supabase-js accepts both.
import { createHmac } from "node:crypto";

const SECRET = "judgey-local-dev-jwt-secret-at-least-32-chars";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "supabase-local", iat: 1790000000, exp: 2105000000, ...payload });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};

console.log(`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`);
console.log(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${sign({ role: "anon" })}`);
console.log(`# service role (scripts/tests only, never in the app):`);
console.log(`JUDGEY_LOCAL_SERVICE_KEY=${sign({ role: "service_role" })}`);
