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
  slug: "obsession" | "kill-bill";
  issue: string;
  title: string;
  zhTitle: string;
  year: string;
  poster: string;
  posterAlt: string;
  accent: string;
  background: string;
  foreground: string;
  sections: Record<ArchiveSection, ArchiveEntry[]>;
};

export const archiveSectionLabels: Record<ArchiveSection, { index: string; zh: string; en: string }> = {
  articles: { index: "01", zh: "文章", en: "READING" },
  photos: { index: "02", zh: "映后图片", en: "AFTER THE SCREENING" },
  tools: { index: "03", zh: "工具", en: "TOOLS" },
  merch: { index: "04", zh: "周边", en: "OBJECTS" },
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
      articles: [
        {
          title: "花为什么挡住了脸？",
          meta: "ISSUE NOTE 01 · 5 MIN",
          copy: "从原始海报、身体姿态与观看关系，重新进入 Obsession 的视觉逻辑。",
          href: "/issues/obsession/",
          action: "阅读全文",
        },
      ],
      photos: [
        {
          title: "活动主视觉",
          meta: "OBSESSION · ISSUE 01",
          image: "/original-poster.png",
          imageAlt: "Obsession 活动主视觉",
        },
        {
          title: "海报暗房成片",
          meta: "PARTICIPANT POSTER",
          image: "/obsession-darkroom-ai.png",
          imageAlt: "参与者制作的 Obsession 海报",
        },
      ],
      tools: [
        {
          title: "Obsession 海报暗房",
          meta: "CAMERA · A3 / A4 PRINT",
          copy: "拍摄、构图、套用电影色调，并导出可以打印的电影海报。",
          href: "/obsession/",
          action: "打开工具",
        },
      ],
      merch: [
        {
          title: "A3 电影海报",
          meta: "PRINT OBJECT 01",
          copy: "保留 Obsession 标题、电影颗粒与现场参与者肖像的打印版本。",
          image: "/original-poster.png",
          imageAlt: "Obsession A3 电影海报",
        },
      ],
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
      articles: [
        {
          title: "文章将在散场后留下",
          meta: "COMING AFTER THE SCREENING",
          copy: "活动记录、映后讨论与参与者作品会在这里继续更新。",
        },
      ],
      photos: [
        {
          title: "Death List Five",
          meta: "VISUAL REFERENCE",
          image: "/kill-bill/death-list-still.jpg",
          imageAlt: "电影中的 Death List Five 画面",
        },
        {
          title: "暗杀名单物料",
          meta: "PRINT TEST",
          image: "/kill-bill/death-list-reference.jpg",
          imageAlt: "纸质暗杀名单和 Kill Bill 海报",
        },
      ],
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
      merch: [
        {
          title: "Death List Five",
          meta: "PRINT OBJECT 01",
          copy: "可以替换第五个名字的纸质名单。",
          image: "/kill-bill/death-list-reference.jpg",
          imageAlt: "Death List Five 纸质名单",
        },
      ],
    },
  },
];

export function findArchiveFilm(slug: string) {
  return archiveFilms.find((film) => film.slug === slug);
}
