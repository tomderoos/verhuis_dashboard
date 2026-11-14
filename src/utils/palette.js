// Gedempte kleuren voor stipjes bij personen en categorieën. Kleur betekent hier
// alleen "dit is een andere groep", dus ze blijven rustig naast het baksteen-accent.
export const DOT_COLORS = ['#a8432b', '#4f6d8a', '#5f7f52', '#b0802a', '#7a5a8c', '#3f7f7a', '#8a6a4f'];

export function colorFor(name) {
  if (!name) return 'var(--text-subtle)';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOT_COLORS[h % DOT_COLORS.length];
}
