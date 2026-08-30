import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

/**
 * Identity, such as it is. There is no registration anywhere in Ouistiti — the
 * whole premise is that a parent can arrive, look, and contribute without an
 * account. This gives each browser an opaque token so we can rate-limit reports
 * and let someone build up standing, and it holds nothing about who they are.
 */

export const SUBMITTER_COOKIE = "oui_sid";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export interface SubmitterRecord {
  id: string;
  token: string;
  trustScore: number;
  verifiedReports: number;
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The current visitor's record, creating one if this is their first contribution.
 *
 * Only call this from a route handler or server action — Next only permits setting
 * a cookie there. Read-only paths should use `peekSubmitter`, which never writes.
 */
export async function getOrCreateSubmitter(): Promise<SubmitterRecord> {
  const jar = await cookies();
  const existingToken = jar.get(SUBMITTER_COOKIE)?.value;

  if (existingToken) {
    const found = await prisma.submitter.findUnique({
      where: { token: existingToken },
    });
    if (found) return found;
  }

  // Either no cookie, or one pointing at a record that no longer exists (a reset
  // database, most likely). Issue a fresh identity either way.
  const token = existingToken ?? newToken();
  const created = await prisma.submitter.upsert({
    where: { token },
    create: { token },
    update: {},
  });

  jar.set(SUBMITTER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });

  return created;
}

/** The visitor's record if they already have one. Never creates, never writes. */
export async function peekSubmitter(): Promise<SubmitterRecord | null> {
  const jar = await cookies();
  const token = jar.get(SUBMITTER_COOKIE)?.value;
  if (!token) return null;
  return prisma.submitter.findUnique({ where: { token } });
}
