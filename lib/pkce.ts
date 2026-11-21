import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
} from "expo-crypto";

const BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export type PkcePair = { verifier: string; challenge: string };

/**
 * An RFC 7636 S256 pair. The verifier is 43 characters, the shortest the RFC
 * allows, and each byte picks one of 64 characters, so it keeps all 258 bits
 * with no modulo bias.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = Array.from(
    getRandomBytes(43),
    (byte) => BASE64URL[byte & 63],
  ).join("");
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: CryptoEncoding.BASE64 },
  );
  const challenge = digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
}
