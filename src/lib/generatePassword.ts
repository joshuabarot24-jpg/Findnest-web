// Generates a random 12-character password that meets the system standard:
// at least one uppercase, one lowercase, one number and one special character.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l or o
const DIGITS = "23456789"; // no 0 or 1
const SPECIAL = "!@#$%&*?";

// Random integer 0..max-1 from the browser's secure random generator
function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return n % max;
}

function pick(chars: string): string {
  return chars[randomIndex(chars.length)];
}

export function generatePassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle so the guaranteed characters aren't always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}