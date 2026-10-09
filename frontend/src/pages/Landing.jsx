import { Link, Navigate } from "react-router-dom";
import {
  FiBell,
  FiCheckCircle,
  FiGrid,
  FiMessageCircle,
  FiUsers,
  FiClock,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

import "../styles/landing.css";

const FEATURES = [
  {
    icon: <FiGrid />,
    title: "Projects in one place",
    text: "Create projects, set priorities and due dates, and see everything you own or belong to at a glance.",
  },
  {
    icon: <FiCheckCircle />,
    title: "Tasks that move",
    text: "Assign work, track status, and mark tasks complete so everyone knows what is next.",
  },
  {
    icon: <FiMessageCircle />,
    title: "Comments and mentions",
    text: "Discuss work on the task itself and @mention teammates to get their attention.",
  },
  {
    icon: <FiBell />,
    title: "Live notifications",
    text: "Get notified the moment you are assigned, mentioned or invited, without refreshing.",
  },
  {
    icon: <FiUsers />,
    title: "Built for teams",
    text: "Invite members to a project and keep everyone working from the same plan.",
  },
  {
    icon: <FiClock />,
    title: "Deadlines in view",
    text: "Due dates are shown on every project so nothing slips past unnoticed.",
  },
];

function Landing() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="page-loader">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">PF</span>
          <span className="landing-brand-name">ProjectFlow</span>
        </Link>

        <nav className="landing-nav-actions">
          <Link to="/login" className="landing-link">
            Log in
          </Link>

          <Link to="/register" className="landing-button landing-button-primary">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>Plan the work. Keep the team moving.</h1>

            <p>
              ProjectFlow brings projects, tasks, comments and notifications
              into one workspace, so your team always knows what is happening
              and what to do next.
            </p>

            <div className="landing-hero-actions">
              <Link
                to="/register"
                className="landing-button landing-button-primary"
              >
                Create a free account
              </Link>

              <Link to="/login" className="landing-button landing-button-ghost">
                Log in
              </Link>
            </div>
          </div>

          <div className="landing-preview" aria-hidden="true">
            <div className="landing-preview-top">
              <span className="landing-chip landing-chip-active">Active</span>
              <span className="landing-chip landing-chip-high">High</span>
            </div>

            <h3>Website redesign</h3>

            <div className="landing-preview-progress">
              <div />
            </div>

            <ul>
              <li className="done">Finalize wireframes</li>
              <li className="done">Review brand colors</li>
              <li>Build the pricing page</li>
              <li>Launch checklist</li>
            </ul>

            <div className="landing-preview-note">
              <FiBell />
              <span>Sara assigned you to “Build the pricing page”</span>
            </div>
          </div>
        </section>

        <section className="landing-features">
          <h2>Everything a small team needs</h2>

          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <article className="landing-feature" key={feature.title}>
                <div className="landing-feature-icon">{feature.icon}</div>

                <h3>{feature.title}</h3>

                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <h2>Ready to get your team on the same page?</h2>

          <Link to="/register" className="landing-button landing-button-primary">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>ProjectFlow</span>
        <span>Collaborative project management</span>
      </footer>
    </div>
  );
}

export default Landing;