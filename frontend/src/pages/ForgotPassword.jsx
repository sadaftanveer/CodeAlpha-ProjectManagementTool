import { useState } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [submitting, setSubmitting] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const data = await forgotPassword(email);

      setSuccess(
        data.message ||
          "If an account exists for this email, a password reset link has been sent."
      );

      setEmail("");
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to process your request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Forgot Password?</h1>

          <p>
            Enter your email address and we'll send
            you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        {success && (
          <div className="form-success">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Sending..."
              : "Send Reset Link"}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password?{" "}
          <Link to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;