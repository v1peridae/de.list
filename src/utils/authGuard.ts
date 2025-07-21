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

export function initAuthGuardWithProfileCheck(): Promise<{ user: User; isProfileComplete: boolean } | null> {
  return new Promise((resolve) => {
    document.body.style.opacity = "0";
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/friends?action=check-profile-completion", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json();
          const isProfileComplete = data.isComplete || false;

          document.body.style.opacity = "1";
          resolve({ user, isProfileComplete });
        } catch (error) {
          console.error("Error checking profile completion:", error);
          document.body.style.opacity = "1";
          resolve({ user, isProfileComplete: false });
        }
      } else {
        window.location.href = "/login";
        resolve(null);
      }
      unsubscribe();
    });
  });
}
export function initOnboardingAuthGuard(): Promise<User | null> {
  return new Promise((resolve) => {
    document.body.style.opacity = "0";
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/friends?action=check-profile-completion", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json();
          const isProfileComplete = data.isComplete || false;

          if (isProfileComplete) {
            window.location.href = "/home";
            resolve(null);
          } else {
            document.body.style.opacity = "1";
            resolve(user);
          }
        } catch (error) {
          console.error("Error checking profile completion:", error);
          document.body.style.opacity = "1";
          resolve(user);
        }
      } else {
        window.location.href = "/login";
        resolve(null);
      }
      unsubscribe();
    });
  });
}

export function initProtectedPageAuthGuard(): Promise<User | null> {
  return new Promise((resolve) => {
    document.body.style.opacity = "0";
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/friends?action=check-profile-completion", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json();
          const isProfileComplete = data.isComplete || false;

          if (!isProfileComplete) {
            window.location.href = "/onboarding";
            resolve(null);
          } else {
            document.body.style.opacity = "1";
            resolve(user);
          }
        } catch (error) {
          console.error("Error checking profile completion:", error);
          document.body.style.opacity = "1";
          resolve(user);
        }
      } else {
        window.location.href = "/login";
        resolve(null);
      }
      unsubscribe();
    });
  });
}

export function addLogoutFunctionality() {
  const logoutButtons = document.querySelectorAll("[data-logout]");
  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await auth.signOut();
        window.location.href = "/";
      } catch (error) {
        alert("Failed to sign out. Please try again.");
      }
    });
  });
}
