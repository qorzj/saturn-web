export function generateRandomNoteSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
