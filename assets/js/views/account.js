// ============================================================
// My account: profile, class, appearance (theme), security
// ============================================================
import { state, setTheme, getTheme, THEME_DEFAULTS, updateProfile, uploadFile, changePassword, sendReset } from "../store.js";
import { navigate } from "../router.js";
import { esc, toast, openModal, closeModal } from "../ui.js";

const ACCENTS = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#0f172a"];

export async function accountView(container) {
  if (!state.user) { navigate("/signin"); return; }
  const p = state.profile || {};
  const t = { ...THEME_DEFAULTS, ...(p.theme || getTheme()) };

  container.innerHTML = `
    <div class="page-head"><div><h1>⚙️ My account</h1><p class="form-note">Your profile, class and how the site looks for you.</p></div></div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">

      <div class="panel">
        <div class="panel-head"><h2>👤 Profile</h2></div>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
          <span class="avatar lg">${esc((p.displayName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span>
          <div>
            <b style="font-size:1.1rem">${esc(p.displayName || "Student")}</b>
            <div class="form-note">${esc(p.email || state.user.email || "")}</div>
            <div style="margin-top:6px">
              <span class="chip ${p.role === "admin" ? "" : "gray"}">${p.role === "admin" ? "🛡️ Admin" : p.role === "teacher" ? "👩‍🏫 Teacher" : "🎓 Student"}</span>
            </div>
          </div>
        </div>

        <form id="profile-form">
          <div class="field">
            <label>Display name</label>
            <input class="input" name="displayName" value="${esc(p.displayName || "")}" />
          </div>
          <div class="field">
            <label>Profile picture</label>
            <div class="row">
              <input class="input" name="photoUrl" value="${esc(p.photoUrl || "")}" placeholder="https://… or upload" />
              <button type="button" class="btn" id="upload-avatar" style="flex:0 0 auto">⬆ Upload</button>
            </div>
          </div>
          <div class="field">
            <label>My class</label>
            <select class="input" name="classId">
              <option value="">— No class —</option>
              ${state.classes.map((c) => `<option value="${esc(c.id)}" ${p.classId === c.id ? "selected" : ""}>${esc(c.icon || "🎓")} ${esc(c.name)}</option>`).join("")}
            </select>
            <div class="hint">Changing your class changes the class pages and chats you can see.</div>
          </div>
          <button class="btn btn-primary" type="submit">Save profile</button>
        </form>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>🎨 Appearance</h2></div>

        <div class="field">
          <label>Theme</label>
          <div class="segmented" data-theme-mode>
            ${["light", "dark", "system"].map((m) => `<button type="button" data-mode="${m}" class="${t.mode === m ? "active" : ""}">${m === "light" ? "☀️ Light" : m === "dark" ? "🌙 Dark" : "🖥 Auto"}</button>`).join("")}
          </div>
        </div>

        <div class="field">
          <label>Accent color</label>
          <div class="swatches" data-accent>
            ${ACCENTS.map((c) => `<button type="button" class="swatch ${t.accent === c ? "active" : ""}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
            <input type="color" value="${esc(t.accent)}" data-accent-custom title="Custom color" />
          </div>
        </div>

        <div class="field">
          <label>Text size — <b><span data-scale-out>${t.fontScale}</span>%</b></label>
          <input type="range" min="80" max="160" step="5" value="${t.fontScale}" data-scale />
          <div class="hint">Aa — the quick brown fox jumps over the lazy dog.</div>
        </div>

        <div class="field">
          <label>Font</label>
          <div class="segmented" data-font>
            ${[["system", "System"], ["serif", "Serif"], ["rounded", "Rounded"], ["accessible", "Accessible"]].map(([v, l]) => `<button type="button" data-font-v="${v}" class="${t.font === v ? "active" : ""}">${l}</button>`).join("")}
          </div>
        </div>

        <div class="field">
          <label>Layout density</label>
          <div class="segmented" data-density>
            ${["compact", "cozy", "comfortable"].map((d) => `<button type="button" data-density-v="${d}" class="${t.density === d ? "active" : ""}">${d[0].toUpperCase() + d.slice(1)}</button>`).join("")}
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>Corner roundness — <b><span data-radius-out>${t.radius}</span>px</b></label>
            <input type="range" min="0" max="26" value="${t.radius}" data-radius />
          </div>
          <div class="field">
            <label>Content width</label>
            <select class="input" data-width>
              ${["narrow", "normal", "wide"].map((w) => `<option ${t.width === w ? "selected" : ""}>${w}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="field">
          <label>Options</label>
          <label class="switch"><input type="checkbox" data-animations ${t.animations !== false ? "checked" : ""}/> Animations &amp; transitions</label>
          <label class="switch" style="margin-top:8px"><input type="checkbox" data-bg ${!t.reduceBg ? "checked" : ""}/> Decorative background</label>
          <label class="switch" style="margin-top:8px"><input type="checkbox" data-contrast ${t.contrast === "high" ? "checked" : ""}/> High contrast (accessibility)</label>
        </div>

        <div class="btn-group">
          <button class="btn btn-sm" id="reset-theme">↺ Reset to defaults</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>🔒 Security</h2></div>
        <form id="pw-form">
          <div class="field">
            <label>Current password</label>
            <input class="input" name="current" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label>New password</label>
            <input class="input" name="next" type="password" autocomplete="new-password" />
          </div>
          <div id="pw-error" class="form-error hidden"></div>
          <button class="btn btn-primary" type="submit">Change password</button>
          <button class="btn" type="button" id="reset-mail">✉ Email me a reset link</button>
        </form>
      </div>
    </div>`;

  // ---------------- profile form ----------------
  const form = container.querySelector("#profile-form");
  container.querySelector("#upload-avatar").onclick = async () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      if (!input.files[0]) return;
      try {
        const res = await uploadFile(input.files[0], "avatars");
        form.photoUrl.value = res.url;
        toast("Picture uploaded — press Save profile to apply.", "ok");
      } catch (e) { toast(e.message, "error"); }
    };
    input.click();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const displayName = form.displayName.value.trim();
    const photoUrl = form.photoUrl.value.trim();
    const classId = form.classId.value || null;
    try {
      await updateProfile({ displayName, photoUrl, classId });
      toast("Profile saved.", "ok");
    } catch (err) { toast(err.message, "error"); }
  };

  // ---------------- appearance ----------------
  const set = (patch) => { setTheme(patch); syncThemeUI(); };

  container.querySelectorAll("[data-theme-mode] button").forEach((b) => (b.onclick = () => set({ mode: b.dataset.mode })));
  container.querySelectorAll("[data-accent] [data-color]").forEach((b) => (b.onclick = () => set({ accent: b.dataset.color })));
  container.querySelector("[data-accent-custom]").oninput = (e) => set({ accent: e.target.value });
  container.querySelector("[data-scale]").oninput = (e) => set({ fontScale: +e.target.value });
  container.querySelectorAll("[data-font] button").forEach((b) => (b.onclick = () => set({ font: b.dataset.fontV })));
  container.querySelectorAll("[data-density] button").forEach((b) => (b.onclick = () => set({ density: b.dataset.densityV })));
  container.querySelector("[data-radius]").oninput = (e) => set({ radius: +e.target.value });
  container.querySelector("[data-width]").onchange = (e) => set({ width: e.target.value });
  container.querySelector("[data-animations]").onchange = (e) => set({ animations: e.target.checked });
  container.querySelector("[data-bg]").onchange = (e) => set({ reduceBg: !e.target.checked });
  container.querySelector("[data-contrast]").onchange = (e) => set({ contrast: e.target.checked ? "high" : "normal" });
  container.querySelector("#reset-theme").onclick = () => { setTheme({ ...THEME_DEFAULTS }); toast("Theme reset.", "ok"); };

  function syncThemeUI() {
    const cur = getTheme();
    container.querySelectorAll("[data-theme-mode] button").forEach((b) => b.classList.toggle("active", b.dataset.mode === cur.mode));
    container.querySelectorAll("[data-accent] [data-color]").forEach((b) => b.classList.toggle("active", b.dataset.color.toLowerCase() === String(cur.accent).toLowerCase()));
    container.querySelector("[data-accent-custom]").value = cur.accent;
    container.querySelector("[data-scale]").value = cur.fontScale;
    container.querySelector("[data-scale-out]").textContent = cur.fontScale;
    container.querySelectorAll("[data-font] button").forEach((b) => b.classList.toggle("active", b.dataset.fontV === cur.font));
    container.querySelectorAll("[data-density] button").forEach((b) => b.classList.toggle("active", b.dataset.densityV === cur.density));
    container.querySelector("[data-radius]").value = cur.radius;
    container.querySelector("[data-radius-out]").textContent = cur.radius;
    container.querySelector("[data-width]").value = cur.width;
    container.querySelector("[data-animations]").checked = cur.animations !== false;
    container.querySelector("[data-bg]").checked = !cur.reduceBg;
    container.querySelector("[data-contrast]").checked = cur.contrast === "high";
  }

  // ---------------- security ----------------
  const pwForm = container.querySelector("#pw-form");
  const pwErr = container.querySelector("#pw-error");
  pwForm.onsubmit = async (e) => {
    e.preventDefault();
    pwErr.classList.add("hidden");
    try {
      await changePassword(pwForm.next.value, pwForm.current.value);
      pwForm.reset();
      toast("Password updated.", "ok");
    } catch (err) {
      pwErr.textContent = err.message; pwErr.classList.remove("hidden");
    }
  };
  container.querySelector("#reset-mail").onclick = async () => {
    try { await sendReset(state.user.email); toast("Reset link sent to your email.", "ok"); }
    catch (err) { toast(err.message, "error"); }
  };
}
