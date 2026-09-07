/* eslint-disable @typescript-eslint/no-require-imports */
const sanitize = require("sanitize-html");

function sanitizeArticle(html, urls = new Map()) {
  return sanitize(String(html || ""), {
    allowedTags: ["p", "div", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "span", "font", "blockquote", "ul", "ol", "li", "hr", "a", "img", "figure", "figcaption"],
    allowedAttributes: { "*": ["style"], a: ["href", "title"], img: ["src", "alt", "data-file-id", "width"], font: ["color", "face", "size"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedStyles: { "*": {
      "text-align": [/^(left|center|right|justify)$/],
      "font-size": [/^\d+(px|pt|em|rem|%)$/],
      "font-family": [/^[\w\s,'"\-\u4e00-\u9fff]+$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^(underline|line-through|none)$/],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i, /^[a-z]+$/i],
      "line-height": [/^[\d.]+(px|em|%)?$/],
      "margin-left": [/^[\d.]+(px|em|%)$/],
      width: [/^\d+(px|%)$/],
    } },
    transformTags: {
      img: (tagName, attributes) => ({ tagName, attribs: { ...attributes, src: urls.get(attributes["data-file-id"]) || attributes.src || "" } }),
    },
  });
}
module.exports = { sanitizeArticle };
