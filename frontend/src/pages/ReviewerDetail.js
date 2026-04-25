import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import api from "../api";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  more_info_requested: "bg-orange-100 text-orange-700",
};

const TRANSITION_MAP = {
  submitted: [{ value: "under_review", label: "Take for Review", color: "bg-yellow-500 hover:bg-yellow-600" }],
  under_review: [
    { value: "approved", label: "Approve", color: "bg-green-600 hover:bg-green-700" },
    { value: "rejected", label: "Reject", color: "bg-red-600 hover:bg-red-700" },
    { value: "more_info_requested", label: "Request More Info", color: "bg-orange-500 hover:bg-orange-600" },
  ],
};

export default function ReviewerDetail() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await api.get(`/reviewer/submissions/${id}/`);
      setSubmission(res.data);
    } catch {
      navigate("/reviewer");
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const transition = async (newStatus) => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post(`/reviewer/submissions/${id}/transition/`, {
        status: newStatus,
        reason,
      });
      setSubmission(res.data);
      setReason("");
    } catch (err) {
      const data = err.response?.data;
      if (data?.status) {
        setError(Array.isArray(data.status) ? data.status[0] : data.status);
      } else {
        setError(data?.detail || "Transition failed");
      }
    }
    setLoading(false);
  };

  if (!submission) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const actions = TRANSITION_MAP[submission.status] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={() => navigate("/reviewer")}
            className="text-blue-600 hover:underline text-sm"
          >
            &larr; Back to Queue
          </button>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold">Submission #{id}</h2>
            <p className="text-sm text-gray-500">
              Merchant: {submission.merchant_username}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[submission.status]}`}
            >
              {submission.status.replace(/_/g, " ")}
            </span>
            {submission.is_at_risk && (
              <span className="text-red-600 font-medium text-xs bg-red-50 px-2 py-1 rounded">
                AT RISK (&gt;24h)
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        {/* Submission Data */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-medium text-lg mb-4">Submitted Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Full Name</p>
              <p className="font-medium">{submission.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">{submission.email || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{submission.phone || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Business Name</p>
              <p className="font-medium">{submission.business_name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Business Type</p>
              <p className="font-medium capitalize">{submission.business_type || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Monthly Volume (USD)</p>
              <p className="font-medium">
                {submission.expected_monthly_volume_usd
                  ? `$${submission.expected_monthly_volume_usd}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-medium text-lg mb-4">Documents</h3>
          {submission.documents && submission.documents.length > 0 ? (
            <div className="space-y-2">
              {submission.documents.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center border rounded p-3">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {doc.doc_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-500">{doc.original_filename}</p>
                  </div>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No documents uploaded.</p>
          )}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-lg mb-4">Actions</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / Notes
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add reason for rejection or additional notes..."
              />
            </div>
            <div className="flex gap-3">
              {actions.map((action) => (
                <button
                  key={action.value}
                  onClick={() => transition(action.value)}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium ${action.color}`}
                  disabled={loading}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Review history info */}
        {submission.review_reason && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Last review note:</p>
            <p className="text-sm">{submission.review_reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
