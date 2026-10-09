# Project Management Tool

A full-stack project management application developed as part of the CodeAlpha internship program. The application enables users to manage projects, organize tasks, collaborate with team members, and receive project-related notifications.

The backend uses Django and Django Channels, with Daphne serving the ASGI application for HTTP and WebSocket communication.

## Features

### Authentication

* User registration and login
* Email-based authentication
* Forgot-password functionality
* Password reset functionality

### Project Management

* Create and manage projects
* Dedicated project workspaces
* Organize tasks within projects
* Collaborate with project members

### Task Management

* Create and manage tasks
* Assign tasks to team members
* Set task descriptions and due dates
* Organize tasks by status
* Track task progress

### Collaboration

* Task comments
* Project and task-related notifications
* WebSocket support through Django Channels
* Real-time communication where implemented

## Technology Stack

### Frontend

* React
* JavaScript
* CSS

### Backend

* Python
* Django
* Django REST Framework
* Django Channels
* Daphne ASGI server

### Communication

* HTTP APIs
* WebSockets

### Database

* SQLite or the database configured in Django settings

### Development Tools

* Git
* GitHub
* Visual Studio Code

## Project Structure


CodeAlpha_ProjectManagementTool/
│
├── backend/
│   ├── config/
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   └── ...
│   ├── manage.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── package.json
│   └── ...
│
├── .gitignore
├── LICENSE
└── README.md


The structure is illustrative; your actual application may contain additional apps and files.

## Prerequisites

Install the following:

* Python 3
* Node.js and npm
* Git

## Installation and Setup

### 1. Clone the Repository


git clone YOUR_GITHUB_REPOSITORY_URL
cd CodeAlpha_ProjectManagementTool


Replace `YOUR_GITHUB_REPOSITORY_URL` with your GitHub repository URL.

### 2. Set Up the Backend

cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1


Install the backend dependencies:
pip install -r requirements.txt


### 3. Configure Environment Variables

If your application uses environment variables, create a local `.env` file according to your Django settings.

Never commit real credentials, secret keys, or passwords.

### 4. Apply Database Migrations

python manage.py migrate


### 5. Create an Administrator Account

Optional:


python manage.py createsuperuser


### 6. Start the Daphne ASGI Server

From the backend directory, run:


daphne -p 8000 config.asgi:application


The backend server listens at:

`http://127.0.0.1:8000/`

This command starts Daphne using the ASGI application defined in `config.asgi`.

**Note:** WebSocket functionality also depends on the project's ASGI configuration, routing, consumers, and channel-layer setup.

### 7. Start the Frontend

Open another terminal and navigate to the frontend directory:


cd D:\CodeAlpha_ProjectManagementTool\frontend


Install dependencies:

npm install


Start the development server:

npm run dev


Open the local URL displayed in the terminal.

Follow the actual scripts in `package.json` if they differ from these commands.

## WebSocket Support

The application uses Django Channels and Daphne to support ASGI and WebSocket communication.

WebSockets can enable features such as:

* Real-time notifications
* Live task updates
* Instant collaboration events

The availability of each feature depends on its implementation in the application.

## Security

* Do not commit `.env` files or credentials.
* Do not upload databases containing private user information.
* Keep Django migration files in version control.
* Configure secure settings before production deployment.
* Use an appropriate production channel layer, such as Redis, if required by the application's architecture.
* Do not use development settings for production deployment.

## Development Status

Developed as part of the CodeAlpha internship program.

