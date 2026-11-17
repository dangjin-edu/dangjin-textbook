import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ALLOWED_ADMIN_EMAILS = ['dkswnsgud808@gmail.com'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const config = window.FIREBASE_CONFIG;
let app = null;
let auth = null;
let db = null;

if (config && config.apiKey && config.projectId) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const FirebaseTextbook = {
  isConfigured() {
    return Boolean(app && auth && db);
  },

  isAuthorizedAdmin(user = auth ? auth.currentUser : null) {
    if (!user || !user.email) return false;
    return ALLOWED_ADMIN_EMAILS.includes(normalizeEmail(user.email));
  },

  getAllowedAdminEmails() {
    return [...ALLOWED_ADMIN_EMAILS];
  },

  getCurrentUser() {
    return auth ? auth.currentUser : null;
  },

  onAuthChange(callback) {
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  },

  async signInWithGoogle() {
    if (!auth) throw new Error('Firebase 설정이 없습니다.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    if (!this.isAuthorizedAdmin(result.user)) {
      const attemptedEmail = result.user?.email || '';
      await signOut(auth);
      const err = new Error('UNAUTHORIZED_ADMIN');
      err.code = 'UNAUTHORIZED_ADMIN';
      err.email = attemptedEmail;
      throw err;
    }
    return result.user;
  },

  async signOutUser() {
    if (!auth) return;
    await signOut(auth);
  },

  async loadTextbook(bookId) {
    if (!db) return null;
    const ref = doc(db, 'textbooks', bookId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  },

  async saveTextbook(bookId, payload) {
    if (!db) throw new Error('Firebase Firestore가 초기화되지 않았습니다.');
    if (!auth || !auth.currentUser) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!this.isAuthorizedAdmin(auth.currentUser)) {
      throw new Error('UNAUTHORIZED_ADMIN');
    }
    const ref = doc(db, 'textbooks', bookId);
    await setDoc(ref, {
      ...payload,
      updatedBy: auth.currentUser.email || auth.currentUser.uid,
      updatedAt: serverTimestamp()
    });
  }
};

window.FirebaseTextbook = FirebaseTextbook;
