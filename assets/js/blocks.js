// ============================================================
// Content blocks — the building blocks of every page.
// Each page stores an array of blocks: { type, ...fields }
// ============================================================
import { esc, md, humanSize, youtubeEmbed, prettyUrl, toast } from "./ui.js";
import { uploadFile } from "./store.js";

export const BLOCK_TYPES = [
  { type: "heading", label: "Heading", icon: "🔤" },
  { type: "text", label: "Text", icon: "📝" },
  { type: "image", label: "Image", icon: "🖼️" },
  { type: "file", label: "File / download", icon: "📎" },
  { type: "list", label: "List", icon: "📋" },
  { type: "quote", label: "Quote", icon: "❝" },
  { type: "callout", label: "Callout box", icon: "💡" },
  { type: "video", label: "Video", icon: "🎬" },
  { type: "button", label: "Button / link", icon: "🔘" },
  { type: "table", label: "Table", icon: "📊" },
  { type: "code", label: "Code", icon: "⌨️" },
  { type: "divider", label: "Divider", icon: "➖" },
];

export function newBlock(type) {
  const base = { type, id: Math.random().toString(36).slice(2, 9) };
  switch (type) {
    case "heading": return { ...base, level: "h2", text: "New heading" };
    case "text": return { ...base, text: "Write your text here. Use **bold** and *italic*." };
    case "image": return { ...base, url: "", caption: "", align: "center" };
    case "file": return { ...base, url: "", name: "" };
    case "list": return { ...base, items: "First item\nSecond item", ordered: false };
    case "quote": return { ...base, text: "A wise quote…", author: "" };
    case "callout": return { ...base, kind: "info", text: "Important information goes here." };
    case "video": return { ...base, url: "" };
    case "button": return { ...base, label: "Click here", url: "#/", style: "primary" };
    case "table": return { ...base, rows: "Name|Grade\nAli|A\nSara|A+" };
    case "code": return { ...base, text: "console.log('hello');" };
    case "divider": return base;
    default: return base;
  }
}

// ============================================================
// RENDERING (public view of a page's content)
// ============================================================
export function renderBlocks(blocks = []) {
  return blocks.map((b) => renderBlock(b)).join("");
}

function renderBlock(b) {
  try {
    switch (b.type) {
      case "heading": {
        const tag = b.level === "h1" ? "h1" : b.level === "h3" ? "h3" : "h2";
        return `<div class="block block-heading"><${tag}>${esc(b.text || "")}</${tag}></div>`;
      }
      case "text":
        return `<div class="block block-text"><p>${md(b.text || "")}</p></div>`;
      case "image":
        if (!b.url) return "";
        return `<figure class="block block-image ${b.align === "center" ? "center" : ""}">
            <img src="${esc(b.url)}" alt="${esc(b.caption || "")}" loading="lazy" />
            ${b.caption ? `<figcaption class="block-caption">${esc(b.caption)}</figcaption>` : ""}
          </figure>`;
      case "file":
        if (!b.url) return "";
        return `<div class="block block-file">
            <a href="${esc(b.url)}" target="_blank" rel="noopener" download>
              <span style="font-size:1.4rem">📎</span>
              <span>${esc(b.name || prettyUrl(b.url))}</span>
            </a>
          </div>`;
      case "list": {
        const items = String(b.items || "").split("\n").map((s) => s.trim()).filter(Boolean);
        if (!items.length) return "";
        const tag = b.ordered ? "ol" : "ul";
        return `<div class="block block-list"><${tag}>${items.map((i) => `<li>${md(i)}</li>`).join("")}</${tag}></div>`;
      }
      case "quote":
        return `<blockquote class="block block-quote"><p>${md(b.text || "")}</p>${b.author ? `<footer>— ${esc(b.author)}</footer>` : ""}</blockquote>`;
      case "callout":
        return `<div class="block block-callout ${esc(b.kind || "info")}">${md(b.text || "")}</div>`;
      case "video": {
        const src = youtubeEmbed(b.url || "");
        return src ? `<div class="block block-video"><iframe src="${esc(src)}" allowfullscreen loading="lazy" title="Video"></iframe></div>` : "";
      }
      case "button":
        return `<div class="block block-button"><a class="btn ${b.style === "ghost" ? "btn-ghost" : "btn-primary"}" href="${esc(b.url || "#/")}" ${String(b.url).startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${esc(b.label || "Open")}</a></div>`;
      case "table": {
        const rows = String(b.rows || "").split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.length);
        if (!rows.length) return "";
        return `<div class="block block-table"><table>
          <thead><tr>${rows[0].map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
      }
      case "code":
        return `<div class="block block-code">${esc(b.text || "")}</div>`;
      case "divider":
        return `<hr class="block block-divider" />`;
      default:
        return "";
    }
  } catch {
    return "";
  }
}

// ============================================================
// BLOCK EDITOR (used inside the admin "edit page" modal)
// ============================================================
export class BlockEditor {
  constructor(host, blocks = []) {
    this.host = host;
    this.blocks = (blocks || []).map((b) => ({ ...b, id: b.id || Math.random().toString(36).slice(2, 9) }));
    this.host.innerHTML = "";
    this.render();
  }

  get value() { return this.blocks.map(({ id, ...b }) => b); }

  render() {
    this.host.innerHTML = `
      <div class="be-list"></div>
      <div style="margin-top:10px">
        <div class="hint" style="margin-bottom:8px">Add content:</div>
        <div class="btn-group">
          ${BLOCK_TYPES.map((t) => `<button type="button" class="btn btn-sm" data-add="${t.type}">${t.icon} ${t.label}</button>`).join("")}
        </div>
      </div>`;

    const list = this.host.querySelector(".be-list");
    if (!this.blocks.length) {
      list.innerHTML = `<div class="empty" style="padding:22px"><span class="empty-ico">🧱</span>No content yet — add a block below.</div>`;
    } else {
      this.blocks.forEach((b, i) => list.appendChild(this.renderBlock(b, i)));
    }

    this.host.querySelectorAll("[data-add]").forEach((btn) => {
      btn.onclick = () => { this.blocks.push(newBlock(btn.dataset.add)); this.render(); };
    });
  }

  renderBlock(b, i) {
    const el = document.createElement("div");
    el.className = "be-block";
    el.innerHTML = `
      <div class="be-head">
        <b>${esc(BLOCK_TYPES.find((t) => t.type === b.type)?.label || b.type)}</b>
        <div class="spacer"></div>
        <button type="button" class="btn btn-sm" data-act="up" title="Move up">↑</button>
        <button type="button" class="btn btn-sm" data-act="down" title="Move down">↓</button>
        <button type="button" class="btn btn-sm btn-danger" data-act="del" title="Delete">✕</button>
      </div>
      <div class="be-fields">${this.fieldsHtml(b)}</div>`;

    el.querySelector('[data-act="up"]').onclick = () => { if (i > 0) { [this.blocks[i - 1], this.blocks[i]] = [this.blocks[i], this.blocks[i - 1]]; this.render(); } };
    el.querySelector('[data-act="down"]').onclick = () => { if (i < this.blocks.length - 1) { [this.blocks[i + 1], this.blocks[i]] = [this.blocks[i], this.blocks[i + 1]]; this.render(); } };
    el.querySelector('[data-act="del"]').onclick = () => { this.blocks.splice(i, 1); this.render(); };

    // keep the in-memory block in sync with its inputs
    el.querySelectorAll("[data-f]").forEach((input) => {
      input.addEventListener("input", () => {
        const f = input.dataset.f;
        this.blocks[i][f] = input.type === "checkbox" ? input.checked : input.value;
      });
    });

    // file upload buttons
    el.querySelectorAll("[data-upload]").forEach((btn) => {
      btn.onclick = async () => {
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          btn.disabled = true; btn.textContent = "Uploading…";
          try {
            const res = await uploadFile(file, "content");
            if (b.type === "file") {
              this.blocks[i].url = res.url; this.blocks[i].name = file.name;
            } else {
              this.blocks[i].url = res.url;
            }
            this.render();
            toast("Uploaded.", "ok");
          } catch (e) {
            toast(e.message, "error", "Upload failed");
            btn.disabled = false; btn.textContent = "⬆ Upload";
          }
        };
        input.click();
      };
    });

    return el;
  }

  fieldsHtml(b) {
    switch (b.type) {
      case "heading":
        return `
          <div class="row">
            <div class="field"><label>Text</label><input class="input" data-f="text" value="${esc(b.text || "")}" /></div>
            <div class="field" style="max-width:130px"><label>Size</label>
              <select class="input" data-f="level">
                ${["h1", "h2", "h3"].map((l) => `<option ${b.level === l ? "selected" : ""}>${l}</option>`).join("")}
              </select></div>
          </div>`;
      case "text":
        return `<div class="field"><label>Text <span class="hint">(supports **bold**, *italic*, [links](https://…))</span></label>
          <textarea class="input" data-f="text" rows="4">${esc(b.text || "")}</textarea></div>`;
      case "image":
        return `
          <div class="field"><label>Image</label>
            <div class="row">
              <input class="input" data-f="url" value="${esc(b.url || "")}" placeholder="https://… or upload" />
              <button type="button" class="btn" data-upload style="flex:0 0 auto">⬆ Upload</button>
            </div>
          </div>
          ${b.url ? `<div style="margin-bottom:10px"><img src="${esc(b.url)}" style="max-height:150px;border-radius:9px;border:1px solid var(--border)" /></div>` : ""}
          <div class="row">
            <div class="field"><label>Caption</label><input class="input" data-f="caption" value="${esc(b.caption || "")}" /></div>
            <div class="field" style="max-width:150px"><label>Align</label>
              <select class="input" data-f="align">
                <option value="center" ${b.align === "center" ? "selected" : ""}>Center</option>
                <option value="left" ${b.align !== "center" ? "selected" : ""}>Left</option>
              </select></div>
          </div>`;
      case "file":
        return `
          <div class="field"><label>File</label>
            <div class="row">
              <input class="input" data-f="url" value="${esc(b.url || "")}" placeholder="https://… or upload" />
              <button type="button" class="btn" data-upload style="flex:0 0 auto">⬆ Upload</button>
            </div>
          </div>
          <div class="field"><label>Display name</label><input class="input" data-f="name" value="${esc(b.name || "")}" placeholder="Worksheet.pdf" /></div>`;
      case "list":
        return `
          <div class="field"><label>Items (one per line)</label><textarea class="input" data-f="items" rows="4">${esc(b.items || "")}</textarea></div>
          <label class="switch"><input type="checkbox" data-f="ordered" ${b.ordered ? "checked" : ""}/> Numbered list</label>`;
      case "quote":
        return `
          <div class="field"><label>Quote</label><textarea class="input" data-f="text" rows="2">${esc(b.text || "")}</textarea></div>
          <div class="field"><label>Author</label><input class="input" data-f="author" value="${esc(b.author || "")}" /></div>`;
      case "callout":
        return `
          <div class="field"><label>Kind</label>
            <select class="input" data-f="kind">
              ${["info", "warn", "success"].map((k) => `<option ${b.kind === k ? "selected" : ""}>${k}</option>`).join("")}
            </select></div>
          <div class="field"><label>Text</label><textarea class="input" data-f="text" rows="2">${esc(b.text || "")}</textarea></div>`;
      case "video":
        return `<div class="field"><label>YouTube link</label><input class="input" data-f="url" value="${esc(b.url || "")}" placeholder="https://youtube.com/watch?v=…" />
          ${b.url ? `<div class="hint">${youtubeEmbed(b.url) ? "✓ Looks good" : "⚠ Could not read a YouTube link from this URL"}</div>` : ""}</div>`;
      case "button":
        return `
          <div class="row">
            <div class="field"><label>Label</label><input class="input" data-f="label" value="${esc(b.label || "")}" /></div>
            <div class="field"><label>Link</label><input class="input" data-f="url" value="${esc(b.url || "")}" placeholder="https://… or #/page/…" /></div>
            <div class="field" style="max-width:140px"><label>Style</label>
              <select class="input" data-f="style">
                <option value="primary" ${b.style !== "ghost" ? "selected" : ""}>Filled</option>
                <option value="ghost" ${b.style === "ghost" ? "selected" : ""}>Outline</option>
              </select></div>
          </div>`;
      case "table":
        return `<div class="field"><label>Rows (one per line, cells separated by |)</label>
          <textarea class="input" data-f="rows" rows="4">${esc(b.rows || "")}</textarea></div>`;
      case "code":
        return `<div class="field"><label>Code</label><textarea class="input" data-f="text" rows="4">${esc(b.text || "")}</textarea></div>`;
      case "divider":
        return `<div class="form-note">A horizontal line — no settings.</div>`;
      default:
        return "";
    }
  }
}
