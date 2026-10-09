import api from "./api";

export async function getComments(taskId) {
  const response = await api.get("/comments/", {
    params: {
      task: taskId,
    },
  });

  return Array.isArray(response.data)
    ? response.data
    : response.data?.results || [];
}

export async function createComment(
  taskId,
  content,
  parentId = null
) {
  const payload = {
    task: taskId,
    content,
  };

  /*
   * Only send parent when this is a reply.
   * Normal comments continue using the existing
   * request structure.
   */
  if (parentId !== null && parentId !== undefined) {
    payload.parent = parentId;
  }

  const response = await api.post(
    "/comments/",
    payload
  );

  return response.data;
}

export async function updateComment(
  commentId,
  content
) {
  const response = await api.patch(
    `/comments/${commentId}/`,
    {
      content,
    }
  );

  return response.data;
}

export async function deleteComment(
  commentId
) {
  const response = await api.delete(
    `/comments/${commentId}/`
  );

  return response.data;
}