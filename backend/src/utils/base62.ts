// backend/src/utils/base62.ts
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = ALPHABET.length; // 62

export function encode(num: number): string {
  if (num === 0) return ALPHABET[0];
  let result = "";
  while (num > 0) {
    result = ALPHABET[num % BASE] + result;
    num = Math.floor(num / BASE);
  }
  return result;
}

export function decode(str: string): number {
  let result = 0;
  for (const char of str) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid character: ${char}`);
    result = result * BASE + idx;
  }
  return result;
}

// Generate a unique short code using timestamp + random component
export function generateShortCode(length = 7): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 999999);
  const combined = timestamp * 1000000 + random;
  const code = encode(combined);
  return code.slice(-length).padStart(length, ALPHABET[0]);
}

export function isValidShortCode(code: string): boolean {
  return /^[a-zA-Z0-9]{4,20}$/.test(code);
}
