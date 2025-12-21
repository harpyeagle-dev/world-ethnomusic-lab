// Utility: Culture deduplication
// Prefers entries from expanded dataset when ids collide; removes duplicates by canonicalized name.

export function canonicalName(str) {
  return (str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/gi, '')       // remove punctuation & spaces
    .toLowerCase();
}

export function dedupeCultures(basicCultures = [], expandedCultures = []) {
  const byId = new Map();
  expandedCultures.forEach(c => byId.set(c.id, c));
  basicCultures.forEach(c => {
    if (!byId.has(c.id)) byId.set(c.id, c);
  });

  const seenNames = new Set();
  const unique = [];
  for (const c of byId.values()) {
    const key = canonicalName(c.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    unique.push(c);
  }
  return unique;
}
