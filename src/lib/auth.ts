export const setAuth = (token: string, user: any) => {
  localStorage.setItem("findnest_token", token);
  localStorage.setItem("findnest_user", JSON.stringify(user));
};

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("findnest_token");
};

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("findnest_user");
  return user ? JSON.parse(user) : null;
};

export const removeAuth = () => {
  localStorage.removeItem("findnest_token");
  localStorage.removeItem("findnest_user");
};

export const isLoggedIn = () => {
  return !!getToken();
};