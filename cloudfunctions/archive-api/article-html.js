/* eslint-disable @typescript-eslint/no-require-imports */
const sanitize = require("sanitize-html");
const articleFormat = require("./article-format.json");

function sanitizeArticle(html, urls = new Map()) {
  return sanitize(String(html || ""), {
    allowedTags: articleFormat.tags,
    allowedAttributes: { "*": ["style"], a: ["href", "title"], img: ["src", "alt", "data-file-id", "width"], font: ["color", "face", "size"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedStyles: { "*": Object.fromEntries(Object.entries(articleFormat.styles).map(([name, pattern]) => [name, [new RegExp(pattern, "i")]])) },
    transformTags: {
      img: (tagName, attributes) => ({ tagName, attribs: { ...attributes, src: urls.get(attributes["data-file-id"]) || attributes.src || "" } }),
    },
  });
}
module.exports = { sanitizeArticle };
