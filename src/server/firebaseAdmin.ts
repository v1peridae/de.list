import { cert, getApps, initializeApp } from "firebase-admin/app";

export function ensureFirebaseAdminApp() {
  if (getApps().length) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (privateKey && privateKey.trim() !== "" && projectId && clientEmail) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    return;
  }
  initializeApp();
}
