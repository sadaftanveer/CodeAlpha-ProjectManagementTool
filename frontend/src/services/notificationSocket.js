const INITIAL_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

/*
 * Set VITE_WS_BASE_URL in .env for production, e.g.
 *   VITE_WS_BASE_URL=wss://api.yourdomain.com
 *
 * In development it follows the hostname the page was opened with,
 * so "localhost" and "127.0.0.1" both work.
 */
function getWsBaseUrl() {
  const fromEnv = import.meta.env?.VITE_WS_BASE_URL;

  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";

  return `${protocol}://${window.location.hostname}:8000`;
}

/**
 * @param {object} options
 * @param {() => string | null} options.getToken  called on EVERY (re)connect so an
 *        expired/refreshed JWT is never reused
 * @param {(data: any) => void} options.onMessage
 * @param {() => void} [options.onOpen]
 * @param {() => void} [options.onClose]
 * @param {(error: Event) => void} [options.onError]
 */
export function createNotificationSocket({
  getToken,
  onMessage,
  onOpen,
  onClose,
  onError,
}) {
  let socket = null;
  let reconnectTimer = null;
  let manuallyClosed = false;
  let reconnectDelay = INITIAL_RECONNECT_DELAY;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (manuallyClosed) {
      return;
    }

    clearReconnectTimer();

    const token = getToken?.();

    // No token means the user logged out - stop trying.
    if (!token) {
      return;
    }

    const ws = new WebSocket(
      `${getWsBaseUrl()}/ws/notifications/?token=${encodeURIComponent(token)}`
    );

    socket = ws;

    ws.onopen = () => {
      reconnectDelay = INITIAL_RECONNECT_DELAY;
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        onMessage?.(JSON.parse(event.data));
      } catch (error) {
        console.error("Invalid notification WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      onError?.(error);
    };

    ws.onclose = () => {
      if (socket === ws) {
        socket = null;
      }

      onClose?.();

      if (manuallyClosed) {
        return;
      }

      reconnectTimer = setTimeout(connect, reconnectDelay);

      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    };
  };

  // Reconnect immediately when the network comes back.
  const handleOnline = () => {
    if (manuallyClosed || socket) {
      return;
    }

    reconnectDelay = INITIAL_RECONNECT_DELAY;
    connect();
  };

  window.addEventListener("online", handleOnline);

  connect();

  return {
    close() {
      manuallyClosed = true;

      clearReconnectTimer();
      window.removeEventListener("online", handleOnline);

      if (!socket) {
        return;
      }

      const ws = socket;
      socket = null;

      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Closing a CONNECTING socket throws a console error
        // (this happens a lot with React StrictMode), so wait for it to open.
        ws.onopen = () => ws.close();
      }
    },
  };
}