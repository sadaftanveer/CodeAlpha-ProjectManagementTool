import api from "./api";

export async function getProjectMembers(projectId) {
  const response = await api.get(`/projects/${projectId}/members/`);
  return response.data;
}

export async function addProjectMember(projectId, data) {
  const response = await api.post(`/projects/${projectId}/members/`, data);
  return response.data;
}

export async function updateProjectMember(projectId, memberId, data) {
  const response = await api.patch(
    `/projects/${projectId}/members/${memberId}/`,
    data
  );
  return response.data;
}

export async function removeProjectMember(projectId, memberId) {
  const response = await api.delete(
    `/projects/${projectId}/members/${memberId}/`
  );
  return response.data;
}
