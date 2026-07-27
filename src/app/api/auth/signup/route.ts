import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/db/migrate";

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80),
});

/**
 * Lightweight in-process rate limiter. For production swap with a Redis
 * debounce; this is good enough to deter drive-by signup spam.
 */
const recentSignups = new Map<string, number>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = recentSignups.get(ip) ?? 0;
  if (now - last < 1500) return true;
  recentSignups.set(ip, now);
  if (recentSignups.size > 5000) {
    for (const [k, t] of recentSignups) if (now - t > 60_000) recentSignups.delete(k);
  }
  return false;
}

/**
 * Sign-up endpoint.
 *
 * Anti-enumeration: returns an *identical* response body for both fresh
 * signups and emails that already have an account, regardless of which
 * branch ran. Run comparable-cost bcrypt work in both branches so timing
 * also doesn't leak presence.
 *
 * The frontend does NOT depend on the response shape — the user is sent to
 * the login flow afterwards either way. If signup succeeded, the response
 * is indistinguishable from "we'd send a magic link" semantics to an
 * outside observer.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  // Always run bcrypt at comparable cost regardless of branch.
  if (existing) {
    await bcrypt.compare(password, existing.passwordHash);
    // Identical body shape to the new-user branch.
    return NextResponse.json({ ok: true });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    email,
    passwordHash,
    name: parsed.data.name,
  });
  return NextResponse.json({ ok: true });
}
