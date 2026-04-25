import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MerchantDashboard from "./pages/MerchantDashboard";
import KYCForm from "./pages/KYCForm";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import ReviewerDetail from "./pages/ReviewerDetail";

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "reviewer" ? "/reviewer" : "/merchant"} />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === "reviewer" ? "/reviewer" : "/merchant"} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/merchant" /> : <Register />} />

      <Route path="/merchant" element={<PrivateRoute role="merchant"><MerchantDashboard /></PrivateRoute>} />
      <Route path="/merchant/submission/:id" element={<PrivateRoute role="merchant"><KYCForm /></PrivateRoute>} />

      <Route path="/reviewer" element={<PrivateRoute role="reviewer"><ReviewerDashboard /></PrivateRoute>} />
      <Route path="/reviewer/submission/:id" element={<PrivateRoute role="reviewer"><ReviewerDetail /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
