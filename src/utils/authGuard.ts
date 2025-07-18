import { auth } from "../firebase/config";
import { onAuthStateChanged, type User } from "firebase/auth";
export function initAuthGuard(): Promise<User | null> {
  return new Promise((resolve) => {
    document.body.style.opacity = "0";
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        document.body.style.opacity = "1";
        resolve(user);
      } else {
        window.location.href = "/login";
        resolve(null);
      }
      unsubscribe();
    });
  });
}

export function addLogoutFunctionality() {
  const logoutButtons = document.querySelectorAll('[data-logout]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await auth.signOut();
        window.location.href = "/";
      } catch (error) {
        alert("Failed to sign out. Please try again.");
      }
    });
  });
} 