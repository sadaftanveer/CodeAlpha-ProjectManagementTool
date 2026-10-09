import api from "./api";

export async function getTasks(projectId) {
  const response = await api.get("/tasks/", {
    params: {
      project: projectId,
    },
  });

  return response.data;
}

export async function createTask(data) {
  const response = await api.post("/tasks/", data);
  return response.data;
}

export async function updateTask(taskId, data) {
  const response = await api.patch(`/tasks/${taskId}/`, data);
  return response.data;
}

export async function deleteTask(taskId) {
  const response = await api.delete(`/tasks/${taskId}/`);
  return response.data;
}