import api from "./api";

export async function getProjects() {
  const response = await api.get("/projects/");
  return response.data;
}

export async function createProject(data) {
  const response = await api.post("/projects/", data);
  return response.data;
}

export async function getProject(projectId) {
  const response = await api.get(
    `/projects/${projectId}/`
  );

  return response.data;
}

export async function updateProject(
  projectId,
  data
) {
  const response = await api.patch(
    `/projects/${projectId}/`,
    data
  );

  return response.data;
}

export async function deleteProject(projectId) {
  const response = await api.delete(
    `/projects/${projectId}/`
  );

  return response.data;
}