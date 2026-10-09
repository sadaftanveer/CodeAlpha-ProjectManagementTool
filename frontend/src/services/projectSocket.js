
const WS_BASE_URL = "ws://127.0.0.1:8000";

export function createProjectSocket(
  projectId,
  token,
  onMessage,
  onOpen,
  onClose,
  onError
) {
  if (!projectId || !token) {
    return null;
  }

  const socket = new WebSocket(
    `${WS_BASE_URL}/ws/projects/${projectId}/?token=${encodeURIComponent(
      token
    )}`
  );

  socket.onopen = () => {
    console.log(
      `Project WebSocket connected: ${projectId}`
    );

    onOpen?.();
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage?.(data);
    } catch (error) {
      console.error(
        "Invalid WebSocket message:",
        error
      );
    }
  };

  socket.onerror = (error) => {
    console.error(
      "Project WebSocket error:",
      error
    );

    onError?.(error);
  };

  socket.onclose = () => {
    console.log(
      `Project WebSocket disconnected: ${projectId}`
    );

    onClose?.();
  };

  return socket;
}
