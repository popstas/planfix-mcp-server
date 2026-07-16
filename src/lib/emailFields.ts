/**
 * Pure helpers and the shared schema for working with email values shared
 * between the primary system email field and a contact's additional/secondary
 * email addresses (Planfix exposes these as the read-only system field
 * `additionalEmailAddresses`, searchable via filter 4221; writes go to a
 * configured numeric custom field).
 *
 * All functions are side-effect free so they can be unit-tested without the API.
 */
import { z } from "zod";

/**
 * The `additionalEmails` argument, shared by every tool that accepts it so the
 * cap and null handling cannot drift apart. `null` is coerced to `undefined`:
 * MCP clients send it for an absent optional argument.
 */
export const additionalEmailsSchema = z.preprocess(
  (val) => (val === null ? undefined : val),
  z.array(z.string()).max(10).optional(),
);

/** Trim surrounding whitespace and lowercase an email for comparison/storage. */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Build the ordered list of unique, non-empty, normalized emails to match a
 * contact against. The primary `email` comes first, followed by any
 * `additionalEmails`, with duplicates removed (first occurrence wins).
 */
export function buildEmailMatchList(
  email?: string,
  additionalEmails?: string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const candidates = [email, ...(additionalEmails ?? [])];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeEmail(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Compute the additional emails to store: normalized, unique, with empties
 * dropped, excluding any value equal to the primary `email` and any value
 * already present in `existing` (the contact's current additional addresses).
 */
export function dedupeAdditionalEmails(
  primary?: string,
  additional?: string[],
  existing?: string[],
): string[] {
  const excluded = new Set<string>();
  if (primary) {
    const normalizedPrimary = normalizeEmail(primary);
    if (normalizedPrimary) excluded.add(normalizedPrimary);
  }
  for (const value of existing ?? []) {
    if (!value) continue;
    const normalized = normalizeEmail(value);
    if (normalized) excluded.add(normalized);
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of additional ?? []) {
    if (!value) continue;
    const normalized = normalizeEmail(value);
    if (!normalized || seen.has(normalized) || excluded.has(normalized))
      continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
