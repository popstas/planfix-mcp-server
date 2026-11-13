function nameTokens(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Planfix filter 4001 matches a *substring* of the full name,
 * case-insensitively, so "US Media" finds "Status Media". A name-only match is
 * accepted only when the record's full name (name, midname, lastname) consists
 * of exactly the same words as the query, in any order.
 */
export function isExactNameMatch(
  query: string,
  record: { name?: string; midname?: string; lastname?: string },
): boolean {
  const expected = nameTokens(query);
  if (!expected) return false;
  const actual = nameTokens(
    [record.name, record.midname, record.lastname].filter(Boolean).join(" "),
  );
  return actual === expected;
}
