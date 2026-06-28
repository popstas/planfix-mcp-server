/**
 * Pure helpers for working with email values shared between the primary system
 * email field and the multi-value "additional emails" field (Planfix id 124).
 *
 * All functions are side-effect free so they can be unit-tested without the API.
 */

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
 * Compute the additional emails to store in field 124: normalized, unique, with
 * empties dropped, excluding any value equal to the primary `email` and any
 * value already present in `existing` (the current field-124 values).
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
