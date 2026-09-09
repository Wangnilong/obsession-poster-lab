export type ArchiveSection = "articles" | "photos" | "tools" | "merch";

export type ArchiveLayoutBlock =
  | {
      type: "heading" | "paragraph" | "quote";
      text: string;
      align?: "left" | "center" | "right";
    }
  | {
      type: "image";
      image?: string;
      fileID?: string;
      imageKey?: string;
      alt?: string;
      caption?: string;
      size?: "full" | "wide" | "half";
    }
  | {
      type: "link";
      text: string;
      href: string;
    };

export type ArchiveEntry = {
  id?: string;
  imageKey?: string;
  articleHtml?: string;
  title: string;
  meta: string;
  copy?: string;
  href?: string;
  image?: string;
  imageAlt?: string;
  action?: string;
  layout?: ArchiveLayoutBlock[];
};

export type ArchiveFilm = {
  slug: string;
  issue: string;
  title: string;
  zhTitle: string;
  year: string;
  poster: string;
  posterAlt: string;
  accent: string;
  background: string;
  foreground: string;
  date?: string;
  location?: string;
  summary?: string;
  status?: "draft" | "published";
  sections: Record<ArchiveSection, ArchiveEntry[]>;
};

export const archiveSectionLabels: Record<ArchiveSection, { index: string; zh: string; en: string }> = {
  articles: { index: "01", zh: "文章", en: "READING" },
  photos: { index: "02", zh: "映后图片", en: "AFTER THE SCREENING" },
  tools: { index: "03", zh: "工具", en: "TOOLS" },
  merch: { index: "04", zh: "物料与周边", en: "OBJECTS" },
};

export const archiveFilms: ArchiveFilm[] = [
  {
    slug: "obsession",
    issue: "01",
    title: "OBSESSION",
    zhTitle: "迷恋",
    year: "2026",
    poster: "/original-poster.png",
    posterAlt: "Obsession 活动电影海报",
    accent: "#e33b2f",
    background: "#0a0909",
    foreground: "#f0ebe1",
    sections: {
      articles: [],
      photos: [],
      tools: [
        {
          title: "Obsession 海报暗房",
          meta: "CAMERA · A3 / A4 PRINT",
          copy: "拍摄、构图、套用电影色调，并导出可以打印的电影海报。",
          href: "/obsession/",
          action: "打开工具",
        },
      ],
      merch: [],
    },
  },
  {
    slug: "kill-bill",
    issue: "02",
    title: "KILL BILL",
    zhTitle: "杀死比尔",
    year: "2026",
    poster: "/kill-bill/death-list-reference.jpg",
    posterAlt: "Kill Bill 暗杀名单活动主视觉",
    accent: "#d9bf13",
    background: "#11100c",
    foreground: "#f5f0e5",
    sections: {
      articles: [],
      photos: [],
      tools: [
        {
          title: "制作暗杀名单",
          meta: "DEATH LIST FIVE",
          copy: "前四项划掉，第五个名字可以选择 BILL，也可以写下自己的名字。",
          href: "/kill-bill/#death-list",
          action: "打开工具",
        },
        {
          title: "制作 Killer License",
          meta: "ID CARD",
          copy: "上传照片、填写姓名与代号，生成自己的杀手身份卡。",
          href: "/kill-bill/#id-card",
          action: "打开工具",
        },
      ],
      merch: [],
    },
  },
];

export function findArchiveFilm(slug: string) {
  return archiveFilms.find((film) => film.slug === slug);
}
