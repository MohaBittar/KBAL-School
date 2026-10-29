// ============================================================
// Chats: General room + one room per class + direct messages
// ============================================================
import { state, isSignedIn, isAdmin, classOf } from "../store.js";
import { navigate, currentPath } from "../router.js";
import { esc, initials, fmtTime, toast, confirmBox } from "../ui.js";
import {
  collection, doc, query, where, onSnapshot, getDoc, setDoc, updateDoc, addDoc,
  deleteDoc, serverTimestamp, arrayUnion, limit, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase.js";

const chatsCol = collection(db, "chats");

export function dmId(a, b) { return "dm_" + [a, b].sort().join("_"); }

export async function chatView(container, { id } = {}, qs = {}) {
  if (!isSignedIn()) { navigate("/signin"); return; }
  const me = state.user.uid;
  const myName = state.profile?.displayName || "Me";

  container.innerHTML = `
    <div class="page-head"><div><h1>💬 Chats</h1><p class="form-note">Talk with classmates, your class and everyone at school.</p></div></div>
    <div class="chat-layout">
      <div class="panel chat-list" id="chat-list"><div class="spinner"></div></div>
      <div class="panel chat-window" id="chat-window"><div class="empty"><span class="empty-ico">💬</span>Pick a conversation</div></div>
    </div>`;

  const listEl = container.querySelector("#chat-list");
  const winEl = container.querySelector("#chat-window");

  // ---------- open a direct message with ?with=uid ----------
  if (qs.get("with")) {
    const other = qs.get("with");
    if (other !== me) {
      await ensureDm(other);
      navigate("/chat/" + dmId(me, other), true);
    }
  }

  // ---------- rooms always available ----------
  await ensureRoom("room_general", { type: "room", title: "General", members: [], names: {} });
  if (state.profile?.classId) {
    await ensureRoom("room_class_" + state.profile.classId, {
      type: "room", classId: state.profile.classId, title: "Class chat", members: [], names: {},
    });
  }

  let activeId = id || (await lastVisited()) || "room_general";
  let unsubMsgs = null;
  const activeUnsubs = [];

  // ---------- list of chats (live) ----------
  const listSub = onSnapshot(chatsCol, (snap) => {
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cid = state.profile?.classId || null;
    const chats = all.filter((c) => {
      if (c.type === "room") return !c.classId || c.classId === cid || isAdmin();
      return (c.members || []).includes(me);
    }).sort((a, b) => (b.lastAtMs || 0) - (a.lastAtMs || 0));

    listEl.innerHTML = `
      <div class="side-title" style="padding:6px 10px">Conversations</div>
      ${chats.map((c) => chatItem(c, me, activeId)).join("")}
      <div class="side-title" style="padding:14px 10px 6px">Start a chat</div>
      <div id="dm-people"></div>`;

    listEl.querySelectorAll("[data-chat]").forEach((el) => {
      el.onclick = () => { activeId = el.dataset.chat; saveLast(activeId); openChat(activeId); };
    });
    renderPeople(chats);
  }, (err) => {
    console.warn("chats:", err.message);
    listEl.innerHTML = `<div class="empty"><span class="empty-ico">🔐</span>Chats are not available yet — the Firestore security rules still need to be published.</div>`;
  });
  activeUnsubs.push(listSub);

  // ---------- people you can message ----------
  async function renderPeople(chats) {
    const host = listEl.querySelector("#dm-people");
    if (!host) return;
    try {
      const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const snap = await getDocs(collection(db, "users"));
      const people = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== me);
      host.innerHTML = people.length
        ? people.map((u) => {
            const dm = dmId(me, u.id);
            return `<a class="chat-item ${activeId === dm ? "active" : ""}" href="#/chat/${dm}" data-chat="${dm}">
              <span class="avatar">${esc(initials(u.displayName || "?"))}</span>
              <span class="c-meta"><span class="c-name">${esc(u.displayName || "Member")}</span>
              <span class="c-last">${u.classId ? esc(classOf(u.classId)?.name || "") : "Student"}</span></span>
            </a>`;
          }).join("")
        : `<div class="form-note" style="padding:0 10px">No other accounts yet.</div>`;
      host.querySelectorAll("[data-chat]").forEach((el) => (el.onclick = () => { activeId = el.dataset.chat; saveLast(activeId); openChat(activeId); }));
    } catch (e) {
      host.innerHTML = `<div class="form-note" style="padding:0 10px">Could not load people.</div>`;
    }
  }

  // ---------- open one chat ----------
  function openChat(chatId) {
    if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
    listEl.querySelectorAll(".chat-item").forEach((el) => el.classList.toggle("active", el.dataset.chat === chatId));

    winEl.innerHTML = `<div class="chat-head"><b>Loading…</b></div><div class="chat-msgs"><div class="spinner"></div></div>`;
    const chatRef = doc(db, "chats", chatId);

    unsubMsgs = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) {
        if (chatId.startsWith("dm_")) {
          const uids = chatId.replace("dm_", "").split("_");
          if (uids.length === 2) {
            const names = {};
            for (const u of uids) {
              try { names[u] = (await getDoc(doc(db, "users", u))).data()?.displayName || "Member"; } catch { names[u] = "Member"; }
            }
            await setDoc(chatRef, { type: "dm", members: uids, names, lastAtMs: 0, createdAt: serverTimestamp() });
            return;
          }
        }
        winEl.innerHTML = `<div class="empty"><span class="empty-ico">💬</span>This conversation no longer exists.</div>`;
        return;
      }
      const chat = { id: snap.id, ...snap.data() };
      renderChatShell(chat);
    });
  }

  function renderChatShell(chat) {
    const alreadyOpen = winEl.dataset.chatId === chat.id && winEl.querySelector("#msg-form");
    winEl._chat = chat;
    if (alreadyOpen) {
      // only refresh the header — never rebuild while the user is typing
      const h = winEl.querySelector(".chat-head b");
      if (h) h.textContent = chatTitle(chat, me);
      return;
    }
    winEl.dataset.chatId = chat.id;
    const title = chatTitle(chat, me);
    winEl.innerHTML = `
      <div class="chat-head">
        <span class="c-ico" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--panel-2)">${chat.type === "dm" ? "👤" : chat.classId ? "🎓" : "🏫"}</span>
        <div>
          <b>${esc(title)}</b>
          <div class="form-note" style="font-size:.82rem">${chat.type === "dm" ? "Direct message" : (chat.classId ? esc(classOf(chat.classId)?.name || "Class chat") : "Everyone at school")}</div>
        </div>
      </div>
      <div class="chat-msgs" id="msgs"><div class="spinner"></div></div>
      <form class="chat-input" id="msg-form">
        <input class="input" id="msg-text" placeholder="Write a message…" autocomplete="off" maxlength="2000" />
        <button class="btn btn-primary" type="submit">Send</button>
      </form>`;

    winEl.querySelector("#msg-form").onsubmit = (e) => {
      e.preventDefault();
      const input = winEl.querySelector("#msg-text");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      sendMessage(winEl._chat, text);
    };

    // live messages
    if (unsubMsgs2) unsubMsgs2();
    unsubMsgs2 = onSnapshot(query(collection(db, "chats", chat.id, "messages"), orderBy("atMs", "asc"), limit(300)), (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const box = winEl.querySelector("#msgs");
      if (!box) return;
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
      box.innerHTML = msgs.length
        ? msgs.map((m) => msgHtml(m, me)).join("")
        : `<div class="empty"><span class="empty-ico">👋</span>Say hello — no messages yet.</div>`;
      box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
        if (await confirmBox("Delete this message for everyone?")) {
          try {
            const current = winEl._chat || chat;
            await deleteDoc(doc(db, "chats", current.id, "messages", b.dataset.del));
            if (current.lastId === b.dataset.del) {
              await setDoc(doc(db, "chats", current.id), { last: null, lastId: null, lastAtMs: 0 }, { merge: true });
            }
            toast("Message deleted.", "ok");
          } catch (e) { toast(e.message, "error"); }
        }
      }));
      if (atBottom) box.scrollTop = box.scrollHeight;
      else if (box.querySelector(".msg:last-child")) box.scrollTop = box.scrollHeight;
    }, (err) => {
      console.warn("messages:", err.message);
      const box = winEl.querySelector("#msgs");
      if (box) box.innerHTML = `<div class="empty"><span class="empty-ico">🔐</span>Messages are not available yet — publish the Firestore rules first.</div>`;
    });
  }

  let unsubMsgs2 = null;

  async function sendMessage(chat, text) {
    const now = Date.now();
    try {
      await addDoc(collection(db, "chats", chat.id, "messages"), {
        uid: me, name: myName, text, atMs: now, createdAt: serverTimestamp(),
      });
      const lastRef = doc(db, "chats", chat.id, "messages");
      const lastDoc = await getDocs(query(lastRef, orderBy("atMs", "desc"), limit(1)));
      await setDoc(doc(db, "chats", chat.id), {
        lastAtMs: now,
        lastId: lastDoc.docs[0]?.id || null,
        last: { text: text.slice(0, 90), name: myName, uid: me, atMs: now },
      }, { merge: true });
    } catch (e) {
      toast(e.message, "error", "Could not send");
    }
  }

  // ---------- open initial chat ----------
  if (!qs.get("with")) openChat(activeId);

  return () => {
    activeUnsubs.forEach((f) => { try { f(); } catch {} });
    if (unsubMsgs) { try { unsubMsgs(); } catch {} }
    if (unsubMsgs2) { try { unsubMsgs2(); } catch {} }
  };
}

// ============================================================
// helpers
// ============================================================
function chatItem(c, me, activeId) {
  const last = c.last?.text ? `<span class="c-last">${esc(c.last.name)}: ${esc(c.last.text)}</span>` : `<span class="c-last">No messages yet</span>`;
  const ico = c.type === "dm" ? "👤" : c.classId ? "🎓" : "🏫";
  const name = c.type === "dm"
    ? Object.entries(c.names || {}).filter(([u]) => u !== me).map(([, n]) => n)[0] || "Direct message"
    : c.classId ? `${classOf(c.classId)?.icon || "🎓"} ${classOf(c.classId)?.name || "Class chat"}` : "🏫 General";
  return `<a class="chat-item ${activeId === c.id ? "active" : ""}" href="#/chat/${esc(c.id)}" data-chat="${esc(c.id)}">
    <span class="c-ico">${ico}</span>
    <span class="c-meta"><span class="c-name">${esc(name)}</span>${last}</span>
  </a>`;
}

function chatTitle(c, me) {
  if (c.type !== "dm") return c.classId ? "Class chat" : "General chat";
  return Object.entries(c.names || {}).filter(([u]) => u !== me).map(([, n]) => n)[0] || "Direct message";
}

function msgHtml(m, me) {
  const mine = m.uid === me;
  return `<div class="msg ${mine ? "mine" : ""}">
    <span class="avatar">${esc(initials(m.name || "?"))}</span>
    <div>
      <div class="m-head"><span>${esc(m.name || "Member")}</span><time>${fmtTime(m.atMs)}</time>
        ${(mine || isAdmin()) ? `<button class="m-del" data-del="${esc(m.id)}" title="Delete">✕</button>` : ""}
      </div>
      <div class="bubble"><div class="m-text">${esc(m.text || "")}</div></div>
    </div>
  </div>`;
}

async function ensureRoom(id, data) {
  const ref = doc(db, "chats", id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { ...data, lastAtMs: 0, createdAt: serverTimestamp() });
  } catch (e) { console.warn("ensureRoom:", e.message); }
}

async function ensureDm(otherUid) {
  const me = state.user.uid;
  const id = dmId(me, otherUid);
  const ref = doc(db, "chats", id);
  const names = {};
  try { names[me] = state.profile?.displayName || "Me"; } catch {}
  try { names[otherUid] = (await getDoc(doc(db, "users", otherUid))).data()?.displayName || "Member"; } catch { names[otherUid] = "Member"; }
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { type: "dm", members: [me, otherUid], names, lastAtMs: 0, createdAt: serverTimestamp() });
  } else if (!(snap.data().members || []).includes(me)) {
    await updateDoc(ref, { members: arrayUnion(me), [`names.${me}`]: names[me] });
  }
}

function saveLast(id) { try { localStorage.setItem("kbal.lastChat", id); } catch {} }
function lastVisited() { try { return localStorage.getItem("kbal.lastChat"); } catch { return null; } }
