// ============================================================
// Tiny hash router
// ============================================================
const routes = [];
let currentCleanup = null;

/** register('#/page/:id', async (container, params) => {}) */
export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp(
    "^" +
      pattern
        .replace(/\/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return "/([^/]+)"; })
        .replace(/\*/g, ".*") +
      "$"
  );
  routes.push({ rx, keys, handler, pattern });
}

export function navigate(path) {
  const clean = path.startsWith("#") ? path : "#" + path;
  if (location.hash === clean) render();
  else location.hash = clean;
}

export function currentPath() {
  return (location.hash || "#/").replace(/^#/, "").split("?")[0];
}

export async function render() {
  const path = currentPath();
  const [pathPart] = [path];
  const qs = new URLSearchParams((location.hash.split("?")[1] || ""));

  for (const r of routes) {
    const m = pathPart.match(r.rx);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));

    if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }

    const container = document.getElementById("view");
    container.innerHTML = `<div class="spinner"></div>`;
    window.scrollTo({ top: 0 });
    try {
      const cleanup = await r.handler(container, params, qs);
      if (typeof cleanup === "function") currentCleanup = cleanup;
      // sidebar active state
      document.querySelectorAll(".side-link").forEach((a) => {
        const href = a.getAttribute("href") || "";
        a.classList.toggle("active", href === "#" + path);
      });
    } catch (e) {
      console.error(e);
      container.innerHTML = `
        <div class="panel empty">
          <span class="empty-ico">⚠️</span>
          <h3>Something went wrong</h3>
          <p>${e.message || e}</p>
          <p><a class="btn btn-primary" href="#/">Back to home</a></p>
        </div>`;
    }
    return;
  }

  // no route matched
  document.getElementById("view").innerHTML = `
    <div class="panel empty">
      <span class="empty-ico">🧭</span>
      <h3>Page not found</h3>
      <p>The page you are looking for does not exist or was removed by an admin.</p>
      <p><a class="btn btn-primary" href="#/">Back to home</a></p>
    </div>`;
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/";
  else render();
}
