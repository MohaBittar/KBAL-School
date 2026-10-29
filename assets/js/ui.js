// ============================================================
// Small DOM / formatting helpers used by every view
// ============================================================

/** Escape a string for safe HTML output. */
export function esc(s = "") {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Minimal markdown: **bold**, *italic*, `code`, [text](url), line breaks. */
export function md(s = "") {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br>");
}

/** Initials for avatars. */
export function initials(name = "?") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function fmtDate(msOrDate, opts = {}) {
  const d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, {
    year: opts.short ? undefined : "numeric", month: "short", day: "numeric",
    hour: opts.noTime ? undefined : "2-digit", minute: opts.noTime ? undefined : "2-digit",
  });
}

export function fmtTime(ms) {
  const d = new Date(ms);
  return isNaN(d) ? "" : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function humanSize(bytes = 0) {
  if (!bytes) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ---------- toast ----------
export function toast(message, type = "", title = "") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${title ? `<b>${esc(title)}</b>` : ""}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 320); }, 3400);
}

// ---------- confirm ----------
export function confirmBox(message, { danger = true, okText = "Confirm" } = {}) {
  return new Promise((resolve) => {
    openModal({
      title: "Please confirm",
      body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn" data-x="cancel">Cancel</button>
               <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-x="ok">${esc(okText)}</button>`,
      onMount(root) {
        root.querySelector('[data-x="cancel"]').onclick = () => { closeModal(); resolve(false); };
        root.querySelector('[data-x="ok"]').onclick = () => { closeModal(); resolve(true); };
      },
    });
  });
}

// ---------- modal ----------
let lastFocus = null;
export function openModal({ title = "", body = "", footer = "", wide = false, onMount }) {
  closeModal();
  lastFocus = document.activeElement;
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3><div class="spacer"></div>
          <button class="icon-btn" data-modal-close aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
      </div>
    </div>`;
  const backdrop = root.querySelector(".modal-backdrop");
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) closeModal(); });
  root.querySelector("[data-modal-close]").onclick = closeModal;
  document.addEventListener("keydown", escClose);
  const modal = root.querySelector(".modal");
  if (onMount) onMount(modal);
  const focusable = modal.querySelector("input,select,textarea,button.btn-primary");
  if (focusable) focusable.focus();
  return modal;
}

function escClose(e) { if (e.key === "Escape") closeModal(); }

export function closeModal() {
  const root = document.getElementById("modal-root");
  if (!root.innerHTML.trim()) return;
  root.innerHTML = "";
  document.removeEventListener("keydown", escClose);
  if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch {} }
}

// ---------- form helpers ----------
export function formValues(root, names) {
  const out = {};
  names.forEach((n) => {
    const el = root.querySelector(`[name="${n}"]`);
    if (!el) return;
    out[n] = el.type === "checkbox" ? el.checked : el.value.trim();
  });
  return out;
}

/** Collect a repeater (dynamic list of text inputs) into an array. */
export function repeaterValues(root, selector) {
  return [...root.querySelectorAll(selector)].map((i) => i.value.trim()).filter(Boolean);
}

export function spinner() { return `<div class="spinner" aria-label="Loading"></div>`; }

export function debounce(fn, ms = 400) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Turn a YouTube URL into an embed URL (or null). */
export function youtubeEmbed(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function prettyUrl(url = "") {
  return String(url).replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 46);
}
