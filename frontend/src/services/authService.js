import api from "./api";

export async function registerUser(data) {
  const response = await api.post("/users/register/", data);
  return response.data;
}

export async function loginUser(data) {
  const response = await api.post("/users/login/", data);
  return response.data;
}

export async function logoutUser() {
  const response = await api.post("/users/logout/");
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/users/me/");
  return response.data;
}

export async function forgotPassword(email) {
  const response = await api.post(
    "/users/forgot-password/",
    { email }
  );

  return response.data;
}

export async function resetPassword(
  uidb64,
  token,
  data
) {
  const response = await api.post(
    `/users/reset-password/${uidb64}/${token}/`,
    data
  );

  return response.data;
}