import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import api from "../api";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  more_info_requested: "bg-orange-100 text-orange-700",
};

export default function ReviewerDashboard() {
  const { user, logout } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/reviewer/metrics/"),
      api.get("/reviewer/queue/"),
    ]).then(([metricsRes, queueRes]) => {
      setMetrics(metricsRes.data);
      setQueue(queueRes.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-blue-600">Playto Pay — Reviewer</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.username}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500">In Queue</p>
              <p className="text-3xl font-bold text-blue-600">{metrics.in_queue}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500">Avg Time in Queue</p>
              <p className="text-3xl font-bold text-yellow-600">
                {metrics.avg_time_in_queue_hours}h
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500">Approval Rate (7d)</p>
              <p className="text-3xl font-bold text-green-600">{metrics.approval_rate_7d}%</p>
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4">Review Queue</h2>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No submissions in the queue.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">ID</th>
                  <th className="text-left p-3 font-medium text-gray-600">Merchant</th>
                  <th className="text-left p-3 font-medium text-gray-600">Business</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                  <th className="text-left p-3 font-medium text-gray-600">Submitted</th>
                  <th className="text-left p-3 font-medium text-gray-600">SLA</th>
                  <th className="text-left p-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((sub) => (
                  <tr key={sub.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">#{sub.id}</td>
                    <td className="p-3">{sub.merchant_username}</td>
                    <td className="p-3">{sub.business_name || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status]}`}
                      >
                        {sub.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">
                      {sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="p-3">
                      {sub.is_at_risk ? (
                        <span className="text-red-600 font-medium text-xs bg-red-50 px-2 py-1 rounded">
                          AT RISK
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">OK</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/reviewer/submission/${sub.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
