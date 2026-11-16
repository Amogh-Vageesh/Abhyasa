import { initializeApp } from 'firebase/app';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, GoogleAuthProvider,
  signInWithPopup, signInWithCredential, signOut as fbSignOut
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBshtpPacLZWAqe93CbS_UG8Wf3oPeXmng',
  authDomain: 'abhyasa-3fe1d.firebaseapp.com',
  projectId: 'abhyasa-3fe1d',
  storageBucket: 'abhyasa-3fe1d.firebasestorage.app',
  messagingSenderId: '885540541559',
  appId: '1:885540541559:web:734de03e0737b93e65e272'
};

export const isNative = Capacitor.isNativePlatform();
export const app = initializeApp(firebaseConfig);
export const auth = isNative
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);

export async function signIn() {
  if (isNative) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const cred = GoogleAuthProvider.credential(res.credential?.idToken);
    return signInWithCredential(auth, cred);
  }
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOut() {
  if (isNative) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut().catch(() => {});
  }
  return fbSignOut(auth);
}
