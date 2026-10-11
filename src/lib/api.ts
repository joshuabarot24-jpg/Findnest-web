import axios from "axios";

const api = axios.create({
  baseURL:  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("findnest_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("findnest_token");
      localStorage.removeItem("findnest_user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// [UX] Every logout button calls this. It opens the styled confirmation popup
// (see LogoutConfirmHost); nothing is logged out until the user confirms.
export function logoutUser() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("findnest:confirm-logout"));
}

// Does the real logout. Only called by the popup after the user confirms.
export async function performLogout() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.error("Logout API call failed:", err);
  }
  localStorage.removeItem("findnest_token");
  localStorage.removeItem("findnest_user");
  const remembered = localStorage.getItem("findnest_remember_me") === "true";
  if (!remembered) {
    localStorage.removeItem("findnest_login_draft");
  }
  window.location.href = "/";
}

export default api;