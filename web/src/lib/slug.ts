export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

/** Level-2 headings of a Markdown document, for a table of contents. */
export function markdownHeadings(md: string): { id: string; label: string }[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => {
      const label = l.slice(3).replace(/`/g, "").trim()
      return { id: slugify(label), label }
    })
}
