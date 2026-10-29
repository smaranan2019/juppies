/**
 * A tiny, safe templating helper.
 *
 *   html`<p>${user.name}</p>`         // interpolated values are HTML-escaped
 *   html`<ul>${items.map(itemView)}</ul>`  // arrays and nested html`` are inserted as-is
 *   ${condition && html`...`}         // false / null / undefined render nothing
 *
 * Views return SafeHtml; only the renderer turns it into innerHTML.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function toHtml(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(toHtml).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += toHtml(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

/** Marks a trusted, static string (such as an SVG icon) as safe. Never pass user data. */
export const trusted = (markup) => new SafeHtml(markup);
