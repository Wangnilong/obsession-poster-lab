import type { Metadata } from "next";
import ArchiveFilmPage from "../../archive-film-page";

export const metadata: Metadata = {
  title: "Obsession · ISSUE 01｜宇宙放映",
  description: "Obsession 放映档案：文章、映后图片、工具与周边。",
};

export default function Page() {
  return <ArchiveFilmPage slug="obsession" />;
}
