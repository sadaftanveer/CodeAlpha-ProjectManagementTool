import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiMessageCircle,
  FiMoreHorizontal,
  FiSend,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

import { createProjectSocket } from "../services/projectSocket";

import { useAuth } from "../context/AuthContext";

import {
  createComment,
  deleteComment,
  updateComment,
} from "../services/commentService";

import { deleteTask } from "../services/taskService";

import api from "../services/api";

import "../styles/taskDetails.css";

function formatDate(date) {
  if (!date) {
    return "Not set";
  }

  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name = "") {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${
      parts[parts.length - 1][0]
    }`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "U";
}

function getCommentAuthor(comment) {
  const firstName =
    comment?.first_name ||
    comment?.user?.first_name ||
    "";

  const lastName =
    comment?.last_name ||
    comment?.user?.last_name ||
    "";

  const username =
    comment?.username ||
    comment?.user?.username ||
    "";

  return (
    [firstName, lastName]
      .filter(Boolean)
      .join(" ") ||
    username ||
    "User"
  );
}

function extractError(error, fallback) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data === "object" && data) {
    const messages = Object.entries(data).flatMap(
      ([key, value]) => {
        if (Array.isArray(value)) {
          return value.map(
            (item) => `${key}: ${item}`
          );
        }

        if (typeof value === "string") {
          return `${key}: ${value}`;
        }

        return [];
      }
    );

    if (messages.length) {
      return messages.join(" ");
    }
  }

  return fallback;
}

function getCommentParentId(comment) {
  return (
    comment?.parent_id ??
    comment?.parent_comment_id ??
    comment?.parent ??
    comment?.reply_to ??
    null
  );
}

function TaskDetailsModal({
  projectId,
  task,
  members = [],
  onClose,
  onTaskDeleted,
  onEditTask,
}) {
  const { user } = useAuth();

  const [comments, setComments] = useState([]);

  const [commentsLoading, setCommentsLoading] =
    useState(true);

  const [commentText, setCommentText] =
    useState("");

  const [
    commentSubmitting,
    setCommentSubmitting,
  ] = useState(false);

  const [
    editingCommentId,
    setEditingCommentId,
  ] = useState(null);

  const [
    editingText,
    setEditingText,
  ] = useState("");

  const [
    commentMenuId,
    setCommentMenuId,
  ] = useState(null);

  /*
   * The comment currently being replied to.
   */
  const [
    replyingTo,
    setReplyingTo,
  ] = useState(null);

  /*
   * Custom delete dialogs.
   */
  const [
    commentToDelete,
    setCommentToDelete,
  ] = useState(null);

  const [
    taskDeleteOpen,
    setTaskDeleteOpen,
  ] = useState(false);

  const [
    deletingComment,
    setDeletingComment,
  ] = useState(false);

  const [
    deletingTask,
    setDeletingTask,
  ] = useState(false);

  const [error, setError] = useState("");

  const textareaRef = useRef(null);

  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionSuggestionsOpen, setMentionSuggestionsOpen] =
    useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] =
    useState(0);

  const currentUserId = user?.id;

  const mentionMembers = useMemo(() => {
    return members
      .map((member) => {
        const memberId =
          member?.user_id ??
          member?.user?.id ??
          member?.user?.pk ??
          member?.id;

        const username =
          member?.username ||
          member?.user?.username ||
          "";

        const firstName =
          member?.first_name ||
          member?.user?.first_name ||
          "";

        const lastName =
          member?.last_name ||
          member?.user?.last_name ||
          "";

        const email =
          member?.email ||
          member?.user?.email ||
          "";

        return {
          id: memberId,
          username,
          displayName: [firstName, lastName]
            .filter(Boolean)
            .join(" ") || username || email || "Member",
          email,
        };
      })
      .filter((member) => member.id && member.username);
  }, [members]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionSuggestionsOpen) {
      return [];
    }

    const query = mentionQuery.trim().toLowerCase();

    return mentionMembers
      .filter((member) => {
        if (
          currentUserId &&
          String(member.id) === String(currentUserId)
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return (
          member.username.toLowerCase().includes(query) ||
          member.displayName.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [
    mentionMembers,
    mentionQuery,
    mentionSuggestionsOpen,
    currentUserId,
  ]);

  /*
   * Load comments for the selected task.
   */
  useEffect(() => {
    if (!task?.id) {
      return undefined;
    }

    let cancelled = false;

    async function loadComments() {
      try {
        setCommentsLoading(true);
        setError("");

        const response = await api.get(
          `/comments/tasks/${task.id}/`
        );

        if (cancelled) {
          return;
        }

        const data = response.data;

        setComments(
          Array.isArray(data)
            ? data
            : data?.results || []
        );
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Failed to load comments:",
            err
          );

          setComments([]);

          setError(
            extractError(
              err,
              "Unable to load comments."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [task?.id]);

  /*
   * Real-time comments through the project WebSocket.
   */
  useEffect(() => {
    const token =
      localStorage.getItem("token");

    if (
      !projectId ||
      !token ||
      !task?.id
    ) {
      return undefined;
    }

    let socket = null;
    let cancelled = false;

    const handleCommentEvent = (message) => {
      if (cancelled) {
        return;
      }

      const eventType =
        message?.type ||
        message?.data?.type;

      const incomingComment =
        message?.comment ||
        message?.data?.comment;

      if (
        ![
          "COMMENT_CREATED",
          "COMMENT_UPDATED",
          "COMMENT_DELETED",
        ].includes(eventType)
      ) {
        return;
      }

      if (!incomingComment) {
        return;
      }

      if (
        String(incomingComment.task) !==
        String(task.id)
      ) {
        return;
      }

      if (
        eventType === "COMMENT_CREATED"
      ) {
        setComments((current) => {
          const alreadyExists =
            current.some(
              (comment) =>
                String(comment.id) ===
                String(incomingComment.id)
            );

          if (alreadyExists) {
            return current;
          }

          return [
            ...current,
            incomingComment,
          ];
        });

        return;
      }

      if (
        eventType === "COMMENT_UPDATED"
      ) {
        setComments((current) =>
          current.map((comment) =>
            String(comment.id) ===
            String(incomingComment.id)
              ? incomingComment
              : comment
          )
        );

        return;
      }

      if (
        eventType === "COMMENT_DELETED"
      ) {
        setComments((current) =>
          current.map((comment) =>
            String(comment.id) ===
            String(incomingComment.id)
              ? incomingComment
              : comment
          )
        );
      }
    };

    socket = createProjectSocket(
      projectId,
      token,
      handleCommentEvent,
      () => {
        console.log(
          `Comment real-time connection enabled for task ${task.id}.`
        );
      },
      () => {
        console.log(
          `Comment real-time connection closed for task ${task.id}.`
        );
      },
      (socketError) => {
        console.warn(
          "Comment WebSocket error:",
          socketError
        );
      }
    );

    return () => {
      cancelled = true;

      if (socket) {
        socket.close();
      }
    };
  }, [projectId, task?.id]);

  const getAssigneeName = () => {
    if (!task?.assigned_to) {
      return "Unassigned";
    }

    const member = members.find(
      (item) =>
        String(
          item?.user_id ??
            item?.user?.id ??
            item?.id
        ) ===
        String(task.assigned_to)
    );

    if (!member) {
      return (
        task.assigned_to_username ||
        "Assigned user"
      );
    }

    const firstName =
      member?.first_name ||
      member?.user?.first_name ||
      "";

    const lastName =
      member?.last_name ||
      member?.user?.last_name ||
      "";

    const username =
      member?.username ||
      member?.user?.username ||
      "";

    return (
      [firstName, lastName]
        .filter(Boolean)
        .join(" ") ||
      username ||
      member?.email ||
      "Assigned user"
    );
  };

  /*
   * Split comments into top-level comments and replies.
   *
   * A reply is identified by:
   * parent_id
   * parent_comment_id
   * parent
   * reply_to
   *
   * This allows the component to work with the
   * backend representation we will finalize next.
   */
  const topLevelComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          !getCommentParentId(comment)
      ),
    [comments]
  );

  const getReplies = (commentId) =>
    comments.filter(
      (comment) =>
        String(
          getCommentParentId(comment)
        ) === String(commentId)
    );

  const handleAddComment = async (event) => {
    event.preventDefault();

    const content =
      commentText.trim();

    if (!content) {
      return;
    }

    try {
      setCommentSubmitting(true);
      setError("");

      /*
       * For a normal comment parentId is null.
       * For a reply it contains the original
       * comment ID.
       *
       * commentService will be updated to send
       * this value to the backend.
       */
      const parentId =
        replyingTo?.id ?? null;

      const createdComment =
        await createComment(
          task.id,
          content,
          parentId
        );

      setComments((current) => {
        const alreadyExists =
          current.some(
            (comment) =>
              String(comment.id) ===
              String(createdComment.id)
          );

        if (alreadyExists) {
          return current;
        }

        return [
          ...current,
          createdComment,
        ];
      });

      setCommentText("");
      setReplyingTo(null);
    } catch (err) {
      console.error(
        "Failed to create comment:",
        err
      );

      setError(
        extractError(
          err,
          "Unable to add comment."
        )
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const updateMentionState = (value, cursorPosition) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9_.-]*)$/);

    if (!match) {
      setMentionSuggestionsOpen(false);
      setMentionQuery("");
      setMentionStart(-1);
      setSelectedMentionIndex(0);
      return;
    }

    const start = cursorPosition - match[2].length - 1;

    setMentionStart(start);
    setMentionQuery(match[2]);
    setSelectedMentionIndex(0);
    setMentionSuggestionsOpen(true);
  };

  const handleCommentTextChange = (event) => {
    const value = event.target.value;
    setCommentText(value);
    updateMentionState(
      value,
      event.target.selectionStart ?? value.length
    );
  };

  const selectMention = (member) => {
    if (!member?.username) {
      return;
    }

    const cursorPosition =
      textareaRef.current?.selectionStart ??
      commentText.length;

    const start = mentionStart >= 0 ? mentionStart : cursorPosition;
    const before = commentText.slice(0, start);
    const after = commentText.slice(cursorPosition);
    const nextValue = `${before}@${member.username} ${after}`;
    const nextCursor = before.length + member.username.length + 2;

    setCommentText(nextValue);
    setMentionSuggestionsOpen(false);
    setMentionQuery("");
    setMentionStart(-1);
    setSelectedMentionIndex(0);

    window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleCommentKeyDown = (event) => {
    if (!mentionSuggestionsOpen || !mentionSuggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedMentionIndex((current) =>
        (current + 1) % mentionSuggestions.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedMentionIndex((current) =>
        current === 0
          ? mentionSuggestions.length - 1
          : current - 1
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const selected =
        mentionSuggestions[selectedMentionIndex];

      if (selected) {
        event.preventDefault();
        selectMention(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMentionSuggestionsOpen(false);
    }
  };

  const handleCommentBlur = () => {
    window.setTimeout(() => {
      setMentionSuggestionsOpen(false);
    }, 150);
  };

  const startReply = (comment) => {
    setReplyingTo(comment);
    setCommentMenuId(null);
    setError("");
    setMentionSuggestionsOpen(false);

    /*
     * Keep the composer focused when possible.
     */
    window.setTimeout(() => {
      const composer =
        document.querySelector(
          ".comment-composer textarea"
        );

      composer?.focus();
    }, 0);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const startEditingComment = (
    comment
  ) => {
    setEditingCommentId(
      comment.id
    );

    setEditingText(
      comment.content || ""
    );

    setCommentMenuId(null);
    setError("");
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleUpdateComment = async (
    commentId
  ) => {
    const content =
      editingText.trim();

    if (!content) {
      setError(
        "Comment cannot be empty."
      );
      return;
    }

    try {
      setError("");

      const updated =
        await updateComment(
          commentId,
          content
        );

      setComments((current) =>
        current.map((comment) =>
          String(comment.id) ===
          String(commentId)
            ? updated
            : comment
        )
      );

      cancelEditingComment();
    } catch (err) {
      console.error(
        "Failed to update comment:",
        err
      );

      setError(
        extractError(
          err,
          "Unable to update comment."
        )
      );
    }
  };

  /*
   * Open custom comment deletion dialog.
   */
  const handleDeleteComment = (
    comment
  ) => {
    setCommentMenuId(null);
    setError("");
    setCommentToDelete(comment);
  };

  /*
   * Actually delete the comment after
   * confirmation.
   */
  const confirmDeleteComment =
    async () => {
      if (!commentToDelete) {
        return;
      }

      try {
        setDeletingComment(true);
        setError("");

        await deleteComment(
          commentToDelete.id
        );

        setComments((current) =>
          current.map((comment) =>
            String(comment.id) ===
            String(commentToDelete.id)
              ? {
                  ...comment,
                  is_deleted: true,
                  content:
                    "Comment deleted",
                }
              : comment
          )
        );

        /*
         * If this comment had a reply composer
         * open, close it.
         */
        if (
          replyingTo &&
          String(replyingTo.id) ===
            String(commentToDelete.id)
        ) {
          setReplyingTo(null);
        }

        setCommentToDelete(null);
      } catch (err) {
        console.error(
          "Failed to delete comment:",
          err
        );

        setError(
          extractError(
            err,
            "Unable to delete comment."
          )
        );
      } finally {
        setDeletingComment(false);
      }
    };

  /*
   * Open custom task deletion dialog.
   */
  const handleDeleteTask = () => {
    setError("");
    setTaskDeleteOpen(true);
  };

  /*
   * Actually delete the task after
   * confirmation.
   */
  const confirmDeleteTask =
    async () => {
      try {
        setDeletingTask(true);
        setError("");

        await deleteTask(task.id);

        onTaskDeleted?.(
          task.id
        );

        setTaskDeleteOpen(false);
        onClose();
      } catch (err) {
        console.error(
          "Failed to delete task:",
          err
        );

        setError(
          extractError(
            err,
            "Unable to delete task."
          )
        );
      } finally {
        setDeletingTask(false);
      }
    };

  const renderComment = (
    comment,
    isReply = false
  ) => {
    const author =
      getCommentAuthor(comment);

    const commentUserId =
      comment?.user_id ??
      comment?.user?.id;

    const isAuthor =
      String(commentUserId) ===
      String(user?.id);

    const replies =
      getReplies(comment.id);

    if (comment.is_deleted) {
      return (
        <div
          className={`comment-item comment-deleted ${
            isReply
              ? "comment-reply"
              : ""
          }`}
          key={comment.id}
        >
          <span>
            Comment deleted
          </span>
        </div>
      );
    }

    return (
      <div
        className={`comment-item ${
          isReply
            ? "comment-reply"
            : ""
        }`}
        key={comment.id}
      >
        <div className="comment-avatar">
          {getInitials(author)}
        </div>

        <div className="comment-content">
          <div className="comment-top">
            <div>
              <strong>
                {author}
              </strong>

              <span>
                {formatDateTime(
                  comment.created_at
                )}
              </span>
            </div>

            {isAuthor && (
              <div className="comment-actions">
                <button
                  type="button"
                  onClick={() =>
                    setCommentMenuId(
                      commentMenuId ===
                        comment.id
                        ? null
                        : comment.id
                    )
                  }
                >
                  <FiMoreHorizontal />
                </button>

                {commentMenuId ===
                  comment.id && (
                  <div className="comment-menu">
                    <button
                      type="button"
                      onClick={() =>
                        startEditingComment(
                          comment
                        )
                      }
                    >
                      <FiEdit2 />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger-action"
                      onClick={() =>
                        handleDeleteComment(
                          comment
                        )
                      }
                    >
                      <FiTrash2 />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editingCommentId ===
          comment.id ? (
            <div className="comment-edit">
              <textarea
                value={
                  editingText
                }
                onChange={(event) =>
                  setEditingText(
                    event.target
                      .value
                  )
                }
                rows="3"
              />

              <div className="comment-edit-actions">
                <button
                  type="button"
                  onClick={
                    cancelEditingComment
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="workspace-primary-btn"
                  onClick={() =>
                    handleUpdateComment(
                      comment.id
                    )
                  }
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p>
              {comment.content}
            </p>
          )}

          {!isReply &&
            !comment.is_deleted &&
            !isAuthor && (
              <button
                type="button"
                className="comment-reply-btn"
                onClick={() =>
                  startReply(comment)
                }
              >
                <FiMessageCircle />
                Reply
              </button>
            )}

          {!isReply &&
            replies.length > 0 && (
              <div className="comment-replies">
                {replies.map(
                  (reply) =>
                    renderComment(
                      reply,
                      true
                    )
                )}
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="modal-backdrop task-details-backdrop"
        onMouseDown={onClose}
      >
        <div
          className="task-details-modal"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div className="task-details-header">
            <div>
              <span className="section-eyebrow">
                TASK DETAILS
              </span>

              <h2>{task.title}</h2>

              <span className="task-details-id">
                Task #{task.id}
              </span>
            </div>

            <button
              type="button"
              className="modal-close"
              onClick={onClose}
            >
              <FiX />
            </button>
          </div>

          <div className="task-details-body">
            <div className="task-details-main">
              <div className="task-detail-description">
                <div className="task-details-label">
                  Description
                </div>

                <p>
                  {task.description ||
                    "No description has been added to this task."}
                </p>
              </div>

              <div className="task-detail-grid">
                <div className="task-detail-item">
                  <span>
                    <FiCheckCircle />
                    Status
                  </span>

                  <strong>
                    {task.status?.replaceAll(
                      "_",
                      " "
                    )}
                  </strong>
                </div>

                <div className="task-detail-item">
                  <span>
                    <FiMessageCircle />
                    Priority
                  </span>

                  <strong>
                    {task.priority}
                  </strong>
                </div>

                <div className="task-detail-item">
                  <span>
                    <FiUser />
                    Assignee
                  </span>

                  <strong>
                    {getAssigneeName()}
                  </strong>
                </div>

                <div className="task-detail-item">
                  <span>
                    <FiCalendar />
                    Due date
                  </span>

                  <strong>
                    {formatDate(
                      task.due_date
                    )}
                  </strong>
                </div>

                <div className="task-detail-item">
                  <span>
                    <FiClock />
                    Estimated time
                  </span>

                  <strong>
                    {task.estimated_hours
                      ? `${task.estimated_hours} hours`
                      : "Not estimated"}
                  </strong>
                </div>

                <div className="task-detail-item">
                  <span>
                    <FiUser />
                    Created by
                  </span>

                  <strong>
                    {task.created_by_username ||
                      "Unknown"}
                  </strong>
                </div>
              </div>

              <div className="task-details-actions">
                <button
                  type="button"
                  className="workspace-outline-btn"
                  onClick={() => {
                    onClose();
                    onEditTask?.(task);
                  }}
                >
                  <FiEdit2 />
                  Edit task
                </button>

                <button
                  type="button"
                  className="task-danger-btn"
                  onClick={
                    handleDeleteTask
                  }
                >
                  <FiTrash2 />
                  Delete task
                </button>
              </div>
            </div>

            <aside className="task-comments-panel">
              <div className="task-comments-heading">
                <div>
                  <span className="section-eyebrow">
                    COMMUNICATION
                  </span>

                  <h3>Comments</h3>
                </div>

                <span className="comment-count">
                  {
                    comments.filter(
                      (comment) =>
                        !comment.is_deleted
                    ).length
                  }
                </span>
              </div>

              {error && (
                <div className="form-error">
                  {error}
                </div>
              )}

              <div className="comments-list">
                {commentsLoading ? (
                  <div className="comments-loading">
                    <div className="workspace-spinner" />

                    <span>
                      Loading comments...
                    </span>
                  </div>
                ) : comments.length ===
                  0 ? (
                  <div className="comments-empty">
                    <div className="comments-empty-icon">
                      <FiMessageCircle />
                    </div>

                    <strong>
                      No comments yet
                    </strong>

                    <span>
                      Start the conversation
                      about this task.
                    </span>
                  </div>
                ) : (
                  topLevelComments.map(
                    (comment) =>
                      renderComment(
                        comment
                      )
                  )
                )}
              </div>

              <form
                className="comment-composer"
                onSubmit={
                  handleAddComment
                }
              >
                {replyingTo && (
                  <div className="replying-to">
                    <div>
                      <span>
                        Replying to{" "}
                        <strong>
                          {getCommentAuthor(
                            replyingTo
                          )}
                        </strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        cancelReply
                      }
                      aria-label="Cancel reply"
                    >
                      <FiX />
                    </button>
                  </div>
                )}

                <div className="comment-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    placeholder={
                      replyingTo
                        ? `Reply to ${getCommentAuthor(
                            replyingTo
                          )}...`
                        : "Write a comment..."
                    }
                    value={commentText}
                    onChange={handleCommentTextChange}
                    onKeyDown={handleCommentKeyDown}
                    onBlur={handleCommentBlur}
                    rows="3"
                  />

                  {mentionSuggestionsOpen &&
                    mentionSuggestions.length > 0 && (
                      <div className="mention-suggestions">
                        <div className="mention-suggestions-header">
                          Mention a project member
                        </div>

                        {mentionSuggestions.map((member, index) => (
                          <button
                            key={member.id}
                            type="button"
                            className={`mention-suggestion ${
                              index === selectedMentionIndex
                                ? "mention-suggestion-active"
                                : ""
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectMention(member);
                            }}
                          >
                            <span className="mention-avatar">
                              {getInitials(member.displayName)}
                            </span>

                            <span className="mention-user-info">
                              <strong>
                                @{member.username}
                              </strong>
                              <span>
                                {member.displayName}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                <div className="comment-composer-footer">
                  <span>
                    <FiMessageCircle />
                    Team discussion
                  </span>

                  <button
                    type="submit"
                    className="workspace-primary-btn"
                    disabled={
                      commentSubmitting ||
                      !commentText.trim()
                    }
                  >
                    <FiSend />

                    {commentSubmitting
                      ? "Sending..."
                      : replyingTo
                      ? "Reply"
                      : "Comment"}
                  </button>
                </div>
              </form>
            </aside>
          </div>
        </div>
      </div>

      {commentToDelete && (
        <div
          className="modal-backdrop"
          onMouseDown={() =>
            !deletingComment &&
            setCommentToDelete(null)
          }
        >
          <div
            className="workspace-modal comment-delete-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="workspace-modal-header">
              <div>
                <span className="section-eyebrow">
                  DELETE COMMENT
                </span>

                <h3>
                  Delete this comment?
                </h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  !deletingComment &&
                  setCommentToDelete(
                    null
                  )
                }
                disabled={
                  deletingComment
                }
              >
                <FiX />
              </button>
            </div>

            <div className="comment-delete-content">
              <div className="comment-delete-icon">
                <FiTrash2 />
              </div>

              <div className="comment-delete-info">
                <strong>
                  {getCommentAuthor(
                    commentToDelete
                  )}
                </strong>

                <span>
                  This comment will be
                  removed from the task
                  discussion.
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="workspace-outline-btn"
                onClick={() =>
                  setCommentToDelete(
                    null
                  )
                }
                disabled={
                  deletingComment
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="comment-delete-confirm-btn"
                onClick={
                  confirmDeleteComment
                }
                disabled={
                  deletingComment
                }
              >
                <FiTrash2 />

                {deletingComment
                  ? "Deleting..."
                  : "Delete comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskDeleteOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() =>
            !deletingTask &&
            setTaskDeleteOpen(false)
          }
        >
          <div
            className="workspace-modal task-delete-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="workspace-modal-header">
              <div>
                <span className="section-eyebrow">
                  DELETE TASK
                </span>

                <h3>
                  Delete this task?
                </h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  !deletingTask &&
                  setTaskDeleteOpen(
                    false
                  )
                }
                disabled={deletingTask}
              >
                <FiX />
              </button>
            </div>

            <div className="task-delete-content">
              <div className="task-delete-icon">
                <FiTrash2 />
              </div>

              <div className="task-delete-info">
                <strong>
                  {task.title}
                </strong>

                <span>
                  Are you sure you want
                  to permanently delete
                  this task?
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="workspace-outline-btn"
                onClick={() =>
                  setTaskDeleteOpen(
                    false
                  )
                }
                disabled={deletingTask}
              >
                Cancel
              </button>

              <button
                type="button"
                className="task-delete-confirm-btn"
                onClick={
                  confirmDeleteTask
                }
                disabled={deletingTask}
              >
                <FiTrash2 />

                {deletingTask
                  ? "Deleting..."
                  : "Delete task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TaskDetailsModal;