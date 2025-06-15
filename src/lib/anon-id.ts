export function getAnonId() {
  if (typeof window === "undefined") {
    // Server side render – we can fallback to a placeholder. It will be replaced on client.
    return "anon-ssr";
  }
  const KEY = "cc_anon_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    try {
      id = `anon-${crypto.randomUUID()}`;
    } catch {
      // Safari < 14 or older browsers
      id = `anon-${Math.random().toString(36).slice(2, 11)}`;
    }
    localStorage.setItem(KEY, id);
  }
  return id;
} 