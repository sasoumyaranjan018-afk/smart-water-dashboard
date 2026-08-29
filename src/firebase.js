import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBGmTsRFWAS9q16OftoROnJes7dtIU13l0",
  authDomain: "smart-water-quality-a7835.firebaseapp.com",
  databaseURL: "https://smart-water-quality-a7835-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-water-quality-a7835",
  storageBucket: "smart-water-quality-a7835.firebasestorage.app",
  messagingSenderId: "539491105217",
  appId: "1:539491105217:web:4c59f416aaefcdf9aa9740"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);