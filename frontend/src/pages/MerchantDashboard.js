import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  more_info_requested: "bg-orange-100 text-orange-700",
};

export default function MerchantDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/merchant/submissions/").then((res) => {
      setSubmissions(res.data);
      setLoading(false);
    });
  }, []);

  const createNew = async () => {
    const res = await api.post("/merchant/submissions/", {});
    navigate(`/merchant/submission/${res.data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-blue-600">Playto Pay</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.username}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">My KYC Submissions</h2>
          <button
            onClick={createNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Submission
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No submissions yet. Start your KYC process.</p>
            <button
              onClick={createNew}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Start KYC
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <Link
                key={sub.id}
                to={`/merchant/submission/${sub.id}`}
                className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {sub.business_name || "Untitled"}{" "}
                      <span className="text-gray-400 text-sm">#{sub.id}</span>
                    </p>
                    <p className="text-sm text-gray-500">{sub.full_name || "No name yet"}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status]}`}
                  >
                    {sub.status.replace(/_/g, " ")}
                  </span>
                </div>
                {sub.review_reason && sub.status === "more_info_requested" && (
                  <p className="mt-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    Reviewer note: {sub.review_reason}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
