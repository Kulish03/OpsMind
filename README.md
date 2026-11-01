# OpsMind — AI-Powered Operations Copilot for SMEs

OpsMind is an intelligent operations platform designed for small and medium-sized enterprises (SMEs). It unifies core business operations (sales, inventory, expenses, customers, suppliers) with machine learning analytics and a grounded, natural-language AI copilot.

---

## System Architecture

OpsMind is built around an **Evolutionary Modular Architecture**:
- **Frontend:** React + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express (Domain-Driven Modules: Auth, Business, Analytics, Notifications)
- **ML & AI Service:** Python + FastAPI (Demand Forecasting, Anomaly Detection, Churn Prediction, Grounded AI Copilot)
- **Database:** MongoDB Atlas (Document data & Vector Search)
- **Caching & Messaging:** Redis & RabbitMQ

---

## Directory Structure

```text
opsmind/
├── frontend/        # React + Vite client application
├── backend/         # Node.js + Express domain-driven modular backend
├── ml_service/      # Python + FastAPI machine learning & copilot service
├── data/            # Raw, processed, and synthetic datasets
├── scripts/         # Repeatable seed & data processing scripts
├── docker/          # Docker container configuration
└── docs/            # Architecture diagrams & API documentation
```

---

## Getting Started

See individual service directories for local environment setup instructions.
- Frontend: `cd frontend && npm install`
- Backend: `cd backend && npm install`
- ML Service: `cd ml_service && python -m venv venv`
