// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD2kYg334KK4_JS05yur_F6_n-M3BFn2m8",
  authDomain: "chatapp-7890e.firebaseapp.com",
  projectId: "chatapp-7890e",
  storageBucket: "chatapp-7890e.firebasestorage.app",
  messagingSenderId: "227818489947",
  appId: "1:227818489947:web:befd58407160ed6aa0577e",
  measurementId: "G-BBJKKC1ZEL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
