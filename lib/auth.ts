// Einfacher Passwortschutz: Wer das Passwort kennt, bekommt ein Cookie.
export const COOKIE = "fb_session";

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode("fragebogen-app:" + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
