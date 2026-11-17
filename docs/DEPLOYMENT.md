# OpsMind Production Deployment & Hosting Guide

This guide details how to deploy the OpsMind full-stack system across free-tier hosting providers (**Render**, **Vercel**, and **MongoDB Atlas**), containerize locally with **Docker Compose**, and verify live production endpoints.

---

## 1. Hosting Providers & Free-Tier Matrix

| Component | Recommended Host | Free Tier Specifications & Limits | Cost |
| :--- | :--- | :--- | :--- |
| **Frontend** (React + Vite) | **Vercel** / **Render Static** | 100 GB bandwidth/month, fast global edge CDN, unlimited preview deploys | **£0.00 / mo** |
| **Backend API** (Express.js) | **Render Web Service** | 750 free instance hours/month (runs 24/7), free automated SSL, auto-sleep after 15m inactivity (spins up in ~30s) | **£0.00 / mo** |
| **ML Service** (FastAPI) | **Render Web Service** | 512 MB RAM, Python 3.11 runtime, 750 free instance hours/month | **£0.00 / mo** |
| **Database** (MongoDB) | **MongoDB Atlas** | **M0 Free Forever Cluster**: 512 MB storage (dataset is ~45 MB), TLS 1.3, automated backups | **£0.00 / mo** |

---

## 2. Step 1: Configure MongoDB Atlas (Free M0 Cluster)

1. **Sign Up / Log In:** Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Create a Free Cluster:**
   * Select **M0 Free** (Shared).
   * Region: Select nearest region (e.g., `eu-west-2` London or `eu-central-1` Frankfurt).
   * Cluster Name: `opsmind-cluster`.
3. **Database Security:**
   * **Database Access:** Create user `opsmind_admin` with password (e.g., `OpsMindSecure2026!`) and `readWriteAnyDatabase` role.
   * **Network Access:** Add IP Address `0.0.0.0/0` (Allow access from anywhere, secured by credential auth).
4. **Copy Connection String:**
   * Click **Connect** > **Drivers** > **Node.js**.
   * Format:
     ```text
     mongodb+srv://opsmind_admin:OpsMindSecure2026!@opsmind-cluster.xxxxx.mongodb.net/opsmind?retryWrites=true&w=majority
     ```
5. **Seed Production Data to Atlas:**
   Run from your local terminal with the Atlas connection string:
   ```bash
   cd backend
   $env:MONGODB_URI="mongodb+srv://opsmind_admin:OpsMindSecure2026!@opsmind-cluster.xxxxx.mongodb.net/opsmind?retryWrites=true&w=majority"
   npm run seed:demo
   ```
   Or run the full synthetic data pipeline:
   ```bash
   python scripts/import_to_mongodb.py --uri "mongodb+srv://..."
   ```

---

## 3. Step 2: Deploy the FastAPI ML Service (Render)

1. Go to [Render Dashboard](https://dashboard.render.com/) > **New +** > **Web Service**.
2. Connect your GitHub repository: `https://github.com/Kulish03/OpsMind`.
3. Configure Service:
   * **Name:** `opsmind-ml-service`
   * **Region:** Frankfurt (EU Central)
   * **Root Directory:** `ml_service`
   * **Runtime:** Python 3
   * **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt -r requirements-ml.txt`
   * **Start Command:** `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
   * **Plan:** Free
4. **Environment Variables:**
   * `ENVIRONMENT`: `production`
   * `PYTHON_VERSION`: `3.11.9`
5. Click **Create Web Service**. Note the deployed URL (e.g. `https://opsmind-ml-service.onrender.com`).
6. **Verify Health:** Visit `https://opsmind-ml-service.onrender.com/api/v1/ml/health`.

---

## 4. Step 3: Deploy the Express Backend (Render)

1. In Render Dashboard > **New +** > **Web Service**.
2. Connect the same repository: `https://github.com/Kulish03/OpsMind`.
3. Configure Service:
   * **Name:** `opsmind-backend`
   * **Region:** Frankfurt (EU Central)
   * **Root Directory:** `backend`
   * **Runtime:** Node
   * **Build Command:** `npm ci --only=production`
   * **Start Command:** `npm start`
   * **Plan:** Free
4. **Environment Variables:**
   * `NODE_ENV`: `production`
   * `PORT`: `10000`
   * `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   * `ML_SERVICE_URL`: `https://opsmind-ml-service.onrender.com`
   * `CLIENT_URL`: `https://opsmind.vercel.app,http://localhost:5173`
   * `JWT_SECRET`: `<Generate random 32-character string>`
   * `JWT_EXPIRES_IN`: `7d`
   * `OPENAI_API_KEY`: `<Your OpenAI API Key, optional>`
5. Click **Create Web Service**. Note the deployed URL (e.g. `https://opsmind-backend.onrender.com`).
6. **Verify Health:** Visit `https://opsmind-backend.onrender.com/api/health`.

---

## 5. Step 4: Deploy the React Frontend (Vercel)

1. Go to [Vercel](https://vercel.com) > **Add New Project**.
2. Import repository `Kulish03/OpsMind`.
3. Configure Project:
   * **Framework Preset:** Vite
   * **Root Directory:** `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. **Environment Variables:**
   * `VITE_API_BASE_URL`: `https://opsmind-backend.onrender.com/api`
   * `VITE_ML_SERVICE_URL`: `https://opsmind-ml-service.onrender.com/api/v1`
5. Click **Deploy**. Note the live URL (e.g. `https://opsmind.vercel.app`).
6. Update `CLIENT_URL` in the Render backend environment variables to match your final Vercel domain.

---

## 6. Alternative: 1-Click Render Blueprint

The repository includes a ready-to-use [`render.yaml`](../render.yaml) specification file.
In Render:
1. Go to **Blueprints** > **New Blueprint Instance**.
2. Select repository `Kulish03/OpsMind`.
3. Render automatically provisions the ML service, backend API, and static frontend with linked internal networking.

---

## 7. Local Production Containerization (Docker Compose)

To run the complete production stack locally with Docker:

```bash
# From the root directory:
docker compose up -d --build

# View container status
docker compose ps

# View service logs
docker compose logs -f backend
```

Services are exposed at:
* **Frontend:** `http://localhost:80`
* **Express API:** `http://localhost:5000/api`
* **FastAPI ML Service:** `http://localhost:8000/docs`
* **MongoDB:** `localhost:27017`

---

## 8. Post-Deployment Smoke Test & Verification Checklist

Once deployed, run this quick smoke test to verify all subsystems:

1. **Service Healthchecks:**
   * [ ] `GET https://opsmind-backend.onrender.com/api/health` returns `status: "healthy"`.
   * [ ] `GET https://opsmind-ml-service.onrender.com/api/v1/ml/health` returns `status: "healthy"`.
2. **Authentication:**
   * [ ] Navigate to the frontend URL.
   * [ ] Log in with demo account: `demo@opsmind.io` / `Password123!`.
   * [ ] Token is stored in `localStorage` and redirects to `/dashboard`.
3. **Analytics Dashboard:**
   * [ ] Revenue, transaction count, gross margin, and AOV metrics populate from the MongoDB backend.
   * [ ] Recharts graphs display revenue trends and category distributions.
4. **Machine Learning Predictions:**
   * [ ] Navigate to `/ml-insights`.
   * [ ] 14-day demand forecast loads with WAPE evaluation score.
   * [ ] Anomaly detection shows flagged expense transactions.
5. **AI Copilot:**
   * [ ] Navigate to `/copilot`.
   * [ ] Ask *"What is our net revenue and sales performance?"*
   * [ ] Copilot invokes `get_sales_analytics` and formats authoritative figures.
6. **Human Approval Workflow:**
   * [ ] Navigate to `/recommendations`.
   * [ ] Select a critical stockout recommendation and click **Confirm & Execute**.
   * [ ] Check the confirmation box and click **Confirm & Execute Operation**.
   * [ ] Status updates to `Action Applied`, inventory stock increments, and an audit trail log is created.
