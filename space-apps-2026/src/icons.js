/* Hand-drawn SVG icon set. Every emoji in the UI is swapped for one of these. */
const ICON_PATHS = {
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12.3l2.8 2.8 5.6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13c0 4.5-2.5 8-6.5 8C7.5 21 6 19 4.5 16l-1-2a1.5 1.5 0 0 1 2.6-1.5L8 15"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  vote: '<rect x="3" y="11" width="18" height="10" rx="1.5"/><path d="M8 11V5h8v6M10 8l1.5 1.5L14 7M7 16h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".9" fill="currentColor"/>',
  pencil: '<path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>',
  sat: '<rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)"/><path d="M8.5 8.5L4 4M15.5 15.5L20 20"/><rect x="1" y="1" width="6" height="3.2" transform="rotate(45 4 2.6)"/><rect x="17" y="17" width="6" height="3.2" transform="rotate(45 20 18.6)"/><path d="M16 5a4 4 0 0 1 3 3M16 1.5a7.5 7.5 0 0 1 6.5 6.5"/>',
  sleep: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2.5M9.5 2.5h5M19 6l1.5-1.5"/>',
  script: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  scale: '<path d="M12 3v18M7 21h10M4 7h16M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>',
  dish: '<path d="M4.5 9.5a8 8 0 0 0 10 10z"/><path d="M9.5 14.5l4-4M13.5 10.5a2 2 0 1 0 0-.01M15 5a5 5 0 0 1 4 4M15.5 1.5a8.5 8.5 0 0 1 7 7M8 21h6"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10.5v3"/><rect x="4.5" y="9.5" width="9" height="5" rx=".6" fill="currentColor" stroke="none"/>',
  door: '<path d="M14 3H5v18h9"/><path d="M10 12h11M17 8l4 4-4 4"/>',
  thumb: '<path d="M7 10v11H3V10zM7 10l4-7c1.7 0 2.7 1.3 2.3 3L12.5 10H19a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 21H7"/>',
  rocket: '<path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.5 13l-3 3.5V19l3-1.5M16.5 13l3 3.5V19l-3-1.5M10 17.5l-.5 3.5M14 17.5l.5 3.5M12 18v4"/>',
  down: '<path d="M12 3v13M6.5 10.5L12 16l5.5-5.5M4 20h16"/>',
  skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 3h7L13 9.2M8.5 3l2.5 6.2"/><path d="M12 12.3l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/>',
  starO: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
};
const IC = (n, cls) => `<svg class="ic ic-${n}${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[n]}</svg>`;
const EMOJI_ICON = { "🔒": "lock", "🔓": "unlock", "🔐": "key", "✅": "check", "✓": "check", "✗": "xc", "✕": "x", "❌": "xc", "✋": "hand", "🎲": "dice", "⏳": "hourglass", "🔁": "repeat", "🔄": "repeat", "🎓": "cap", "🗳": "vote", "👤": "user", "⚠": "alert", "✏": "pencil", "🛰": "sat", "💤": "sleep", "⏱": "timer", "📜": "script", "💡": "bulb", "📏": "ruler", "⚡": "bolt", "⚖": "scale", "📡": "dish", "🔋": "battery", "🚪": "door", "👍": "thumb", "🚀": "rocket", "★": "star", "☆": "starO", "💸": "alert", "⬇": "down", "⏭": "skip", "🏅": "medal", "🏆": "medal", "🎉": "star" };
const EMOJI_RE = new RegExp("(" + Object.keys(EMOJI_ICON).join("|") + ")\\uFE0F?", "gu");
const NO_SVG = new Set(["OPTION", "TEXTAREA", "TITLE", "SCRIPT", "STYLE", "SELECT"]);
function deEmojiTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = [];
  while (w.nextNode()) { EMOJI_RE.lastIndex = 0; if (EMOJI_RE.test(w.currentNode.nodeValue)) hits.push(w.currentNode); }
  for (const t of hits) {
    const par = t.parentNode; if (!par || (par.closest && par.closest("svg"))) continue;
    if (NO_SVG.has(par.nodeName)) { t.nodeValue = t.nodeValue.replace(EMOJI_RE, "").replace(/^\s+/, ""); continue; }
    const span = document.createElement("span"); span.className = "icw";
    span.innerHTML = t.nodeValue.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).replace(EMOJI_RE, (m, e) => IC(EMOJI_ICON[e]));
    par.replaceChild(span, t);
  }
  // attributes that hold text (placeholders, titles, aria)
  root.querySelectorAll && root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(el => ["placeholder", "title", "aria-label"].forEach(a => { const v = el.getAttribute(a); if (v && (EMOJI_RE.lastIndex = 0, EMOJI_RE.test(v))) el.setAttribute(a, v.replace(EMOJI_RE, "").trim()); }));
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1) deEmojiTree(n); else if (n.nodeType === 3 && n.parentNode) deEmojiTree(n.parentNode); } })
  .observe(document.body, { childList: true, subtree: true, characterData: false });
document.addEventListener("DOMContentLoaded", () => deEmojiTree(document.body));
