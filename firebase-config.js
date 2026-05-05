const firebaseConfig = {
  apiKey: "AIzaSyDmwYAkrKO2oGso3vEasf4sPAgEEf9XUJY",
  authDomain: "pupass-4b720.firebaseapp.com",
  projectId: "pupass-4b720",
  storageBucket: "pupass-4b720.firebasestorage.app",
  messagingSenderId: "970440433085",
  appId: "1:970440433085:web:8118f63daaa8a7bf2806d4",
  measurementId: "G-KX94LB7KHG"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
