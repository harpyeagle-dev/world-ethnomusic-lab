import { dedupeCultures, canonicalName } from '../src/utils/dedup.js';

describe('canonicalName', () => {
  test('strips diacritics and punctuation, lowercases', () => {
    expect(canonicalName('Andalusia, Spain!')).toBe('andalusiaspain');
    expect(canonicalName('Beyoncé')).toBe('beyonce');
    expect(canonicalName('São Paulo')).toBe('saopaulo');
  });
});

describe('dedupeCultures', () => {
  const basic = [
    { id: 'latin-american', name: 'Latin American', region: 'Latin America' },
    { id: 'west-african', name: 'West African', region: 'West Africa' },
    { id: 'middle-eastern', name: 'Middle Eastern', region: 'Middle East' },
    { id: 'duplicate-name-id-a', name: 'Andalusía', region: 'Spain' },
  ];
  const expanded = [
    // Same id as basic: expanded should win
    { id: 'latin-american', name: 'Latin American', region: 'Latin America', extra: 'expanded' },
    // New ids
    { id: 'flamenco', name: 'Flamenco', region: 'Spain' },
    // Different id but same name (diacritics differ): keep only one
    { id: 'duplicate-name-id-b', name: 'Andalusia', region: 'Spain' },
  ];

  test('prefers expanded entries on id collision', () => {
    const result = dedupeCultures(basic, expanded);
    const la = result.find(c => c.id === 'latin-american');
    expect(la).toBeDefined();
    expect(la.extra).toBe('expanded');
  });

  test('includes basics not present in expanded', () => {
    const result = dedupeCultures(basic, expanded);
    expect(result.some(c => c.id === 'west-african')).toBe(true);
    expect(result.some(c => c.id === 'middle-eastern')).toBe(true);
  });

  test('dedupes by canonicalized name across different ids', () => {
    const result = dedupeCultures(basic, expanded);
    const matches = result.filter(c => canonicalName(c.name) === 'andalusia');
    expect(matches.length).toBe(1);
    // Prefer whichever appears first via id precedence (expanded wins here)
    expect(matches[0].id).toBe('duplicate-name-id-b');
  });

  test('overall count is correct', () => {
    const result = dedupeCultures(basic, expanded);
    // basic: 4, expanded: 3, but latin-american collides (1), and Andalusia duplicate-by-name removes one -> total 5
    expect(result.length).toBe(5);
  });
});
