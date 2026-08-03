import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import IssuePage from "../app/issue-page";
import KillBillGenerator from "../app/kill-bill-generator";
import SiteHome from "../app/site-home";
import "../app/globals.css";

const ObsessionPoster = lazy(() => import("../app/obsession-poster"));
const currentPath = window.location.pathname.replace(/\/+$/, "");
const isObsession = /(?:^|\/)obsession$/.test(currentPath);
const isObsessionIssue = /(?:^|\/)issues\/obsession$/.test(currentPath);
const isKillBill = /(?:^|\/)kill-bill$/.test(currentPath);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isKillBill ? (
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
