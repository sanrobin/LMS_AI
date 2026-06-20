# 📚 Library Management System

A lightweight, full-stack Library Management System designed for **Raspberry Pi** deployment. Features AI-powered book discovery, interactive floor-plan maps, and role-based dashboards.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Role-based Auth** | JWT sessions with Student and Librarian roles (modular, swappable for OAuth/LDAP) |
| **Book Management** | Full CRUD with search, ISBN validation, and status tracking |
| **Interactive Map** | Leaflet.js floor-plan with animated pin markers for book locations |
| **AI Assistant** | Gemini-powered chat with Google Custom Search enrichment |
| **Circulation Tracking** | Borrow/return flow with duration sorting and overdue highlighting |
| **Dark Glassmorphism UI** | Premium dark theme with micro-animations |

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, SQLAlchemy, SQLite
- **Frontend:** Vanilla HTML5/CSS3/JavaScript, Leaflet.js
- **AI:** Google Gemini API, Google Custom Search Engine API
- **Auth:** JWT (PyJWT) + bcrypt password hashing

## 🚀 Quick Start

### 1. Clone and install dependencies

```bash
cd LMS_AI
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your API keys (optional for basic usage)
```

### 3. Initialize database with sample data

```bash
python -m scripts.init_db
```

### 4. Start the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000** in your browser.

## 👤 Default Accounts

| Role | Username | Password |
|------|----------|----------|
| Librarian | `admin` | `admin123` |
| Student | `student1` | `pass123` |
| Student | `student2` | `pass123` |

## 🗺️ Project Structure

```
LMS_AI/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py             # Environment config
│   ├── database.py           # SQLite + SQLAlchemy
│   ├── models.py             # ORM models
│   ├── schemas.py            # Pydantic schemas
│   ├── auth/                 # Authentication (modular)
│   │   ├── router.py         # Login/register/logout
│   │   ├── dependencies.py   # JWT validation, role check
│   │   └── utils.py          # Password hashing, JWT creation
│   ├── routers/              # API routes
│   │   ├── books.py          # Book CRUD
│   │   ├── locations.py      # CSV location management
│   │   ├── circulation.py    # Borrow/return/history
│   │   └── ai_assistant.py   # Gemini + CSE chat
│   └── services/             # Business logic
│       ├── csv_service.py    # Thread-safe CSV operations
│       ├── gemini_service.py # Gemini API integration
│       └── search_service.py # Google CSE integration
├── static/
│   ├── css/styles.css        # Design system
│   ├── js/                   # Frontend modules
│   └── img/floorplan.png     # Library map image
├── templates/                # Jinja2 HTML templates
├── data/                     # SQLite DB + locations.csv
├── scripts/init_db.py        # Database seeder
├── requirements.txt
└── .env.example
```

## 🍓 Raspberry Pi Deployment

```bash
# Install on Pi
pip install -r requirements.txt

# Initialize DB
python -m scripts.init_db

# Run with Uvicorn (production)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

# Or run as a background service
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 &
```

### Systemd Service (optional)

```ini
[Unit]
Description=Library Management System
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/LMS_AI
ExecStart=/home/pi/.local/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🔑 API Keys Setup

The AI Assistant requires:
1. **Gemini API Key** — Get from [Google AI Studio](https://aistudio.google.com/)
2. **Custom Search API Key + Engine ID** — Get from [Google Cloud Console](https://console.cloud.google.com/)

Add them to your `.env` file. The system works without them (AI features show a setup message).

## 📝 License

MIT
