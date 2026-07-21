export type FilmProject = {
  number: string;
  slug: string;
  title: string;
  chineseTitle: string;
  year: string;
  poster: string;
  description: string;
  experience: string;
  status: "live" | "coming-soon";
};

// Every public film starts here. Add one record, then register its experience
// component in src/main.tsx. The homepage updates automatically.
export const filmProjects: FilmProject[] = [
  {
    number: "01",
    slug: "obsession",
    title: "OBSESSION",
    chineseTitle: "迷恋",
    year: "2026",
    poster: "./original-poster.png",
    description: "花挡住脸，双手抱紧花瓶。把自己留在这张电影海报里。",
    experience: "海报暗房",
    status: "live",
  },
];

export function filmUrl(slug: string) {
  return `./${slug}/`;
}
