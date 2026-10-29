// ============================================================
// KBAL-School — app bootstrap
// ============================================================
import { init, subscribe, applyTheme, getLocalTheme, state } from "./store.js";
import { initAnalytics } from "./firebase.js";
import { route, startRouter, navigate } from "./router.js";
import { initLayout } from "./layout.js";
import { homeView, browseView, categoryView, pageView, classView, searchView } from "./views/public.js";
import { authView } from "./views/auth.js";
import { accountView } from "./views/account.js";
import { chatView } from "./views/chat.js";
import { adminView } from "./views/admin.js";
import { spinner } from "./ui.js";

// ---- show something while Firebase boots ----
const boot = document.createElement("div");
boot.className = "loading-screen";
boot.innerHTML = `<div style="text-align:center"><div class="spinner"></div><p class="form-note">Loading KBAL-School…</p></div>`;
document.body.appendChild(boot);

// ---- routes ----
route("/", homeView);
route("/browse", browseView);
route("/category/:id", categoryView);
route("/page/:id", pageView);
route("/class/:id", classView);
route("/search", searchView);
route("/signin", (c, p, q) => authView(c, { mode: "signin" }, q));
route("/signup", (c, p, q) => authView(c, { mode: "signup" }, q));
route("/account", accountView);
route("/chat", chatView);
route("/chat/:id", chatView);
route("/admin", adminView);
route("/admin/:tab", adminView);

(async function start() {
  applyTheme(getLocalTheme());   // instant theme, before Firebase answers
  initLayout();

  try {
    await init();
  } catch (e) {
    console.error("Boot error:", e);
    document.getElementById("view").innerHTML = `
      <div class="panel empty" style="max-width:620px;margin:30px auto">
        <span class="empty-ico">🔌</span>
        <h3>Could not connect to Firebase</h3>
        <p>${e.message || e}</p>
        <p class="form-note">Check your internet connection and reload the page. If the problem persists, verify the Firebase configuration in <code>assets/js/firebase.js</code>.</p>
      </div>`;
  }

  boot.remove();
  startRouter();
  initAnalytics();

  // keep the layout in sync with auth changes (redirect to sign-in when signed out)
  subscribe((s) => {
    const path = location.hash.replace(/^#/, "");
    if (!s.user && (path.startsWith("/account") || path.startsWith("/chat") || path.startsWith("/admin"))) {
      navigate("/signin");
    }
    if (s.user && (path === "/signin" || path === "/signup")) {
      navigate(s.profile?.role === "admin" ? "/admin" : "/");
    }
  });
})();
