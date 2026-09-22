import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
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

export async function logoutUser() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.error("Logout API call failed:", err);
  }
  localStorage.removeItem("findnest_token");
  localStorage.removeItem("findnest_user");
  window.location.href = "/";
}

export default api;