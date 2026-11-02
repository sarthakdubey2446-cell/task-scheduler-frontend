# TaskFlow – Task Scheduler Frontend

A React-based frontend for **TaskFlow**, a real-time task scheduling and notification system. It allows users to manage scheduled tasks, monitor their execution status, and receive email notifications when tasks are completed.

## Overview

TaskFlow provides a user-friendly interface for interacting with the Task Scheduler backend built using Spring Boot.

Users can register, log in, create scheduled tasks, manage existing tasks, cancel pending tasks, and monitor task statuses through an interactive dashboard.

## Features

- **User Authentication:** Login and registration with JWT-based authentication.
- **Dashboard:** View and manage scheduled tasks from a centralized dashboard.
- **Task Creation:** Create tasks with a title, description, scheduled time, recipient email, email subject, and email body.
- **Task Management:** View, update, and delete scheduled tasks.
- **Task Cancellation:** Cancel scheduled tasks before their execution time.
- **Task Status Tracking:** Monitor task statuses such as PENDING, PROCESSING, COMPLETED, FAILED, and CANCELLED.
- **Search and Filtering:** Find tasks using search and filtering options.
- **Pagination:** Navigate through task lists efficiently.
- **Automatic Updates:** Periodically refresh task information to display updated statuses.
- **Responsive UI:** A clean interface designed for convenient task management.

## Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend library |
| JavaScript (JSX) | Application development |
| Vite | Development server and build tool |
| HTML5 | Application structure |
| CSS3 | Styling and responsive UI |
| Axios | Backend API communication |
| React Router | Client-side navigation |

## Project Structure

```text
task-scheduler-frontend/
│
├── public/
│
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── api.js
│   ├── index.css
│   ├── main.jsx
│   └── websocket.js
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git

The Spring Boot backend must also be running for the frontend to communicate with the application APIs.

### 1. Clone the Repository

```bash
git clone https://github.com/sarthakdubey2446-cell/task-scheduler-frontend.git
```

### 2. Navigate to the Project Directory

```bash
cd task-scheduler-frontend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal, usually:

```text
http://localhost:5173
```

## Backend Integration

The frontend communicates with the Spring Boot backend through REST APIs using Axios.

The backend handles:

- User authentication and authorization.
- Task creation and scheduling.
- Database operations.
- RabbitMQ-based asynchronous processing.
- Email notifications.
- Task status management.

Make sure the backend is running and the API base URL configured in `src/api.js` points to the correct backend address.

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run preview` | Preview the production build |

## Related Repository

**Backend Repository:**  
https://github.com/sarthakdubey2446-cell/task-scheduler

## Project Purpose

This project was developed to explore full-stack application development, REST API integration, JWT authentication, asynchronous task processing, and real-time task management.

It demonstrates how a React frontend can interact with a Spring Boot backend to build a task scheduling and notification application.

---

**TaskFlow – Task Scheduler Project**