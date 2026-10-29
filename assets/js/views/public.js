// ============================================================
// Public views: home, browse, category, page, class, search
// ============================================================
import { state, isSignedIn, isAdmin, visibleCategories, visibleAnnouncements, myClass, classOf, categoryOf } from "../store.js";
import { navigate } from "../router.js";
import { esc, fmtDate, spinner } from "../ui.js";
import { renderBlocks } from "../blocks.js";
import {
  collection, query, where, onSnapshot, orderBy, doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase.js";

const pagesCol = collection(db, "pages");

/** Live list of pages in a category (optionally also filtered by class). */
function watchPages(catId, cb) {
  const q = catId ? query(pagesCol, where("categoryId", "==", catId)) : pagesCol;
  return onSnapshot(q, (snap) => {
    let pages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const admin = isAdmin();
    const cid = state.profile?.classId || null;
    pages = pages
      .filter((p) => (p.published === false ? admin : true))
      .filter((p) => admin || !p.classId || p.classId === cid)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.title).localeCompare(String(b.title)));
    cb(pages, null);
  }, (err) => {
    console.warn("pages:", err.message);
    cb([], err);
  });
}

/** Friendly message shown when Firestore rules are not deployed yet. */
export function setupNeededHtml() {
  return `<div class="empty">
    <span class="empty-ico">🔐</span>
    <h3>Waiting for setup</h3>
    <p>This content lives in Firebase and the security rules are not published yet.</p>
    <p class="form-note">Run <code>firebase deploy --only firestore:rules,storage</code> (or publish <code>firestore.rules</code> and <code>storage.rules</code> in the Firebase console), then reload.</p>
  </div>`;
}

// ============================================================
// HOME
// ============================================================
export async function homeView(container) {
  const s = state.settings || {};
  const cats = visibleCategories();
  const anns = visibleAnnouncements().slice(0, 6);
  const cls = myClass();

  container.innerHTML = `
    <div class="hero ${s.coverUrl ? "has-cover" : ""}" ${s.coverUrl ? `style="background-image:linear-gradient(rgba(2,6,23,.55),rgba(2,6,23,.55)),url('${esc(s.coverUrl)}')"` : ""}>
      <div class="hero-inner">
        <h1>${esc(s.siteName || "KBAL-School")}</h1>
        <p>${esc(s.tagline || "Learn, explore and grow together.")}</p>
        ${s.homeIntro ? `<p>${esc(s.homeIntro)}</p>` : ""}
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/browse">🗂️ Browse categories</a>
          ${isSignedIn()
            ? `<a class="btn btn-ghost" href="#/chat">💬 Open chats</a>`
            : `<a class="btn btn-ghost" href="#/signin">🔑 Sign in</a>`}
        </div>
      </div>
    </div>

    ${s.showAnnouncements !== false && anns.length ? `
      <div class="panel">
        <div class="panel-head"><h2>📣 Announcements</h2></div>
        <div class="grid cols-3">
          ${anns.map((a) => `
            <div class="card" style="cursor:default">
              <div class="card-meta">${fmtDate(a.atMs)} ${a.classId ? `· <span class="chip">${esc(classOf(a.classId)?.name || "Class")}</span>` : ""}</div>
              <h3 style="margin-top:8px">${esc(a.title)}</h3>
              <p>${esc(a.body || "")}</p>
            </div>`).join("")}
        </div>
      </div>` : ""}

    ${cls ? `
      <div class="panel">
        <div class="panel-head">
          <h2>${esc(cls.icon || "🎓")} ${esc(cls.name)}</h2>
          <div class="spacer"></div>
          <a class="btn btn-sm" href="#/class/${esc(cls.id)}">Open class →</a>
          <a class="btn btn-sm" href="#/chat/${esc("room_class_" + cls.id)}">Class chat</a>
        </div>
        <p class="form-note">${esc(cls.description || "Your class space: pages, announcements and chat made just for you.")}</p>
        <div id="home-class-pages">${spinner()}</div>
      </div>` : ""}

    <div class="panel">
      <div class="panel-head">
        <h2>🗂️ Categories</h2>
        <div class="spacer"></div>
        <a class="btn btn-sm" href="#/browse">See all</a>
      </div>
      ${cats.length
        ? `<div class="grid cols-3">${cats.slice(0, 9).map(categoryCard).join("")}</div>`
        : `<div class="empty"><span class="empty-ico">🗂️</span>No categories have been published yet.</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>📚 Recently added</h2></div>
      <div id="home-latest">${spinner()}</div>
    </div>`;

  // ---- class pages (live)
  let clean1 = () => {};
  if (cls) {
    clean1 = watchPages(null, (pages, err) => {
      const host = document.getElementById("home-class-pages");
      if (!host) return;
      if (err) { host.innerHTML = setupNeededHtml(); return; }
      const mine = pages.filter((p) => p.classId === cls.id).slice(0, 6);
      host.innerHTML = mine.length
        ? `<div class="grid cols-3">${mine.map(pageCard).join("")}</div>`
        : `<div class="form-note">No class pages yet — your teacher can add them from the admin panel.</div>`;
    });
  }

  // ---- latest pages (live)
  const clean2 = watchPages(null, (pages, err) => {
    const host = document.getElementById("home-latest");
    if (!host) return;
    if (err) { host.innerHTML = setupNeededHtml(); return; }
    const latest = [...pages].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0)).slice(0, 6);
    host.innerHTML = latest.length
      ? `<div class="grid cols-3">${latest.map(pageCard).join("")}</div>`
      : `<div class="empty"><span class="empty-ico">📚</span>Nothing here yet — an admin can add pages from the admin panel.</div>`;
  });

  return () => { clean1(); clean2(); };
}

function categoryCard(c) {
  return `<a class="card" href="#/category/${esc(c.id)}">
    <span class="card-ico">${esc(c.icon || "📁")}</span>
    <h3>${esc(c.name)}</h3>
    <p>${esc(c.description || "")}</p>
    ${c.classId ? `<div class="card-meta"><span class="chip">${esc(classOf(c.classId)?.name || "Class only")}</span></div>` : ""}
  </a>`;
}

function pageCard(p) {
  return `<a class="card" href="#/page/${esc(p.id)}">
    <div class="card-meta">${esc(categoryOf(p.categoryId)?.name || "General")}</div>
    <h3 style="margin-top:6px">${esc(p.title)}</h3>
    <p>${esc(String(p.summary || firstText(p) || "").slice(0, 120))}</p>
    <div class="card-meta">${fmtDate(p.updatedAtMs || p.createdAtMs, { short: true, noTime: true })}</div>
  </a>`;
}

function firstText(p) {
  const t = (p.blocks || []).find((b) => b.type === "text" || b.type === "heading");
  return t ? String(t.text || "").replace(/[*`]/g, "") : "";
}

// ============================================================
// BROWSE (all categories)
// ============================================================
export async function browseView(container) {
  const cats = visibleCategories();
  container.innerHTML = `
    <div class="page-head">
      <div>
        <h1>🗂️ Categories</h1>
        <p class="form-note">Pick a category to see its pages.</p>
      </div>
    </div>
    ${cats.length
      ? `<div class="grid cols-3">${cats.map(categoryCard).join("")}</div>`
      : `<div class="panel empty"><span class="empty-ico">🗂️</span><h3>No categories yet</h3>
         <p>An administrator can create categories from the <a href="#/admin">admin panel</a>.</p></div>`}`;
}

// ============================================================
// CATEGORY (pages inside one category)
// ============================================================
export async function categoryView(container, { id }) {
  const cat = categoryOf(id);
  if (!cat) {
    container.innerHTML = `<div class="panel empty"><span class="empty-ico">🔍</span><h3>Category not found</h3><p><a class="btn" href="#/browse">Back to categories</a></p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="#/browse">Categories</a> / ${esc(cat.name)}</div>
        <h1>${esc(cat.icon || "📁")} ${esc(cat.name)}</h1>
        <p class="form-note">${esc(cat.description || "")}</p>
      </div>
      <div class="spacer" style="flex:1"></div>
      ${cat.classId ? `<span class="chip">${esc(classOf(cat.classId)?.name || "Class only")}</span>` : ""}
    </div>
    <div id="cat-pages">${spinner()}</div>`;

  return watchPages(id, (pages, err) => {
    const host = document.getElementById("cat-pages");
    if (!host) return;
    if (err) { host.innerHTML = `<div class="panel">${setupNeededHtml()}</div>`; return; }
    host.innerHTML = pages.length
      ? `<div class="grid cols-3">${pages.map(pageCard).join("")}</div>`
      : `<div class="panel empty"><span class="empty-ico">📄</span><h3>No pages yet</h3><p>Pages added to this category will appear here.</p></div>`;
  });
}

// ============================================================
// PAGE (one page made of blocks)
// ============================================================
export async function pageView(container, { id }) {
  const ref = doc(db, "pages", id);
  const host = container;
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      host.innerHTML = `<div class="panel empty"><span class="empty-ico">📄</span><h3>Page not found</h3><p>It may have been removed. <a href="#/browse">Browse categories</a>.</p></div>`;
      return;
    }
    const p = { id: snap.id, ...snap.data() };
    const cat = categoryOf(p.categoryId);
    host.innerHTML = `
      <div class="page-head">
        <div>
          <div class="crumbs">${cat ? `<a href="#/category/${esc(cat.id)}">${esc(cat.name)}</a> / ` : ""}Page</div>
          <h1>${esc(p.title)}</h1>
          <div class="form-note">
            ${fmtDate(p.updatedAtMs || p.createdAtMs, { short: true, noTime: true })}
            ${p.classId ? ` · <span class="chip">${esc(classOf(p.classId)?.name || "Class")}</span>` : ""}
            ${p.authorName ? ` · by ${esc(p.authorName)}` : ""}
          </div>
        </div>
        <div style="flex:1"></div>
        ${isAdmin() ? `<a class="btn btn-sm" href="#/admin/pages?edit=${esc(p.id)}">🛠 Edit</a>` : ""}
      </div>
      <div class="content">
        ${(p.blocks || []).length ? renderBlocks(p.blocks) : `<div class="panel empty"><span class="empty-ico">📝</span>This page has no content yet.</div>`}
        ${(p.blocks || []).length ? "" : ""}
      </div>
      ${(p.attachments || []).length ? `
        <div class="panel" style="margin-top:24px">
          <div class="panel-head"><h3>📎 Attachments</h3></div>
          ${p.attachments.map((f) => `<p><a href="${esc(f.url)}" target="_blank" rel="noopener" download>${esc(f.name)}</a></p>`).join("")}
        </div>` : ""}`;
  }, (err) => {
    console.warn("page:", err.message);
    host.innerHTML = `<div class="panel">${setupNeededHtml()}</div>`;
  });
}

// ============================================================
// CLASS SPACE
// ============================================================
export async function classView(container, { id }) {
  const cls = classOf(id);
  if (!cls) {
    container.innerHTML = `<div class="panel empty"><span class="empty-ico">🎓</span><h3>Class not found</h3><p><a class="btn" href="#/">Back home</a></p></div>`;
    return;
  }
  const members = await (async () => {
    try {
      const { collection, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const snap = await getDocs(query(collection(db, "users"), where("classId", "==", id)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  })();

  container.innerHTML = `
    <div class="hero" style="background:linear-gradient(120deg,${esc(cls.color || "var(--accent)")},color-mix(in srgb, ${esc(cls.color || "var(--accent)")} 55%, #111))">
      <div class="hero-inner">
        <h1>${esc(cls.icon || "🎓")} ${esc(cls.name)}</h1>
        <p>${esc(cls.description || "")}</p>
        <div class="hero-actions">
          <a class="btn btn-ghost" href="#/chat/${esc("room_class_" + cls.id)}">💬 Class chat</a>
          ${state.profile?.classId === cls.id ? `<span class="btn">✅ You are in this class</span>` : ""}
        </div>
      </div>
    </div>

    <div class="grid cols-3" style="align-items:start">
      <div class="panel" style="grid-column:span 2">
        <div class="panel-head"><h2>📚 Class pages</h2></div>
        <div id="class-pages">${spinner()}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>👩‍🏫 Details</h2></div>
        ${cls.teacher ? `<p><b>Teacher:</b> ${esc(cls.teacher)}</p>` : ""}
        ${cls.room ? `<p><b>Room:</b> ${esc(cls.room)}</p>` : ""}
        ${cls.code ? `<p><b>Join code:</b> <code>${esc(cls.code)}</code></p>` : ""}
        <h3 style="margin-top:18px">👥 Members (${members.length})</h3>
        ${members.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${members.map((m) => `
              <a class="chip" href="#/chat?with=${esc(m.id)}" title="Message ${esc(m.displayName)}">${esc(m.displayName)}</a>`).join("")}</div>`
          : `<p class="form-note">No students in this class yet.</p>`}
      </div>
    </div>`;

  return watchPages(null, (pages, err) => {
    const host = document.getElementById("class-pages");
    if (!host) return;
    if (err) { host.innerHTML = setupNeededHtml(); return; }
    const mine = pages.filter((p) => p.classId === id || categoryOf(p.categoryId)?.classId === id);
    host.innerHTML = mine.length
      ? `<div class="grid cols-3">${mine.map(pageCard).join("")}</div>`
      : `<div class="empty"><span class="empty-ico">📚</span>No pages for this class yet.</div>`;
  });
}

// ============================================================
// SEARCH
// ============================================================
export async function searchView(container, params, qs) {
  const term = qs.get("q") || "";
  container.innerHTML = `
    <div class="page-head"><div><h1>🔎 Search</h1></div></div>
    <div class="panel">
      <div class="field"><input class="input" id="search-input" value="${esc(term)}" placeholder="Search pages, categories, people…" autofocus /></div>
      <div id="search-results">${spinner()}</div>
    </div>`;

  const input = container.querySelector("#search-input");
  let pageSnapPages = [];
  const clean = watchPages(null, (pages) => { pageSnapPages = pages; run(); });

  const userDocs = state.categories ? await (async () => {
    try {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  })() : [];

  function run() {
    const t = input.value.trim().toLowerCase();
    const host = document.getElementById("search-results");
    if (!host) return;
    if (!t) { host.innerHTML = `<div class="empty"><span class="empty-ico">🔎</span>Type something to search.</div>`; return; }

    const cats = visibleCategories().filter((c) => (c.name + " " + (c.description || "")).toLowerCase().includes(t));
    const pages = pageSnapPages.filter((p) => {
      const text = (p.title + " " + (p.summary || "") + " " + (p.blocks || []).map((b) => b.text || "").join(" ")).toLowerCase();
      return text.includes(t);
    }).slice(0, 30);
    const people = (userDocs || []).filter((u) => (u.displayName || "").toLowerCase().includes(t)).slice(0, 12);

    if (!cats.length && !pages.length && !people.length) {
      host.innerHTML = `<div class="empty"><span class="empty-ico">🤷</span>No results for “${esc(input.value)}”.</div>`;
      return;
    }
    host.innerHTML = `
      ${cats.length ? `<h3>Categories</h3><div class="grid cols-3" style="margin-bottom:18px">${cats.map(categoryCard).join("")}</div>` : ""}
      ${pages.length ? `<h3>Pages</h3><div class="grid cols-3" style="margin-bottom:18px">${pages.map(pageCard).join("")}</div>` : ""}
      ${people.length && isSignedIn() ? `<h3>People</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${people.map((p) => `<a class="chip" href="#/chat?with=${esc(p.id)}">💬 ${esc(p.displayName)}</a>`).join("")}</div>` : ""}`;
  }

  input.addEventListener("input", run);
  run();
  return clean;
}
