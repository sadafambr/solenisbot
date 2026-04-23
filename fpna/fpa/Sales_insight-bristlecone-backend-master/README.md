# Bristlecone AI Platform

Bristlecone is an AI-powered platform that provides intelligent insights and automation capabilities. The platform consists of a Python-based backend service and a modern web frontend.

## Project Overview

The platform is built with the following key components:

- **Backend**: A Flask-based Python service (`final__bristlecone/`) that handles AI processing, data management, and API endpoints. Key utilities include `utils/chat_history_handler.py` for chat persistence.
- **Frontend**: A modern web interface (`final__bristleconefrontend/`) built with Next.js 14, TypeScript, Tailwind CSS, and Zustand for state management.
- **Database**: PostgreSQL database for data persistence. Key tables include `users`, `chat_sessions`, and `chat_history` (which stores individual messages, identified by `message_id`).
- **AI Components**: Integration with various AI models and services.

## Project Structure

```
./
├── final__bristlecone/           # Backend service (Flask, Python)
│   ├── auth/                   # Authentication and authorization modules
│   ├── agents/                 # AI agent implementations
│   ├── connectors/             # External service integrations
│   ├── models/                 # Data models (SQLAlchemy, Pydantic, etc.)
│   ├── prompts/                # AI prompt templates
│   ├── utils/                  # Utility functions (e.g., chat_history_handler.py)
│   ├── workflows/              # Business logic and workflow definitions
│   ├── .venv/                  # Virtual environment (typically unmanaged)
│   ├── flask_app.py            # Main Flask application
│   ├── database_schema.sql     # Database schema definition (ensure this is up-to-date)
│   ├── pyproject.toml          # Python dependency management with Poetry
│   ├── poetry.lock             # Poetry lock file
│   ├── requirements.txt        # pip requirements (if used alongside or for specific purposes)
│   └── README.md               # This file
│
└── final__bristleconefrontend/   # Frontend application (Next.js)
    ├── app/                    # Next.js app directory (pages and layouts)
    ├── components/             # Reusable UI components
    ├── lib/                    # Utility functions, axios instance, API logic, types
    ├── public/                 # Static assets
    ├── store/                  # Zustand store configurations
    ├── .env.local              # Frontend local environment variables
    ├── package.json            # Frontend dependencies and scripts
    ├── pnpm-lock.yaml          # pnpm lock file
    └── README.md               # Frontend specific README
```

## Getting Started

### Prerequisites

- Python 3.8+ (check `pyproject.toml` for specific version if defined)
- Poetry (Python package manager: https://python-poetry.org/docs/#installation)
- PostgreSQL (running instance)
- Node.js 18+
- pnpm (frontend package manager: https://pnpm.io/installation)

### Backend Setup (`final__bristlecone/`)

1.  **Navigate to the backend directory:**
    ```bash
    cd final__bristlecone
    ```

2.  **Install Dependencies using Poetry:**
    ```bash
    poetry install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the `final__bristlecone` directory with necessary variables. Example:
    ```env
    DATABASE_URL=postgresql://user:password@localhost:5432/bristlecone_db_name
    SECRET_KEY=your-very-secret-and-strong-key
    # Add other backend-specific environment variables if any (e.g., API keys for AI services)
    ```

4.  **Initialize Database:**
    Ensure your PostgreSQL server is running and you have created the database specified in `DATABASE_URL`.
    Then, apply the schema. *Make sure `database_schema.sql` is current, reflecting the `chat_history` table and its `message_id` column, among other tables like `users` and `chat_sessions`.*
    ```bash
    psql -U your_postgres_user -d your_bristlecone_db_name -f database_schema.sql
    ```

5.  **Run the Backend (within Poetry environment):**
    ```bash
    poetry shell
    flask run # This usually starts the server on http://localhost:5000
    ```

### Frontend Setup (`final__bristleconefrontend/`)

1.  **Navigate to the frontend directory:**
    ```bash
    cd final__bristleconefrontend # (From the workspace root)
    ```

2.  **Install Dependencies using pnpm:**
    ```bash
    pnpm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env.local` file in the `final__bristleconefrontend` directory. This points to your running backend.
    ```env
    NEXT_PUBLIC_API_BASE_URL=http://localhost:5000 # Default Flask port
    ```

4.  **Run Development Server:**
    ```bash
    pnpm run dev # This usually starts the server on http://localhost:3000
    ```

## Development

### Backend Development

The backend is built with Flask and follows a modular architecture:

- **Authentication**: Likely JWT-based, managed via `auth/` modules.
- **API Endpoints**: RESTful API endpoints. Key chat-related endpoints include `/chat/create_chat`, `/chat/chat_sessions`, `/chat/get_chat/{chat_id}`.
- **AI Integration**: Integration with AI models and services.
- **Database**: PostgreSQL. Data access might be through raw SQL (as seen in `utils/chat_history_handler.py`) or an ORM like SQLAlchemy (if `models/` contains ORM definitions).

### Frontend Development

The frontend is built with modern web technologies:

- **Framework**: Next.js 14 with TypeScript.
- **Styling**: Tailwind CSS for responsive design.
- **State Management**: Zustand for global state (user session, messages), and local component state.
- **API Communication**: Uses an Axios instance defined in `lib/axiosInstance.ts` to communicate with backend endpoints specified by `NEXT_PUBLIC_API_BASE_URL`.

## Contributing

1.  Fork the repository (if applicable).
2.  Create a feature branch for your changes.
3.  Commit your changes with clear, descriptive messages.
4.  Push your branch and create a Pull Request against the main development branch.
5.  Ensure any relevant documentation (like this README and the frontend README) is updated.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details (if one exists, otherwise assume proprietary or specify).
