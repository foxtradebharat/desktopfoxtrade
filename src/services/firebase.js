import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC26VMHA7Mw_v8b5sTx3c-XpCDRF28RTgQ",
  authDomain: "foxtradebharat2026.firebaseapp.com",
  projectId: "foxtradebharat2026",
  storageBucket: "foxtradebharat2026.firebasestorage.app",
  messagingSenderId: "807258489787",
  appId: "1:807258489787:web:3b3ac973927a5558dfba9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in using Google OAuth Popup (with redirect fallback)
 */
export async function loginWithGoogle(emailHint) {
  try {
    const params = { prompt: 'select_account' };
    if (emailHint && typeof emailHint === 'string' && emailHint.includes('@')) {
      params.login_hint = emailHint.trim();
    }
    googleProvider.setCustomParameters(params);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    const user = result.user;
    return { user, accessToken };
  } catch (error) {
    console.warn('[Firebase Auth] Popup error, attempting fallback:', error.code, error.message);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError) {
        throw redirectError;
      }
    }
    throw error;
  }
}

/**
 * Sign out user
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('[Firebase Auth] Logout error:', error.message);
  }
}

/**
 * Subscribe to Auth state changes
 */
export function subscribeToAuth(onUserChanged) {
  return onAuthStateChanged(auth, (user) => {
    onUserChanged(user);
  });
}
