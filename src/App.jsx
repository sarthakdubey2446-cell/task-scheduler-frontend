import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { api } from "./api";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [taskActionError, setTaskActionError] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    scheduledTime: "",
    recipientEmail: "",
    emailSubject: "",
    emailBody: "",
  });

  // Load tasks after login, then refresh periodically so backend status changes
  // (for example, a scheduled email being processed) appear without a page reload.
  useEffect(() => {
    if (!token) {
      setTasks([]);
      return undefined;
    }

    let cancelled = false;

    async function loadTasks(showLoading = true) {
      if (showLoading) setTasksLoading(true);

      try {
        const data = await api.getTasks();

        if (cancelled) return;

        if (!Array.isArray(data)) {
          throw new Error("The tasks API did not return a task list.");
        }

        setTasks(data);
        setTasksError("");
      } catch (error) {
        if (!cancelled && showLoading) {
          setTasksError(error.message || "Unable to load tasks.");
        }
      } finally {
        if (!cancelled && showLoading) {
          setTasksLoading(false);
        }
      }
    }

    loadTasks(true);

    // Refresh in the background every 10 seconds. This does not execute tasks;
    // it only asks Spring Boot for their latest persisted statuses.
    const refreshId = window.setInterval(() => {
      loadTasks(false);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, [token]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        await api.register({
          name: authData.name,
          email: authData.email,
          password: authData.password,
        });

        setAuthMessage("Registration successful. You can now log in.");
        setAuthMode("login");
        setAuthData((previous) => ({
          ...previous,
          password: "",
        }));
      } else {
        const response = await api.login({
          email: authData.email,
          password: authData.password,
        });

        if (!response?.token) {
          throw new Error("Login succeeded without a token in the response.");
        }

        localStorage.setItem("token", response.token);
        setToken(response.token);
      }
    } catch (error) {
      setAuthError(error.message || "Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setAuthMode("login");
    setAuthData({ name: "", email: "", password: "" });
    setAuthError("");
    setAuthMessage("");
    setTasksError("");
    setTaskActionError("");
    setFilter("ALL");
  }

  const visibleTasks = tasks.filter((task) => {
    const statusMatches = filter === "ALL" || task.status === filter;
    const title = (task.title || "").toLowerCase();
    const description = (task.description || "").toLowerCase();
    const searchTerm = search.toLowerCase();

    return (
      statusMatches &&
      (title.includes(searchTerm) || description.includes(searchTerm))
    );
  });

  const completed = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const pending = tasks.filter(
    (task) => task.status === "PENDING"
  ).length;

  const processing = tasks.filter(
    (task) => task.status === "PROCESSING"
  ).length;

  function formatDate(value) {
    if (!value) return "Not set";

    // Java LocalDateTime values usually arrive without a timezone suffix.
    // Keep those values as local time instead of letting the browser reinterpret them.
    const localDateTime = typeof value === "string"
      && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?$/.test(value);

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString(undefined, localDateTime
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }
      : undefined);
  }

  async function addTask(event) {
    event.preventDefault();
    setTaskActionError("");

    if (
      !newTask.title.trim() ||
      !newTask.scheduledTime ||
      !newTask.recipientEmail.trim() ||
      !newTask.emailSubject.trim() ||
      !newTask.emailBody.trim()
    ) {
      setTaskActionError("Please complete all required task fields.");
      return;
    }

    try {
      const createdTask = await api.createTask({
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        // datetime-local already represents the user's local wall-clock time.
        // Send a timezone-free LocalDateTime string to Spring Boot, rather than
        // converting it to UTC with toISOString() (which shifts the time).
        scheduledTime: newTask.scheduledTime.length === 16
          ? `${newTask.scheduledTime}:00`
          : newTask.scheduledTime,
        recipientEmail: newTask.recipientEmail.trim(),
        emailSubject: newTask.emailSubject.trim(),
        emailBody: newTask.emailBody.trim(),
      });

      if (createdTask && typeof createdTask === "object") {
        setTasks((previous) => [
          createdTask,
          ...previous.filter((task) => task.id !== createdTask.id),
        ]);
      } else {
        const refreshedTasks = await api.getTasks();
        setTasks(Array.isArray(refreshedTasks) ? refreshedTasks : []);
      }

      setNewTask({
        title: "",
        description: "",
        scheduledTime: "",
        recipientEmail: "",
        emailSubject: "",
        emailBody: "",
      });
      setShowForm(false);
    } catch (error) {
      setTaskActionError(error.message || "Unable to create the task.");
    }
  }

  async function updateStatus(id, status) {
    setTaskActionError("");

    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const previousStatus = task.status;

    // The backend supports PENDING, PROCESSING, COMPLETED,
    // FAILED, and CANCELLED. UpdateTaskRequest fields are used here.
    try {
      await api.updateTask(id, {
        title: task.title,
        description: task.description || "",
        scheduledTime: task.scheduledTime,
        recipientEmail: task.recipientEmail,
        emailSubject: task.emailSubject,
        emailBody: task.emailBody,
        status,
      });

      setTasks((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      );
    } catch (error) {
      setTaskActionError(
        `Could not update task status. ${error.message || ""}`
      );

      // Keep the displayed status unchanged when the API rejects the update.
      setTasks((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, status: previousStatus } : item
        )
      );
    }
  }

  async function deleteTask(id) {
    setTaskActionError("");

    try {
      await api.deleteTask(id);
      setTasks((previous) => previous.filter((task) => task.id !== id));
    } catch (error) {
      setTaskActionError(error.message || "Unable to delete the task.");
    }
  }
  
async function cancelTask(id) {
  setTaskActionError("");

  try {
    await api.cancelTask(id);

    setTasks((previous) =>
      previous.map((task) =>
        task.id === id
          ? { ...task, status: "CANCELLED" }
          : task
      )
    );
  } catch (error) {
    setTaskActionError(
      error.message || "Unable to cancel the task."
    );
  }
}


  if (!token) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-icon">T</div>
            <div>
              <h5>TaskFlow</h5>
              <small>Task Scheduler</small>
            </div>
          </div>

          <h1>
            {authMode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="muted">
            {authMode === "login"
              ? "Log in to manage your scheduled tasks."
              : "Register to start scheduling your tasks."}
          </p>

          {authError && (
            <div className="alert alert-danger" role="alert">
              {authError}
            </div>
          )}

          {authMessage && (
            <div className="alert alert-success" role="status">
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuth}>
            {authMode === "register" && (
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  autoComplete="name"
                  required
                  value={authData.name}
                  onChange={(event) =>
                    setAuthData({ ...authData, name: event.target.value })
                  }
                  placeholder="Your name"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                type="email"
                autoComplete="email"
                required
                value={authData.email}
                onChange={(event) =>
                  setAuthData({ ...authData, email: event.target.value })
                }
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                className="form-control"
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                value={authData.password}
                onChange={(event) =>
                  setAuthData({ ...authData, password: event.target.value })
                }
                placeholder="Enter your password"
              />
            </div>

            <button
              className="btn btn-primary w-100"
              type="submit"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Log In"
                  : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthMessage("");
              }}
            >
              {authMode === "login" ? "Register" : "Log in"}
            </button>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">T</div>
          <div>
            <h5>TaskFlow</h5>
            <small>Task Scheduler</small>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <button
          className={`nav-item ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          <span>▦</span> Dashboard
        </button>

        <button className="nav-item" onClick={() => setFilter("ALL")}>
          <span>☷</span> All Tasks
        </button>

        <button
          className={`nav-item ${filter === "PENDING" ? "active" : ""}`}
          onClick={() => setFilter("PENDING")}
        >
          <span>◷</span> Pending
        </button>

        <button
          className={`nav-item ${filter === "PROCESSING" ? "active" : ""}`}
          onClick={() => setFilter("PROCESSING")}
        >
          <span>↻</span> In Progress
        </button>

        <button
          className={`nav-item ${filter === "COMPLETED" ? "active" : ""}`}
          onClick={() => setFilter("COMPLETED")}
        >
          <span>✓</span> Completed
        </button>

        <div className="sidebar-footer">
          <div className="avatar">TF</div>
          <div>
            <strong>My Workspace</strong>
            <small>Personal account</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / </span>
            <strong>Dashboard</strong>
          </div>

          <div className="topbar-right">
            <span className="online-dot" />
            <span>Connected session</span>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>Task Dashboard</h1>
              <p className="muted">
                Organize your work and keep everything on schedule.
              </p>
            </div>

            <button
              className="btn btn-primary create-btn"
              onClick={() => {
                setTaskActionError("");
                setShowForm(!showForm);
              }}
            >
              + Create Task
            </button>
          </div>

          {tasksLoading && (
            <div className="alert alert-info">
              Loading tasks from the server...
            </div>
          )}

          {tasksError && (
            <div className="alert alert-danger" role="alert">
              {tasksError}
              <button
                className="btn btn-sm btn-outline-danger ms-3"
                onClick={() => {
                  setTasksError("");
                  setTasksLoading(true);
                  api
                    .getTasks()
                    .then((data) => {
                      if (!Array.isArray(data)) {
                        throw new Error("Unexpected task list response.");
                      }
                      setTasks(data);
                    })
                    .catch((error) =>
                      setTasksError(error.message || "Unable to load tasks.")
                    )
                    .finally(() => setTasksLoading(false));
                }}
              >
                Retry
              </button>
            </div>
          )}

          {taskActionError && (
            <div className="alert alert-danger" role="alert">
              {taskActionError}
              <button
                type="button"
                className="btn-close float-end"
                aria-label="Close"
                onClick={() => setTaskActionError("")}
              />
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-heading">
                Total Tasks <span className="stat-icon blue">▦</span>
              </div>
              <h2>{tasks.length}</h2>
              <p>Tasks in your workspace</p>
            </div>

            <div className="stat-card">
              <div className="stat-heading">
                Pending <span className="stat-icon orange">◷</span>
              </div>
              <h2>{pending}</h2>
              <p>Waiting to be started</p>
            </div>

            <div className="stat-card">
              <div className="stat-heading">
                In Progress <span className="stat-icon purple">↻</span>
              </div>
              <h2>{processing}</h2>
              <p>Currently being worked on</p>
            </div>

            <div className="stat-card">
              <div className="stat-heading">
                Completed <span className="stat-icon green">✓</span>
              </div>
              <h2>{completed}</h2>
              <p>
                {tasks.length
                  ? `${Math.round((completed / tasks.length) * 100)}% completion rate`
                  : "No tasks yet"}
              </p>
            </div>
          </div>

          {showForm && (
            <section className="task-form-card">
              <h4>Create a new scheduled task</h4>

              <form onSubmit={addTask}>
                <div className="mb-3">
                  <label className="form-label">Task title *</label>
                  <input
                    className="form-control"
                    required
                    value={newTask.title}
                    onChange={(event) =>
                      setNewTask({ ...newTask, title: event.target.value })
                    }
                    placeholder="What needs to be done?"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={newTask.description}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        description: event.target.value,
                      })
                    }
                    placeholder="Add some details..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Recipient email *</label>
                  <input
                    className="form-control"
                    type="email"
                    required
                    value={newTask.recipientEmail}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        recipientEmail: event.target.value,
                      })
                    }
                    placeholder="recipient@example.com"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email subject *</label>
                  <input
                    className="form-control"
                    required
                    value={newTask.emailSubject}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        emailSubject: event.target.value,
                      })
                    }
                    placeholder="Reminder subject"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email message *</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    required
                    value={newTask.emailBody}
                    onChange={(event) =>
                      setNewTask({ ...newTask, emailBody: event.target.value })
                    }
                    placeholder="Write the email that should be sent..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Scheduled date and time *
                  </label>
                  <input
                    className="form-control"
                    type="datetime-local"
                    required
                    value={newTask.scheduledTime}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        scheduledTime: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => {
                      setShowForm(false);
                      setTaskActionError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Task
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="tasks-section">
            <div className="tasks-heading">
              <div>
                <h3>My Tasks</h3>
                <p className="muted">Track and manage your daily work.</p>
              </div>

              <input
                className="form-control search-input"
                placeholder="Search tasks..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="filter-tabs">
              {[
                ["ALL", "All Tasks"],
                ["PENDING", "Pending"],
                ["PROCESSING", "In Progress"],
                ["COMPLETED", "Completed"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-tab ${
                    filter === value ? "selected" : ""
                  }`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="task-list">
              {visibleTasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="task-main">
                    <div className="task-check">
                      {task.status === "COMPLETED" ? "✓" : "○"}
                    </div>

                    <div className="task-details">
                      <h5>{task.title}</h5>
                      <p>{task.description || "No description provided."}</p>

                      <div className="task-meta">
                        <span
                          className={`priority ${
                            task.status === "FAILED"
                              ? "high"
                              : task.status === "COMPLETED"
                                ? "low"
                                : "medium"
                          }`}
                        >
                          {task.status || "PENDING"}
                        </span>
                        <span>
                          Scheduled: {formatDate(task.scheduledTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  
                  <div className="task-actions">
                    <select
                      className="form-select status-select"
                      aria-label={`Status for ${task.title}`}
                      value={task.status || "PENDING"}
                      onChange={(event) =>
                        updateStatus(task.id, event.target.value)
                      }
                    >
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED" disabled>Failed</option>
                    <option value="CANCELLED" disabled>Cancelled</option>
                    </select>

                  {(task.status === "PENDING" ||
                  task.status === "PROCESSING") && (
                  <button
                    type="button"
                    className="cancel-btn"
                    title="Cancel scheduled task"
                    onClick={() => cancelTask(task.id)}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  className="delete-btn"
                  title="Delete task"
                  onClick={() => deleteTask(task.id)}
                >
                  Delete
                </button>
              </div>
                </article>
              ))}

              {!tasksLoading && visibleTasks.length === 0 && !tasksError && (
                <div className="empty-state">
                  <h5>No tasks found</h5>
                  <p>
                    {tasks.length
                      ? "Try another filter or search term."
                      : "You have no tasks yet. Create a scheduled task to get started."}
                  </p>
                </div>
              )}
            </div>

            <div className="task-count">
              Showing {visibleTasks.length} of {tasks.length} tasks
            </div>
          </section>

          <footer className="page-footer">
            TaskFlow · Task Scheduler Project
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
