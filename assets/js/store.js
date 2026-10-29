// ============================================================
// KBAL-School — central store: auth, Firestore data & theming
// ============================================================
import { auth, db, ADMIN_EMAILS } from "./firebase.js";
import {
  onAuthStateChanged, updateProfile as fbUpdateProfile, sendPasswordResetEmail,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, collection, onSnapshot, query, orderBy, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, where, addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const state = {
  user: null,          // Firebase auth user
  profile: null,       // users/{uid} document
  settings: null,      // site/main document
  categories: [],      // categories collection (ordered)
  classes: [],         // classes collection (ordered)
  announcements: [],   // announcements collection (newest first)
  booting: true,
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

const unsubs = [];
let profileLoaded = false;

// ============================================================
// BOOT
// ============================================================
export async function init() {
  // ---- live: site settings ----
  unsubs.push(onSnapshot(doc(db, "site", "main"), async (snap) => {
    if (snap.exists()) {
      state.settings = snap.data();
    } else {
      // First ever run: create the default settings doc.
      state.settings = DEFAULT_SETTINGS;
      try { await setDoc(doc(db, "site", "main"), { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() }); }
      catch (e) { console.warn("Could not create site settings (check Firestore rules):", e.message); }
    }
    document.title = `${state.settings.siteName || "KBAL-School"}`;
    emit();
  }, handleErr));

  // ---- live: categories ----
  unsubs.push(onSnapshot(collection(db, "categories"), (snap) => {
    state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
    emit();
  }, handleErr));

  // ---- live: classes ----
  unsubs.push(onSnapshot(collection(db, "classes"), (snap) => {
    state.classes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
    emit();
  }, handleErr));

  // ---- live: announcements ----
  unsubs.push(onSnapshot(query(collection(db, "announcements"), orderBy("atMs", "desc")), (snap) => {
    state.announcements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  }, handleErr));

  // ---- auth ----
  return new Promise((resolve) => {
    let first = true;
    onAuthStateChanged(auth, async (user) => {
      state.user = user || null;
      if (user) {
        try {
          await ensureProfile(user);
        } catch (e) { console.warn("profile:", e.message); }
        try { watchProfile(user.uid); } catch (e) { console.warn("profile watch:", e.message); }
        if (isAdmin()) { try { await maybeCreateSettings(); } catch (e) { console.warn(e.message); } }
      } else {
        stopProfileWatch();
        state.profile = null;
        profileLoaded = false;
        applyTheme(getLocalTheme());
      }
      state.booting = false;
      emit();
      if (first) { first = false; resolve(); }
    }, (e) => { console.error(e); state.booting = false; resolve(); });
  });
}

function handleErr(e) {
  console.error("Firestore:", e);
  if (String(e?.code || "").includes("permission")) {
    toastOnce("Firestore rules not deployed yet — read the README to deploy them.");
  }
}

let toastedRules = false;
function toastOnce(msg) {
  if (toastedRules) return; toastedRules = true;
  import("./ui.js").then(({ toast }) => toast(msg, "error", "Setup needed"));
}

// ============================================================
// PROFILES (users/{uid})
// ============================================================
let unsubProfile = null;
function watchProfile(uid) {
  stopProfileWatch();
  unsubProfile = onSnapshot(doc(db, "users", uid), (snap) => {
    state.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    profileLoaded = true;
    applyTheme(state.profile?.theme || getLocalTheme());
    emit();
  }, handleErr);
}
function stopProfileWatch() { if (unsubProfile) { unsubProfile(); unsubProfile = null; } }

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const isAdminEmail = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  await setDoc(ref, {
    displayName: user.displayName || (user.email || "Student").split("@")[0],
    email: (user.email || "").toLowerCase(),
    role: isAdminEmail ? "admin" : "student",
    classId: null,
    theme: getLocalTheme(),
    createdAt: Date.now(),
    lastSeen: Date.now(),
  }).catch((e) => console.warn("profile create:", e.message));
}

/** The settings doc can only be written by an admin — create it once signed in. */
export async function maybeCreateSettings() {
  try {
    const snap = await getDoc(doc(db, "site", "main"));
    if (!snap.exists()) {
      await setDoc(doc(db, "site", "main"), { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
    }
  } catch (e) { console.warn("settings:", e.message); }
}

/** One-click starter content so a fresh install is not empty. */
export async function seedStarter() {
  const now = Date.now();
  const cats = [
    { name: "About the school", icon: "🏫", description: "Who we are, our story, mission and values.", order: 1 },
    { name: "Academics", icon: "📚", description: "Subjects, curriculum, timetables and resources.", order: 2 },
    { name: "Admissions", icon: "🧾", description: "How to apply, fees, dates and requirements.", order: 3 },
    { name: "News & events", icon: "📰", description: "The latest from our school community.", order: 4 },
  ];
  const ids = {};
  for (const c of cats) {
    const ref = await addDoc(collection(db, "categories"), { ...c, hidden: false, classId: null, createdAt: serverTimestamp() });
    ids[c.name] = ref.id;
  }
  await addDoc(collection(db, "pages"), {
    title: "Welcome to KBAL-School",
    summary: "Start here — a quick introduction to our school.",
    categoryId: ids["About the school"], classId: null, order: 1, published: true,
    authorName: "Admin",
    blocks: [
      { type: "heading", level: "h1", text: "Welcome to KBAL-School 🎓" },
      { type: "text", text: "We are delighted to welcome you. Use the **categories** on the left to explore everything the school offers — from academics to clubs and events." },
      { type: "callout", kind: "info", text: "Sign in with your school account to see your class pages, announcements and chats." },
      { type: "heading", level: "h2", text: "Quick links" },
      { type: "button", label: "Browse categories", url: "#/browse", style: "primary" },
      { type: "divider" },
      { type: "quote", text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    ],
    createdAt: serverTimestamp(), createdAtMs: now, updatedAt: serverTimestamp(), updatedAtMs: now,
  });
  await addDoc(collection(db, "announcements"), {
    title: "Welcome to the new school website 🎉",
    body: "This site is fully managed by your administrators — check back often for new pages, files and announcements.",
    classId: null, atMs: now, updatedAt: serverTimestamp(),
  });
}

export async function updateProfile(patch) {
  if (!state.user) return;
  await updateDoc(doc(db, "users", state.user.uid), patch);
}

// ============================================================
// AUTH ACTIONS
// ============================================================
export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp({ displayName, email, password, classId = null }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try { await fbUpdateProfile(cred.user, { displayName }); } catch {}
  const isAdminEmail = ADMIN_EMAILS.includes(email.trim().toLowerCase());
  await setDoc(doc(db, "users", cred.user.uid), {
    displayName: displayName || email.split("@")[0],
    email: email.trim().toLowerCase(),
    role: isAdminEmail ? "admin" : "student",
    classId,
    theme: getLocalTheme(),
    createdAt: Date.now(),
    lastSeen: Date.now(),
  });
  return cred;
}

export async function signOutUser() { await signOut(auth); }

export async function sendReset(email) { await sendPasswordResetEmail(auth, email.trim()); }

export async function changePassword(newPassword, currentPassword) {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error("Not signed in.");
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword));
  } catch {
    throw new Error("Current password is incorrect.");
  }
  await updatePassword(u, newPassword);
}

// ============================================================
// PERMISSIONS / LOOKUPS
// ============================================================
export function isAdmin() {
  if (!state.user) return false;
  if ((state.profile?.role || "") === "admin") return true;
  return ADMIN_EMAILS.includes((state.user.email || "").toLowerCase());
}
export function isSignedIn() { return !!state.user; }

export const classOf = (id) => state.classes.find((c) => c.id === id) || null;
export const categoryOf = (id) => state.categories.find((c) => c.id === id) || null;

export function myClass() { return state.profile?.classId ? classOf(state.profile.classId) : null; }

/** Categories the current visitor is allowed to see. */
export function visibleCategories() {
  const admin = isAdmin();
  const cid = state.profile?.classId || null;
  return state.categories
    .filter((c) => (c.hidden ? admin : true))
    .filter((c) => admin || !c.classId || c.classId === cid);
}

export function visibleAnnouncements() {
  const admin = isAdmin();
  const cid = state.profile?.classId || null;
  return state.announcements.filter((a) => admin || !a.classId || a.classId === cid);
}

// ============================================================
// THEME (per-user, persisted in localStorage + Firestore)
// ============================================================
export const THEME_DEFAULTS = {
  mode: "system",          // light | dark | system
  accent: "#2563eb",
  font: "system",          // system | serif | rounded | accessible
  fontScale: 100,          // 80 – 160 (%)
  density: "comfortable",  // comfortable | compact | cozy
  radius: 14,              // 0 – 24
  width: "normal",         // narrow | normal | wide
  contrast: "normal",      // normal | high
  animations: true,
  reduceBg: false,         // disable background gradient
};

const FONTS = {
  system: `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  rounded: `"Trebuchet MS", "Segoe UI", system-ui, sans-serif`,
  accessible: `Verdana, Geneva, Tahoma, sans-serif`,
};

let localTheme = (() => {
  try { return { ...THEME_DEFAULTS, ...JSON.parse(localStorage.getItem("kbal.theme") || "{}") }; }
  catch { return { ...THEME_DEFAULTS }; }
})();

export function getLocalTheme() { return localTheme; }
export function getTheme() { return state.profile?.theme || localTheme; }

export function setTheme(patch) {
  localTheme = { ...localTheme, ...patch };
  try { localStorage.setItem("kbal.theme", JSON.stringify(localTheme)); } catch {}
  applyTheme(localTheme);
  if (state.user) updateProfile({ theme: localTheme }).catch(() => {});
}

export function applyTheme(theme = getTheme()) {
  const t = { ...THEME_DEFAULTS, ...(theme || {}) };
  const root = document.documentElement;
  const dark = t.mode === "dark" || (t.mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.contrast = t.contrast || "normal";
  root.dataset.animations = t.animations === false ? "off" : "on";
  root.dataset.width = t.width || "normal";
  root.style.setProperty("--accent", t.accent || THEME_DEFAULTS.accent);
  root.style.setProperty("--accent-soft", hexToRgba(t.accent || THEME_DEFAULTS.accent, dark ? 0.2 : 0.12));
  root.style.setProperty("--font", FONTS[t.font] || FONTS.system);
  root.style.setProperty("--font-scale", String((t.fontScale || 100) / 100));
  root.style.setProperty("--radius", `${t.radius ?? 14}px`);
  root.style.setProperty("--gap", t.density === "compact" ? "12px" : t.density === "cozy" ? "16px" : "22px");
  root.style.setProperty("--pad", t.density === "compact" ? "12px" : t.density === "cozy" ? "15px" : "20px");
  root.style.setProperty("--bg-grad", t.reduceBg ? "none" : "");
  renderQuickTheme();
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(n, 16);
  if (isNaN(int)) return `rgba(37,99,235,${a})`;
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
}

// keep "system" mode in sync with the OS
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme().mode === "system") applyTheme();
});

/** The tiny ☀/🌙 button in the topbar. */
function renderQuickTheme() {
  const host = document.getElementById("quick-theme");
  if (!host) return;
  const dark = document.documentElement.dataset.theme === "dark";
  host.innerHTML = `<button class="icon-btn" id="quick-theme-btn" title="Toggle light / dark">${dark ? "☀️" : "🌙"}</button>`;
  host.querySelector("#quick-theme-btn").onclick = () => setTheme({ mode: dark ? "light" : "dark" });
}

// ============================================================
// STORAGE UPLOADS
// ============================================================
export async function uploadFile(file, folder = "uploads") {
  const { ref, uploadBytes, getDownloadURL } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
  );
  const { storage } = await import("./firebase.js");
  const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}_${safe}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return { url: await getDownloadURL(r), name: file.name, size: file.size, type: file.type, path };
}

export const DEFAULT_SETTINGS = {
  siteName: "KBAL-School",
  tagline: "Learn, explore and grow together.",
  logoUrl: "",
  coverUrl: "",
  announcement: "",
  announcementLink: "",
  footerText: "© KBAL-School. Built with care for our students.",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  adminEmails: [...ADMIN_EMAILS],
  showAnnouncements: true,
  showCategories: true,
  homeIntro: "",
};

// convenience: run a one-shot query
export async function collect(queryOrRef) {
  const snap = await getDocs(queryOrRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
