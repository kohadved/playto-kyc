import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(form.username, form.password);
      navigate(user.role === "reviewer" ? "/reviewer" : "/merchant");
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Playto Pay</h1>
        <p className="text-gray-500 text-center mb-6">KYC Portal Login</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Sign In
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          New merchant?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
