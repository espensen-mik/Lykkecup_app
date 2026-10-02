/**
 * Simpel formatering til mails til frivillige. Teksten parses til blokke — aldrig til rå HTML —
 * så både mailskabelonen og forhåndsvisningen kan rendere den sikkert.
 *
 *   Tom linje          → nyt afsnit
 *   Linjer med "- "    → punktliste
 *   **tekst**          → fed
 *   *tekst*            → kursiv
 *   ***tekst***        → fed og kursiv
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

export type Inline =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean }
  | { type: "link"; text: string; href: string; bold?: boolean; italic?: boolean };
export type Block = { type: "paragraph"; lines: Inline[][] } | { type: "list"; items: Inline[][] };

type Marks = { bold?: boolean; italic?: boolean };

function marksOf(stars: number): { bold: boolean; italic: boolean } {
  if (stars >= 3) return { bold: true, italic: true };
  if (stars === 2) return { bold: true, italic: false };
  return { bold: false, italic: true };
}

/** Hvor mange stjerner en lukke-run må bruge på den åbne run. */
function closingSize(opener: number, closer: number): number {
  if (opener === closer && opener >= 1 && opener <= 3) return opener;
  if (closer >= 3 && opener >= 1 && opener < 3) return opener;
  return 0;
}

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
  return null;
}

type Node =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "em"; bold: boolean; italic: boolean; children: Node[] };

type Token = { type: "text"; text: string } | { type: "link"; text: string; href: string } | { type: "stars"; n: number };

const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)/;
const URL_RE = /^(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const link = LINK_RE.exec(line.slice(i));
    if (link) {
      const href = safeHref(link[2]);
      tokens.push(href ? { type: "link", text: link[1], href } : { type: "text", text: link[0] });
      i += link[0].length;
      continue;
    }
    const url = URL_RE.exec(line.slice(i));
    if (url) {
      const href = safeHref(url[1]);
      tokens.push(href ? { type: "link", text: url[1], href } : { type: "text", text: url[0] });
      i += url[0].length;
      continue;
    }
    if (line[i] === "*") {
      let n = 0;
      while (line[i + n] === "*") n += 1;
      tokens.push({ type: "stars", n });
      i += n;
      continue;
    }
    let j = i + 1;
    while (j < line.length && line[j] !== "*" && line[j] !== "[") {
      if (line.startsWith("http://", j) || line.startsWith("https://", j)) break;
      j += 1;
    }
    tokens.push({ type: "text", text: line.slice(i, j) });
    i = j;
  }
  return tokens;
}

function parseNodes(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack: { stars: number; children: Node[] }[] = [{ stars: 0, children: root }];
  const current = () => stack[stack.length - 1].children;

  for (const token of tokens) {
    if (token.type !== "stars") {
      current().push(token);
      continue;
    }
    let n = token.n;
    while (n > 0 && stack.length > 1) {
      const use = closingSize(stack[stack.length - 1].stars, n);
      if (!use) break;
      n -= use;
      const frame = stack.pop()!;
      const marks = marksOf(frame.stars);
      current().push({ type: "em", bold: marks.bold, italic: marks.italic, children: frame.children });
    }
    if (n >= 1 && n <= 3) stack.push({ stars: n, children: [] });
    else if (n > 0) current().push({ type: "text", text: "*".repeat(n) });
  }

  while (stack.length > 1) {
    const frame = stack.pop()!;
    current().push({ type: "text", text: "*".repeat(frame.stars) }, ...frame.children);
  }
  return root;
}

function nodesToInline(nodes: Node[], marks: Marks): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.type === "em") {
      out.push(...nodesToInline(node.children, { bold: marks.bold || node.bold || undefined, italic: marks.italic || node.italic || undefined }));
    } else if (node.type === "link") {
      out.push({ type: "link", text: node.text, href: node.href, bold: marks.bold, italic: marks.italic });
    } else if (node.text) {
      out.push({ type: "text", text: node.text, bold: marks.bold, italic: marks.italic });
    }
  }
  return out;
}

export function parseInline(line: string): Inline[] {
  return nodesToInline(parseNodes(tokenize(line)), {});
}

function starsBefore(text: string, index: number): number {
  let n = 0;
  while (index - n - 1 >= 0 && text[index - n - 1] === "*") n += 1;
  return n;
}

function starsAfter(text: string, index: number): number {
  let n = 0;
  while (index + n < text.length && text[index + n] === "*") n += 1;
  return n;
}

function leadingStars(text: string): number {
  return starsAfter(text, 0);
}

function trailingStars(text: string): number {
  let n = 0;
  while (n < text.length && text[text.length - 1 - n] === "*") n += 1;
  return n;
}

/** Sætter eller fjerner fed (`**`) eller kursiv (`*`) rundt om markeringen. */
export function applyInlineMarker(
  body: string,
  start: number,
  end: number,
  kind: "bold" | "italic",
): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = body.slice(start, end);
  const selLeft = leadingStars(selected);
  const selRight = trailingStars(selected);
  const outsideLeft = starsBefore(body, start);
  const outsideRight = starsAfter(body, end);

  let from = start;
  let to = end;
  let leftStars = 0;
  let rightStars = 0;
  if (selected.length > 0 && selLeft > 0 && selRight > 0 && selLeft + selRight < selected.length) {
    leftStars = selLeft;
    rightStars = selRight;
  } else if (outsideLeft > 0 && outsideRight > 0) {
    leftStars = outsideLeft;
    rightStars = outsideRight;
    from = start - outsideLeft;
    to = end + outsideRight;
  }

  const content = body.slice(from + leftStars, to - rightStars);
  const isOn = kind === "bold" ? leftStars >= 2 && rightStars >= 2 : leftStars % 2 === 1 && rightStars % 2 === 1;
  const delta = kind === "bold" ? 2 : 1;
  const nextLeft = Math.max(0, leftStars + (isOn ? -delta : delta));
  const nextRight = Math.max(0, rightStars + (isOn ? -delta : delta));
  const replacement = `${"*".repeat(nextLeft)}${content}${"*".repeat(nextRight)}`;
  return {
    text: body.slice(0, from) + replacement + body.slice(to),
    selectionStart: from + nextLeft,
    selectionEnd: from + nextLeft + content.length,
  };
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
