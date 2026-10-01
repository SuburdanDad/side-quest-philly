"use client";

// Live mode's only door to Supabase (docs/backend-spec.md §8). Two lazy
// browser clients: a session-less one for the public meet_snapshot (so the ETA
// never waits on sign-in) and one with the anonymous session for every write.
// supabase-js is only downloaded once live mode is actually used.

import type { SupabaseClient } from "@supabase/supabase-js";
import { backoffDelay, isAuthRateLimit } from "./live-core";

// Literal process.env reads so Next inlines them at build time.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** With no Supabase env vars the app is demo-only. */
export const isLiveEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

const RPC_TIMEOUT_MS = 12_000;
const MAX_SIGN_IN_ATTEMPTS = 6;

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/**
 * A 429 from /auth/v1/* rejects instead of resolving: auth-js then treats it
 * as a retryable network error and keeps the stored session, instead of
 * reading it as "invalid refresh token" and signing the fan out.
 */
const authAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (isAuthRateLimit(urlOf(input), res.status)) throw new TypeError("Supabase Auth rate limit (429)");
  return res;
};

let authed: Promise<SupabaseClient> | undefined;
let anon: Promise<SupabaseClient> | undefined;

function authedClient(): Promise<SupabaseClient> {
  authed ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const client = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "judgey_auth" },
      global: { fetch: authAwareFetch },
    });
    client.auth.onAuthStateChange((event) => {
      // Never call auth from inside this callback (auth-js holds its lock here).
      if (event === "SIGNED_OUT") setTimeout(onUnexpectedSignOut, 0);
    });
    return client;
  });
  return authed;
}

function publicClient(): Promise<SupabaseClient> {
  anon ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "judgey_public" },
    }),
  );
  return anon;
}

// --- Turnstile (optional) ---------------------------------------------------

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}

let turnstileScript: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  turnstileScript ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api) resolve(api);
      else reject(new Error("Turnstile did not load"));
    };
    script.onerror = () => reject(new Error("Turnstile did not load"));
    document.head.appendChild(script);
  }).catch((e) => {
    turnstileScript = undefined;
    throw e;
  });
  return turnstileScript;
}

/** A fresh Turnstile token. The widget only shows itself if Cloudflare needs a click. */
async function turnstileToken(siteKey: string): Promise<string> {
  const api = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:60";
    document.body.appendChild(el);
    const widget: { id?: string } = {};
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      if (widget.id !== undefined) api.remove(widget.id);
      el.remove();
      settle();
    };
    const timeout = setTimeout(() => finish(() => reject(new Error("Turnstile timed out"))), 30_000);
    widget.id = api.render(el, {
      sitekey: siteKey,
      appearance: "interaction-only",
      theme: "dark",
      callback: (token: string) => finish(() => resolve(token)),
      "error-callback": () => finish(() => reject(new Error("Turnstile failed"))),
    });
  });
}

// --- The anonymous session ----------------------------------------------------

let session: Promise<string> | undefined;
const renewListeners = new Set<() => void>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate limits, network errors and 5xx are worth retrying; other 4xx (e.g. sign-ins disabled) are not. */
function retryable(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status !== "number" || status === 0 || status === 429 || status >= 500;
}

/**
 * One sign-in at a time across every tab of this origin: inside the Web Lock
 * getSession() re-reads `judgey_auth` from storage, so a second tab picks up
 * the identity the first one just minted instead of creating another (two
 * identities would let one press send the shared outbox's tap twice).
 */
async function signIn(): Promise<string> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return signInUnlocked();
  return locks.request("judgey-signin", signInUnlocked);
}

async function signInUnlocked(): Promise<string> {
  const client = await authedClient();
  for (let attempt = 0; ; attempt++) {
    let error: unknown;
    try {
      const current = await client.auth.getSession();
      if (current.data.session) return current.data.session.user.id;
      // A stored session that couldn't refresh yet: retry it rather than mint a new identity.
      error = current.error;
      if (!error) {
        const captchaToken = TURNSTILE_SITE_KEY ? await turnstileToken(TURNSTILE_SITE_KEY) : undefined;
        const res = await client.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
        if (res.data.session) return res.data.session.user.id;
        error = res.error ?? new Error("Anonymous sign-in returned no session");
      }
    } catch (e) {
      error = e;
    }
    if (attempt + 1 >= MAX_SIGN_IN_ATTEMPTS || !retryable(error)) throw error;
    await sleep(backoffDelay(attempt, Math.random()));
  }
}

/**
 * The anonymous user's id. Signs in once (with a Turnstile token when a site
 * key is set), retrying 429s and network errors with backoff and jitter. A
 * failure is not remembered: the next caller tries again.
 */
export function ensureSession(): Promise<string> {
  if (!isLiveEnabled) return Promise.reject(new Error("Live mode is off"));
  session ??= signIn().catch((e) => {
    session = undefined;
    throw e;
  });
  return session;
}

/** Called after an unexpected sign-out has been repaired with a new anonymous session. */
export function onSessionRenewed(cb: () => void): () => void {
  renewListeners.add(cb);
  return () => renewListeners.delete(cb);
}

function onUnexpectedSignOut() {
  session = undefined;
  ensureSession().then(
    () => renewListeners.forEach((l) => l()),
    () => {}, // the next action or poll tries again
  );
}

// --- RPCs ---------------------------------------------------------------------

export class RpcError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function call(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args).abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS));
  if (error) throw new RpcError(error.message, error.code ?? "");
  return data;
}

/** meet_snapshot: public, no session involved. */
export async function fetchSnapshot(meetId: string, haveVersion: number): Promise<unknown> {
  return call(await publicClient(), "meet_snapshot", { p_meet: meetId, p_have_version: haveVersion });
}

/** Any RPC that needs auth.uid(): signs in first. */
export async function callAuthed(fn: string, args: Record<string, unknown>): Promise<unknown> {
  await ensureSession();
  try {
    return await call(await authedClient(), fn, args);
  } catch (e) {
    // 'not-authenticated' (28000): the session went away under us; sign in again next time.
    if (e instanceof RpcError && e.code === "28000") session = undefined;
    throw e;
  }
}
