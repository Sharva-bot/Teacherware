import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import defaultConfig from '../../firebase-applet-config.json';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || defaultConfig?.apiKey || '',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || defaultConfig?.authDomain || '',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || defaultConfig?.projectId || '',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || defaultConfig?.storageBucket || '',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || defaultConfig?.messagingSenderId || '',
  appId: getEnv('VITE_FIREBASE_APP_ID') || defaultConfig?.appId || '',
  firestoreDatabaseId: getEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || defaultConfig?.firestoreDatabaseId || '',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = firebaseConfig.firestoreDatabaseId || undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

