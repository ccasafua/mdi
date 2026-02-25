# --- Stage 1: Build frontend ---
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# --- Stage 2: Python backend + serve frontend ---
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Generate synthetic datasets
RUN python -m app.data.generate_datasets

# Copy frontend build into backend static folder
COPY --from=frontend-build /app/frontend/dist ./static

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
