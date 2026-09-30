/**
 * Simpel formatering til mails til frivillige. Teksten parses til blokke — aldrig til rå HTML —
 * så både mailskabelonen og forhåndsvisningen kan rendere den sikkert.
 *
 *   Tom linje          → nyt afsnit
 *   Linjer med "- "    → punktliste
 *   **tekst**          → fed
 *   [tekst](https://…) → link
 *   https://…          → link
 */

export const MERGE_FIELDS = [
  { token: "{fornavn}", label: "Fornavn" },
  { token: "{navn}", label: "Fulde navn" },
  { token: "{team}", label: "Team" },
  { token: "{opgaver}", label: "Opgaver" },
] as const;

export type MergeValues = { fornavn: string; navn: string; team: string; opgaver: string };

export function applyMergeFields(text: string, values: MergeValues): string {
  return text.replace(/\{(fornavn|navn|team|opgaver)\}/gi, (_, key: string) => values[key.toLowerCase() as keyof MergeValues]);
}

export type Inline = { type: "text"; text: string; bold?: boolean } | { type: "link"; text: string; href: string; bold?: boolean };
export type Block = { type: "paragraph"; lines: Inline[][] } | { type: "list"; items: Inline[][] };

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
  return null;
}

function parseLinks(text: string, bold: boolean): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", text: text.slice(last, idx), bold });
    const label = m[1] ?? m[3];
    const href = safeHref(m[2] ?? m[3]);
    out.push(href ? { type: "link", text: label, href, bold } : { type: "text", text: m[0], bold });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last), bold });
  return out;
}

export function parseInline(line: string): Inline[] {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.flatMap((part, i) => (part ? parseLinks(part, i % 2 === 1) : []));
}

export function parseMailBody(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trimEnd());
    let paragraph: string[] = [];
    let list: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph.map(parseInline) });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: "list", items: list.map(parseInline) });
      list = [];
    };
    for (const line of lines) {
      const item = line.match(/^\s*[-*•]\s+(.*)$/);
      if (item) {
        flushParagraph();
        list.push(item[1]);
      } else if (line.trim()) {
        flushList();
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

function inlineToText(parts: Inline[]): string {
  return parts.map((p) => (p.type === "link" && p.text !== p.href ? `${p.text} (${p.href})` : p.text)).join("");
}

export function mailBodyToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "paragraph" ? b.lines.map(inlineToText).join("\n") : b.items.map((i) => `• ${inlineToText(i)}`).join("\n")))
    .join("\n\n");
}
