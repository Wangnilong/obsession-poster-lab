import type { Metadata } from "next";
import ArchiveFilmPage from "../../archive-film-page";

export const metadata: Metadata = {
  title: "Kill Bill · ISSUE 02｜宇宙放映",
  description: "Kill Bill 放映档案：文章、映后图片、工具与周边。",
};

export default function Page() {
  return <ArchiveFilmPage slug="kill-bill" />;
}
