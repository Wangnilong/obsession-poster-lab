import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import IssuePage from "../app/issue-page";
import SiteHome from "../app/site-home";
import "../app/globals.css";

const ObsessionPoster = lazy(() => import("../app/obsession-poster"));
const currentPath = window.location.pathname.replace(/\/+$/, "");
const isObsession = /(?:^|\/)obsession$/.test(currentPath);
const isObsessionIssue = /(?:^|\/)issues\/obsession$/.test(currentPath);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isObsessionIssue ? (
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
