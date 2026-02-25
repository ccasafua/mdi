# MDI: Material Design Intelligence

Plataforma web para el diseño inteligente de mezclas de concreto, asistido por machine learning y explicabilidad (SHAP).

**Demo en vivo:** [https://mdi-1.onrender.com](https://mdi-1.onrender.com)

## Qué es

MDI permite explorar datos de mezclas cementíceas, entrenar modelos predictivos de resistencia a compresión, entender por qué el modelo predice lo que predice, y explorar el espacio de diseño de forma interactiva para encontrar configuraciones óptimas.

El objetivo es reducir la cantidad de pruebas experimentales necesarias en el laboratorio, permitiendo al ingeniero de materiales explorar miles de combinaciones computacionalmente y llevar al laboratorio solo las más prometedoras.

## Funcionalidades

- **Data Explorer** — Exploración de 3 datasets con estadísticas descriptivas, matriz de correlación, histogramas y tabla de datos
- **Model Training** — Entrenamiento de Random Forest o Gradient Boosting con métricas (R², MAE, RMSE), gráfico actual vs predicho, y predicción individual con intervalo de confianza al 95%
- **Explanations** — Explicabilidad SHAP: feature importance, summary plot, dependence plot y waterfall de predicciones individuales
- **Exploration Lab** — Barrido paramétrico 1D con banda de incertidumbre, superficie de respuesta 2D, comparación de configuraciones lado a lado, y visualización de microestructura 2D procedural
- **Configurations** — Guardar mezclas candidatas, marcarlas para validación experimental y exportar a CSV

## Datasets

| Dataset | Muestras | Descripción |
|---------|----------|-------------|
| concrete (UCI) | 1,030 | Dataset real de resistencia a compresión |
| concrete_xai | 500 | Dataset sintético extendido |
| geopolymer | 400 | Concreto geopolimérico sintético |

## Stack técnico

- **Backend:** Python, FastAPI, scikit-learn, SHAP, pandas
- **Frontend:** React, TypeScript, Material-UI, Recharts, Plotly.js
- **Visualización:** HTML5 Canvas (microestructura 2D procedural)

## Ejecución local

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m app.data.generate_datasets
uvicorn app.main:app --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Backend en `http://localhost:8000` | Frontend en `http://localhost:5173`

## Licencia

Este proyecto está bajo la [Licencia MIT](LICENSE).
