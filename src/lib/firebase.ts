import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const embeddedFirebaseConfig = {
  apiKey: 'AIzaSyAFi-hLqTGE50HW5OkwKclml1pI64ukEHc',
  authDomain: 'rushd-app-fd5a8.firebaseapp.com',
  projectId: 'rushd-app-fd5a8',
  storageBucket: 'rushd-app-fd5a8.firebasestorage.app',
  messagingSenderId: '987533331215',
  appId: '1:987533331215:web:a9fab37c9db633f8798c7a',
}

const environmentFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasEnvironmentConfig = Object.values(environmentFirebaseConfig).every((value) => Boolean(value?.trim()))
const firebaseConfig = hasEnvironmentConfig ? environmentFirebaseConfig : embeddedFirebaseConfig

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export let db: Firestore

try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  // Vite hot reload can reuse an already initialized Firestore instance.
  db = getFirestore(firebaseApp)
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
export const firebaseConfigSource = hasEnvironmentConfig ? 'environment' : 'embedded-public-client'

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch(() => setPersistence(auth, browserSessionPersistence))
auth.languageCode = 'ar'
