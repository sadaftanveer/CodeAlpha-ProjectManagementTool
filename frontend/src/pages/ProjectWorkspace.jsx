import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiEdit2,
  FiMail,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  updateProjectMember,
} from "../services/memberService";

import {
  deleteProject,
  getProject,
  updateProject,
} from "../services/projectService";

import { useAuth } from "../context/AuthContext";

import TaskBoard from "../components/TaskBoard";

import "../styles/projectWorkspace.css";

function getInitials(firstName = "", lastName = "", username = "") {
  const first = firstName?.trim()?.charAt(0);
  const last = lastName?.trim()?.charAt(0);

  if (first || last) {
    return `${first || ""}${last || ""}`.toUpperCase();
  }

  return username?.charAt(0)?.toUpperCase() || "U";
}

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

function formatMoney(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams] = useSearchParams();

  const notificationTaskId = searchParams.get("task");
  const notificationCommentId = searchParams.get("comment");

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");

  const [showAddMember, setShowAddMember] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState(null);
  const [memberRemoving, setMemberRemoving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [projectSaving, setProjectSaving] = useState(false);
  const [showProjectActions, setShowProjectActions] = useState(false);

  // Custom delete-project confirmation modal
  const [showDeleteProjectModal, setShowDeleteProjectModal] =
    useState(false);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState("");

  const [isEditingProject, setIsEditingProject] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "PLANNING",
    priority: "MEDIUM",
    start_date: "",
    due_date: "",
    budget: "",
  });

  /*
   * Load project and members.
   */
  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      async function loadWorkspace() {
        if (!projectId) {
          if (!cancelled) {
            setError("Project ID is missing.");
            setLoading(false);
            setMembersLoading(false);
          }

          return;
        }

        setLoading(true);
        setMembersLoading(true);
        setError("");
        setMemberError("");

        try {
          const [projectData, membersData] = await Promise.all([
            getProject(projectId),
            getProjectMembers(projectId),
          ]);

          if (cancelled) {
            return;
          }

          setProject(projectData);

          setMembers(
            Array.isArray(membersData)
              ? membersData
              : membersData?.results || []
          );

          setEditForm({
            name: projectData?.name || "",
            description: projectData?.description || "",
            status: projectData?.status || "PLANNING",
            priority: projectData?.priority || "MEDIUM",
            start_date: projectData?.start_date || "",
            due_date: projectData?.due_date || "",
            budget: projectData?.budget ?? "",
          });
        } catch (err) {
          if (cancelled) {
            return;
          }

          console.error(
            "Failed to load project workspace:",
            err
          );

          setError(
            err?.response?.data?.detail ||
              "Unable to load this project."
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
            setMembersLoading(false);
          }
        }
      }

      await loadWorkspace();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId]);

  /*
   * Open the Task Board when arriving from a task notification.
   */
  useEffect(() => {
    if (!notificationTaskId) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveTab("board");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notificationTaskId]);

  /*
   * Refresh project data.
   */
  const refreshProject = async () => {
    try {
      const data = await getProject(projectId);

      setProject(data);

      setEditForm({
        name: data?.name || "",
        description: data?.description || "",
        status: data?.status || "PLANNING",
        priority: data?.priority || "MEDIUM",
        start_date: data?.start_date || "",
        due_date: data?.due_date || "",
        budget: data?.budget ?? "",
      });
    } catch (err) {
      console.error("Failed to refresh project:", err);

      setError(
        err?.response?.data?.detail ||
          "Unable to refresh project."
      );
    }
  };

  /*
   * Refresh project members.
   */
  const refreshMembers = async () => {
    try {
      setMembersLoading(true);
      setMemberError("");

      const data = await getProjectMembers(projectId);

      setMembers(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
    } catch (err) {
      console.error("Failed to refresh members:", err);

      setMemberError(
        err?.response?.data?.detail ||
          "Unable to refresh project members."
      );
    } finally {
      setMembersLoading(false);
    }
  };

  /*
   * Determine current user's project role.
   */
  const currentMembership = useMemo(() => {
    if (!user) {
      return null;
    }

    return members.find(
      (member) =>
        String(member?.user_id) === String(user?.id) ||
        String(member?.user?.id) === String(user?.id) ||
        member?.email?.toLowerCase() === user?.email?.toLowerCase()
    );
  }, [members, user]);

  const currentRole =
    currentMembership?.role ||
    (String(project?.owner) === String(user?.id)
      ? "OWNER"
      : null);

  const isProjectOwner =
    String(project?.owner) === String(user?.id);

  const canManageProject =
    currentRole === "OWNER" ||
    currentRole === "MANAGER" ||
    isProjectOwner;

  const canManageMembers =
    currentRole === "OWNER" ||
    currentRole === "MANAGER" ||
    isProjectOwner;

  /*
   * Filter the member list.
   */
  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const name = [
        member?.first_name,
        member?.last_name,
        member?.username,
        member?.user?.first_name,
        member?.user?.last_name,
        member?.user?.username,
        member?.email,
        member?.user?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return name.includes(query);
    });
  }, [members, searchTerm]);

  /*
   * Project statistics.
   */
  const stats = [
    {
      icon: <FiUsers />,
      value: project?.member_count ?? members.length,
      label: "Members",
    },
    {
      icon: <FiCalendar />,
      value: formatDate(project?.due_date),
      label: "Due Date",
    },
    {
      icon: <FiDollarSign />,
      value:
        project?.budget !== null &&
        project?.budget !== undefined
          ? `$${formatMoney(project.budget)}`
          : "Not set",
      label: "Budget",
    },
    {
      icon: <FiClock />,
      value: formatDate(project?.start_date),
      label: "Started",
    },
  ];

  /*
   * Add a project member.
   */
  const handleAddMember = async (event) => {
    event.preventDefault();

    if (!memberEmail.trim()) {
      setMemberError("Enter an email address.");
      return;
    }

    try {
      setMemberSubmitting(true);
      setMemberError("");

      await addProjectMember(projectId, {
        email: memberEmail.trim().toLowerCase(),
        role: memberRole,
      });

      setMemberEmail("");
      setMemberRole("MEMBER");
      setShowAddMember(false);

      await refreshMembers();
      await refreshProject();
    } catch (err) {
      console.error("Failed to add member:", err);

      const data = err?.response?.data;

      setMemberError(
        data?.detail ||
          data?.email?.[0] ||
          "Unable to add this member."
      );
    } finally {
      setMemberSubmitting(false);
    }
  };

  /*
   * Update a member's role.
   */
  const handleRoleChange = async (memberId, role) => {
    try {
      setMemberError("");

      await updateProjectMember(projectId, memberId, {
        role,
      });

      setShowMemberMenu(null);

      await refreshMembers();
    } catch (err) {
      console.error("Failed to update member:", err);

      setMemberError(
        err?.response?.data?.detail ||
          "Unable to update member role."
      );
    }
  };

  /*
   * Open member-removal confirmation.
   */
  const handleRemoveMember = (member) => {
    setShowMemberMenu(null);
    setMemberError("");
    setMemberToRemove(member);
  };

  /*
   * Remove a member after confirmation.
   */
  const confirmRemoveMember = async () => {
    if (!memberToRemove || memberRemoving) {
      return;
    }

    try {
      setMemberRemoving(true);
      setMemberError("");

      await removeProjectMember(
        projectId,
        memberToRemove.id
      );

      setMemberToRemove(null);

      await refreshMembers();
      await refreshProject();
    } catch (err) {
      console.error("Failed to remove member:", err);

      setMemberError(
        err?.response?.data?.detail ||
          "Unable to remove this member."
      );
    } finally {
      setMemberRemoving(false);
    }
  };

  /*
   * Open project edit modal.
   */
  const handleEditProject = () => {
    setShowProjectActions(false);
    setError("");
    setIsEditingProject(true);
  };

  /*
   * Save project changes.
   */
  const handleProjectSave = async (event) => {
    event.preventDefault();

    if (!editForm.name.trim()) {
      return;
    }

    try {
      setProjectSaving(true);
      setError("");

      await updateProject(projectId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
        priority: editForm.priority,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        budget:
          editForm.budget === ""
            ? null
            : Number(editForm.budget),
      });

      await refreshProject();

      setIsEditingProject(false);
    } catch (err) {
      console.error("Failed to update project:", err);

      setError(
        err?.response?.data?.detail ||
          "Unable to update project."
      );
    } finally {
      setProjectSaving(false);
    }
  };

  /*
   * Open the custom delete-project confirmation modal.
   * No deletion takes place at this stage.
   */
  const handleDeleteProject = () => {
    setShowProjectActions(false);
    setProjectDeleteError("");
    setShowDeleteProjectModal(true);
  };

  /*
   * Permanently delete the project after confirmation.
   */
  const confirmDeleteProject = async () => {
    if (projectDeleting) {
      return;
    }

    try {
      setProjectDeleting(true);
      setProjectDeleteError("");

      await deleteProject(projectId);

      setShowDeleteProjectModal(false);

      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to delete project:", err);

      setProjectDeleteError(
        err?.response?.data?.detail ||
          "Unable to delete this project. Please try again."
      );
    } finally {
      setProjectDeleting(false);
    }
  };

  /*
   * Escape closes the delete-project modal.
   */
  useEffect(() => {
    if (!showDeleteProjectModal || projectDeleting) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowDeleteProjectModal(false);
        setProjectDeleteError("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDeleteProjectModal, projectDeleting]);

  /*
   * Loading screen.
   */
  if (loading) {
    return (
      <div className="workspace-loading">
        <div className="workspace-spinner" />
        <span>Loading project...</span>
      </div>
    );
  }

  /*
   * Project error screen.
   */
  if (error && !project) {
    return (
      <div className="workspace-page">
        <div className="workspace-empty">
          <div className="workspace-empty-icon">
            <FiX />
          </div>

          <h2>Unable to open project</h2>

          <p>{error}</p>

          <Link
            to="/dashboard"
            className="workspace-primary-btn"
          >
            <FiArrowLeft />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="workspace-container">
        {/* Top navigation */}
        <div className="workspace-topbar">
          <Link
            to="/dashboard"
            className="workspace-back"
          >
            <FiArrowLeft />
            <span>Back to Dashboard</span>
          </Link>

          <div className="workspace-breadcrumb">
            <span>Projects</span>
            <span>/</span>
            <strong>{project?.name}</strong>
          </div>
        </div>

        {/* Project hero */}
        <section className="project-hero">
          <div className="project-hero-content">
            <div className="project-title-row">
              <div className="project-title-area">
                <div className="project-kicker">
                  <span className="project-kicker-dot" />
                  PROJECT WORKSPACE
                </div>

                <h1>{project?.name}</h1>

                <p>
                  {project?.description ||
                    "No project description has been added yet."}
                </p>
              </div>

              {canManageProject && (
                <div className="workspace-actions">
                  <button
                    type="button"
                    className="icon-action-btn"
                    onClick={() =>
                      setShowProjectActions((value) => !value)
                    }
                    aria-label="Project actions"
                  >
                    <FiMoreHorizontal />
                  </button>

                  {showProjectActions && (
                    <div className="action-menu">
                      <button
                        type="button"
                        onClick={handleEditProject}
                      >
                        <FiEdit2 />
                        Edit project
                      </button>

                      <button
                        type="button"
                        className="danger-action"
                        onClick={handleDeleteProject}
                      >
                        <FiTrash2 />
                        Delete project
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="project-status-row">
              <span
                className={`status-badge status-${String(
                  project?.status || "PLANNING"
                ).toLowerCase()}`}
              >
                {project?.status?.replaceAll("_", " ") ||
                  "PLANNING"}
              </span>

              <span
                className={`priority-badge priority-${String(
                  project?.priority || "MEDIUM"
                ).toLowerCase()}`}
              >
                {project?.priority || "MEDIUM"} Priority
              </span>

              <span className="owner-badge">
                <FiUser />
                Owner: {project?.owner_username || "Project owner"}
              </span>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="workspace-stats">
          {stats.map((stat) => (
            <div
              className="workspace-stat-card"
              key={stat.label}
            >
              <div className="workspace-stat-icon">
                {stat.icon}
              </div>

              <div className="workspace-stat-content">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Navigation tabs */}
        <div className="workspace-tabs-wrapper">
          <div className="workspace-tabs">
            <button
              type="button"
              className={
                activeTab === "overview" ? "active" : ""
              }
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>

            <button
              type="button"
              className={
                activeTab === "board" ? "active" : ""
              }
              onClick={() => setActiveTab("board")}
            >
              Task Board
            </button>

            <button
              type="button"
              className={
                activeTab === "members" ? "active" : ""
              }
              onClick={() => setActiveTab("members")}
            >
              Members

              <span className="tab-count">
                {members.length}
              </span>
            </button>
          </div>
        </div>

        {/* General project error */}
        {error && (
          <div
            className="workspace-alert"
            role="alert"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Overview */}
        {activeTab === "overview" && (
          <section className="workspace-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">
                  PROJECT
                </span>

                <h2>Overview</h2>

                <p>
                  A quick view of the project details and current
                  configuration.
                </p>
              </div>

              {canManageProject && (
                <button
                  type="button"
                  className="workspace-outline-btn"
                  onClick={handleEditProject}
                >
                  <FiEdit2 />
                  Edit details
                </button>
              )}
            </div>

            <div className="overview-grid">
              <div className="overview-card overview-card-large">
                <div className="card-heading">
                  <div>
                    <span className="section-eyebrow">
                      DESCRIPTION
                    </span>

                    <h3>About this project</h3>
                  </div>
                </div>

                <p className="overview-description">
                  {project?.description ||
                    "No description has been added for this project."}
                </p>
              </div>

              <div className="overview-card">
                <div className="card-heading">
                  <div>
                    <span className="section-eyebrow">
                      TIMELINE
                    </span>

                    <h3>Project dates</h3>
                  </div>
                </div>

                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-icon">
                      <FiCalendar />
                    </div>

                    <div>
                      <span>Start date</span>

                      <strong>
                        {formatDate(project?.start_date)}
                      </strong>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <FiClock />
                    </div>

                    <div>
                      <span>Due date</span>

                      <strong>
                        {formatDate(project?.due_date)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-heading">
                  <div>
                    <span className="section-eyebrow">
                      PROJECT INFO
                    </span>

                    <h3>Configuration</h3>
                  </div>
                </div>

                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-icon">
                      <FiUser />
                    </div>

                    <div>
                      <span>Owner</span>

                      <strong>
                        {project?.owner_username ||
                          "Not available"}
                      </strong>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <FiDollarSign />
                    </div>

                    <div>
                      <span>Budget</span>

                      <strong>
                        {project?.budget
                          ? `$${formatMoney(project.budget)}`
                          : "Not set"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Task Board */}
        {activeTab === "board" && (
          <section className="workspace-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">
                  WORKFLOW
                </span>

                <h2>Task Board</h2>

                <p>
                  Organize project work, assign responsibilities,
                  and track progress across the project.
                </p>
              </div>
            </div>

            <TaskBoard
              projectId={projectId}
              members={members}
              notificationTaskId={notificationTaskId}
              notificationCommentId={notificationCommentId}
            />
          </section>
        )}

        {/* Members */}
        {activeTab === "members" && (
          <section className="workspace-section">
            <div className="section-heading members-heading">
              <div>
                <span className="section-eyebrow">
                  TEAM
                </span>

                <h2>Project Members</h2>

                <p>
                  Manage the people working on this project and
                  control their access level.
                </p>
              </div>

              {canManageMembers && (
                <button
                  type="button"
                  className="workspace-primary-btn"
                  onClick={() => {
                    setMemberError("");
                    setShowAddMember(true);
                  }}
                >
                  <FiPlus />
                  Add member
                </button>
              )}
            </div>

            {memberError && (
              <div
                className="workspace-alert member-alert"
                role="alert"
              >
                <span>{memberError}</span>

                <button
                  type="button"
                  onClick={() => setMemberError("")}
                  aria-label="Dismiss member error"
                >
                  <FiX />
                </button>
              </div>
            )}

            <div className="members-toolbar">
              <div className="member-search">
                <FiSearch />

                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                />
              </div>

              <span className="member-total">
                {filteredMembers.length}{" "}
                {filteredMembers.length === 1
                  ? "member"
                  : "members"}
              </span>
            </div>

            <div className="members-card">
              {membersLoading ? (
                <div className="members-loading">
                  <div className="workspace-spinner" />

                  <span>Loading members...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="members-empty">
                  <div className="members-empty-icon">
                    <FiUsers />
                  </div>

                  <h3>No members found</h3>

                  <p>
                    {searchTerm
                      ? "Try a different search."
                      : "Add your first member to this project."}
                  </p>
                </div>
              ) : (
                <div className="members-list">
                  {filteredMembers.map((member) => {
                    const memberUser = member?.user || {};

                    const firstName =
                      member?.first_name ||
                      memberUser?.first_name ||
                      "";

                    const lastName =
                      member?.last_name ||
                      memberUser?.last_name ||
                      "";

                    const username =
                      member?.username ||
                      memberUser?.username ||
                      "";

                    const email =
                      member?.email ||
                      memberUser?.email ||
                      "";

                    const role = member?.role || "MEMBER";

                    return (
                      <div
                        className="member-row"
                        key={member.id}
                      >
                        <div className="member-main">
                          <div className="member-avatar">
                            {getInitials(
                              firstName,
                              lastName,
                              username
                            )}
                          </div>

                          <div className="member-identity">
                            <strong>
                              {[
                                firstName,
                                lastName,
                              ]
                                .filter(Boolean)
                                .join(" ") ||
                                username ||
                                "Project member"}
                            </strong>

                            <span>
                              {username
                                ? `@${username}`
                                : email}
                            </span>
                          </div>
                        </div>

                        <div className="member-email">
                          <FiMail />

                          <span>{email || "No email"}</span>
                        </div>

                        <span
                          className={`role-badge role-${role.toLowerCase()}`}
                        >
                          {role}
                        </span>

                        <div className="member-actions">
                          {canManageMembers ? (
                            <>
                              <button
                                type="button"
                                className="member-menu-btn"
                                onClick={() =>
                                  setShowMemberMenu(
                                    showMemberMenu === member.id
                                      ? null
                                      : member.id
                                  )
                                }
                                aria-label={`Member actions for ${username || email}`}
                              >
                                <FiMoreHorizontal />
                              </button>

                              {showMemberMenu === member.id && (
                                <div className="member-action-menu">
                                  <span>Change role</span>

                                  {[
                                    "MANAGER",
                                    "MEMBER",
                                    "VIEWER",
                                  ].map((roleOption) => (
                                    <button
                                      type="button"
                                      key={roleOption}
                                      onClick={() =>
                                        handleRoleChange(
                                          member.id,
                                          roleOption
                                        )
                                      }
                                    >
                                      {roleOption}
                                    </button>
                                  ))}

                                  <div className="menu-divider" />

                                  <button
                                    type="button"
                                    className="danger-action"
                                    onClick={() =>
                                      handleRemoveMember(member)
                                    }
                                  >
                                    <FiTrash2 />
                                    Remove member
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="member-protected">
                              <FiUser />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Add member modal */}
        {showAddMember && (
          <div
            className="modal-backdrop"
            onMouseDown={() => {
              if (!memberSubmitting) {
                setShowAddMember(false);
              }
            }}
          >
            <div
              className="workspace-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <span className="section-eyebrow">
                    PROJECT TEAM
                  </span>

                  <h2>Add project member</h2>

                  <p>
                    Add an existing user to this project.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  disabled={memberSubmitting}
                  onClick={() => setShowAddMember(false)}
                  aria-label="Close add-member dialog"
                >
                  <FiX />
                </button>
              </div>

              <form
                className="workspace-form"
                onSubmit={handleAddMember}
              >
                <div className="form-field">
                  <label htmlFor="member-email">
                    Email address
                  </label>

                  <div className="input-with-icon">
                    <FiMail />

                    <input
                      id="member-email"
                      type="email"
                      placeholder="member@example.com"
                      value={memberEmail}
                      onChange={(event) =>
                        setMemberEmail(event.target.value)
                      }
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="member-role">
                    Project role
                  </label>

                  <select
                    id="member-role"
                    value={memberRole}
                    onChange={(event) =>
                      setMemberRole(event.target.value)
                    }
                  >
                    <option value="MANAGER">
                      Manager
                    </option>

                    <option value="MEMBER">
                      Member
                    </option>

                    <option value="VIEWER">
                      Viewer
                    </option>
                  </select>
                </div>

                {memberError && (
                  <div className="form-error" role="alert">
                    {memberError}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="workspace-cancel-btn"
                    disabled={memberSubmitting}
                    onClick={() => setShowAddMember(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="workspace-primary-btn"
                    disabled={memberSubmitting}
                  >
                    {memberSubmitting
                      ? "Adding..."
                      : "Add member"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Remove member confirmation modal */}
        {memberToRemove && (
          <div
            className="modal-backdrop"
            onMouseDown={() => {
              if (!memberRemoving) {
                setMemberToRemove(null);
              }
            }}
          >
            <div
              className="workspace-modal remove-member-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <span className="section-eyebrow">
                    PROJECT TEAM
                  </span>

                  <h2>Remove member?</h2>

                  <p>
                    Are you sure you want to remove this
                    member from the project?
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  disabled={memberRemoving}
                  onClick={() => setMemberToRemove(null)}
                  aria-label="Close remove-member dialog"
                >
                  <FiX />
                </button>
              </div>

              <div className="remove-member-content">
                <div className="remove-member-avatar">
                  {getInitials(
                    memberToRemove?.first_name ||
                      memberToRemove?.user?.first_name ||
                      "",
                    memberToRemove?.last_name ||
                      memberToRemove?.user?.last_name ||
                      "",
                    memberToRemove?.username ||
                      memberToRemove?.user?.username ||
                      ""
                  )}
                </div>

                <div className="remove-member-info">
                  <strong>
                    {[
                      memberToRemove?.first_name ||
                        memberToRemove?.user?.first_name ||
                        "",
                      memberToRemove?.last_name ||
                        memberToRemove?.user?.last_name ||
                        "",
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                      memberToRemove?.username ||
                      memberToRemove?.user?.username ||
                      "Project member"}
                  </strong>

                  <span>
                    {memberToRemove?.email ||
                      memberToRemove?.user?.email ||
                      "No email available"}
                  </span>
                </div>
              </div>

              <p className="remove-member-warning">
                This member will lose access to this project.
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="workspace-cancel-btn"
                  disabled={memberRemoving}
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="workspace-primary-btn remove-member-confirm-btn"
                  onClick={confirmRemoveMember}
                  disabled={memberRemoving}
                >
                  <FiTrash2 />

                  {memberRemoving
                    ? "Removing..."
                    : "Remove member"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom delete-project confirmation modal */}
        {showDeleteProjectModal && (
          <div
            className="modal-backdrop"
            onMouseDown={() => {
              if (!projectDeleting) {
                setShowDeleteProjectModal(false);
                setProjectDeleteError("");
              }
            }}
          >
            <div
              className="workspace-modal delete-project-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              aria-describedby="delete-project-description"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <span className="section-eyebrow">
                    PROJECT SETTINGS
                  </span>

                  <h2 id="delete-project-title">
                    Delete project?
                  </h2>

                  <p>
                    This action cannot be undone.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close confirmation"
                  disabled={projectDeleting}
                  onClick={() => {
                    setShowDeleteProjectModal(false);
                    setProjectDeleteError("");
                  }}
                >
                  <FiX />
                </button>
              </div>

              <div className="delete-project-content">
                <div className="delete-project-icon">
                  <FiTrash2 />
                </div>

                <div className="delete-project-info">
                  <strong>
                    {project?.name || "This project"}
                  </strong>

                  <span id="delete-project-description">
                    Deleting this project will permanently remove
                    the project and its associated tasks, comments,
                    and membership records. This cannot be undone.
                  </span>
                </div>
              </div>

              {projectDeleteError && (
                <div
                  className="form-error delete-project-error"
                  role="alert"
                >
                  {projectDeleteError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="workspace-cancel-btn"
                  disabled={projectDeleting}
                  onClick={() => {
                    setShowDeleteProjectModal(false);
                    setProjectDeleteError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="delete-project-confirm-btn"
                  disabled={projectDeleting}
                  onClick={confirmDeleteProject}
                >
                  <FiTrash2 />

                  {projectDeleting
                    ? "Deleting project..."
                    : "Delete project"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit project modal */}
        {isEditingProject && (
          <div
            className="modal-backdrop"
            onMouseDown={() => {
              if (!projectSaving) {
                setIsEditingProject(false);
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
                    PROJECT SETTINGS
                  </span>

                  <h2>Edit project</h2>

                  <p>
                    Update the basic details and timeline.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  disabled={projectSaving}
                  onClick={() => setIsEditingProject(false)}
                  aria-label="Close edit-project dialog"
                >
                  <FiX />
                </button>
              </div>

              <form
                className="workspace-form"
                onSubmit={handleProjectSave}
              >
                <div className="form-grid">
                  <div className="form-field full">
                    <label htmlFor="project-name">
                      Project name
                    </label>

                    <input
                      id="project-name"
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="form-field full">
                    <label htmlFor="project-description">
                      Description
                    </label>

                    <textarea
                      id="project-description"
                      rows="5"
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="project-status">
                      Status
                    </label>

                    <select
                      id="project-status"
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
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

                      <option value="COMPLETED">
                        Completed
                      </option>

                      <option value="ARCHIVED">
                        Archived
                      </option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="project-priority">
                      Priority
                    </label>

                    <select
                      id="project-priority"
                      value={editForm.priority}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="project-start">
                      Start date
                    </label>

                    <input
                      id="project-start"
                      type="date"
                      value={editForm.start_date}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          start_date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="project-due">
                      Due date
                    </label>

                    <input
                      id="project-due"
                      type="date"
                      value={editForm.due_date}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          due_date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field full">
                    <label htmlFor="project-budget">
                      Budget
                    </label>

                    <div className="input-with-icon">
                      <FiDollarSign />

                      <input
                        id="project-budget"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.budget}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            budget: event.target.value,
                          }))
                        }
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
                    disabled={projectSaving}
                    onClick={() => setIsEditingProject(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="workspace-primary-btn"
                    disabled={projectSaving}
                  >
                    {projectSaving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectWorkspace;

