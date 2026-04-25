import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default api;
