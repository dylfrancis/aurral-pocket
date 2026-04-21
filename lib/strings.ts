export function stripArticle(name: string): string {
  return name.replace(/^the\s+/i, "");
}
