import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

/*
 * NotificationCenter is no longer rendered here. It used to be pinned to the
 * top-right corner of every page (position: fixed), which put it on top of the
 * Logout button. It now lives inside each page header instead.
 */
function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="page-loader">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;