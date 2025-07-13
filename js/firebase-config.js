import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, doc, updateDoc,
  getDocs, query, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { 
  getAuth, 
  signInAnonymously,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiatSPlFduccWDUib4A953rRdX9Cjyu1w",
  authDomain: "bilis-paps.firebaseapp.com",
  projectId: "bilis-paps",
  storageBucket: "bilis-paps.appspot.com",  // Changed from firebasestorage.app
  messagingSenderId: "202516520331",
  appId: "1:202516520331:web:bebbb5bf12f90ea998638e",
  measurementId: "G-Z3KGFY19HJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
  db, collection, addDoc, doc, updateDoc,
  getDocs, query, orderBy, limit, serverTimestamp,
  auth, signInAnonymously, onAuthStateChanged
};
