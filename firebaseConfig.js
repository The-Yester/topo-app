import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// import { getAnalytics } from "firebase/analytics"; 

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBP-u3T176r9aHrwEwoiOOHWd1sZWWoVdw",
    authDomain: "topo-32725.firebaseapp.com",
    projectId: "topo-32725",
    storageBucket: "topo-32725.firebasestorage.app",
    messagingSenderId: "1033066369750",
    appId: "1:1033066369750:web:18876ea50a12b2a28a2f77",
    measurementId: "G-188GS03Y7M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); 

export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
