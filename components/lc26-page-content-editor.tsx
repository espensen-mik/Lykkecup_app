"use client";

import { useMemo, useState } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";
import type {
  Lc26FindRundtContent,
  Lc26NytContent,
  Lc26PageContentRow,
  Lc26PageKey,
  Lc26PraktiskInfoContent,
  Lc26ProgramContent,
} from "@/lib/lc26-page-content";

type Props = {
  pageKey: Lc26PageKey;
  initialRow: Lc26PageContentRow;
};

export function Lc26PageContentEditor({ pageKey, initialRow }: Props) {
  const [title, setTitle] = useState(initialRow.title);
  const [intro, setIntro] = useState(initialRow.intro);
  const [heroImageUrl, setHeroImageUrl] = useState(initialRow.heroImageUrl ?? "");
  const [contentText, setContentText] = useState(() => JSON.stringify(initialRow.content ?? {}, null, 2));
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [programContent, setProgramContent] = useState<Lc26ProgramContent>(() => {
    const c = initialRow.content as Lc26ProgramContent | null;
    return {
      caption: c?.caption ?? "",
      schedule: Array.isArray(c?.schedule) ? c.schedule : [],
    };
  });
  const [findContent, setFindContent] = useState<Lc26FindRundtContent>(() => {
    const c = initialRow.content as Lc26FindRundtContent | null;
    return { cards: Array.isArray(c?.cards) ? c.cards : [] };
  });
  const [praktiskContent, setPraktiskContent] = useState<Lc26PraktiskInfoContent>(() => {
    const c = initialRow.content as Lc26PraktiskInfoContent | null;
    return {
      sections: Array.isArray(c?.sections) ? c.sections : [],
      faq: Array.isArray(c?.faq) ? c.faq : [],
    };
  });
  const [nytContent, setNytContent] = useState<Lc26NytContent>(() => {
    const c = initialRow.content as Lc26NytContent | null;
    return { articles: Array.isArray(c?.articles) ? c.articles : [] };
  });

  const updatedLabel = useMemo(() => {
    if (!initialRow.updatedAt) return "Ikke opdateret endnu";
    const d = new Date(initialRow.updatedAt);
    if (Number.isNaN(d.getTime())) return initialRow.updatedAt;
    return d.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
  }, [initialRow.updatedAt]);

  function moveItem<T>(list: T[], from: number, to: number): T[] {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  async function save() {
    setError(null);
    setNotice(null);
    let parsed: unknown;
    if (showAdvancedJson) {
      try {
        parsed = JSON.parse(contentText);
      } catch {
        setError("Indhold JSON er ugyldig. Ret formatet før du gemmer.");
        return;
      }
    } else {
      if (pageKey === "program") parsed = programContent;
      else if (pageKey === "find-rundt") parsed = findContent;
      else if (pageKey === "praktisk-info") parsed = praktiskContent;
      else parsed = nytContent;
    }

    setBusy(true);
    const supabase = getAuthBrowserClient();
    const { error: saveError } = await supabase.from("lc26_page_content").upsert(
      {
        event_id: LYKKECUP26_EVENT_ID,
        page_key: pageKey,
        title: title.trim(),
        intro: intro.trim(),
        hero_image_url: heroImageUrl.trim() || null,
        content: parsed,
      },
      { onConflict: "event_id,page_key" },
    );
    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setNotice("Indhold gemt.");
  }

  return (
    <div className="space-y-5 rounded-xl border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Senest gemt: {updatedLabel}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Titel</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Introtekst</span>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Hero billed-URL (valgfri)
        </span>
        <input
          value={heroImageUrl}
          onChange={(e) => setHeroImageUrl(e.target.value)}
          placeholder="/mumle.jpg"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>

      {pageKey === "program" ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Program indhold</p>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Billedtekst</span>
            <textarea
              value={programContent.caption}
              onChange={(e) => setProgramContent((c) => ({ ...c, caption: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          {programContent.schedule.map((item, idx) => (
            <div key={`${item.time}-${idx}`} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={item.time}
                  onChange={(e) =>
                    setProgramContent((c) => {
                      const next = [...c.schedule];
                      next[idx] = { ...next[idx], time: e.target.value };
                      return { ...c, schedule: next };
                    })
                  }
                  placeholder="Tid (fx 09.00)"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <input
                  value={item.title}
                  onChange={(e) =>
                    setProgramContent((c) => {
                      const next = [...c.schedule];
                      next[idx] = { ...next[idx], title: e.target.value };
                      return { ...c, schedule: next };
                    })
                  }
                  placeholder="Titel"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <textarea
                value={item.note ?? ""}
                onChange={(e) =>
                  setProgramContent((c) => {
                    const next = [...c.schedule];
                    next[idx] = { ...next[idx], note: e.target.value };
                    return { ...c, schedule: next };
                  })
                }
                placeholder="Note"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(item.highlight)}
                    onChange={(e) =>
                      setProgramContent((c) => {
                        const next = [...c.schedule];
                        next[idx] = { ...next[idx], highlight: e.target.checked };
                        return { ...c, schedule: next };
                      })
                    }
                  />
                  Fremhæv
                </label>
                <button
                  type="button"
                  onClick={() => setProgramContent((c) => ({ ...c, schedule: c.schedule.filter((_, i) => i !== idx) }))}
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  Fjern
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setProgramContent((c) => ({
                      ...c,
                      schedule: moveItem(c.schedule, idx, idx - 1),
                    }))
                  }
                  disabled={idx === 0}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Op
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProgramContent((c) => ({
                      ...c,
                      schedule: moveItem(c.schedule, idx, idx + 1),
                    }))
                  }
                  disabled={idx === programContent.schedule.length - 1}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Ned
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setProgramContent((c) => ({
                ...c,
                schedule: [...c.schedule, { time: "", title: "", note: "", highlight: false }],
              }))
            }
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
          >
            Tilføj programpunkt
          </button>
        </div>
      ) : null}

      {pageKey === "find-rundt" ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kort-sektioner</p>
          {findContent.cards.map((card, idx) => (
            <div key={`${card.title}-${idx}`} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <input
                value={card.title}
                onChange={(e) =>
                  setFindContent((c) => {
                    const next = [...c.cards];
                    next[idx] = { ...next[idx], title: e.target.value };
                    return { ...c, cards: next };
                  })
                }
                placeholder="Titel"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <textarea
                value={card.body}
                onChange={(e) =>
                  setFindContent((c) => {
                    const next = [...c.cards];
                    next[idx] = { ...next[idx], body: e.target.value };
                    return { ...c, cards: next };
                  })
                }
                rows={3}
                placeholder="Tekst"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setFindContent((c) => ({ ...c, cards: c.cards.filter((_, i) => i !== idx) }))}
                className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                Fjern kort
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFindContent((c) => ({
                      ...c,
                      cards: moveItem(c.cards, idx, idx - 1),
                    }))
                  }
                  disabled={idx === 0}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Op
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFindContent((c) => ({
                      ...c,
                      cards: moveItem(c.cards, idx, idx + 1),
                    }))
                  }
                  disabled={idx === findContent.cards.length - 1}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Ned
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFindContent((c) => ({ ...c, cards: [...c.cards, { title: "", body: "" }] }))}
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
          >
            Tilføj kort
          </button>
        </div>
      ) : null}

      {pageKey === "praktisk-info" ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Praktiske sektioner</p>
          {praktiskContent.sections.map((section, idx) => (
            <div key={`${section.title}-${idx}`} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <input
                value={section.title}
                onChange={(e) =>
                  setPraktiskContent((c) => {
                    const next = [...c.sections];
                    next[idx] = { ...next[idx], title: e.target.value };
                    return { ...c, sections: next };
                  })
                }
                placeholder="Overskrift"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <textarea
                value={section.body}
                onChange={(e) =>
                  setPraktiskContent((c) => {
                    const next = [...c.sections];
                    next[idx] = { ...next[idx], body: e.target.value };
                    return { ...c, sections: next };
                  })
                }
                rows={3}
                placeholder="Brødtekst"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPraktiskContent((c) => ({
                      ...c,
                      sections: moveItem(c.sections, idx, idx - 1),
                    }))
                  }
                  disabled={idx === 0}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Op
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPraktiskContent((c) => ({
                      ...c,
                      sections: moveItem(c.sections, idx, idx + 1),
                    }))
                  }
                  disabled={idx === praktiskContent.sections.length - 1}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Ned
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setPraktiskContent((c) => ({ ...c, sections: [...c.sections, { title: "", body: "" }] }))
            }
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
          >
            Tilføj sektion
          </button>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">FAQ</p>
          {praktiskContent.faq.map((item, idx) => (
            <div key={`${item.q}-${idx}`} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <input
                value={item.q}
                onChange={(e) =>
                  setPraktiskContent((c) => {
                    const next = [...c.faq];
                    next[idx] = { ...next[idx], q: e.target.value };
                    return { ...c, faq: next };
                  })
                }
                placeholder="Spørgsmål"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <textarea
                value={item.a}
                onChange={(e) =>
                  setPraktiskContent((c) => {
                    const next = [...c.faq];
                    next[idx] = { ...next[idx], a: e.target.value };
                    return { ...c, faq: next };
                  })
                }
                rows={3}
                placeholder="Svar"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPraktiskContent((c) => ({
                      ...c,
                      faq: moveItem(c.faq, idx, idx - 1),
                    }))
                  }
                  disabled={idx === 0}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Op
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPraktiskContent((c) => ({
                      ...c,
                      faq: moveItem(c.faq, idx, idx + 1),
                    }))
                  }
                  disabled={idx === praktiskContent.faq.length - 1}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Ned
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPraktiskContent((c) => ({ ...c, faq: [...c.faq, { q: "", a: "" }] }))}
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
          >
            Tilføj FAQ
          </button>
        </div>
      ) : null}

      {pageKey === "nyt-fra-lykkeliga" ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Artikler</p>
          {nytContent.articles.map((article, idx) => (
            <div key={`${article.title}-${idx}`} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={article.tag}
                  onChange={(e) =>
                    setNytContent((c) => {
                      const next = [...c.articles];
                      next[idx] = { ...next[idx], tag: e.target.value };
                      return { ...c, articles: next };
                    })
                  }
                  placeholder="Tag"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <input
                  value={article.date}
                  onChange={(e) =>
                    setNytContent((c) => {
                      const next = [...c.articles];
                      next[idx] = { ...next[idx], date: e.target.value };
                      return { ...c, articles: next };
                    })
                  }
                  placeholder="Dato (fx 12. april 2026)"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <input
                value={article.title}
                onChange={(e) =>
                  setNytContent((c) => {
                    const next = [...c.articles];
                    next[idx] = { ...next[idx], title: e.target.value };
                    return { ...c, articles: next };
                  })
                }
                placeholder="Titel"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <textarea
                value={(article.paragraphs ?? []).join("\n\n")}
                onChange={(e) =>
                  setNytContent((c) => {
                    const next = [...c.articles];
                    next[idx] = {
                      ...next[idx],
                      paragraphs: e.target.value
                        .split(/\n{2,}/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    };
                    return { ...c, articles: next };
                  })
                }
                rows={6}
                placeholder="Afsnit (adskil med tom linje)"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setNytContent((c) => ({ ...c, articles: c.articles.filter((_, i) => i !== idx) }))}
                className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                Fjern artikel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setNytContent((c) => ({
                      ...c,
                      articles: moveItem(c.articles, idx, idx - 1),
                    }))
                  }
                  disabled={idx === 0}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Op
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNytContent((c) => ({
                      ...c,
                      articles: moveItem(c.articles, idx, idx + 1),
                    }))
                  }
                  disabled={idx === nytContent.articles.length - 1}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Ned
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setNytContent((c) => ({
                ...c,
                articles: [
                  ...c.articles,
                  { tag: "", tagClass: "bg-lc26-teal text-white shadow-sm", date: "", dateIso: "", title: "", paragraphs: [] },
                ],
              }))
            }
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
          >
            Tilføj artikel
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-3 dark:border-gray-700 dark:bg-gray-900/20">
        <button
          type="button"
          onClick={() => setShowAdvancedJson((v) => !v)}
          className="text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          {showAdvancedJson ? "Skjul avanceret JSON" : "Vis avanceret JSON"}
        </button>
        {showAdvancedJson ? (
          <label className="mt-2 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Side-indhold (JSON)
            </span>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={18}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-lg bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e] disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {busy ? "Gemmer..." : "Gem indhold"}
        </button>
      </div>
    </div>
  );
}
