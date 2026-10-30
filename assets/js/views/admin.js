// ============================================================
// ADMIN PANEL — controls every part of the site
// ============================================================
import {
  state, isAdmin, uploadFile, classOf, categoryOf, updateProfile, DEFAULT_SETTINGS, seedStarter, createAnnouncement,
} from "../store.js";
import { navigate } from "../router.js";
import { esc, fmtDate, toast, confirmBox, openModal, closeModal, spinner } from "../ui.js";
import { BlockEditor } from "../blocks.js";
import {
  db, ADMIN_EMAILS,
} from "../firebase.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, getDoc,
  query, orderBy, serverTimestamp, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "categories", label: "Categories", icon: "🗂️" },
  { id: "pages", label: "Pages", icon: "📄" },
  { id: "classes", label: "Classes", icon: "🎓" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "database", label: "Database", icon: "🗄️" },
  { id: "settings", label: "Site settings", icon: "⚙️" },
];

// ============================================================
export async function adminView(container, { tab } = {}, qs = {}) {
  if (!state.user) { navigate("/signin"); return; }
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="panel empty" style="max-width:520px;margin:30px auto">
        <span class="empty-ico">🔒</span>
        <h3>Admins only</h3>
        <p>Your account (${esc(state.user.email || "")}) does not have administrator rights.</p>
        <p><a class="btn" href="#/">Back to the site</a></p>
      </div>`;
    return;
  }

  const active = TABS.some((t) => t.id === tab) ? tab : "dashboard";
  container.innerHTML = `
    <div class="page-head">
      <div><h1>🛠️ Admin panel</h1><p class="form-note">Everything on KBAL-School is managed from here.</p></div>
      <div style="flex:1"></div>
      <a class="btn btn-sm" href="#/" target="_self">👁 View site</a>
    </div>
    <div class="admin-layout">
      <div class="panel admin-nav">
        ${TABS.map((t) => `<a href="#/admin/${t.id}" class="${t.id === active ? "active" : ""}">${t.icon} ${t.label}</a>`).join("")}
      </div>
      <div id="admin-content">${spinner()}</div>
    </div>`;

  const host = container.querySelector("#admin-content");
  const q = qs.get("q");

  switch (active) {
    case "categories": await tabCategories(host); break;
    case "pages": await tabPages(host, qs.get("edit")); break;
    case "classes": await tabClasses(host); break;
    case "announcements": await tabAnnouncements(host); break;
    case "users": await tabUsers(host); break;
    case "database": await tabDatabase(host); break;
    case "settings": await tabSettings(host); break;
    default: await tabDashboard(host);
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function tabDashboard(host) {
  const [pages, users] = await Promise.all([allPages(), allUsers()]);
  const anns = state.announcements;
  const recent = [...pages].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0)).slice(0, 6);

  host.innerHTML = `
    ${state.categories.length === 0 ? `
      <div class="panel" style="margin-bottom:var(--gap);border-color:var(--accent)">
        <div class="panel-head"><h2>✨ Fresh install?</h2></div>
        <p class="form-note">Create sample categories, a welcome page and an announcement in one click — then edit or delete them.</p>
        <button class="btn btn-primary" id="seed-btn">✨ Create starter content</button>
      </div>` : ""}

    <div class="grid cols-4" style="margin-bottom:var(--gap)">
      ${stat(state.categories.length, "Categories", "🗂️")}
      ${stat(pages.length, "Pages", "📄")}
      ${stat(state.classes.length, "Classes", "🎓")}
      ${stat(users.length, "Users", "👥")}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>🚀 Quick actions</h2></div>
      <div class="btn-group">
        <a class="btn btn-primary" href="#/admin/pages">+ New page</a>
        <a class="btn" href="#/admin/categories">+ Category</a>
        <a class="btn" href="#/admin/classes">+ Class</a>
        <a class="btn" href="#/admin/announcements">+ Announcement</a>
        <a class="btn" href="#/admin/users">Manage users</a>
        <a class="btn" href="#/admin/settings">Site settings</a>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>🕘 Recently updated pages</h2></div>
      ${recent.length ? `
        <div class="table-wrap"><table class="list">
          <thead><tr><th>Title</th><th>Category</th><th>Updated</th><th></th></tr></thead>
          <tbody>${recent.map((p) => `
            <tr>
              <td><a href="#/page/${esc(p.id)}">${esc(p.title)}</a></td>
              <td>${esc(categoryOf(p.categoryId)?.name || "—")}</td>
              <td>${fmtDate(p.updatedAtMs || p.createdAtMs, { short: true })}</td>
              <td><a class="btn btn-sm" href="#/admin/pages?edit=${esc(p.id)}">Edit</a></td>
            </tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty">No pages yet — create your first one.</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>✅ Setup checklist</h2></div>
      <ul class="checklist">
        <li>✅ Firebase project connected (<code>kbal-school</code>)</li>
        <li>✅ Email/Password sign-in enabled in Firebase → Authentication</li>
        <li>✅ Admin e-mail allow-list: ${ADMIN_EMAILS.map((e) => `<code>${esc(e)}</code>`).join(", ")}</li>
        <li>${state.settings ? "✅" : "⏳"} Site settings saved</li>
        <li>${state.categories.length ? "✅" : "⏳"} Categories created</li>
        <li>${pages.length ? "✅" : "⏳"} Pages published</li>
        <li>${state.classes.length ? "✅" : "⏳"} Classes created</li>
      </ul>
      <p class="form-note">Rules for Firestore &amp; Storage are included in the project files (<code>firestore.rules</code>, <code>storage.rules</code>) — deploy them with <code>firebase deploy --only firestore:rules,storage</code>.</p>
    </div>`;

  function stat(num, label, icon) {
    return `<div class="stat"><div style="font-size:1.4rem">${icon}</div><div class="stat-num">${num}</div><div class="stat-lbl">${label}</div></div>`;
  }

  const seedBtn = host.querySelector("#seed-btn");
  if (seedBtn) seedBtn.onclick = async () => {
    seedBtn.disabled = true; seedBtn.textContent = "Creating…";
    try { await seedStarter(); toast("Starter content created — take a look!", "ok"); }
    catch (e) { toast(e.message, "error", "Could not seed"); seedBtn.disabled = false; seedBtn.textContent = "✨ Create starter content"; }
  };
}

// ============================================================
// CATEGORIES
// ============================================================
async function tabCategories(host) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>🗂️ Categories</h2><div class="spacer"></div>
        <button class="btn btn-primary" id="add-cat">+ Add category</button>
      </div>
      <div id="cat-list">${spinner()}</div>
    </div>`;

  host.querySelector("#add-cat").onclick = () => categoryModal(null, render);
  await render();

  async function render() {
    const el = host.querySelector("#cat-list");
    el.innerHTML = state.categories.length ? `
      <div class="table-wrap"><table class="list">
        <thead><tr><th>Order</th><th>Category</th><th>Description</th><th>Class</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${state.categories.map((c) => `
          <tr>
            <td>${c.order ?? "—"}</td>
            <td><b>${esc(c.icon || "📁")} ${esc(c.name)}</b></td>
            <td class="form-note">${esc((c.description || "").slice(0, 70))}</td>
            <td>${c.classId ? `<span class="chip">${esc(classOf(c.classId)?.name || "—")}</span>` : `<span class="chip gray">All</span>`}</td>
            <td>${c.hidden ? `<span class="chip amber">Hidden</span>` : `<span class="chip green">Live</span>`}</td>
            <td style="text-align:right;white-space:nowrap">
              <a class="btn btn-sm" href="#/category/${esc(c.id)}">View</a>
              <button class="btn btn-sm" data-edit="${esc(c.id)}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(c.id)}">Delete</button>
            </td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><span class="empty-ico">🗂️</span>No categories yet. Add your first one — e.g. “Mathematics”, “Science”, “News”.</div>`;

    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => categoryModal(categoryOf(b.dataset.edit), render)));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (await confirmBox(`Delete the category “${categoryOf(b.dataset.del)?.name}”? Its pages will stay but become uncategorised.`)) {
        await deleteDoc(doc(db, "categories", b.dataset.del)).catch((e) => toast(e.message, "error"));
        toast("Category deleted.", "ok");
      }
    }));
  }
}

function categoryModal(cat, onDone) {
  const isNew = !cat;
  const c = cat || { name: "", icon: "📁", description: "", order: state.categories.length + 1, classId: "", hidden: false };
  openModal({
    title: isNew ? "➕ Add category" : "✏️ Edit category",
    body: `
      <div class="row">
        <div class="field"><label>Name *</label><input class="input" name="name" value="${esc(c.name)}" required /></div>
        <div class="field" style="max-width:120px"><label>Icon</label><input class="input" name="icon" value="${esc(c.icon || "📁")}" /></div>
      </div>
      <div class="field"><label>Description</label><textarea class="input" name="description" rows="2">${esc(c.description || "")}</textarea></div>
      <div class="row">
        <div class="field" style="max-width:130px"><label>Order</label><input class="input" name="order" type="number" value="${c.order ?? 1}" /></div>
        <div class="field"><label>Limit to class</label>
          <select class="input" name="classId">
            <option value="">Visible to everyone</option>
            ${state.classes.map((k) => `<option value="${esc(k.id)}" ${c.classId === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}
          </select>
        </div>
      </div>
      <label class="switch"><input type="checkbox" name="hidden" ${c.hidden ? "checked" : ""}/> Hidden from students (admins only)</label>`,
    footer: `<button class="btn" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="save">${isNew ? "Add category" : "Save changes"}</button>`,
    onMount(m) {
      m.querySelector('[data-x="cancel"]').onclick = closeModal;
      m.querySelector('[data-x="save"]').onclick = async () => {
        const name = m.querySelector('[name="name"]').value.trim();
        if (!name) return toast("Please enter a name.", "error");
        const data = {
          name,
          icon: m.querySelector('[name="icon"]').value.trim() || "📁",
          description: m.querySelector('[name="description"]').value.trim(),
          order: +m.querySelector('[name="order"]').value || 1,
          classId: m.querySelector('[name="classId"]').value || null,
          hidden: m.querySelector('[name="hidden"]').checked,
          updatedAt: serverTimestamp(),
        };
        try {
          if (isNew) await addDoc(collection(db, "categories"), { ...data, createdAt: serverTimestamp() });
          else await updateDoc(doc(db, "categories", cat.id), data);
          closeModal(); toast(isNew ? "Category added." : "Category saved.", "ok"); onDone();
        } catch (e) { toast(e.message, "error", "Save failed"); }
      };
    },
  });
}

// ============================================================
// PAGES
// ============================================================
export async function allPages() {
  try {
    const snap = await getDocs(collection(db, "pages"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.title).localeCompare(String(b.title)));
  } catch { return []; }
}

async function tabPages(host, editId) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>📄 Pages</h2><div class="spacer"></div>
        <button class="btn btn-primary" id="add-page">+ New page</button>
      </div>
      <div id="page-list">${spinner()}</div>
    </div>`;

  host.querySelector("#add-page").onclick = () => pageModal(null, render);
  await render();
  if (editId) {
    const p = (await allPages()).find((x) => x.id === editId);
    if (p) pageModal(p, render);
  }

  async function render() {
    const el = host.querySelector("#page-list");
    const pages = await allPages();
    el.innerHTML = pages.length ? `
      <div class="table-wrap"><table class="list">
        <thead><tr><th>Title</th><th>Category</th><th>Class</th><th>Blocks</th><th>Updated</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${pages.map((p) => `
          <tr>
            <td><b>${esc(p.title)}</b></td>
            <td>${esc(categoryOf(p.categoryId)?.name || "—")}</td>
            <td>${p.classId ? `<span class="chip">${esc(classOf(p.classId)?.name || "—")}</span>` : `<span class="chip gray">All</span>`}</td>
            <td>${(p.blocks || []).length}</td>
            <td class="form-note">${fmtDate(p.updatedAtMs || p.createdAtMs, { short: true, noTime: true })}</td>
            <td>${p.published === false ? `<span class="chip amber">Draft</span>` : `<span class="chip green">Live</span>`}</td>
            <td style="text-align:right;white-space:nowrap">
              <a class="btn btn-sm" href="#/page/${esc(p.id)}">View</a>
              <button class="btn btn-sm" data-edit="${esc(p.id)}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(p.id)}">Delete</button>
            </td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><span class="empty-ico">📄</span>No pages yet. Click “New page” to create one with text, images, files, videos and more.</div>`;

    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = async () => {
      const p = (await allPages()).find((x) => x.id === b.dataset.edit);
      pageModal(p, render);
    }));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (await confirmBox("Delete this page permanently?")) {
        await deleteDoc(doc(db, "pages", b.dataset.del)).catch((e) => toast(e.message, "error"));
        toast("Page deleted.", "ok");
      }
    }));
  }
}

function pageModal(page, onDone) {
  const isNew = !page;
  const p = page || {
    title: "", categoryId: state.categories[0]?.id || "", classId: "", order: 1,
    published: true, blocks: [], summary: "",
  };

  const modal = openModal({
    title: isNew ? "➕ New page" : "✏️ Edit page",
    wide: true,
    body: `
      <div class="row">
        <div class="field"><label>Title *</label><input class="input" name="title" value="${esc(p.title)}" required /></div>
        <div class="field"><label>Summary <span class="hint">(shown on cards)</span></label><input class="input" name="summary" value="${esc(p.summary || "")}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Category</label>
          <select class="input" name="categoryId">
            ${state.categories.map((c) => `<option value="${esc(c.id)}" ${p.categoryId === c.id ? "selected" : ""}>${esc(c.icon || "📁")} ${esc(c.name)}</option>`).join("")}
          </select></div>
        <div class="field"><label>Limit to class</label>
          <select class="input" name="classId">
            <option value="">Visible to everyone</option>
            ${state.classes.map((k) => `<option value="${esc(k.id)}" ${p.classId === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}
          </select></div>
        <div class="field" style="max-width:110px"><label>Order</label><input class="input" name="order" type="number" value="${p.order ?? 1}" /></div>
      </div>
      <label class="switch"><input type="checkbox" name="published" ${p.published !== false ? "checked" : ""}/> Published (visible to users)</label>
      <hr style="border:0;border-top:1px solid var(--border);margin:18px 0" />
      <div class="panel-head" style="margin-bottom:10px"><h3>🧱 Page content</h3></div>
      <div id="block-editor"></div>`,
    footer: `
      <button class="btn" data-x="cancel">Cancel</button>
      <button class="btn btn-primary" data-x="save">${isNew ? "Create page" : "Save changes"}</button>`,
    onMount(m) {
      const editor = new BlockEditor(m.querySelector("#block-editor"), p.blocks || []);
      m.querySelector('[data-x="cancel"]').onclick = closeModal;
      m.querySelector('[data-x="save"]').onclick = async (e) => {
        const btn = e.currentTarget;
        const title = m.querySelector('[name="title"]').value.trim();
        if (!title) return toast("Please enter a title.", "error");
        btn.disabled = true; btn.textContent = "Saving…";
        const data = {
          title,
          summary: m.querySelector('[name="summary"]').value.trim(),
          categoryId: m.querySelector('[name="categoryId"]').value || null,
          classId: m.querySelector('[name="classId"]').value || null,
          order: +m.querySelector('[name="order"]').value || 1,
          published: m.querySelector('[name="published"]').checked,
          blocks: editor.value,
          authorName: state.profile?.displayName || "",
          updatedAt: serverTimestamp(),
          updatedAtMs: Date.now(),
        };
        try {
          if (isNew) await addDoc(collection(db, "pages"), { ...data, createdAt: serverTimestamp(), createdAtMs: Date.now() });
          else await updateDoc(doc(db, "pages", page.id), data);
          closeModal(); toast(isNew ? "Page created." : "Page saved.", "ok"); onDone();
        } catch (err) { toast(err.message, "error", "Save failed"); btn.disabled = false; btn.textContent = "Save changes"; }
      };
    },
  });
  return modal;
}

// ============================================================
// CLASSES
// ============================================================
async function tabClasses(host) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>🎓 Classes</h2><div class="spacer"></div>
        <button class="btn btn-primary" id="add-class">+ Add class</button>
      </div>
      <div id="class-list">${spinner()}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>💡 How classes work</h2></div>
      <p class="form-note">Every class gets its own space: pages, announcements and a private class chat.
      A student picks (or gets assigned) a class when signing in, and from then on class-only content
      appears in their sidebar, home page and chats. Students can join a class with its <b>join code</b> from “My account”.</p>
    </div>`;

  host.querySelector("#add-class").onclick = () => classModal(null, render);
  await render();

  async function render() {
    const el = host.querySelector("#class-list");
    const users = await allUsers();
    el.innerHTML = state.classes.length ? `
      <div class="table-wrap"><table class="list">
        <thead><tr><th>Class</th><th>Teacher</th><th>Room</th><th>Code</th><th>Students</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${state.classes.map((k) => {
          const count = users.filter((u) => u.classId === k.id).length;
          return `
          <tr>
            <td><b>${esc(k.icon || "🎓")} ${esc(k.name)}</b><div class="form-note">${esc((k.description || "").slice(0, 60))}</div></td>
            <td>${esc(k.teacher || "—")}</td>
            <td>${esc(k.room || "—")}</td>
            <td><code>${esc(k.code || "—")}</code></td>
            <td><span class="chip">${count}</span></td>
            <td style="text-align:right;white-space:nowrap">
              <a class="btn btn-sm" href="#/class/${esc(k.id)}">Open</a>
              <a class="btn btn-sm" href="#/chat/${esc("room_class_" + k.id)}">Chat</a>
              <button class="btn btn-sm" data-edit="${esc(k.id)}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(k.id)}">Delete</button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : `<div class="empty"><span class="empty-ico">🎓</span>No classes yet — add one to give students their own space.</div>`;

    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => classModal(classOf(b.dataset.edit), render)));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const k = classOf(b.dataset.del);
      if (await confirmBox(`Delete the class “${k?.name}”? Students will lose access to its pages and chat.`)) {
        await deleteDoc(doc(db, "classes", b.dataset.del)).catch((e) => toast(e.message, "error"));
        toast("Class deleted.", "ok");
      }
    }));
  }
}

function classModal(cls, onDone) {
  const isNew = !cls;
  const c = cls || { name: "", icon: "🎓", color: "#2563eb", teacher: "", room: "", code: "", description: "", order: state.classes.length + 1 };
  openModal({
    title: isNew ? "➕ Add class" : "✏️ Edit class",
    body: `
      <div class="row">
        <div class="field"><label>Name *</label><input class="input" name="name" value="${esc(c.name)}" placeholder="Grade 10 — A" /></div>
        <div class="field" style="max-width:110px"><label>Icon</label><input class="input" name="icon" value="${esc(c.icon || "🎓")}" /></div>
      </div>
      <div class="field"><label>Description</label><textarea class="input" name="description" rows="2">${esc(c.description || "")}</textarea></div>
      <div class="row">
        <div class="field"><label>Teacher</label><input class="input" name="teacher" value="${esc(c.teacher || "")}" /></div>
        <div class="field" style="max-width:120px"><label>Room</label><input class="input" name="room" value="${esc(c.room || "")}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Join code <span class="hint">(students enter this to join)</span></label><input class="input" name="code" value="${esc(c.code || "")}" placeholder="e.g. MATH10A" /></div>
        <div class="field" style="max-width:110px"><label>Colour</label><input type="color" name="color" value="${esc(c.color || "#2563eb")}" style="width:100%" /></div>
        <div class="field" style="max-width:100px"><label>Order</label><input class="input" name="order" type="number" value="${c.order ?? 1}" /></div>
      </div>`,
    footer: `<button class="btn" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="save">${isNew ? "Add class" : "Save"}</button>`,
    onMount(m) {
      m.querySelector('[data-x="cancel"]').onclick = closeModal;
      m.querySelector('[data-x="save"]').onclick = async () => {
        const name = m.querySelector('[name="name"]').value.trim();
        if (!name) return toast("Please enter a class name.", "error");
        const data = {
          name,
          icon: m.querySelector('[name="icon"]').value.trim() || "🎓",
          description: m.querySelector('[name="description"]').value.trim(),
          teacher: m.querySelector('[name="teacher"]').value.trim(),
          room: m.querySelector('[name="room"]').value.trim(),
          code: m.querySelector('[name="code"]').value.trim(),
          color: m.querySelector('[name="color"]').value,
          order: +m.querySelector('[name="order"]').value || 1,
          updatedAt: serverTimestamp(),
        };
        try {
          if (isNew) await addDoc(collection(db, "classes"), { ...data, createdAt: serverTimestamp() });
          else await updateDoc(doc(db, "classes", cls.id), data);
          closeModal(); toast(isNew ? "Class added." : "Class saved.", "ok"); onDone();
        } catch (e) { toast(e.message, "error", "Save failed"); }
      };
    },
  });
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
async function tabAnnouncements(host) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>📣 Announcements</h2><div class="spacer"></div>
        <button class="btn btn-primary" id="add-ann">+ New announcement</button>
      </div>
      <div id="ann-list">${spinner()}</div>
    </div>`;

  host.querySelector("#add-ann").onclick = () => annModal(null, render);
  await render();

  async function render() {
    const el = host.querySelector("#ann-list");
    el.innerHTML = state.announcements.length ? `
      <div class="table-wrap"><table class="list">
        <thead><tr><th>Title</th><th>Body</th><th>Audience</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${state.announcements.map((a) => `
          <tr>
            <td><b>${esc(a.title)}</b></td>
            <td class="form-note">${esc((a.body || "").slice(0, 70))}</td>
            <td>${a.classId ? `<span class="chip">${esc(classOf(a.classId)?.name || "—")}</span>` : `<span class="chip gray">Everyone</span>`}</td>
            <td class="form-note">${fmtDate(a.atMs, { short: true, noTime: true })}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-sm" data-edit="${esc(a.id)}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(a.id)}">Delete</button>
            </td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><span class="empty-ico">📣</span>No announcements yet.</div>`;

    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => annModal(state.announcements.find((a) => a.id === b.dataset.edit), render)));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (await confirmBox("Delete this announcement?")) {
        await deleteDoc(doc(db, "announcements", b.dataset.del)).catch((e) => toast(e.message, "error"));
        toast("Announcement deleted.", "ok");
      }
    }));
  }
}

function annModal(ann, onDone) {
  const isNew = !ann;
  const a = ann || { title: "", body: "", classId: "" };
  openModal({
    title: isNew ? "➕ New announcement" : "✏️ Edit announcement",
    body: `
      <div class="field"><label>Title *</label><input class="input" name="title" value="${esc(a.title)}" /></div>
      <div class="field"><label>Message</label><textarea class="input" name="body" rows="4">${esc(a.body || "")}</textarea></div>
      <div class="field"><label>Audience</label>
        <select class="input" name="classId">
          <option value="">Everyone</option>
          ${state.classes.map((k) => `<option value="${esc(k.id)}" ${a.classId === k.id ? "selected" : ""}>${esc(k.name)} only</option>`).join("")}
        </select></div>`,
    footer: `<button class="btn" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="save">${isNew ? "Publish" : "Save"}</button>`,
    onMount(m) {
      m.querySelector('[data-x="cancel"]').onclick = closeModal;
      m.querySelector('[data-x="save"]').onclick = async () => {
        const title = m.querySelector('[name="title"]').value.trim();
        if (!title) return toast("Please enter a title.", "error");
        const data = {
          title,
          body: m.querySelector('[name="body"]').value.trim(),
          classId: m.querySelector('[name="classId"]').value || null,
          atMs: ann?.atMs || Date.now(),
          updatedAt: serverTimestamp(),
        };
        try {
          if (isNew) {
            // goes through the shared engine → fans out a notification to every device
            await createAnnouncement({
              title,
              body: data.body,
              classId: data.classId,
            });
          } else {
            await updateDoc(doc(db, "announcements", ann.id), data);
          }
          closeModal(); toast(isNew ? "Announcement published — everyone was notified." : "Saved.", "ok"); onDone();
        } catch (e) { toast(e.message, "error"); }
      };
    },
  });
}

// ============================================================
// USERS
// ============================================================
async function allUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
  } catch { return []; }
}

async function tabUsers(host) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>👥 Users</h2><div class="spacer"></div>
        <button class="btn" id="how-add">ℹ️ How to create a new account</button>
        <button class="btn" id="refresh-users">↻ Refresh</button>
      </div>
      <div id="user-list">${spinner()}</div>
    </div>`;

  host.querySelector("#refresh-users").onclick = render;
  host.querySelector("#how-add").onclick = () => openModal({
    title: "Creating new accounts",
    body: `
      <p>Accounts live in <b>Firebase → Authentication</b>. To add a student, teacher or admin:</p>
      <ol style="padding-left:20px;line-height:2">
        <li>Open the <a href="https://console.firebase.google.com/project/kbal-school/authentication/users" target="_blank" rel="noopener">Firebase Authentication → Users</a> page.</li>
        <li>Click <b>Add user</b> → enter their email and a password.</li>
        <li>They sign in on this site — their profile is created automatically.</li>
        <li>Then come back here to give them a <b>role</b> (student / teacher / admin) and a <b>class</b>.</li>
      </ol>
      <p class="form-note">Admins can also be granted by adding their email to the admin allow-list in <b>Site settings</b>.</p>`,
    footer: `<button class="btn btn-primary" data-x="ok">Got it</button>`,
    onMount(m) { m.querySelector('[data-x="ok"]').onclick = closeModal; },
  });

  await render();

  async function render() {
    const el = host.querySelector("#user-list");
    const users = await allUsers();
    el.innerHTML = users.length ? `
      <div class="table-wrap"><table class="list">
        <thead><tr><th>User</th><th>Role</th><th>Class</th><th>📣 Announce</th><th>Joined</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${users.map((u) => `
          <tr data-uid="${esc(u.id)}">
            <td>
              <b>${esc(u.displayName || "Member")}</b>
              <div class="form-note">${esc(u.email || "")}</div>
            </td>
            <td>
              <select class="input" data-role style="min-width:120px">
                ${["student", "teacher", "admin"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
              </select>
            </td>
            <td>
              <select class="input" data-class style="min-width:140px">
                <option value="">— none —</option>
                ${state.classes.map((k) => `<option value="${esc(k.id)}" ${u.classId === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}
              </select>
            </td>
            <td title="Allow this user to publish announcements (and notify everyone)">
              <label class="switch" style="margin:0">
                <input type="checkbox" data-announce ${u.canAnnounce === true ? "checked" : ""} ${u.role === "admin" ? "disabled" : ""}/>
                <span class="switch-text">${u.role === "admin" ? "always" : "allow"}</span>
              </label>
            </td>
            <td class="form-note">${u.createdAt ? fmtDate(u.createdAt, { short: true, noTime: true }) : "—"}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-sm btn-primary" data-save>Save</button>
              <button class="btn btn-sm" data-reset>Reset pw</button>
              <button class="btn btn-sm btn-danger" data-del>Delete</button>
            </td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><span class="empty-ico">👥</span>No users yet. Create accounts in Firebase Authentication — they appear here after their first sign-in.</div>`;

    el.querySelectorAll("tr[data-uid]").forEach((tr) => {
      const uid = tr.dataset.uid;
      const u = users.find((x) => x.id === uid);
      tr.querySelector("[data-save]").onclick = async () => {
        const role = tr.querySelector("[data-role]").value;
        const classId = tr.querySelector("[data-class]").value || null;
        const canAnnounce = role === "admin" ? true : tr.querySelector("[data-announce]").checked;
        try {
          await updateDoc(doc(db, "users", uid), { role, classId, canAnnounce, updatedAt: serverTimestamp() });
          toast(`${u.displayName || "User"} updated.`, "ok");
          if (uid === state.user.uid) await updateProfile({ role, classId, canAnnounce });
        } catch (e) { toast(e.message, "error"); }
      };
      tr.querySelector("[data-reset]").onclick = async () => {
        if (!u.email) return toast("This user has no email on file.", "error");
        try {
          const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          const { auth } = await import("../firebase.js");
          await sendPasswordResetEmail(auth, u.email);
          toast("Password reset email sent.", "ok");
        } catch (e) { toast(e.message, "error"); }
      };
      tr.querySelector("[data-del]").onclick = async () => {
        if (uid === state.user.uid) return toast("You cannot delete your own account here.", "error");
        if (await confirmBox(`Delete ${u.displayName || "this user"}'s profile? They can still sign in, but their profile will be recreated.`)) {
          try { await deleteDoc(doc(db, "users", uid)); toast("Profile deleted.", "ok"); }
          catch (e) { toast(e.message, "error"); }
        }
      };
    });
  }
}

// ============================================================
// DATABASE — read-only live browser of the Firestore data
// ============================================================
const DB_COLLECTIONS = [
  { id: "site", label: "Site settings", icon: "🏠", hint: "Name, logo, announcement bar, contact info" },
  { id: "categories", label: "Categories", icon: "🗂️", hint: "Folder groups shown on Browse" },
  { id: "pages", label: "Pages", icon: "📄", hint: "All page content (blocks, files, images)" },
  { id: "classes", label: "Classes", icon: "🎓", hint: "Class groups students join" },
  { id: "announcements", label: "Announcements", icon: "📣", hint: "Posts that notify everyone" },
  { id: "users", label: "Users", icon: "👥", hint: "Profiles: role, class, theme, permissions" },
  { id: "chats", label: "Chats", icon: "💬", hint: "Chat rooms (each contains messages)" },
];

async function tabDatabase(host) {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>🗄️ Database</h2><div class="spacer"></div>
        <input class="input" id="db-search" placeholder="🔎 Filter documents…" style="max-width:240px" />
        <button class="btn" id="db-refresh">↻ Refresh</button>
      </div>
      <p class="form-note">
        Live view of your Firebase <b>Firestore</b> database (project <code>kbal-school</code>).
        Read-only — content is edited from the tabs above.
      </p>
      <div id="db-stats" class="form-note"></div>
      <div id="db-list" style="margin-top:12px">${spinner()}</div>
    </div>`;

  // fetch every collection once; filtering afterwards is instant (no network)
  let CACHE = null; // { byId: { [collectionId]: { docs, err } }, at: Date }

  host.querySelector("#db-refresh").onclick = () => load(true);
  host.querySelector("#db-search").addEventListener("input", (e) => paint(e.target.value));
  await load(false);

  async function load(force) {
    if (CACHE && !force) return CACHE;
    const el = host.querySelector("#db-list");
    if (el) el.innerHTML = spinner();
    const byId = {};
    for (const c of DB_COLLECTIONS) {
      let docs = [], err = null;
      try {
        const snap = await getDocs(collection(db, c.id));
        docs = snap.docs.map((d) => ({ __id: d.id, ...d.data() }));
      } catch (e) { err = e.message; }
      // chat rooms → message counts
      if (c.id === "chats" && !err) {
        for (const r of docs) {
          try { r.__msgs = (await getDocs(collection(db, "chats", r.__id, "messages"))).size; }
          catch { r.__msgs = "?"; }
        }
      }
      // precompute a lowercase haystack so typing is instant
      for (const d of docs) {
        try { d.__hay = (d.__id + " " + JSON.stringify(prettyDoc(d))).toLowerCase(); }
        catch { d.__hay = String(d.__id).toLowerCase(); }
      }
      byId[c.id] = { docs, err };
    }
    CACHE = { byId, at: new Date() };
    paint(host.querySelector("#db-search")?.value || "");
    return CACHE;
  }

  function paint(filter) {
    const el = host.querySelector("#db-list");
    const stats = host.querySelector("#db-stats");
    if (!el || !CACHE) return;
    const f = (filter || "").trim().toLowerCase();
    let shown = 0, total = 0, matchedCollections = 0;
    const sections = [];

    for (const c of DB_COLLECTIONS) {
      const { docs, err } = CACHE.byId[c.id];
      total += docs.length;
      const matched = f ? docs.filter((d) => d.__hay.includes(f)) : docs;
      if (f && !matched.length && !err) continue;
      matchedCollections++;
      shown += matched.length;

      sections.push(`
        <details ${f || err ? "open" : ""} style="border:1px solid var(--border);border-radius:12px;margin-bottom:10px;background:var(--panel);padding:8px 14px">
          <summary style="cursor:pointer;font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span>${c.icon}</span>
            <code>/${esc(c.id)}</code>
            <span class="form-note" style="font-weight:400">— ${esc(c.hint)}</span>
            <span class="chip" style="margin-left:auto">${err ? "⚠️" : (f ? matched.length + " / " + docs.length : docs.length) + " docs"}</span>
          </summary>
          ${err
            ? `<p class="form-note" style="color:var(--danger);margin-top:8px">${esc(err)}</p>`
            : docs.length
              ? `<div style="margin-top:10px;display:grid;gap:8px">${matched.map((d) => docRow(c, d)).join("")}</div>`
              : `<p class="form-note" style="margin-top:8px">Empty — no documents yet.</p>`}
        </details>`);
    }

    stats.innerHTML = f
      ? `🔎 “${esc(filter)}” → <b>${shown} documents</b> in ${matchedCollections} of ${DB_COLLECTIONS.length} collections (${total} total) · updated ${esc(CACHE.at.toLocaleString())}`
      : `📁 ${DB_COLLECTIONS.length} collections · <b>${total} documents</b> · updated ${esc(CACHE.at.toLocaleString())}`;
    el.innerHTML = sections.join("") || `<div class="empty"><span class="empty-ico">🔎</span>No documents match “${esc(filter)}”.</div>`;
  }

  function docRow(c, d) {
    const label = d.title || d.name || d.displayName || d.siteName || d.__id;
    const sub = [
      d.email ? esc(d.email) : "",
      d.role ? `role: <b>${esc(d.role)}</b>` : "",
      d.canAnnounce === true ? "📣 can announce" : "",
      d.classId ? "class: " + esc(classOf(d.classId)?.name || d.classId) : "",
      d.__msgs !== undefined ? `💬 ${d.__msgs} messages` : "",
      d.published === false ? "🚧 unpublished" : "",
    ].filter(Boolean).join(" · ");
    return `
      <details style="border:1px dashed var(--border);border-radius:9px;padding:6px 10px">
        <summary style="cursor:pointer;font-size:.92rem">
          <code>${esc(d.__id)}</code> — <b>${esc(String(label).slice(0, 70))}</b>
          ${sub ? `<div class="form-note" style="font-size:.8rem">${sub}</div>` : ""}
        </summary>
        <pre style="white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:.78rem;max-height:340px;overflow:auto;margin-top:8px">${esc(prettyDoc(d))}</pre>
      </details>`;
  }
}

function prettyDoc(d) {
  const out = {};
  Object.keys(d).sort().forEach((k) => {
    const v = d[k];
    if (k === "__hay") {
      return;                                        // internal search index — never show
    } else if (k === "__id" || k === "__msgs") {
      out[k] = v;                                    // doc id / message count helpers
    } else if (k === "blocks" && Array.isArray(v)) {
      out.blocks = v.map((b) => `[${b.type}] ${String(b.text || b.url || b.title || "").slice(0, 90)}`);
    } else if (v && typeof v.toDate === "function") {
      try { out[k] = v.toDate().toISOString(); } catch { out[k] = "(timestamp)"; }
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = v;                                    // plain nested object
    } else if (typeof v === "string" && v.length > 300) {
      out[k] = v.slice(0, 300) + "…";
    } else {
      out[k] = v;
    }
  });
  try { return JSON.stringify(out, null, 2); } catch { return String(out); }
}

// ============================================================
// SITE SETTINGS
// ============================================================
async function tabSettings(host) {
  const s = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  host.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>⚙️ Site settings</h2></div>
      <form id="settings-form">
        <div class="row">
          <div class="field"><label>Site name</label><input class="input" name="siteName" value="${esc(s.siteName)}" /></div>
          <div class="field"><label>Tagline</label><input class="input" name="tagline" value="${esc(s.tagline || "")}" /></div>
        </div>
        <div class="field"><label>Home intro <span class="hint">(optional paragraph under the tagline)</span></label>
          <textarea class="input" name="homeIntro" rows="2">${esc(s.homeIntro || "")}</textarea></div>

        <div class="row">
          <div class="field"><label>Logo</label>
            <div class="row">
              <input class="input" name="logoUrl" value="${esc(s.logoUrl || "")}" placeholder="https://…" />
              <button type="button" class="btn" data-up="logoUrl" style="flex:0 0 auto">⬆ Upload</button>
            </div>
            ${s.logoUrl ? `<img src="${esc(s.logoUrl)}" style="max-height:60px;margin-top:8px;border-radius:9px;border:1px solid var(--border)"/>` : ""}
          </div>
          <div class="field"><label>Home cover image</label>
            <div class="row">
              <input class="input" name="coverUrl" value="${esc(s.coverUrl || "")}" placeholder="https://…" />
              <button type="button" class="btn" data-up="coverUrl" style="flex:0 0 auto">⬆ Upload</button>
            </div>
            ${s.coverUrl ? `<img src="${esc(s.coverUrl)}" style="max-height:60px;margin-top:8px;border-radius:9px;border:1px solid var(--border)"/>` : ""}
          </div>
        </div>

        <div class="row">
          <div class="field"><label>Top announcement bar</label><input class="input" name="announcement" value="${esc(s.announcement || "")}" placeholder="e.g. exams start on Sunday" /></div>
          <div class="field" style="max-width:220px"><label>Announcement link</label><input class="input" name="announcementLink" value="${esc(s.announcementLink || "")}" placeholder="https://…" /></div>
        </div>

        <div class="row">
          <div class="field"><label>Contact email</label><input class="input" name="contactEmail" value="${esc(s.contactEmail || "")}" /></div>
          <div class="field"><label>Contact phone</label><input class="input" name="contactPhone" value="${esc(s.contactPhone || "")}" /></div>
          <div class="field"><label>Address</label><input class="input" name="contactAddress" value="${esc(s.contactAddress || "")}" /></div>
        </div>

        <div class="field"><label>Footer text</label><input class="input" name="footerText" value="${esc(s.footerText || "")}" /></div>

        <div class="field"><label>Admin emails <span class="hint">(comma separated — these accounts always get admin rights)</span></label>
          <textarea class="input" name="adminEmails" rows="2">${esc((s.adminEmails || ADMIN_EMAILS).join(", "))}</textarea></div>

        <div class="field">
          <label>Home page sections</label>
          <label class="switch"><input type="checkbox" name="showAnnouncements" ${s.showAnnouncements !== false ? "checked" : ""}/> Show announcements on home</label>
          <label class="switch" style="margin-top:8px"><input type="checkbox" name="showCategories" ${s.showCategories !== false ? "checked" : ""}/> Show categories on home</label>
        </div>

        <button class="btn btn-primary" type="submit">💾 Save settings</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>🎨 Default appearance for guests</h2></div>
      <p class="form-note">Visitors choose their own theme in <b>My account → Appearance</b>. The site honours their saved theme everywhere.</p>
      <button class="btn" id="preview-dark">🌙 Preview dark mode</button>
      <button class="btn" id="preview-light">☀️ Preview light mode</button>
    </div>`;

  host.querySelectorAll("[data-up]").forEach((btn) => {
    btn.onclick = async () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          const res = await uploadFile(input.files[0], "site");
          host.querySelector(`[name="${btn.dataset.up}"]`).value = res.url;
          toast("Uploaded — press Save settings to apply.", "ok");
        } catch (e) { toast(e.message, "error"); }
      };
      input.click();
    };
  });

  host.querySelector("#preview-dark").onclick = () => { document.documentElement.dataset.theme = "dark"; };
  host.querySelector("#preview-light").onclick = () => { document.documentElement.dataset.theme = "light"; };

  host.querySelector("#settings-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      siteName: f.siteName.value.trim() || "KBAL-School",
      tagline: f.tagline.value.trim(),
      homeIntro: f.homeIntro.value.trim(),
      logoUrl: f.logoUrl.value.trim(),
      coverUrl: f.coverUrl.value.trim(),
      announcement: f.announcement.value.trim(),
      announcementLink: f.announcementLink.value.trim(),
      contactEmail: f.contactEmail.value.trim(),
      contactPhone: f.contactPhone.value.trim(),
      contactAddress: f.contactAddress.value.trim(),
      footerText: f.footerText.value.trim(),
      adminEmails: f.adminEmails.value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      showAnnouncements: f.showAnnouncements.checked,
      showCategories: f.showCategories.checked,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "site", "main"), data, { merge: true });
      toast("Settings saved.", "ok");
    } catch (err) { toast(err.message, "error", "Save failed"); }
  };
}
