export type EditorialLink = {
  label: string;
  href?: string;
  external?: boolean;
};

export type EditorialEntry = {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  href?: string;
  kind: "story" | "experience" | "ticket";
};

export type EditorialIssue = {
  number: string;
  slug: string;
  title: string;
  chineseTitle: string;
  year: string;
  dateLabel: string;
  accent: string;
  accentDark: string;
  paper: string;
  poster: string;
  statement: string;
  introduction: string;
  experienceHref: string;
  ticket: EditorialLink;
  entries: EditorialEntry[];
};

export const editorialIssues: EditorialIssue[] = [
  {
    number: "01",
    slug: "obsession",
    title: "OBSESSION",
    chineseTitle: "迷恋",
    year: "2026",
    dateLabel: "JUL—AUG 2026",
    accent: "#ef3b2d",
    accentDark: "#6f1713",
    paper: "#eadfce",
    poster: "/original-poster.png",
    statement: "电影散场以后，故事还在发生。",
    introduction:
      "第一期从《Obsession》开始。我们把观影、影像实验和可以带走的海报放在同一个入口里。",
    experienceHref: "/obsession/",
    ticket: {
      label: "微信购票入口即将开放",
    },
    entries: [
      {
        eyebrow: "互动企划 / ON DEVICE",
        title: "把自己放进电影里",
        description:
          "按照参考线站好，拍下一张照片，在手机里生成属于你的 Obsession 海报。",
        meta: "POSTER DARKROOM",
        href: "/obsession/",
        kind: "experience",
      },
      {
        eyebrow: "活动入口 / SOON",
        title: "微信购票入口即将开放",
        description:
          "公众号、放映场次和购票链接会集中放在这里。开放以后，一步跳转到微信。",
        meta: "WECHAT / TICKETS",
        kind: "ticket",
      },
    ],
  },
];

export const currentIssue = editorialIssues[0];

export function issueUrl(slug: string) {
  return `/issues/${slug}/`;
}
