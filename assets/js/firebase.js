// ============================================================
// Firebase init — KBAL-School
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDe7hPdG1R749FfSLdp8Oibj1LCkf3GtSg",
  authDomain: "kbal-school.firebaseapp.com",
  projectId: "kbal-school",
  storageBucket: "kbal-school.firebasestorage.app",
  messagingSenderId: "597813408278",
  appId: "1:597813408278:web:06a842431d440e6b067b37",
  measurementId: "G-BXNERDFDLM"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// E-mails that always receive admin rights (matched against the signed-in
// account's e-mail). The very first admin of this project was created in the
// Firebase console — keep it in this list.
export const ADMIN_EMAILS = ["mohabittarinfo12@gmail.com"];

// Analytics is optional: it can fail on unsupported browsers / file:// — the
// site must keep working without it.
export async function initAnalytics() {
  try {
    const { getAnalytics, isSupported } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js"
    );
    if (await isSupported()) getAnalytics(app);
  } catch (e) {
    /* analytics unavailable — ignore */
  }
}

/** Sign in with Google (popup). */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** Sign in as an anonymous / guest user. */
export async function signInAsGuest() {
  const result = await signInAnonymously(auth);
  return result.user;
}
