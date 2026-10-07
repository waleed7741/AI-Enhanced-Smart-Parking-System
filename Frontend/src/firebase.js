import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAqaMlhPp_E6-8Pmn_QGTO7UOnAnAbNcCU",
  authDomain: "ai-enhanced-smart-parking.firebaseapp.com",
  projectId: "ai-enhanced-smart-parking",
  storageBucket: "ai-enhanced-smart-parking.firebasestorage.app",
  messagingSenderId: "597427219308",
  appId: "1:597427219308:web:071f9a1b3e3f84fad4a149",
  measurementId: "G-L7HVXNGK2T"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
