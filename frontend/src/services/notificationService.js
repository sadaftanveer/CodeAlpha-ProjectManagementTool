import api from "./api";

/*
 * All exports keep the same names and behaviour as before.
 * Changes:
 *  - getNotifications also accepts { notifications: [...] } responses
 *  - getUnreadNotificationCount also accepts a bare number and always
 *    returns a real number
 *  - GET helpers accept an optional { signal } (AbortController) so a
 *    request can be cancelled when the component unmounts
 */

export async function getNotifications({ signal } = {}) {
  const response = await api.get("/notifications/", { signal });

  const data = response.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.notifications)) return data.notifications;

  return [];
}

export async function getUnreadNotificationCount({ signal } = {}) {
  const response = await api.get("/notifications/unread-count/", { signal });

  const data = response.data;

  const count =
    typeof data === "number"
      ? data
      : data?.count ?? data?.unread_count ?? 0;

  return Number(count) || 0;
}

export async function markNotificationRead(notificationId) {
  const response = await api.patch(`/notifications/${notificationId}/`, {
    is_read: true,
  });

  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.patch("/notifications/mark-all-read/");

  return response.data;
}

export async function deleteNotification(notificationId) {
  const response = await api.delete(`/notifications/${notificationId}/`);

  return response.data;
}