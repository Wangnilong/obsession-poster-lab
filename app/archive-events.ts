import { archiveFilms, type ArchiveFilm } from "./archive-data";
export type EventRecord = { slug: string; title: string; zhTitle: string; issue: string; date: string; location: string; summary: string; status: "draft" | "published" };
export type EventCatalog = { revision: number; events: EventRecord[] };
export function eventFilm(event: EventRecord): ArchiveFilm {
  const base = archiveFilms.find(film => film.slug === event.slug);
  return { poster: "/cosmos42/logo.png", posterAlt: event.zhTitle,
    accent: "#d9bf13", background: "#11100c", foreground: "#f5f0e5", sections: { articles: [], photos: [], tools: [], merch: [] }, ...base, ...event, year: event.date.slice(0, 4) || base?.year || "" };
}
export function eventHref(slug: string, section?: string) {
  const base = ["obsession", "kill-bill"].includes(slug) ? `/archive/${slug}/` : `/archive/event/?event=${encodeURIComponent(slug)}`;
  return section ? `${base}${base.includes("?") ? "&" : "?"}section=${section}` : base;
}
export function monthDays(month: string): (string | null)[] {
  const [year, number] = month.split("-").map(Number);
  const offset = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, number, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
}
