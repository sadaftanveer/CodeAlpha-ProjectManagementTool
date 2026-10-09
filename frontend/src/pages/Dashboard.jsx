import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaPlus,
  FaSignOutAlt,
  FaTimes,
  FaUsers,
} from "react-icons/fa";

import { useAuth } from "../context/AuthContext";
import NotificationCenter from "../components/NotificationCenter"; // CHANGED: added
import {
  createProject,
  getProjects,
} from "../services/projectService";

function Dashboard() {
  const { user, logout } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "PLANNING",
    priority: "MEDIUM",
    start_date: "",
    due_date: "",
    budget: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setError("");

    try {
      const data = await getProjects();

      setProjects(
        Array.isArray(data)
          ? data
          : data.results || []
      );
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.detail ||
          "Unable to load your projects."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  }

  function openCreateModal() {
    setFormError("");

    setFormData({
      name: "",
      description: "",
      status: "PLANNING",
      priority: "MEDIUM",
      start_date: "",
      due_date: "",
      budget: "",
    });

    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (submitting) {
      return;
    }

    setShowCreateModal(false);
    setFormError("");
  }

  async function handleCreateProject(event) {
    event.preventDefault();

    setFormError("");
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        start_date:
          formData.start_date || null,
        due_date:
          formData.due_date || null,
        budget:
          formData.budget === ""
            ? null
            : formData.budget,
      };

      const newProject =
        await createProject(payload);

      setProjects((currentProjects) => [
        newProject,
        ...currentProjects,
      ]);

      setShowCreateModal(false);

      setFormData({
        name: "",
        description: "",
        status: "PLANNING",
        priority: "MEDIUM",
        start_date: "",
        due_date: "",
        budget: "",
      });
    } catch (error) {
      console.error(error);

      const responseData =
        error.response?.data;

      if (
        responseData &&
        typeof responseData === "object"
      ) {
        const messages = Object.values(
          responseData
        )
          .flat()
          .join(" ");

        setFormError(
          messages ||
            "Unable to create the project."
        );
      } else {
        setFormError(
          "Unable to create the project."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: projects.length,

      active: projects.filter(
        (project) =>
          project.status === "ACTIVE"
      ).length,

      completed: projects.filter(
        (project) =>
          project.status === "COMPLETED"
      ).length,

      members: projects.reduce(
        (total, project) =>
          total +
          Number(
            project.member_count || 0
          ),
        0
      ),
    };
  }, [projects]);

  function getStatusLabel(status) {
    const labels = {
      PLANNING: "Planning",
      ACTIVE: "Active",
      ON_HOLD: "On Hold",
      COMPLETED: "Completed",
      ARCHIVED: "Archived",
    };

    return labels[status] || status;
  }

  function getPriorityLabel(priority) {
    const labels = {
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      URGENT: "Urgent",
    };

    return labels[priority] || priority;
  }

  function formatDate(date) {
    if (!date) {
      return "No due date";
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  const displayName =
    user?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="brand-mark">
            PF
          </div>

          <div>
            <h1>ProjectFlow</h1>
            <p>
              Collaborative project management
            </p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          {/* CHANGED: bell now lives in the header instead of floating over it */}
          <NotificationCenter />

          <div className="dashboard-user">
            <div className="user-avatar">
              {(
                user?.first_name?.[0] ||
                user?.email?.[0] ||
                "U"
              ).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>
                {user?.first_name
                  ? `${user.first_name} ${
                      user.last_name || ""
                    }`
                  : user?.email}
              </strong>

              <span>{user?.email}</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={logout}
            title="Logout"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-intro">
          <div>
            <span className="eyebrow">
              WORKSPACE
            </span>

            <h2>
              Welcome back, {displayName}
            </h2>

            <p>
              Manage your projects, collaborate
              with your team, and keep work moving
              forward.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={openCreateModal}
          >
            <FaPlus />
            New Project
          </button>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FaClipboardList />
            </div>

            <div>
              <span>Total Projects</span>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FaClock />
            </div>

            <div>
              <span>Active Projects</span>
              <strong>{stats.active}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FaCheckCircle />
            </div>

            <div>
              <span>Completed</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FaUsers />
            </div>

            <div>
              <span>Team Members</span>
              <strong>{stats.members}</strong>
            </div>
          </div>
        </section>

        <section className="projects-section">
          <div className="section-header">
            <div>
              <h3>Your Projects</h3>
              <p>
                Projects you own or are a member of.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={openCreateModal}
            >
              <FaPlus />
              Create Project
            </button>
          </div>

          {loading && (
            <div className="dashboard-state">
              <div className="state-spinner" />
              <p>Loading projects...</p>
            </div>
          )}

          {!loading && error && (
            <div className="dashboard-state error-state">
              <p>{error}</p>

              <button
                className="secondary-button"
                onClick={loadProjects}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            projects.length === 0 && (
              <div className="dashboard-state empty-state">
                <div className="empty-icon">
                  <FaClipboardList />
                </div>

                <h4>
                  No projects yet
                </h4>

                <p>
                  Create your first project and
                  start organizing your work.
                </p>

                <button
                  className="primary-button"
                  onClick={openCreateModal}
                >
                  <FaPlus />
                  Create Your First Project
                </button>
              </div>
            )}

          {!loading &&
            !error &&
            projects.length > 0 && (
              <div className="projects-grid">
                {projects.map((project) => (
                  <article
                    className="project-card"
                    key={project.id}
                  >
                    <div className="project-card-top">
                      <span
                        className={`status-badge status-${project.status?.toLowerCase()}`}
                      >
                        {getStatusLabel(
                          project.status
                        )}
                      </span>

                      <span
                        className={`priority-badge priority-${project.priority?.toLowerCase()}`}
                      >
                        {getPriorityLabel(
                          project.priority
                        )}
                      </span>
                    </div>

                    <h4>{project.name}</h4>

                    <p className="project-description">
                      {project.description ||
                        "No project description provided."}
                    </p>

                    <div className="project-card-meta">
                      <div>
                        <FaCalendarAlt />
                        <span>
                          {formatDate(
                            project.due_date
                          )}
                        </span>
                      </div>

                      <div>
                        <FaUsers />
                        <span>
                          {project.member_count ||
                            0}{" "}
                          {project.member_count ===
                          1
                            ? "member"
                            : "members"}
                        </span>
                      </div>
                    </div>

                   <button className="project-open-button"
                    onClick={() => navigate(`/projects/${project.id}`)} 
                    >
                     Open Project </button>
                  </article>
                ))}
              </div>
            )}
        </section>
      </main>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div
            className="project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  NEW PROJECT
                </span>

                <h3 id="create-project-title">
                  Create Project
                </h3>

                <p>
                  Set up the project workspace
                  for your team.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeCreateModal}
                type="button"
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            {formError && (
              <div className="form-error">
                {formError}
              </div>
            )}

            <form
              className="project-form"
              onSubmit={handleCreateProject}
            >
              <div className="form-group">
                <label htmlFor="project-name">
                  Project Name
                </label>

                <input
                  id="project-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Website Redesign"
                  maxLength={200}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="project-description">
                  Description
                </label>

                <textarea
                  id="project-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the purpose of this project..."
                  rows={4}
                />
              </div>

              <div className="project-form-grid">
                <div className="form-group">
                  <label htmlFor="project-status">
                    Status
                  </label>

                  <select
                    id="project-status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="PLANNING">
                      Planning
                    </option>

                    <option value="ACTIVE">
                      Active
                    </option>

                    <option value="ON_HOLD">
                      On Hold
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="project-priority">
                    Priority
                  </label>

                  <select
                    id="project-priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                  >
                    <option value="LOW">
                      Low
                    </option>

                    <option value="MEDIUM">
                      Medium
                    </option>

                    <option value="HIGH">
                      High
                    </option>

                    <option value="URGENT">
                      Urgent
                    </option>
                  </select>
                </div>
              </div>

              <div className="project-form-grid">
                <div className="form-group">
                  <label htmlFor="project-start-date">
                    Start Date
                  </label>

                  <input
                    id="project-start-date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="project-due-date">
                    Due Date
                  </label>

                  <input
                    id="project-due-date"
                    name="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="project-budget">
                  Budget
                  <span className="optional-label">
                    Optional
                  </span>
                </label>

                <input
                  id="project-budget"
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.budget}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeCreateModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting
                    ? "Creating..."
                    : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;