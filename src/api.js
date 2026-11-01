
const API_BASE_URL = "http://localhost:8080";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      text || `Request failed with status ${response.status}`
    );
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  register: (data) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTasks: (status) => {
    const query = status
      ? `?status=${encodeURIComponent(status)}`
      : "";

    return request(`/tasks${query}`);
  },

  createTask: (data) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTask: (id) =>
    request(`/tasks/${id}`, {
      method: "DELETE",
    }),

  cancelTask: (id) =>
    request(`/tasks/${id}/cancel`, {
      method: "PATCH",
    }),
};
