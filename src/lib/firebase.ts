import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAFi-hLqTGE50HW5OkwKclml1pI64ukEHc',
  authDomain: 'rushd-app-fd5a8.firebaseapp.com',
  projectId: 'rushd-app-fd5a8',
  storageBucket: 'rushd-app-fd5a8.firebasestorage.app',
  messagingSenderId: '987533331215',
  appId: '1:987533331215:web:a9fab37c9db633f8798c7a',
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const isFirebaseConfigured = true

void setPersistence(auth, browserLocalPersistence).catch(() => undefined)
auth.languageCode = 'ar'
