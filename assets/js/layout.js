// ============================================================
// Chrome: topbar user menu, sidebar (categories), footer, bar
// ============================================================
import {
  state, subscribe, isAdmin, isSignedIn, signOutUser, visibleCategories, visibleTodos, myClass, classOf, updateProfile,
  canAnnounce, createAnnouncement, markNotificationRead, markAllNotificationsRead,
  addPersonalTodo, updatePersonalTodo, deletePersonalTodo, togglePersonalTodo,
} from "./store.js";
import { navigate, currentPath } from "./router.js";
import { esc, initials, openModal, closeModal, toast, fmtDate } from "./ui.js";

export function initLayout() {
  wireNavToggle();
  wireSearch();
  subscribe(renderAll);
  renderAll(state);
  window.addEventListener("hashchange", () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("user-menu")?.remove();
  });
}

function renderAll() {
  renderTopbar();
  renderSidebar();
  renderAnnounce();
  renderFooter();
}

// ---------------------------------------------------------------- topbar
function renderTopbar() {
  const s = state.settings;
  document.getElementById("brand-name").textContent = s?.siteName || "KBAL-School";
  const logo = document.getElementById("brand-logo");
  if (s?.logoUrl) { logo.src = s.logoUrl; logo.classList.remove("hidden"); }
  else logo.classList.add("hidden");

  const area = document.getElementById("user-area");
  if (isSignedIn()) {
    const name = state.profile?.displayName || state.user?.displayName || "Me";
    const unread = state.unread || 0;
    area.innerHTML = `
      <button class="icon-btn bell-btn" id="bell-btn" title="Notifications" aria-label="Notifications">
        🔔${unread > 0 ? `<span class="bell-badge">${unread > 99 ? "99+" : unread}</span>` : ""}
      </button>
      ${canAnnounce() ? `<button class="btn btn-primary btn-sm" id="new-ann-btn" title="Publish an announcement">📣 New announcement</button>` : ""}
      <button class="user-btn" id="user-btn">
        <span class="avatar">${esc(initials(name))}</span>
        <span class="user-name">${esc(name.split(" ")[0])}</span>
      </button>`;
    area.querySelector("#user-btn").onclick = (e) => { e.stopPropagation(); toggleUserMenu(); };
    area.querySelector("#bell-btn").onclick = (e) => { e.stopPropagation(); toggleBell(); };
    const annBtn = area.querySelector("#new-ann-btn");
    if (annBtn) annBtn.onclick = (e) => { e.stopPropagation(); openAnnouncementComposer(); };
  } else {
    area.innerHTML = `<a class="btn btn-primary btn-sm" href="#/signin">Sign in</a>`;
  }
}

// ---------------------------------------------------------------- notifications bell
function toggleBell() {
  const existing = document.getElementById("bell-menu");
  if (existing) { existing.remove(); return; }
  const notes = state.notifications || [];
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.id = "bell-menu";
  menu.style.position = "fixed";
  menu.style.top = "62px";
  menu.style.right = "18px";
  menu.style.width = "340px";
  menu.style.maxHeight = "70vh";
  menu.style.overflowY = "auto";
  menu.innerHTML = `
    <div class="menu-head">
      <b>🔔 Notifications</b>
      ${notes.length ? `<button class="btn btn-sm" id="read-all-btn" style="margin-left:auto">Mark all read</button>` : ""}
    </div>
    ${notes.length
      ? notes.map((n) => `
        <div class="bell-item" data-note="${esc(n.id)}" style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer">
          <span style="font-size:1.1rem">📣</span>
          <span style="flex:1;min-width:0">
            <b style="display:block">${esc(n.title || "Announcement")}</b>
            <span style="color:var(--muted);font-size:.86rem;display:block;white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis;max-height:3.4em">${esc(n.body || "")}</span>
            <span style="color:var(--muted);font-size:.76rem">${esc(n.authorName || "")} ${n.atMs ? "· " + esc(new Date(n.atMs).toLocaleString()) : ""}</span>
          </span>
        </div>`).join("")
      : `<div style="padding:18px 14px;color:var(--muted);font-size:.9rem;text-align:center">No notifications yet.<br>📣 New announcements will ring here.</div>`}`;
  document.body.appendChild(menu);

  menu.querySelectorAll(".bell-item").forEach((el) => {
    el.onclick = async () => {
      await markNotificationRead(el.dataset.note);
      el.style.opacity = ".45";
    };
  });
  const readAll = menu.querySelector("#read-all-btn");
  if (readAll) readAll.onclick = async () => { menu.remove(); await markAllNotificationsRead(); toast("All notifications cleared.", "ok"); };

  setTimeout(() => document.addEventListener("click", function away(ev) {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", away); }
  }), 0);
}

// ---------------------------------------------------------------- announcement composer
export function openAnnouncementComposer() {
  if (!isSignedIn()) { toast("Sign in first.", "error"); return; }
  if (!canAnnounce()) { toast("You do not have permission to publish announcements.", "error"); return; }
  openModal({
    title: "📣 New announcement",
    body: `
      <form id="ann-form">
        <div class="field">
          <label>Title *</label>
          <input class="input" name="title" required maxlength="120" placeholder="e.g. Exam schedule published" autofocus />
        </div>
        <div class="field">
          <label>Message</label>
          <textarea class="input" name="body" rows="5" maxlength="2000" placeholder="Write what everyone should know…"></textarea>
        </div>
        <div class="field">
          <label>Audience</label>
          ${classSelectHtml("", { allowAll: true, name: "classId" })}
          <div class="form-note">🔔 Every signed-in user in the selected audience gets a notification on this device.</div>
        </div>
        <div class="field">
          <label>Publish date & time <span class="hint">(leave blank to publish now)</span></label>
          <input class="input" name="scheduledAt" type="datetime-local" />
        </div>
        <div id="ann-err" class="form-note" style="color:var(--danger)"></div>
      </form>`,
    footer: `
      <button class="btn" data-x="cancel">Cancel</button>
      <button class="btn btn-primary" data-x="send">📣 Publish &amp; notify</button>`,
    onMount(modal) {
      modal.querySelector('[data-x="cancel"]').onclick = closeModal;
      modal.querySelector('[data-x="send"]').onclick = async () => {
        const form = modal.querySelector("#ann-form");
        const errBox = modal.querySelector("#ann-err");
        const title = form.title.value.trim();
        if (!title) { errBox.textContent = "Please write a title."; form.title.focus(); return; }
        const btn = modal.querySelector('[data-x="send"]');
        btn.disabled = true;
        btn.textContent = "Publishing…";
        try {
          const scheduledInput = form.scheduledAt.value;
          const scheduledAt = scheduledInput ? new Date(scheduledInput).getTime() : null;
          await createAnnouncement({
            title,
            body: form.body.value.trim(),
            classId: form.classId.value || null,
            scheduledAt,
          });
          closeModal();
          const msg = scheduledAt
            ? "Announcement scheduled — it will publish automatically at the chosen time."
            : "Announcement published — everyone was notified.";
          toast(msg, "ok", "📣 Done");
          // re-render the current view so the new announcement shows up right away
          try { navigate(currentPath()); } catch {}
        } catch (e) {
          errBox.textContent = e.message || "Could not publish.";
          btn.disabled = false;
          btn.textContent = "📣 Publish & notify";
        }
      };
    },
  });
}

function toggleUserMenu() {
  const existing = document.getElementById("user-menu");
  if (existing) { existing.remove(); return; }
  const name = state.profile?.displayName || "Me";
  const email = state.profile?.email || state.user?.email || "";
  const cls = myClass();
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.id = "user-menu";
  menu.style.position = "fixed";
  menu.style.top = "62px";
  menu.style.right = "18px";
  menu.innerHTML = `
    <div class="menu-head">
      <b>${esc(name)}</b>
      <span>${esc(email)}</span>
      <span>${esc(cls ? "Class: " + cls.name : "No class assigned")}</span>
    </div>
    <a href="#/account">⚙️ My account &amp; theme</a>
    <a href="#/chat">💬 Chats</a>
    ${isAdmin() ? `<a href="#/admin">🛠️ Admin panel</a>` : ""}
    <div class="menu-sep"></div>
    <button id="signout-btn">🚪 Sign out</button>`;
  document.body.appendChild(menu);
  menu.querySelector("#signout-btn").onclick = async () => {
    menu.remove();
    try { await signOutUser(); navigate("/"); toast("Signed out.", "ok"); }
    catch (e) { toast(e.message, "error"); }
  };
  setTimeout(() => document.addEventListener("click", function away(ev) {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", away); }
  }), 0);
}

// ---------------------------------------------------------------- sidebar
function renderSidebar() {
  const el = document.getElementById("sidebar");
  const path = currentPath();
  const cats = visibleCategories();
  const admin = isAdmin();
  const cls = myClass();

  el.innerHTML = `
    <div class="side-section">
      <div class="side-title">Menu</div>
      <a class="side-link ${path === "/" ? "active" : ""}" href="#/"><span class="ico">🏠</span> Home</a>
      <a class="side-link ${path === "/browse" ? "active" : ""}" href="#/browse"><span class="ico">🗂️</span> Browse <span class="count">${cats.length}</span></a>
      ${isSignedIn() ? `
        <a class="side-link ${path.startsWith("/chat") ? "active" : ""}" href="#/chat"><span class="ico">💬</span> Chats</a>
        <a class="side-link ${path.startsWith("/account") ? "active" : ""}" href="#/account"><span class="ico">⚙️</span> My account</a>` : `
        <a class="side-link ${path === "/signin" ? "active" : ""}" href="#/signin"><span class="ico">🔑</span> Sign in</a>`}
      ${admin ? `<a class="side-link ${path.startsWith("/admin") ? "active" : ""}" href="#/admin"><span class="ico">🛠️</span> Admin panel</a>` : ""}
    </div>

    ${cls ? `
      <div class="side-section">
        <div class="side-title">My class</div>
        <a class="side-link ${path === "/class/" + cls.id ? "active" : ""}" href="#/class/${esc(cls.id)}">
          <span class="ico">${esc(cls.icon || "🎓")}</span> ${esc(cls.name)}
        </a>
      </div>` : ""}

    <div class="side-section">
      <div class="side-title">Categories</div>
      ${cats.length
        ? cats.map((c) => `
          <a class="side-link ${path === "/category/" + c.id ? "active" : ""}" href="#/category/${esc(c.id)}" title="${esc(c.description || c.name)}">
            <span class="ico">${esc(c.icon || "📁")}</span> ${esc(c.name)}
            ${c.classId ? `<span class="side-badge">${esc(classOf(c.classId)?.name || "Class")}</span>` : ""}
          </a>`).join("")
        : `<div style="padding:6px 12px;color:var(--muted);font-size:.88rem">No categories yet.</div>`}
    </div>

    <div class="side-section">
      <div class="side-title">✅ To-do lists</div>
      ${isSignedIn()
        ? `
          <div style="padding:6px 12px">
            ${visibleTodos().length
              ? `<ul style="padding:0;margin:0;list-style:none">
                 ${visibleTodos().map((t) => `
                   <li style="display:flex;gap:8px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--line);font-size:.9rem">
                     <input type="checkbox" data-pt-toggle="${esc(t.id)}" ${t.done ? "checked" : ""} style="margin:0" />
                     <span style="flex:1;min-width:0;${t.done ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(t.title)}</span>
                     ${t.source === "personal" ? `
                       <button class="btn btn-sm btn-danger" data-pt-del="${esc(t.id)}" style="padding:2px 6px;font-size:.75rem">✕</button>
                     ` : ""}
                     ${t.source === "global" && t.targetType === "admin" ? `<span class="side-badge" style="font-size:.65rem">Admin</span>` : ""}
                     ${t.dueAt ? `<span class="side-badge" style="font-size:.75rem">${fmtDate(t.dueAt, { short: true, noTime: true })}</span>` : ""}
                   </li>`).join("")}
               </ul>` : `<div style="padding:6px 12px;color:var(--muted);font-size:.88rem">No to-do items yet.</div>`}
            ${admin ? `<div style="margin-top:8px"><a class="btn btn-sm btn-primary" href="#/admin/todos" style="width:100%;text-align:center">Manage global to-dos</a></div>` : ""}
            <div style="margin-top:8px">
              <input class="input" id="pt-new-title" placeholder="New to-do…" style="width:70%;padding:6px 8px;font-size:.85rem" />
              <button class="btn btn-sm btn-primary" id="pt-add" style="width:28%;padding:6px 4px;font-size:.85rem">Add</button>
            </div>
          </div>`
        : `<div style="padding:6px 12px;color:var(--muted);font-size:.88rem">Sign in to see to-do lists.</div>`}
    </div>`;

  // ---- wire up personal to-do interactions ----
  wireSidebarTodos();
}

function wireSidebarTodos() {
  // toggle checkboxes
  document.querySelectorAll('[data-pt-toggle]').forEach((cb) => {
    cb.onclick = async () => {
      try { await togglePersonalTodo(cb.dataset.ptToggle, cb.checked); }
      catch (e) { cb.checked = !cb.checked; toast(e.message, "error"); }
    };
  });
  // delete buttons
  document.querySelectorAll('[data-pt-del]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm("Delete this to-do?")) {
        try { await deletePersonalTodo(btn.dataset.ptDel); toast("To-do deleted.", "ok"); }
        catch (e) { toast(e.message, "error"); }
      }
    };
  });
  // add button
  const addBtn = document.getElementById("pt-add");
  const titleInput = document.getElementById("pt-new-title");
  if (addBtn && titleInput) {
    addBtn.onclick = async () => {
      const title = titleInput.value.trim();
      if (!title) return;
      try {
        await addPersonalTodo({ title });
        titleInput.value = "";
        toast("To-do added.", "ok");
      } catch (e) { toast(e.message, "error"); }
    };
    titleInput.onkeydown = (e) => { if (e.key === "Enter") addBtn.onclick(); };
  }
}

// ---------------------------------------------------------------- announce
function renderAnnounce() {
  const bar = document.getElementById("announce-bar");
  const s = state.settings;
  if (s?.announcement) {
    bar.classList.remove("hidden");
    bar.innerHTML = `📣 ${esc(s.announcement)}${s.announcementLink ? ` — <a href="${esc(s.announcementLink)}" target="_blank" rel="noopener">Learn more</a>` : ""}`;
  } else bar.classList.add("hidden");
}

// ---------------------------------------------------------------- footer
function renderFooter() {
  const s = state.settings || {};
  document.getElementById("footer").innerHTML = `
    <div>${esc(s.footerText || "© KBAL-School")}</div>
    <div style="margin-top:6px">
      ${s.contactEmail ? `✉️ <a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a> &nbsp;` : ""}
      ${s.contactPhone ? `📞 <a href="tel:${esc(s.contactPhone)}">${esc(s.contactPhone)}</a> &nbsp;` : ""}
      ${s.contactAddress ? `📍 ${esc(s.contactAddress)}` : ""}
    </div>`;
}

// ---------------------------------------------------------------- misc
function wireNavToggle() {
  document.getElementById("nav-toggle").onclick = () =>
    document.getElementById("sidebar").classList.toggle("open");
}

function wireSearch() {
  const input = document.getElementById("global-search");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) navigate(`/search?q=${encodeURIComponent(input.value.trim())}`);
  });
}

/** Modal used across the app to pick one of the admin-managed classes. */
export function classSelectHtml(selected = "", { allowAll = true, name = "classId" } = {}) {
  return `<select class="input" name="${name}">
    ${allowAll ? `<option value="">All classes</option>` : `<option value="">— none —</option>`}
    ${state.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? "selected" : ""}>${esc(c.icon || "🎓")} ${esc(c.name)}</option>`).join("")}
  </select>`;
}
