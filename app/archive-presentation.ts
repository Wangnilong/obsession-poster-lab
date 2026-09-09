import type { ArchiveEntry, ArchiveSection } from "./archive-data";

export const defaultSectionOrder: ArchiveSection[] = ["articles", "photos", "tools", "merch"];
export type ArchivePresentation = {
  revision: number;
  posterFileID: string;
  poster: string;
  posterX: number;
  posterY: number;
  sectionOrder: ArchiveSection[];
  itemOrders: Record<ArchiveSection, string[]>;
};
export const emptyPresentation = (): ArchivePresentation => ({ revision: 0, posterFileID: "", poster: "", posterX: 50, posterY: 50,
  sectionOrder: [...defaultSectionOrder], itemOrders: { articles: [], photos: [], tools: [], merch: [] } });

export function orderItems<T>(items: T[], keys: string[], getKey: (item: T) => string): T[] {
  const rank = new Map(keys.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (rank.get(getKey(a)) ?? keys.length) - (rank.get(getKey(b)) ?? keys.length));
}

export type GalleryImage = { key: string; image: string; alt: string };
export function galleryImages(entries: ArchiveEntry[]): GalleryImage[] {
  return entries.flatMap((entry, index) => {
    const images: GalleryImage[] = [];
    if (entry.image) images.push({ key: entry.imageKey || `${entry.id || index}:cover`, image: entry.image, alt: entry.imageAlt || entry.title });
    entry.layout?.forEach((block, blockIndex) => {
      if (block.type === "image" && block.image) images.push({ key: block.imageKey || `${entry.id || index}:image:${blockIndex}`, image: block.image, alt: block.alt || entry.title });
    });
    return images;
  });
}

export function moveKey(keys: string[], from: string, to: string): string[] {
  if (from === to || !keys.includes(from) || !keys.includes(to)) return keys;
  const next = keys.filter(key => key !== from);
  next.splice(keys.indexOf(to), 0, from);
  return next;
}
