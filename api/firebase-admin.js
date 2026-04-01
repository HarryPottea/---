import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("[FIREBASE ADMIN] Missing environment variables");
    return null;
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  } catch (error) {
    console.error("[FIREBASE ADMIN] Initialization error:", error.message);
    return null;
  }
}

const app = getFirebaseAdminApp();

// In firebase-admin, you can specify the database ID when calling getFirestore()
// We'll use an environment variable for the database ID as well
const db = app ? getFirestore(app, process.env.FIREBASE_DATABASE_ID || undefined) : null;
const auth = app ? getAuth(app) : null;

export { app, db, auth };
