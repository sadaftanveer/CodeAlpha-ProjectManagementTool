import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiEdit2,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from "../services/taskService";

import TaskDetailsModal from "./TaskDetailsModal";
import { createProjectSocket } from "../services/projectSocket";

import "../styles/taskBoard.css";

const STATUS_COLUMNS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BLOCKED", label: "Blocked" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const MANAGER_ROLES = ["OWNER", "MANAGER"];

const EMPTY_FORM = {
  title: "",
  description: "",
  assigned_to: "",
  status: "TODO",
  priority: "MEDIUM",
  due_date: "",
  estimated_hours: "",
};

function getMemberId(member) {
  return (
    member?.user_id ??
    member?.user?.id ??
    member?.user?.pk ??
    member?.id
  );
}

function getMemberName(member) {
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

  const fullName = [firstName, lastName]
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    username ||
    member?.email ||
    member?.user?.email ||
    "Member"
  );
}

function getMemberRole(member) {
  return String(
    member?.role ??
      member?.user_role ??
      member?.role_name ??
      ""
  ).toUpperCase();
}

function getInitials(name = "") {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "U";
}

function formatTaskDate(date) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(date, status) {
  if (!date || status === "COMPLETED") {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const taskDate = new Date(`${date}T00:00:00`);

  return !Number.isNaN(taskDate.getTime()) && taskDate < today;
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
          return value.map((item) => `${key}: ${item}`);
        }

        if (typeof value === "string") {
          return [`${key}: ${value}`];
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

function normalizeTaskResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

/*
 * Optional permission props:
 *
 * canManageTasks  - explicit owner/manager permission
 * projectOwnerId  - project's owner user ID
 * currentUserRole - current user's project role
 *
 * When these are not provided, the user's role is determined
 * from the members array. If the role cannot be determined,
 * the board defaults to read-only.
 */
function TaskBoard({
  projectId,
  members = [],
  notificationTaskId,
  notificationCommentId,
  canManageTasks,
  projectOwnerId,
  currentUserRole,
}) {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);

  /*
   * Loading is derived from the ID of the project whose
   * tasks have finished loading. This avoids setting loading
   * state synchronously inside useEffect.
   */
  const [loadedProjectId, setLoadedProjectId] = useState(null);

  const loading =
    Boolean(projectId) &&
    String(loadedProjectId) !== String(projectId);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [openTaskMenu, setOpenTaskMenu] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);

  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const openedNotificationRef = useRef(null);

  /*
   * Member lookup.
   */
  const memberMap = useMemo(() => {
    return new Map(
      members.map((member) => [
        String(getMemberId(member)),
        {
          id: getMemberId(member),
          name: getMemberName(member),
        },
      ])
    );
  }, [members]);

  /*
 * Determine whether the current user can manage tasks.
 * Only project owners and managers can manage tasks.
 */
let canManage = false;

if (typeof canManageTasks === "boolean") {
  // Use explicitly supplied permissions when available.
  canManage = canManageTasks;
} else if (user?.id) {
  // The project owner can manage tasks.
  if (
    projectOwnerId !== undefined &&
    projectOwnerId !== null &&
    String(projectOwnerId) === String(user.id)
  ) {
    canManage = true;
  } else if (currentUserRole) {
    // Use the explicitly supplied project role.
    canManage = MANAGER_ROLES.includes(
      String(currentUserRole).toUpperCase()
    );
  } else {
    // Otherwise, determine permissions from project membership.
    const currentMember = members.find(
      (member) =>
        String(getMemberId(member)) === String(user.id)
    );

    canManage =
      Boolean(currentMember?.is_owner) ||
      MANAGER_ROLES.includes(
        getMemberRole(currentMember || {})
      );
  }
} [
    canManageTasks,
    projectOwnerId,
    currentUserRole,
    members,
    user?.id,
  ];

  /*
   * Load tasks for the selected project.
   */
  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    let cancelled = false;

    async function loadTasks() {
      try {
        const data = await getTasks(projectId);

        if (cancelled) {
          return;
        }

        setTasks(normalizeTaskResponse(data));
        setError("");
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load tasks:", err);

        setTasks([]);
        setError(
          extractError(err, "Unable to load project tasks.")
        );
      } finally {
        if (!cancelled) {
          setLoadedProjectId(String(projectId));
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /*
   * Open a task referenced by a notification.
   *
   * Example:
   * /projects/5?task=12&comment=8
   *
   * The ref prevents the modal from reopening when a WebSocket
   * refresh changes the tasks array.
   */
  useEffect(() => {
    if (!notificationTaskId || tasks.length === 0) {
      return undefined;
    }

    const notificationKey =
      `${notificationTaskId}:${notificationCommentId ?? ""}`;

    if (openedNotificationRef.current === notificationKey) {
      return undefined;
    }

    const targetTask = tasks.find(
      (task) => String(task.id) === String(notificationTaskId)
    );

    if (!targetTask) {
      return undefined;
    }

    openedNotificationRef.current = notificationKey;

    const timer = window.setTimeout(() => {
      setSelectedTask(targetTask);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    notificationTaskId,
    notificationCommentId,
    tasks,
  ]);

  /*
   * Subscribe to project task events.
   *
   * Events:
   * TASK_CREATED
   * TASK_UPDATED
   * TASK_DELETED
   *
   * The task list is refreshed from Django after an event so
   * every browser receives the persisted database state.
   */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!projectId || !token) {
      return undefined;
    }

    let socket = null;
    let cancelled = false;

    const handleProjectEvent = async (message) => {
      if (cancelled) {
        return;
      }

      const eventType =
        message?.type ||
        message?.data?.type;

      if (
        ![
          "TASK_CREATED",
          "TASK_UPDATED",
          "TASK_DELETED",
        ].includes(eventType)
      ) {
        return;
      }

      try {
        const data = await getTasks(projectId);

        if (cancelled) {
          return;
        }

        setTasks(normalizeTaskResponse(data));
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to refresh tasks after WebSocket event:",
          err
        );
      }
    };

    socket = createProjectSocket(
      projectId,
      token,
      handleProjectEvent,
      () => {
        console.log("Real-time project updates enabled.");
      },
      () => {
        console.log("Project real-time connection closed.");
      },
      (socketError) => {
        console.warn(
          "Project real-time connection error:",
          socketError
        );
      }
    );

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [projectId]);

  /*
   * Allow Escape to close the delete confirmation dialog.
   */
  useEffect(() => {
    if (!taskToDelete) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deletingTask) {
        setTaskToDelete(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [taskToDelete, deletingTask]);

  /*
   * Filter the tasks.
   */
  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const title = String(task?.title ?? "").toLowerCase();
      const description = String(
        task?.description ?? ""
      ).toLowerCase();

      const assignee = String(
        task?.assigned_to_username ?? ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        title.includes(query) ||
        description.includes(query) ||
        assignee.includes(query);

      const matchesPriority =
        priorityFilter === "ALL" ||
        task?.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [tasks, searchTerm, priorityFilter]);

  /*
   * Group the tasks into Kanban columns.
   */
  const groupedTasks = useMemo(() => {
    return STATUS_COLUMNS.reduce((groups, column) => {
      groups[column.value] = filteredTasks.filter(
        (task) => task.status === column.value
      );

      return groups;
    }, {});
  }, [filteredTasks]);

  /*
   * Task statistics.
   */
  const stats = useMemo(() => {
    const completed = tasks.filter(
      (task) => task.status === "COMPLETED"
    ).length;

    const overdue = tasks.filter((task) =>
      isOverdue(task.due_date, task.status)
    ).length;

    return {
      total: tasks.length,
      completed,
      overdue,
      progress: tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0,
    };
  }, [tasks]);

  /*
   * Reset the task form.
   */
  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingTask(null);
  };

  /*
   * Open the create dialog.
   */
  const openCreateModal = (status = "TODO") => {
    if (!canManage || saving) {
      return;
    }

    setEditingTask(null);

    setForm({
      ...EMPTY_FORM,
      status,
    });

    setError("");
    setOpenTaskMenu(null);
    setShowTaskModal(true);
  };

  /*
   * Open the edit dialog.
   */
  const openEditModal = (task) => {
    if (!canManage || saving) {
      return;
    }

    setEditingTask(task);

    setForm({
      title: task?.title || "",
      description: task?.description || "",
      assigned_to:
        task?.assigned_to !== null &&
        task?.assigned_to !== undefined
          ? String(task.assigned_to)
          : "",
      status: task?.status || "TODO",
      priority: task?.priority || "MEDIUM",
      due_date: task?.due_date || "",
      estimated_hours: task?.estimated_hours ?? "",
    });

    setError("");
    setOpenTaskMenu(null);
    setShowTaskModal(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /*
   * Create or update a task.
   */
  const handleSaveTask = async (event) => {
    event.preventDefault();

    if (!canManage || saving) {
      return;
    }

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        project: Number(projectId),
        assigned_to:
          form.assigned_to === ""
            ? null
            : Number(form.assigned_to),
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        estimated_hours:
          form.estimated_hours === ""
            ? null
            : Number(form.estimated_hours),
      };

      if (editingTask) {
        const updated = await updateTask(
          editingTask.id,
          payload
        );

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTask.id ? updated : task
          )
        );

        setSelectedTask((current) =>
          current?.id === editingTask.id
            ? updated
            : current
        );
      } else {
        const created = await createTask(payload);

        setTasks((current) => [
          created,
          ...current,
        ]);
      }

      resetForm();
      setShowTaskModal(false);
    } catch (err) {
      console.error("Failed to save task:", err);

      setError(
        extractError(err, "Unable to save this task.")
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * Open the delete confirmation dialog.
   * This function does not delete anything yet.
   */
  const handleDeleteTask = (task) => {
    if (!canManage || deletingTask) {
      return;
    }

    setOpenTaskMenu(null);
    setError("");
    setTaskToDelete(task);
  };

  /*
   * Actually delete the task after confirmation.
   */
  const confirmDeleteTask = async () => {
    if (!canManage || !taskToDelete || deletingTask) {
      return;
    }

    try {
      setDeletingTask(true);
      setError("");

      await deleteTask(taskToDelete.id);

      setTasks((current) =>
        current.filter(
          (task) => task.id !== taskToDelete.id
        )
      );

      setSelectedTask((current) =>
        current?.id === taskToDelete.id
          ? null
          : current
      );

      setTaskToDelete(null);
    } catch (err) {
      console.error("Failed to delete task:", err);

      setError(
        extractError(err, "Unable to delete this task.")
      );
    } finally {
      setDeletingTask(false);
    }
  };

  /*
   * Drag a task to a different column.
   */
  const handleDrop = async (status) => {
    if (!canManage || !draggedTask) {
      setDraggedTask(null);
      return;
    }

    const task = draggedTask;

    setDraggedTask(null);

    if (task.status === status) {
      return;
    }

    const previousTasks = [...tasks];

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status,
              completed_at:
                status === "COMPLETED"
                  ? new Date().toISOString()
                  : null,
            }
          : item
      )
    );

    setSelectedTask((current) =>
      current?.id === task.id
        ? { ...current, status }
        : current
    );

    try {
      const updated = await updateTask(task.id, {
        status,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? updated : item
        )
      );

      setSelectedTask((current) =>
        current?.id === task.id
          ? updated
          : current
      );
    } catch (err) {
      console.error("Failed to change task status:", err);

      setTasks(previousTasks);

      setSelectedTask((current) =>
        current?.id === task.id
          ? task
          : current
      );

      setError(
        extractError(err, "Unable to change task status.")
      );
    }
  };

  /*
   * Change status using the card dropdown.
   */
  const handleStatusChange = async (task, status) => {
    if (!canManage || task.status === status) {
      return;
    }

    const previousStatus = task.status;

    setError("");

    // Update the visible card immediately.
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status }
          : item
      )
    );

    setSelectedTask((current) =>
      current?.id === task.id
        ? { ...current, status }
        : current
    );

    try {
      const updated = await updateTask(task.id, {
        status,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? updated : item
        )
      );

      setSelectedTask((current) =>
        current?.id === task.id
          ? updated
          : current
      );
    } catch (err) {
      console.error("Failed to update status:", err);

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, status: previousStatus }
            : item
        )
      );

      setSelectedTask((current) =>
        current?.id === task.id
          ? { ...current, status: previousStatus }
          : current
      );

      setError(
        extractError(err, "Unable to update task status.")
      );
    }
  };

  /*
   * Keep the board synchronized when the details modal
   * deletes a task itself.
   */
  const handleTaskDeleted = (taskId) => {
    setTasks((current) =>
      current.filter((task) => task.id !== taskId)
    );

    setSelectedTask(null);
  };

  return (
    <div className="task-board-wrapper">
      {/* Toolbar */}
      <div className="task-board-toolbar">
        <div className="task-board-summary">
          <div className="task-summary-item">
            <strong>{stats.total}</strong>
            <span>Total</span>
          </div>

          <div className="task-summary-item">
            <strong>{stats.completed}</strong>
            <span>Completed</span>
          </div>

          <div className="task-summary-item">
            <strong>{stats.overdue}</strong>
            <span>Overdue</span>
          </div>

          <div className="task-progress">
            <div className="task-progress-top">
              <span>Progress</span>
              <strong>{stats.progress}%</strong>
            </div>

            <div className="task-progress-track">
              <div
                className="task-progress-value"
                style={{
                  width: `${stats.progress}%`,
                }}
              />
            </div>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            className="workspace-primary-btn"
            onClick={() => openCreateModal()}
          >
            <FiPlus />
            New task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="task-board-filters">
        <div className="task-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />
        </div>

        <select
          value={priorityFilter}
          onChange={(event) =>
            setPriorityFilter(event.target.value)
          }
        >
          <option value="ALL">All priorities</option>

          {PRIORITIES.map((priority) => (
            <option
              value={priority.value}
              key={priority.value}
            >
              {priority.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && !taskToDelete && (
        <div
          className="workspace-alert task-board-alert"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="task-board-loading">
          <div className="workspace-spinner" />
          <span>Loading tasks...</span>
        </div>
      ) : (
        <div className="kanban-board">
          {STATUS_COLUMNS.map((column) => {
            const columnTasks =
              groupedTasks[column.value] || [];

            return (
              <div
                className={`kanban-column kanban-${column.value.toLowerCase()}`}
                key={column.value}
                onDragOver={(event) => {
                  if (canManage) {
                    event.preventDefault();
                  }
                }}
                onDrop={() => handleDrop(column.value)}
              >
                {/* Column header */}
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span className="kanban-status-dot" />

                    <h3>{column.label}</h3>

                    <span className="kanban-count">
                      {columnTasks.length}
                    </span>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      className="kanban-add-btn"
                      onClick={() =>
                        openCreateModal(column.value)
                      }
                      aria-label={`Add task to ${column.label}`}
                    >
                      <FiPlus />
                    </button>
                  )}
                </div>

                {/* Column body */}
                <div className="kanban-column-body">
                  {columnTasks.length === 0 ? (
                    <div className="kanban-empty">
                      <span>No tasks here</span>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const member = memberMap.get(
                        String(task?.assigned_to)
                      );

                      const assignedName =
                        member?.name ||
                        task?.assigned_to_username ||
                        "Unassigned";

                      const overdue = isOverdue(
                        task?.due_date,
                        task?.status
                      );

                      return (
                        <article
                          className={`task-card ${
                            canManage
                              ? ""
                              : "task-card-readonly"
                          }`}
                          key={task.id}
                          draggable={canManage}
                          onClick={() =>
                            setSelectedTask(task)
                          }
                          onDragStart={(event) => {
                            if (!canManage) {
                              event.preventDefault();
                              return;
                            }

                            event.stopPropagation();
                            setDraggedTask(task);
                          }}
                          onDragEnd={() =>
                            setDraggedTask(null)
                          }
                        >
                          {/* Card top */}
                          <div className="task-card-top">
                            <span
                              className={`task-priority task-priority-${String(
                                task.priority || "MEDIUM"
                              ).toLowerCase()}`}
                            >
                              {task.priority || "MEDIUM"}
                            </span>

                            {canManage && (
                              <div className="task-card-actions">
                                <button
                                  type="button"
                                  aria-label={`Actions for ${task.title}`}
                                  onClick={(event) => {
                                    event.stopPropagation();

                                    setOpenTaskMenu(
                                      openTaskMenu === task.id
                                        ? null
                                        : task.id
                                    );
                                  }}
                                >
                                  <FiMoreHorizontal />
                                </button>

                                {openTaskMenu === task.id && (
                                  <div className="task-card-menu">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openEditModal(task);
                                      }}
                                    >
                                      <FiEdit2 />
                                      Edit task
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-action"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteTask(task);
                                      }}
                                    >
                                      <FiTrash2 />
                                      Delete task
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <h4>{task.title}</h4>

                          {/* Description */}
                          {task.description && (
                            <p className="task-description">
                              {task.description}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="task-card-meta">
                            {task.due_date && (
                              <span
                                className={
                                  overdue
                                    ? "task-meta-overdue"
                                    : ""
                                }
                              >
                                <FiCalendar />
                                {formatTaskDate(task.due_date)}
                              </span>
                            )}

                            {task.estimated_hours !== null &&
                              task.estimated_hours !== undefined &&
                              task.estimated_hours !== "" && (
                                <span>
                                  <FiClock />
                                  {task.estimated_hours}h
                                </span>
                              )}
                          </div>

                          {/* Footer */}
                          <div className="task-card-footer">
                            <div className="task-assignee">
                              <div className="task-assignee-avatar">
                                {assignedName === "Unassigned" ? (
                                  <FiUser />
                                ) : (
                                  getInitials(assignedName)
                                )}
                              </div>

                              <span>{assignedName}</span>
                            </div>

                            {canManage && (
                              <select
                                value={task.status}
                                aria-label={`Change status for ${task.title}`}
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                                onChange={(event) => {
                                  event.stopPropagation();

                                  handleStatusChange(
                                    task,
                                    event.target.value
                                  );
                                }}
                              >
                                {STATUS_COLUMNS.map((status) => (
                                  <option
                                    value={status.value}
                                    key={status.value}
                                  >
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}

                  {/* Add task */}
                  {canManage && columnTasks.length > 0 && (
                    <button
                      type="button"
                      className="kanban-add-task"
                      onClick={() =>
                        openCreateModal(column.value)
                      }
                    >
                      <FiPlus />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit task modal */}
      {showTaskModal && canManage && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!saving) {
              setShowTaskModal(false);
            }
          }}
        >
          <div
            className="workspace-modal workspace-modal-large"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-eyebrow">
                  TASK MANAGEMENT
                </span>

                <h2>
                  {editingTask
                    ? "Edit task"
                    : "Create task"}
                </h2>

                <p>
                  Add the work item, assign a team member,
                  and define its priority.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close task form"
                onClick={() => {
                  if (!saving) {
                    setShowTaskModal(false);
                  }
                }}
              >
                <FiX />
              </button>
            </div>

            <form
              className="workspace-form"
              onSubmit={handleSaveTask}
            >
              <div className="form-grid">
                <div className="form-field full">
                  <label htmlFor="task-title">
                    Task title
                  </label>

                  <input
                    id="task-title"
                    name="title"
                    type="text"
                    placeholder="e.g. Build dashboard UI"
                    value={form.title}
                    onChange={handleFormChange}
                    maxLength={255}
                    required
                  />
                </div>

                <div className="form-field full">
                  <label htmlFor="task-description">
                    Description
                  </label>

                  <textarea
                    id="task-description"
                    name="description"
                    rows="5"
                    placeholder="Describe what needs to be completed..."
                    value={form.description}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="task-assignee">
                    Assign to
                  </label>

                  <div className="task-select-with-icon">
                    <FiUser />

                    <select
                      id="task-assignee"
                      name="assigned_to"
                      value={form.assigned_to}
                      onChange={handleFormChange}
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {members.map((member) => {
                        const id = getMemberId(member);

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {getMemberName(member)}
                          </option>
                        );
                      })}
                    </select>

                    <FiChevronDown className="select-arrow" />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="task-status">
                    Status
                  </label>

                  <select
                    id="task-status"
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    {STATUS_COLUMNS.map((status) => (
                      <option
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="task-priority">
                    Priority
                  </label>

                  <select
                    id="task-priority"
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                  >
                    {PRIORITIES.map((priority) => (
                      <option
                        key={priority.value}
                        value={priority.value}
                      >
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="task-due-date">
                    Due date
                  </label>

                  <input
                    id="task-due-date"
                    type="date"
                    name="due_date"
                    value={form.due_date}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field full">
                  <label htmlFor="task-hours">
                    Estimated hours
                  </label>

                  <div className="task-number-wrap">
                    <FiClock />

                    <input
                      id="task-hours"
                      type="number"
                      name="estimated_hours"
                      min="0"
                      step="0.25"
                      placeholder="e.g. 4"
                      value={form.estimated_hours}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="workspace-cancel-btn"
                  disabled={saving}
                  onClick={() =>
                    setShowTaskModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="workspace-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingTask
                      ? "Save changes"
                      : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {taskToDelete && canManage && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!deletingTask) {
              setTaskToDelete(null);
            }
          }}
        >
          <div
            className="workspace-modal task-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            aria-describedby="delete-task-description"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-eyebrow">
                  DELETE TASK
                </span>

                <h2 id="delete-task-title">
                  Delete task?
                </h2>

                <p>
                  This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close delete confirmation"
                disabled={deletingTask}
                onClick={() =>
                  setTaskToDelete(null)
                }
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
                  {taskToDelete.title}
                </strong>

                <span id="delete-task-description">
                  Are you sure you want to permanently
                  delete this task?
                </span>
              </div>
            </div>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="workspace-cancel-btn"
                disabled={deletingTask}
                onClick={() =>
                  setTaskToDelete(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="task-delete-confirm-btn"
                disabled={deletingTask}
                onClick={confirmDeleteTask}
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

      {/* Task details and comments */}
      {selectedTask && (
        <TaskDetailsModal
          projectId={projectId}
          task={selectedTask}
          members={members}
          notificationCommentId={notificationCommentId}
          canManage={canManage}
          onClose={() =>
            setSelectedTask(null)
          }
          onTaskDeleted={handleTaskDeleted}
          onTaskUpdated={(updatedTask) => {
            setTasks((current) =>
              current.map((task) =>
                task.id === updatedTask.id
                  ? updatedTask
                  : task
              )
            );

            setSelectedTask(updatedTask);
          }}
          onEditTask={
            canManage
              ? (task) => {
                  setSelectedTask(null);
                  openEditModal(task);
                }
              : undefined
          }
          onRequestDelete={
            canManage
              ? (task) => {
                  setSelectedTask(null);
                  handleDeleteTask(task);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

export default TaskBoard;