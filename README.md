# 🏫 KBAL-School

A complete, fully **admin-managed school website** powered by **Firebase** (Authentication + Firestore + Storage).
Everything — categories, pages, content, classes, users, announcements and the site's look — is controlled from a built-in admin panel. Students get their own class space, a personal theme, and real-time chats.

---

## ✨ Features

**Public site**
- 🏠 Home page with hero, announcements, categories and recent pages
- 🗂️ **Categories** → each contains its own **pages**
- 📄 Pages built from drag-free visual **content blocks**: headings, rich text, images, file downloads, lists, quotes, callouts, YouTube videos, buttons, tables, code and dividers
- 🔎 Global search across categories, pages and people
- 📣 Announcement bar + announcements feed (can be limited to a class)

**Accounts**
- 🔑 Email/password **sign-in and sign-up** (Firebase Authentication)
- Admins are recognised automatically (role in Firestore or the admin e-mail allow-list)
- Every user gets a profile: display name, picture, **class**, role

**Chats** 💬
- 🏫 **General** room for the whole school
- 🎓 One **class chat** per class (only class members see it)
- 👤 **Direct messages** with any other user — click a person in the sidebar or a search result
- Real-time delivery, delete your own messages (admins can delete any)

**Classes** 🎓
- Admins can add/edit/delete classes (name, icon, colour, teacher, room, join code)
- Each class has its **own pages, announcements and chat**
- Students join with a **join code** or get assigned by the admin

**Per-user appearance** 🎨
- Light / dark / auto theme
- Accent colour presets + custom colour picker
- **Text size** slider (80% – 160%)
- Font family (system, serif, rounded, accessible)
- Density, corner roundness, content width, animations, high-contrast
- Saved to the user's profile — the theme follows them on every device

**Admin panel** 🛠️
- Dashboard with stats, quick actions and setup checklist
- One-click **starter content** for fresh installs
- Site settings: name, tagline, logo, cover, announcement bar, contact info, footer, admin emails
- Full CRUD for categories, pages, classes, announcements and users

---

## 🚀 Getting started

### 1. Run it locally

```bash
node server.js          # or: npm run dev
# → open http://localhost:5000
```

> The site uses ES modules, so it must be served over HTTP (not opened as a `file://` URL).

### 2. Firebase setup (one time)

Your Firebase project `kbal-school` is already configured in `assets/js/firebase.js`.

1. **Authentication → Sign-in method** → enable **Email/Password**.
2. **Authentication → Users** → **Add user** (this is how you create the admin account):
   - Email: `mohabittarinfo12@gmail.com`
   - Password: *(whatever you set)*
3. **Firestore Database** → Create database (production mode).
4. **Storage** → Get started (upgrade to a billing plan if you exceed the free tier).

### 3. Deploy the security rules

```bash
npm i -g firebase-tools
firebase login
firebase use kbal-school
firebase deploy --only firestore:rules,storage
```

Or paste the contents of `firestore.rules` / `storage.rules` into
**Firestore → Rules** and **Storage → Rules** in the console and press *Publish*.

> Until the rules are deployed, reads/writes are blocked by Firestore's default
> rules and the site will show a friendly "setup needed" toast.

### 4. Sign in as admin

Open `#/signin`, sign in with the admin email — the **🛠 Admin panel** appears in the
top-right menu and sidebar automatically. Then press **✨ Create starter content**
on the admin dashboard to seed example categories, a welcome page and an announcement.

### 5. Publish

```bash
firebase deploy --only hosting
```

Your site goes live at `https://kbal-school.web.app` (and `.firebaseapp.com`).

---

## 🔐 Who can do what

| Action | Guest | Student | Admin |
|---|---|---|---|
| Browse categories/pages, read announcements | ✅ | ✅ | ✅ |
| Sign up, chat, join a class, set own theme | — | ✅ | ✅ |
| Add/edit/delete categories, pages, classes, announcements | — | — | ✅ |
| Change site settings, upload files, manage users & roles | — | — | ✅ |

Rules are enforced **server-side** in `firestore.rules` — the UI hiding is just convenience.
Admins can also be granted by adding an e-mail to the **admin allow-list** in
*Site settings* (or the `ADMIN_EMAILS` array in `assets/js/firebase.js`).

---

## 📁 Project structure

```
KBAL-School/
├── index.html                 app shell (topbar, sidebar, view container)
├── server.js                  tiny dev server (node server.js)
├── firebase.json              hosting + rules config
├── firestore.rules            Firestore security rules
├── storage.rules              Storage security rules
└── assets/
    ├── css/main.css           design system (themeable CSS variables)
    └── js/
        ├── firebase.js        Firebase init + config
        ├── store.js           auth, Firestore subscriptions, theme engine
        ├── router.js          hash router
        ├── layout.js          topbar / sidebar / footer
        ├── ui.js              modals, toasts, helpers
        ├── blocks.js          content blocks + visual block editor
        ├── main.js            bootstrap
        └── views/
            ├── public.js      home, browse, category, page, class, search
            ├── auth.js        sign in / sign up
            ├── account.js     profile, class, appearance, security
            ├── chat.js        rooms + direct messages
            └── admin.js       the whole admin panel
```

## 🗃️ Data model (Firestore)

```
site/main                      site settings (name, logo, announcement, admin emails…)
categories/{id}                name, icon, description, order, classId?, hidden
pages/{id}                     title, categoryId, classId?, order, published, blocks[]
classes/{id}                   name, icon, color, teacher, room, join code
announcements/{id}             title, body, classId?
users/{uid}                    displayName, email, role, classId, theme
chats/{chatId}                 type: room|dm, members, names, last message
chats/{chatId}/messages/{id}   uid, name, text, atMs
```

Uploaded images/files live in **Firebase Storage** under `content/`, `site/`, `avatars/` and `uploads/`.
