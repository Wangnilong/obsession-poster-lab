/* eslint-disable @next/next/no-img-element -- CloudBase image URLs are generated at runtime */

import type { ArchiveLayoutBlock } from "./archive-data";

export default function ArchiveLayout({ blocks }: { blocks: ArchiveLayoutBlock[] }) {
  return (
    <div className="archive-layout">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "image") {
          if (!block.image) return null;
          return (
            <figure className={`archive-layout-image is-${block.size ?? "full"}`} key={key}>
              <img src={block.image} alt={block.alt ?? ""} />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "link") {
          if (!block.href || !block.text) return null;
          return <a className="archive-layout-link" href={block.href} key={key}>{block.text}<span>↗</span></a>;
        }

        const className = `archive-layout-${block.type} is-align-${block.align ?? "left"}`;
        if (block.type === "heading") return <h4 className={className} key={key}>{block.text}</h4>;
        if (block.type === "quote") return <blockquote className={className} key={key}>{block.text}</blockquote>;
        return <p className={className} key={key}>{block.text}</p>;
      })}
    </div>
  );
}
