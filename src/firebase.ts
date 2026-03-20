import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBelzMoNIZS1FxB0bFOFrhRGgtLcaiLBSM',
  authDomain: 'nazarai-4dd42.firebaseapp.com',
  projectId: 'nazarai-4dd42',
  storageBucket: 'nazarai-4dd42.firebasestorage.app',
  messagingSenderId: '963615452212',
  appId: '1:963615452212:web:0681f540c4f1099dbe2e61',
  measurementId: 'G-DXDXGMKM6D',
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export { app, firebaseConfig };
