"use client";
import { useEffect, useState } from "react";
import { findArchiveFilm, type ArchiveFilm, type ArchiveEntry, type ArchiveSection } from "./archive-data";
import { loadArchiveDocument, loadArchiveEvents } from "./cloudbase-archive";
import { eventHref } from "./archive-events";
import { defaultSectionOrder, emptyPresentation, type ArchivePresentation } from "./archive-presentation";
import ArchiveFilmView from "./archive-film-view";

function sectionFromLocation(): ArchiveSection {
  if (typeof window === "undefined") return "articles";
  const candidate = new URLSearchParams(window.location.search).get("section");
  return defaultSectionOrder.includes(candidate as ArchiveSection) ? candidate as ArchiveSection : "articles";
}

export default function ArchiveFilmPage({ slug }: { slug: string }) {
  const [film, setFilm] = useState<ArchiveFilm | null | undefined>(() => findArchiveFilm(slug));
  const [section, setSection] = useState<ArchiveSection>("articles");
  const [published, setPublished] = useState<{ key: string; entries: ArchiveEntry[] }>({ key: "", entries: [] });
  const [presentation, setPresentation] = useState<ArchivePresentation>(emptyPresentation);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadArchiveEvents().then(events => { if (active) setFilm(events.find(item => item.slug === slug) || null); }).catch(() => { if (active) setError("活动加载失败，请刷新重试。"); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    const update = () => setSection(sectionFromLocation());
    update(); window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    let active = true;
    loadArchiveDocument(slug, section).then(result => {
      if (!active) return;
      setPublished({ key: `${slug}:${section}`, entries: result.entries });
      setPresentation(result.presentation); setError("");
      if (!new URLSearchParams(window.location.search).has("section")) setSection(result.presentation.sectionOrder[0]);
    }).catch(() => { if (active) setError("内容加载失败，请刷新重试。"); });
    return () => { active = false; };
  }, [slug, section]);
  if (!film) return <main className="archive-page archive-missing"><p>{error || (film === null ? "这个活动尚未发布。" : "正在加载活动…")}</p><a href="/archive/">返回往期活动</a></main>;
  const selectSection = (next: ArchiveSection) => {
    window.history.pushState({}, "", eventHref(slug, next));
    setSection(next); setError("");
  };
  return <ArchiveFilmView film={film} section={section} entries={published.key === `${slug}:${section}` ? published.entries : []} presentation={presentation} onSectionChange={selectSection} message={error} />;
}
