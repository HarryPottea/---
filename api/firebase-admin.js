import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

// In firebase-admin, you can specify the database ID when calling firestore()
const db = firebaseConfig.firestoreDatabaseId 
  ? admin.firestore(firebaseConfig.firestoreDatabaseId)
  : admin.firestore();

const auth = admin.auth();

export { admin, db, auth };
