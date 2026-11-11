import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyCRyZ78INIyDHqwDE654Qsi3iDX6t78L58',
  authDomain: 'localfind-fb.firebaseapp.com',
  projectId: 'localfind-fb',
  appId: '1:975619308856:web:278033c56a3ff84ea455cd',
})

export const auth = getAuth(app)
export const db = getFirestore(app)
