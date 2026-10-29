// ============================================================
// Auth views: sign in / create account
// ============================================================
import { signIn, signUp, sendReset, state, isAdmin } from "../store.js";
import { navigate } from "../router.js";
import { esc, toast } from "../ui.js";

export async function authView(container, params, qs) {
  const mode = params.mode === "signup" ? "signup" : "signin";
  const s = state.settings || {};

  // Already signed in → do not show the auth forms again.
  if (state.user) { navigate(isAdmin() ? "/admin" : "/"); return; }

  container.innerHTML = `
    <div class="auth-wrap">
      <div class="panel">
        <div style="text-align:center;margin-bottom:18px">
          <div style="font-size:2.2rem">🏫</div>
          <h1 style="margin:6px 0 2px">${esc(s.siteName || "KBAL-School")}</h1>
          <p class="form-note">${mode === "signup" ? "Create your account to join classes and chats." : "Welcome back! Sign in to continue."}</p>
        </div>

        <div class="auth-tabs">
          <a href="#/signin" class="${mode === "signin" ? "active" : ""}">Sign in</a>
          <a href="#/signup" class="${mode === "signup" ? "active" : ""}">Create account</a>
        </div>

        <form id="auth-form" novalidate>
          ${mode === "signup" ? `
            <div class="field">
              <label>Full name</label>
              <input class="input" name="displayName" required placeholder="e.g. Sara Ahmed" autocomplete="name" />
            </div>` : ""}
          <div class="field">
            <label>Email</label>
            <input class="input" name="email" type="email" required placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input class="input" name="password" type="password" required minlength="6" placeholder="••••••••" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" />
            ${mode === "signup" ? `<div class="hint">At least 6 characters.</div>` : ""}
          </div>
          ${mode === "signup" ? `
            <div class="field">
              <label>Class <span class="hint">(optional — you can change it later)</span></label>
              <select class="input" name="classId">
                <option value="">I'll choose later</option>
                ${state.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.icon || "🎓")} ${esc(c.name)}</option>`).join("")}
              </select>
              ${state.classes.length ? "" : `<div class="hint">No classes published yet — an admin can assign you later.</div>`}
            </div>` : ""}
          <div id="auth-error" class="form-error hidden"></div>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">
            ${mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        ${mode === "signin" ? `
          <div style="text-align:center;margin-top:14px">
            <a href="#" id="forgot" class="form-note">Forgot your password?</a>
          </div>` : ""}

        <div class="auth-hint">
          <b>Students &amp; teachers:</b> create an account with your school email.<br/>
          <b>Admins:</b> sign in with the administrator email — the admin panel unlocks automatically.
        </div>
      </div>
    </div>`;

  const form = container.querySelector("#auth-form");
  const errBox = container.querySelector("#auth-error");
  const submit = container.querySelector("#auth-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.classList.add("hidden");
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach((k) => (data[k] = String(data[k]).trim()));

    if (!data.email || !data.password) return showError("Please fill in your email and password.");
    if (mode === "signup" && data.password.length < 6) return showError("Password must be at least 6 characters.");

    submit.disabled = true;
    submit.textContent = mode === "signup" ? "Creating your account…" : "Signing in…";
    try {
      if (mode === "signup") {
        await signUp({ displayName: data.displayName || data.email.split("@")[0], email: data.email, password: data.password, classId: data.classId || null });
        toast("Welcome to KBAL-School!", "ok");
        navigate("/");
      } else {
        await signIn(data.email, data.password);
        toast("Signed in!", "ok");
        navigate("/");
      }
    } catch (err) {
      showError(friendlyAuthError(err));
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Create account" : "Sign in";
    }
  });

  container.querySelector("#forgot")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return showError("Enter your email first, then click “Forgot password”.");
    try { await sendReset(email); toast("Password reset email sent.", "ok"); }
    catch (err) { showError(friendlyAuthError(err)); }
  });

  function showError(msg) { errBox.textContent = msg; errBox.classList.remove("hidden"); return false; }
}

function friendlyAuthError(err) {
  const code = String(err?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Wrong email or password.";
  if (code.includes("user-not-found")) return "No account found with this email.";
  if (code.includes("email-already-in-use")) return "An account with this email already exists — try signing in.";
  if (code.includes("weak-password")) return "That password is too weak — use at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait a minute and try again.";
  if (code.includes("network")) return "Network error — check your connection.";
  return err?.message || "Could not complete the request.";
}
