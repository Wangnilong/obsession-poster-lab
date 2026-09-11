import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import ArchivePage from "../app/archive-page";
import ArchiveAdminPage from "../app/archive-admin-page";
import ArchiveFilmPage from "../app/archive-film-page";
import ArchiveEventPage from "../app/archive-event-page";
import ArchiveUploadPage from "../app/archive-upload-page";
import IssuePage from "../app/issue-page";
import KillBillGenerator from "../app/kill-bill-generator";
import SiteHome from "../app/site-home";
import "../app/globals.css";

const ObsessionPoster = lazy(() => import("../app/obsession-poster"));
const currentPath = window.location.pathname.replace(/\/+$/, "");
const isObsession = /(?:^|\/)obsession$/.test(currentPath);
const isObsessionIssue = /(?:^|\/)issues\/obsession$/.test(currentPath);
const isKillBill = /(?:^|\/)kill-bill$/.test(currentPath);
const isArchive = /(?:^|\/)archive$/.test(currentPath);
const isArchiveAdmin = /(?:^|\/)archive\/admin$/.test(currentPath);
const archiveFilmMatch = currentPath.match(/(?:^|\/)archive\/(obsession|kill-bill)$/);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isArchiveAdmin ? (
      <ArchiveAdminPage />
    ) : /(?:^|\/)archive\/upload$/.test(currentPath) ? (
      <ArchiveUploadPage />
    ) : /(?:^|\/)archive\/event$/.test(currentPath) ? (
      <ArchiveEventPage />
    ) : archiveFilmMatch ? (
      <ArchiveFilmPage slug={archiveFilmMatch[1]} />
    ) : isArchive ? (
      <ArchivePage />
    ) : isKillBill ? (
      <KillBillGenerator />
    ) : isObsessionIssue ? (
      <IssuePage />
    ) : isObsession ? (
      <Suspense fallback={<p className="route-loading">正在打开暗房…</p>}>
        <ObsessionPoster />
      </Suspense>
    ) : (
      <SiteHome />
    )}
  </StrictMode>,
);
