import { useState } from "react";
import {
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { resetPassword } from "../services/authService";

function ResetPassword() {
  const { uidb64, token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: "",
    password_confirm: "",
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [submitting, setSubmitting] =
    useState(false);

  function handleChange(event) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (formData.password.length < 8) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    if (
      formData.password !==
      formData.password_confirm
    ) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const data = await resetPassword(
        uidb64,
        token,
        formData
      );

      setSuccess(
        data.message ||
          "Password reset successfully."
      );

      setFormData({
        password: "",
        password_confirm: "",
      });

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to reset your password. The link may be invalid or expired."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>

          <p>
            Create a new password for your
            ProjectFlow account.
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
            <label htmlFor="password">
              New Password
            </label>

            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password_confirm">
              Confirm New Password
            </label>

            <div className="password-input-wrapper">
              <input
                id="password_confirm"
                name="password_confirm"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={
                  formData.password_confirm
                }
                onChange={handleChange}
                placeholder="Repeat your new password"
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    !showConfirmPassword
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Resetting Password..."
              : "Reset Password"}
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

export default ResetPassword;