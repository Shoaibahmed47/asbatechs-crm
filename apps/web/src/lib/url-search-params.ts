/** Compare query strings ignoring parameter order. */
export function areSearchQueriesEqual(a: string, b: string): boolean {
  const normalize = (raw: string) => {
    const params = new URLSearchParams(raw);
    return [...params.entries()]
      .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
  };
  return normalize(a) === normalize(b);
}
