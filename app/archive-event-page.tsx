"use client";
import { useSyncExternalStore } from "react";
import ArchiveFilmPage from "./archive-film-page";
const subscribe = (listener: () => void) => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); };
const getSlug = () => new URLSearchParams(window.location.search).get("event") || "";
export default function ArchiveEventPage() {
  const slug = useSyncExternalStore(subscribe, getSlug, () => "");
  return slug ? <ArchiveFilmPage key={slug} slug={slug} /> : <main className="archive-page"><p>请选择一个活动。</p><a href="/archive/">返回活动日历</a></main>;
}
