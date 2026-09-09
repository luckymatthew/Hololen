import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const env = import.meta.env;
export const firebaseBuild = env?.VITE_APP_BACKEND === 'firebase';
export const firebaseConfigured = Boolean(env?.VITE_FIREBASE_API_KEY && env?.VITE_FIREBASE_PROJECT_ID && env?.VITE_FIREBASE_APP_ID && env?.VITE_FIREBASE_DATABASE_URL);
let services: ReturnType<typeof initialize> | undefined;
function initialize() {
  if (!firebaseConfigured) throw new Error('雲端服務尚未設定，你仍可使用本機牌組。');
  const app = getApps().length ? getApp() : initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  });
  const auth = getAuth(app);
  // Local data is explicitly partitioned by UID below. Do not retain another user's
  // private Firestore disk cache on shared browsers.
  const firestore = getFirestore(app);
  const database = getDatabase(app);
  if (env.VITE_FIREBASE_EMULATORS === 'true') {
    const host = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, host, 8080);
    connectDatabaseEmulator(database, host, 9000);
  }
  return { app, auth, firestore, database };
}
export function getFirebase() { return services ??= initialize(); }
export async function googleLogin() { return signInWithPopup(getFirebase().auth, new GoogleAuthProvider()); }
export async function emailLogin(email: string, password: string, register = false) {
  const auth = getFirebase().auth;
  return register ? createUserWithEmailAndPassword(auth, email, password) : signInWithEmailAndPassword(auth, email, password);
}
export async function logout() { return signOut(getFirebase().auth); }
export function friendlyError(error: unknown) {
  const code = (error as { code?: string })?.code || '';
  if (/popup-closed|cancelled-popup/.test(code)) return '登入已取消，本機牌組仍然保留。';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return '電郵或密碼不正確。';
  if (/email-already-in-use/.test(code)) return '此電郵已有帳號，請改用登入。';
  if (/weak-password/.test(code)) return '請使用至少 8 個字元的密碼。';
  if (/unauthorized-domain|operation-not-allowed/.test(code)) return '此登入方式尚未啟用，請聯絡網站管理者。';
  if (/permission-denied|PERMISSION_DENIED/.test(code)) return '雲端暫時無法存取；本機資料已保留，請重新登入或稍後重試。';
  if (/resource-exhausted|quota|too-many-requests/.test(code)) return '雲端用量暫時達上限，變更已留在此裝置，稍後會再同步。';
  return '暫時無法連接雲端，請稍後重試；你仍可使用本機牌組。';
}
