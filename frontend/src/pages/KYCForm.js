import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import api from "../api";

const STEPS = ["Personal Details", "Business Details", "Documents", "Review & Submit"];

export default function KYCForm() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submission, setSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [documents, setDocuments] = useState([]);

  const isEditable = submission && ["draft", "more_info_requested"].includes(submission.status);

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await api.get(`/merchant/submissions/${id}/`);
      setSubmission(res.data);
      setDocuments(res.data.documents || []);
    } catch {
      navigate("/merchant");
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const saveProgress = async () => {
    if (!isEditable) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.patch(`/merchant/submissions/${id}/`, {
        full_name: submission.full_name,
        email: submission.email,
        phone: submission.phone,
        business_name: submission.business_name,
        business_type: submission.business_type,
        expected_monthly_volume_usd: submission.expected_monthly_volume_usd,
      });
      setSubmission(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save");
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    setError("");
    try {
      await saveProgress();
      const res = await api.post(`/merchant/submissions/${id}/submit/`);
      setSubmission(res.data);
      navigate("/merchant");
    } catch (err) {
      const data = err.response?.data;
      if (data?.status) {
        setError(Array.isArray(data.status) ? data.status[0] : data.status);
      } else {
        setError(data?.detail || "Failed to submit");
      }
    }
  };

  const uploadDocument = async (docType, file) => {
    setUploadError("");
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("file", file);
    try {
      const res = await api.post(`/merchant/submissions/${id}/documents/`, formData);
      setDocuments([...documents, res.data]);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.file?.[0] || data?.detail || "Upload failed";
      setUploadError(msg);
    }
  };

  const update = (field, value) => {
    setSubmission({ ...submission, [field]: value });
  };

  if (!submission) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <button onClick={() => navigate("/merchant")} className="text-blue-600 hover:underline text-sm">
            &larr; Back to Dashboard
          </button>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">KYC Submission #{id}</h2>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            submission.status === "draft" ? "bg-gray-100 text-gray-700" :
            submission.status === "more_info_requested" ? "bg-orange-100 text-orange-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {submission.status.replace(/_/g, " ")}
          </span>
        </div>

        {submission.status === "more_info_requested" && submission.review_reason && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6">
            <p className="text-sm font-medium text-orange-800">Reviewer requested more info:</p>
            <p className="text-sm text-orange-700 mt-1">{submission.review_reason}</p>
          </div>
        )}

        {!isEditable && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-700">This submission is read-only (status: {submission.status}).</p>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex mb-8">
          {STEPS.map((label, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex-1 text-center py-2 text-sm border-b-2 transition ${
                i === step
                  ? "border-blue-600 text-blue-600 font-medium"
                  : "border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Personal Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.full_name || ""}
                  onChange={(e) => update("full_name", e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.email || ""}
                  onChange={(e) => update("email", e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.phone || ""}
                  onChange={(e) => update("phone", e.target.value)}
                  disabled={!isEditable}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Business Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.business_name || ""}
                  onChange={(e) => update("business_name", e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.business_type || ""}
                  onChange={(e) => update("business_type", e.target.value)}
                  disabled={!isEditable}
                >
                  <option value="">Select type...</option>
                  <option value="individual">Individual / Freelancer</option>
                  <option value="agency">Agency</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Monthly Volume (USD)
                </label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={submission.expected_monthly_volume_usd || ""}
                  onChange={(e) => update("expected_monthly_volume_usd", e.target.value)}
                  disabled={!isEditable}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Document Upload</h3>
              <p className="text-sm text-gray-500">
                Accepted: PDF, JPG, PNG. Max size: 5 MB per file.
              </p>

              {uploadError && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{uploadError}</div>
              )}

              {["pan", "aadhaar", "bank_statement"].map((docType) => {
                const existing = documents.filter((d) => d.doc_type === docType);
                return (
                  <div key={docType} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm capitalize">
                        {docType.replace(/_/g, " ")}
                      </span>
                      {existing.length > 0 && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Uploaded
                        </span>
                      )}
                    </div>
                    {existing.map((doc) => (
                      <p key={doc.id} className="text-xs text-gray-500 mb-1">
                        {doc.original_filename}
                      </p>
                    ))}
                    {isEditable && (
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="text-sm mt-1"
                        onChange={(e) => {
                          if (e.target.files[0]) uploadDocument(docType, e.target.files[0]);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Review & Submit</h3>
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
                  <p className="font-medium">{submission.business_type || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Monthly Volume (USD)</p>
                  <p className="font-medium">${submission.expected_monthly_volume_usd || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Documents ({documents.length})</p>
                {documents.length === 0 ? (
                  <p className="text-sm text-red-500">No documents uploaded yet.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {documents.map((d) => (
                      <li key={d.id} className="text-gray-700">
                        {d.doc_type.replace(/_/g, " ")}: {d.original_filename}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              className={`px-4 py-2 text-sm rounded-lg ${
                step === 0 ? "invisible" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Previous
            </button>
            <div className="flex gap-2">
              {isEditable && step < 3 && (
                <button
                  onClick={saveProgress}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (isEditable) saveProgress();
                    setStep(step + 1);
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Next
                </button>
              ) : isEditable ? (
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"
                >
                  Submit for Review
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
