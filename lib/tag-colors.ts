const TAG_COLORS = [
  '#845336',
  '#57553c',
  '#a17e3e',
  '#43454f',
  '#604848',
  '#5c6652',
  '#a18b62',
  '#8c4f4a',
  '#898471',
  '#c8b491',
  '#65788f',
  '#755e4a',
  '#718062',
  '#bc9d66',
];

export function getTagColor(name: string): string {
  if (!name) return '#211f27';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
