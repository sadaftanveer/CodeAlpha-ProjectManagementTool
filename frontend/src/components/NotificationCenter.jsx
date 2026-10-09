import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMessageCircle,
  FiTrash2,
  FiUserPlus,
  FiAtSign,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";

import { createNotificationSocket } from "../services/notificationSocket";

import "../styles/notificationCenter.css";

function formatNotificationTime(date) {
  if (!date) return "";

  const notificationDate = new Date(date);
  const diff = Date.now() - notificationDate.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return notificationDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getNotificationIcon(type) {
  switch (type) {
    case "TASK_ASSIGNED":
      return <FiUserPlus />;
    case "TASK_COMPLETED":
      return <FiCheckCircle />;
    case "COMMENT":
      return <FiMessageCircle />;
    case "MENTION":
      return <FiAtSign />;
    case "PROJECT_INVITE":
      return <FiUserPlus />;
    case "PROJECT_UPDATED":
    case "TASK_UPDATED":
      return <FiFileText />;
    case "DEADLINE":
      return <FiClock />;
    default:
      return <FiBell />;
  }
}

function getNotificationType(notification) {
  return notification?.notification_type || notification?.type || "SYSTEM";
}

function getNotificationKey(notification) {
  return (
    notification?.id ??
    `${getNotificationType(notification)}-${notification?.created_at}`
  );
}

function normalizeNotifications(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.notifications)) return data.notifications;
  return [];
}

/*
 * Accepts "NOTIFICATION_CREATED", "notification.created",
 * "notification_created", etc. so a small naming difference on the
 * backend (Channels uses dotted handler names) does not silently
 * drop every event.
 */
function isCreatedEvent(type) {
  return (
    String(type || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "") === "notificationcreated"
  );
}

function getRecipientId(notification) {
  const recipient =
    notification?.recipient ??
    notification?.recipient_id ??
    notification?.user;

  return recipient && typeof recipient === "object"
    ? recipient.id
    : recipient;
}

function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const notificationsRef = useRef([]);
  const refreshRef = useRef(null);

  const currentUserId = user?.id;

  // Always-current copy used by the socket handler (avoids stale closures
  // and lets us de-duplicate BEFORE touching the unread counter).
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  /*
   * Load notifications for the current user. Depends on currentUserId so
   * switching accounts clears the previous user's data.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      if (!currentUserId) {
        setNotifications([]);
        setUnreadCount(0);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [notificationData, unreadData] = await Promise.all([
          getNotifications(),
          getUnreadNotificationCount(),
        ]);

        if (cancelled) return;

        setNotifications(normalizeNotifications(notificationData));
        setUnreadCount(Number(unreadData) || 0);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load notifications:", err);
          setError("Unable to load notifications.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  /*
   * Re-fetch from the server. Used when the panel opens AND every time the
   * WebSocket (re)connects, so anything missed while offline shows up.
   */
  const refreshNotifications = async () => {
    if (!currentUserId) return;

    try {
      const [notificationData, unreadData] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);

      setNotifications(normalizeNotifications(notificationData));
      setUnreadCount(Number(unreadData) || 0);
      setError("");
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
    }
  };

  // Keep the ref pointing at the latest function. Refs must be updated in an
  // effect, not during render (React's "refs during render" rule).
  useEffect(() => {
    refreshRef.current = refreshNotifications;
  });

  /*
   * One WebSocket per authenticated user.
   */
  useEffect(() => {
    if (!currentUserId || !localStorage.getItem("token")) {
      return undefined;
    }

    let cancelled = false;
    let hasConnectedBefore = false;

    const handleNotificationEvent = (message) => {
      if (cancelled) return;

      const eventType = message?.type || message?.data?.type;

      if (!isCreatedEvent(eventType)) return;

      const incoming =
        message?.notification ||
        message?.data?.notification ||
        message?.payload;

      if (!incoming) return;

      // Ignore notifications that belong to another account.
      const recipientId = getRecipientId(incoming);

      if (
        recipientId !== undefined &&
        recipientId !== null &&
        String(recipientId) !== String(currentUserId)
      ) {
        return;
      }

      // De-duplicate first, so the unread counter is not bumped twice.
      const alreadyExists = notificationsRef.current.some(
        (item) => String(item.id) === String(incoming.id)
      );

      if (alreadyExists) return;

      setNotifications((current) =>
        current.some((item) => String(item.id) === String(incoming.id))
          ? current
          : [incoming, ...current]
      );

      if (!incoming.is_read) {
        setUnreadCount((current) => current + 1);
      }
    };

    socketRef.current = createNotificationSocket({
      // Read on every reconnect, so a refreshed token is picked up.
      getToken: () => localStorage.getItem("token"),

      onMessage: handleNotificationEvent,

      onOpen: () => {
        if (cancelled) return;

        // After a reconnect, catch up on anything that was missed.
        if (hasConnectedBefore) {
          refreshRef.current?.();
        }

        hasConnectedBefore = true;
      },

      onError: (socketError) => {
        if (!cancelled) {
          console.warn("Notification socket error:", socketError);
        }
      },
    });

    return () => {
      cancelled = true;

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [currentUserId]);

  /*
   * Close the panel when clicking outside it.
   */
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleToggle = async () => {
    const nextState = !isOpen;

    setIsOpen(nextState);

    if (nextState) {
      await refreshNotifications();
    }
  };

  const handleMarkRead = async (notification) => {
    if (notification.is_read) return;

    try {
      const updated = await markNotificationRead(notification.id);

      setNotifications((current) =>
        current.map((item) =>
          String(item.id) === String(notification.id)
            ? { ...item, ...updated, is_read: true }
            : item
        )
      );

      setUnreadCount((current) => Math.max(current - 1, 0));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleNotificationClick = async (notification) => {
    await handleMarkRead(notification);

    const projectId = notification?.related_project_id;
    const taskId = notification?.related_task_id;
    const commentId = notification?.related_comment_id;

    if (!projectId) return;

    setIsOpen(false);

    if (taskId) {
      const params = new URLSearchParams();

      params.set("task", String(taskId));

      if (commentId) {
        params.set("comment", String(commentId));
      }

      navigate(`/projects/${projectId}?${params.toString()}`);

      return;
    }

    navigate(`/projects/${projectId}`);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    try {
      await markAllNotificationsRead();

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleDelete = async (notificationId) => {
    const notification = notifications.find(
      (item) => String(item.id) === String(notificationId)
    );

    try {
      await deleteNotification(notificationId);

      setNotifications((current) =>
        current.filter((item) => String(item.id) !== String(notificationId))
      );

      if (notification && !notification.is_read) {
        setUnreadCount((current) => Math.max(current - 1, 0));
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell ${
          isOpen ? "notification-bell-active" : ""
        }`}
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <FiBell />

        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div>
              <span className="notification-eyebrow">ACTIVITY</span>

              <h3>Notifications</h3>
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <FiCheck />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <FiX />
              </button>
            </div>
          </div>

          {error && <div className="notification-error">{error}</div>}

          <div className="notification-list">
            {loading ? (
              <div className="notification-state">
                <div className="notification-spinner" />

                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-state">
                <div className="notification-empty-icon">
                  <FiBell />
                </div>

                <strong>All caught up</strong>

                <span>New project activity will appear here.</span>
              </div>
            ) : (
              notifications.map((notification) => {
                const type = getNotificationType(notification);

                return (
                  <div
                    className={`notification-item ${
                      notification.is_read ? "" : "notification-unread"
                    }`}
                    key={getNotificationKey(notification)}
                    onClick={() => handleNotificationClick(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(type)}
                    </div>

                    <div className="notification-content">
                      <p>{notification.message}</p>

                      <span>
                        {formatNotificationTime(notification.created_at)}
                      </span>
                    </div>

                    <div className="notification-item-actions">
                      {!notification.is_read && (
                        <span className="notification-unread-dot" />
                      )}

                      <button
                        type="button"
                        title="Delete notification"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(notification.id);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;