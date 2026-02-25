---
output:
  html_document: default
  pdf_document: default
---
# Informe Técnico: Material Design Intelligence (MDI)

## Plataforma de Diseño de Materiales Asistida por Inteligencia Artificial

**Versión:** 0.2.0
**Tipo:** MVP (Minimum Viable Product)
**Líneas de código total:** ~3,868 (2,021 backend + 1,847 frontend)
**Tests automatizados:** 35 tests (100% passing)

---

## Índice

1. [Introducción y Motivación](#1-introducción-y-motivación)
2. [Arquitectura General del Sistema](#2-arquitectura-general-del-sistema)
3. [Capa de Datos](#3-capa-de-datos)
4. [Capa de Modelado Predictivo](#4-capa-de-modelado-predictivo)
5. [Capa de Explicabilidad (XAI)](#5-capa-de-explicabilidad-xai)
6. [Laboratorio de Exploración de Materiales](#6-laboratorio-de-exploración-de-materiales)
7. [Sistema de Gestión de Configuraciones](#7-sistema-de-gestión-de-configuraciones)
8. [Interfaz de Usuario (Frontend)](#8-interfaz-de-usuario-frontend)
9. [API REST - Especificación Completa](#9-api-rest---especificación-completa)
10. [Suite de Tests](#10-suite-de-tests)
11. [Stack Tecnológico](#11-stack-tecnológico)
12. [Instrucciones de Ejecución](#12-instrucciones-de-ejecución)
13. [Resumen de Archivos](#13-resumen-de-archivos)

---

## 1. Introducción y Motivación

### 1.1 Problema

El diseño de mezclas de concreto es un proceso que tradicionalmente se basa en prueba y error experimental, tablas empíricas y la experiencia del ingeniero. Cada prueba de laboratorio consume tiempo y recursos. La relación entre los componentes de una mezcla (cemento, ceniza volante, agua, aditivos, agregados) y la resistencia a compresión resultante es altamente no lineal, lo que dificulta la optimización manual.

### 1.2 Solución Propuesta

MDI (Material Design Intelligence) es una plataforma web que utiliza modelos de Machine Learning para:

1. **Predecir** la resistencia a compresión de mezclas de concreto a partir de su composición
2. **Explicar** por qué el modelo predice lo que predice (Explainable AI con SHAP)
3. **Explorar** el espacio de diseño de forma interactiva (barridos paramétricos, superficies de respuesta)
4. **Comparar** configuraciones de mezcla con análisis cuantitativo de factores de influencia
5. **Gestionar** configuraciones candidatas para validación experimental

### 1.3 Flujo de Trabajo del Ingeniero

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  Explorar   │───>│   Entrenar   │───>│   Explicar    │
│   Datos     │    │   Modelo ML  │    │   (SHAP)      │
└─────────────┘    └──────────────┘    └───────────────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  Exportar   │<───│   Guardar    │<───│   Explorar    │
│  CSV Lab    │    │  Candidatas  │    │   Mezclas     │
└─────────────┘    └──────────────┘    └───────────────┘
```

---

## 2. Arquitectura General del Sistema

### 2.1 Diagrama de Arquitectura

```
┌────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  Data    │  Model   │  Expla-  │  Explo-  │  Confi-  │  │
│  │ Explorer │ Training │  nations │  ration  │ gurations│  │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘  │
│       │          │          │          │          │          │
│  ┌────┴──────────┴──────────┴──────────┴──────────┴─────┐   │
│  │              API Client (Axios)                       │   │
│  └──────────────────────┬────────────────────────────────┘   │
│         Puerto 5173     │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP REST (JSON)
┌─────────────────────────┼────────────────────────────────────┐
│         Puerto 8000     │                                    │
│  ┌──────────────────────┴────────────────────────────────┐   │
│  │              FastAPI + CORS Middleware                 │   │
│  └──────┬───────┬───────┬───────┬───────┬────────────────┘   │
│         │       │       │       │       │                    │
│  ┌──────┴──┐ ┌──┴───┐ ┌─┴────┐ ┌┴─────┐ ┌┴──────────┐      │
│  │Datasets │ │Models│ │Expla-│ │Explo-│ │Configura- │      │
│  │ Router  │ │Router│ │nation│ │ration│ │tions Route│      │
│  └────┬────┘ └──┬───┘ │Route │ │Route │ └─────┬─────┘      │
│       │         │      └──┬──┘ └──┬──┘        │            │
│  ┌────┴────┐ ┌──┴─────┐ ┌┴─────┐ ┌┴────────┐ ┌┴──────────┐ │
│  │  Data   │ │ Model  │ │ XAI  │ │Explora- │ │Config.    │ │
│  │ Service │ │Service │ │Serv. │ │tion Svc │ │Service    │ │
│  └────┬────┘ └──┬─────┘ └──┬──┘ └─────────┘ └─────┬─────┘ │
│       │         │          │                       │        │
│  ┌────┴────┐ ┌──┴─────┐ ┌─┴──────┐          ┌─────┴─────┐  │
│  │ pandas  │ │sklearn │ │  SHAP  │          │ JSON File │  │
│  │  CSVs   │ │ Models │ │TreeExp.│          │ Persist.  │  │
│  └─────────┘ └────────┘ └────────┘          └───────────┘  │
│                    BACKEND (Python/FastAPI)                  │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Patrón de Diseño

El backend sigue un patrón de **capas**:

| Capa | Responsabilidad | Archivos |
|------|----------------|----------|
| **Routers** | Definir endpoints HTTP, validación de entrada | `datasets.py`, `models.py`, `explanations.py`, `exploration.py`, `configurations.py` |
| **Services** | Lógica de negocio, algoritmos, cómputos | `data_service.py`, `model_service.py`, `xai_service.py`, `exploration_service.py`, `configuration_service.py` |
| **Schemas** | Validación de datos con Pydantic | `schemas.py` (271 líneas, 30+ modelos) |
| **Config** | Configuración centralizada de datasets | `config.py` |

Cada servicio se instancia como **singleton** al final de su archivo (`data_service = DataService()`), compartiendo estado en memoria durante la sesión del servidor.

---

## 3. Capa de Datos

### 3.1 Datasets Disponibles

| Dataset | Origen | Muestras | Features | Descripción |
|---------|--------|----------|----------|-------------|
| `concrete` | UCI ML Repository | 1,030 | 8 | Dataset real de resistencia a compresión de concreto |
| `concrete_xai` | Sintético (generado) | 500 | 7 | Dataset extendido para análisis XAI |
| `geopolymer` | Sintético (generado) | 400 | 7 | Concreto geopolimérico con alta ceniza volante |

### 3.2 Variables del Sistema

| Variable | Unidad | Descripción | Rango típico |
|----------|--------|-------------|--------------|
| `cement` | kg/m³ | Cemento Portland | 100-550 |
| `blast_furnace_slag` | kg/m³ | Escoria de alto horno (solo dataset UCI) | 0-360 |
| `fly_ash` | kg/m³ | Ceniza volante | 0-400 |
| `water` | kg/m³ | Agua de mezcla | 100-250 |
| `superplasticizer` | kg/m³ | Aditivo superplastificante | 0-30 |
| `coarse_aggregate` | kg/m³ | Agregado grueso | 700-1150 |
| `fine_aggregate` | kg/m³ | Agregado fino | 400-950 |
| `age` | días | Edad de curado | 1-365 |
| `compressive_strength` | MPa | **Variable objetivo** - Resistencia a compresión | 2-82 |

### 3.3 Variables Unificadas

Para poder combinar los 3 datasets, se define un conjunto unificado de 7 features comunes:

```python
UNIFIED_FEATURES = [
    "cement", "fly_ash", "water", "superplasticizer",
    "fine_aggregate", "coarse_aggregate", "age",
]
```

Nota: `blast_furnace_slag` solo existe en el dataset UCI y se excluye del conjunto unificado.

### 3.4 Generación de Datasets Sintéticos

Los datasets `concrete_xai` y `geopolymer` se generan con el script `generate_datasets.py` usando relaciones no lineales realistas:

**ConcreteXAI** (fórmula simplificada):
```
strength ≈ 0.08·cement + 0.03·fly_ash - 15·(water/cement_total)
           + 0.4·superplasticizer + 4·ln(age) + ruido_normal(σ=3)
```

**Geopolymer** (fórmula simplificada):
```
strength ≈ 0.04·cement + 0.06·fly_ash + 10·(fly_ash_ratio)
           - 20·(water/binder_total) + 0.3·superplasticizer + 3.5·ln(age) + ruido_normal(σ=4)
```

### 3.5 Funcionalidades del Data Service

| Método | Descripción |
|--------|-------------|
| `load_dataset(name)` | Carga CSV con caché en memoria |
| `list_datasets()` | Lista los 3 datasets con metadatos |
| `get_summary(name)` | Estadísticas descriptivas (media, std, min, max, cuartiles) |
| `get_sample(name, n, offset)` | Paginación de filas del dataset |
| `get_feature_distributions(name, bins)` | Histogramas para cada variable |
| `get_correlation_matrix(name)` | Matriz de correlación de Pearson |
| `load_unified(dataset_names)` | Merge de múltiples datasets con columna `source` |

### 3.6 Matriz de Correlación

Se calcula la correlación de Pearson entre todas las variables (features + target). Esto permite identificar:
- **Correlaciones positivas fuertes:** ej. cement↔compressive_strength (~0.5)
- **Correlaciones negativas:** ej. water↔compressive_strength (~-0.3)
- **Multicolinealidad:** variables correlacionadas entre sí que pueden afectar el modelo

---

## 4. Capa de Modelado Predictivo

### 4.1 Algoritmos Implementados

#### 4.1.1 Random Forest Regressor

**Principio:** Ensemble de múltiples árboles de decisión entrenados sobre subconjuntos aleatorios del dataset. La predicción final es el promedio de las predicciones individuales de cada árbol.

```
                    Dataset
                   /   |   \
              Árbol1  Árbol2  ... ÁrbolN
                 |       |          |
              pred1   pred2      predN
                   \    |     /
                  PROMEDIO → predicción final
```

**Hiperparámetros configurables:**
- `n_estimators`: Número de árboles (10-1000, default: 100)
- `max_depth`: Profundidad máxima de cada árbol (1-50, opcional)
- `random_state`: Semilla de reproducibilidad (default: 42)

**Rendimiento típico:** R² > 0.85

#### 4.1.2 Gradient Boosting Regressor

**Principio:** Construcción secuencial de árboles donde cada nuevo árbol corrige los errores residuales del modelo acumulado anterior.

```
Modelo₀ → residuos → Árbol₁ → residuos → Árbol₂ → ... → ÁrbolN
                       ×lr         ×lr              ×lr
          Modelo = Modelo₀ + lr·Árbol₁ + lr·Árbol₂ + ... + lr·ÁrbolN
```

**Hiperparámetros configurables:**
- `n_estimators`: Número de etapas de boosting (10-1000, default: 100)
- `learning_rate`: Tasa de aprendizaje (0.01-1.0, default: 0.1)
- `max_depth`: Profundidad máxima por árbol (1-50, opcional)
- `random_state`: Semilla de reproducibilidad (default: 42)

**Rendimiento típico:** R² > 0.80

### 4.2 Pipeline de Entrenamiento

```
1. Cargar dataset "concrete" (1,030 muestras)
2. Separar features (X) y target (y)
3. Split train/test (80/20 por defecto, estratificado con semilla)
4. Entrenar modelo principal
5. Si es Gradient Boosting:
   5a. Entrenar modelo cuantil inferior (α=0.05)
   5b. Entrenar modelo cuantil superior (α=0.95)
6. Calcular métricas en conjunto de test
7. Almacenar modelo + datos en memoria con UUID
```

### 4.3 Métricas de Evaluación

| Métrica | Fórmula | Interpretación |
|---------|---------|----------------|
| **R²** (Coeficiente de determinación) | 1 - SS_res/SS_tot | Proporción de varianza explicada. 1.0 = perfecto, 0 = igual al promedio |
| **MAE** (Error Absoluto Medio) | Σ\|yᵢ - ŷᵢ\| / n | Error promedio en MPa. Menor = mejor |
| **RMSE** (Raíz del Error Cuadrático Medio) | √(Σ(yᵢ - ŷᵢ)² / n) | Error cuadrático promedio en MPa. Penaliza errores grandes |

### 4.4 Cuantificación de Incertidumbre

Un aspecto clave del sistema es que las predicciones no son puntuales sino que incluyen **intervalos de confianza al 95%**.

#### Para Random Forest:

Se aprovecha que el RF es un ensemble de árboles independientes:

```python
# Cada árbol genera su propia predicción
tree_predictions = [tree.predict(X) for tree in model.estimators_]

# Intervalo de confianza = percentiles de las predicciones
lower_bound = percentil(tree_predictions, 2.5)
upper_bound = percentil(tree_predictions, 97.5)
std_dev = desviación_estándar(tree_predictions)
```

**Interpretación:** Si hay 100 árboles y la mayoría predice entre 30 y 40 MPa, el intervalo es [30, 40]. Si los árboles discrepan mucho, el intervalo se amplía, indicando mayor incertidumbre.

#### Para Gradient Boosting:

Se entrenan 2 modelos adicionales con **regresión cuantil**:

```python
# Modelo para el límite inferior (cuantil 5%)
gb_lower = GradientBoostingRegressor(loss="quantile", alpha=0.05)

# Modelo para el límite superior (cuantil 95%)
gb_upper = GradientBoostingRegressor(loss="quantile", alpha=0.95)
```

**Interpretación:** En lugar de predecir la media (pérdida cuadrática), estos modelos predicen directamente los cuantiles 5% y 95% de la distribución condicional de la resistencia. Esto da un intervalo de confianza del 90% (que usamos como aproximación del 95% CI).

#### Ejemplo de salida:

```
Predicción: 34.5 MPa [29.1 — 39.9] (95% CI)
```

Esto le dice al ingeniero: "El modelo predice 34.5 MPa, pero con 95% de confianza la resistencia real estará entre 29.1 y 39.9 MPa".

---

## 5. Capa de Explicabilidad (XAI)

### 5.1 ¿Qué es SHAP?

SHAP (SHapley Additive exPlanations) es un framework basado en la teoría de juegos cooperativos que asigna a cada feature una **contribución marginal** a la predicción.

**Idea central:** Para una predicción f(x) = 35 MPa, SHAP descompone:

```
f(x) = valor_base + SHAP(cement) + SHAP(water) + SHAP(fly_ash) + ...

Ejemplo:
35 MPa = 32 MPa(base) + 5(cement alto) - 3(agua alta) + 1(edad 28d) + ...
```

### 5.2 TreeExplainer

Para modelos basados en árboles (RF, GB), SHAP tiene una implementación optimizada llamada `TreeExplainer` que calcula los valores SHAP exactos en tiempo polinomial (no exponencial como la fórmula original de Shapley).

### 5.3 Funcionalidades XAI del Sistema

#### 5.3.1 Feature Importance (Importancia de Variables)

Calcula la importancia promedio de cada variable:

```
Importancia(feature) = media(|SHAP(feature)|) sobre todas las muestras
```

Se presenta como gráfico de barras horizontales ordenado de mayor a menor.

#### 5.3.2 SHAP Summary Plot

Gráfico de dispersión donde:
- **Eje Y:** cada feature (ordenadas por importancia)
- **Eje X:** valor SHAP (positivo = aumenta la predicción, negativo = disminuye)
- **Color:** valor de la feature (rojo = alto, azul = bajo)

Este gráfico permite ver no solo qué features son importantes, sino **cómo** afectan a la predicción. Ejemplo: "valores altos de cemento (puntos rojos) tienen SHAP positivo → más cemento = más resistencia".

#### 5.3.3 Waterfall Plot (Explicación Individual)

Para una mezcla específica, muestra paso a paso cómo se llega a la predicción:

```
Valor base (promedio): 32.0 MPa
  + cement = 400 kg/m³:        +6.2 MPa
  + water = 220 kg/m³:         -4.1 MPa
  + age = 28 días:             +1.8 MPa
  + fly_ash = 50 kg/m³:        +0.5 MPa
  + superplasticizer = 8:      +0.3 MPa
  + ...
  ──────────────────────────────────────
  Predicción final:            36.7 MPa
```

#### 5.3.4 Dependence Plot

Gráfico de dispersión que muestra la relación entre:
- **Eje X:** valor de una feature (ej. cement de 100 a 500 kg/m³)
- **Eje Y:** valor SHAP de esa feature
- **Color:** la feature con mayor interacción (detectada automáticamente vía correlación)

Permite identificar relaciones no lineales y efectos de interacción entre variables.

#### 5.3.5 Interpretación en Lenguaje Natural

El sistema genera automáticamente una interpretación textual en español:

```
"La predicción es 36.70 MPa (valor base: 32.00 MPa). Los factores más
influyentes son: cement (400.0) aumenta la predicción en 6.20 MPa;
water (220.0) disminuye la predicción en 4.10 MPa; age (28.0) aumenta
la predicción en 1.80 MPa."
```

---

## 6. Laboratorio de Exploración de Materiales

### 6.1 Exploración Paramétrica (1D)

**Objetivo:** Responder "¿cómo cambia la resistencia si varío UN ingrediente manteniendo el resto fijo?"

**Algoritmo:**
```
1. Definir configuración base (8 features con valores fijos)
2. Seleccionar feature a variar (ej. fly_ash)
3. Definir rango (ej. 0 a 200 kg/m³) y número de pasos (ej. 30)
4. Para cada valor en el rango:
   a. Reemplazar el valor en la config base
   b. Obtener predicción + intervalo de confianza del modelo
5. Calcular región óptima (valores que producen ≥90% de la mejor predicción)
```

**Visualización:** Gráfico de línea con banda de incertidumbre (área sombreada al 95% CI) y región óptima resaltada en verde.

### 6.2 Exploración Multivariable (2D)

**Objetivo:** Responder "¿cómo interactúan DOS variables en la resistencia?"

**Algoritmo:**
```
1. Definir configuración base
2. Seleccionar 2 variables (ej. fly_ash y water)
3. Definir rangos y resolución (ej. 20×20 = 400 puntos)
4. Para cada combinación (v1, v2) en la grilla:
   a. Reemplazar ambos valores en la config base
   b. Obtener predicción del modelo
5. Construir matriz de predicciones 20×20
```

**Visualización:** Mapa de calor (heatmap) con escala de color YlOrRd donde cada celda muestra la resistencia predicha. Permite identificar visualmente las zonas de máxima resistencia.

### 6.3 Comparación de Configuraciones

**Objetivo:** Comparar 2 o más mezclas lado a lado con análisis detallado.

**Para cada configuración:**
1. Predicción puntual + intervalo de confianza 95%
2. Top-3 factores más influyentes (SHAP) con sus valores y contribuciones

**Visualización:**
- Gráfico de barras agrupado con barras de error (incertidumbre)
- Tarjetas detalladas con SHAP por configuración
- Botón "Guardar como candidata" para persistir la configuración

---

## 7. Sistema de Gestión de Configuraciones

### 7.1 Propósito

Permitir al ingeniero guardar las mezclas prometedoras encontradas durante la exploración, marcarlas como "candidatas a validación experimental" y exportarlas a CSV para llevar al laboratorio.

### 7.2 Estructura de una Configuración

```json
{
  "id": "a1b2c3d4",
  "label": "Mezcla alta ceniza",
  "values": {
    "cement": 250, "fly_ash": 150, "water": 170,
    "superplasticizer": 10, "coarse_aggregate": 1000,
    "fine_aggregate": 700, "age": 28
  },
  "model_id": "f8e7d6c5",
  "predicted_strength": 38.5,
  "lower_bound": 33.2,
  "upper_bound": 43.8,
  "is_candidate": true
}
```

### 7.3 Persistencia

Las configuraciones se almacenan en memoria durante la ejecución del servidor y se persisten a disco como archivo JSON (`data/configurations.json`). Al reiniciar el servidor, se recargan automáticamente.

### 7.4 Operaciones CRUD

| Operación | Método HTTP | Descripción |
|-----------|-------------|-------------|
| Guardar | `POST /api/configurations` | Crea nueva configuración |
| Listar | `GET /api/configurations` | Retorna todas las configuraciones |
| Marcar candidata | `PATCH /api/configurations/{id}/validate` | Activa flag `is_candidate` |
| Eliminar | `DELETE /api/configurations/{id}` | Elimina configuración |
| Exportar CSV | `GET /api/configurations/export?only_candidates=true` | Descarga como CSV |

### 7.5 Exportación CSV

El CSV exportado incluye todas las columnas necesarias para el laboratorio:

```csv
id,label,cement,coarse_aggregate,fine_aggregate,fly_ash,superplasticizer,water,age,predicted_strength,lower_bound,upper_bound,model_id,is_candidate
a1b2c3d4,Mezcla alta ceniza,250,1000,700,150,10,170,28,38.5,33.2,43.8,f8e7d6c5,True
```

---

## 8. Interfaz de Usuario (Frontend)

### 8.1 Tecnologías

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19.2.0 | Framework de UI |
| TypeScript | 5.9.3 | Tipado estático |
| Material-UI (MUI) | 7.3.8 | Componentes de interfaz |
| Recharts | 3.7.0 | Gráficos de línea, barras, scatter |
| Plotly.js | 3.3.1 | Heatmaps, waterfall, SHAP plots |
| React Router | 7.13.0 | Navegación entre páginas |
| Axios | 1.13.5 | Cliente HTTP para API REST |
| Vite | 7.3.1 | Bundler y dev server |

### 8.2 Estructura de Navegación

La aplicación tiene un **drawer lateral permanente** con 5 páginas:

| # | Página | Ruta | Ícono | Descripción |
|---|--------|------|-------|-------------|
| 1 | Data Explorer | `/` | Storage | Exploración de datasets, estadísticas, correlaciones |
| 2 | Model Training | `/models` | Psychology | Entrenamiento de modelos, predicción individual |
| 3 | Explanations | `/explanations` | Insights | SHAP: importancia, summary, waterfall, dependence |
| 4 | Exploration Lab | `/exploration` | Science | Barrido paramétrico, superficie 2D, comparación |
| 5 | Configurations | `/configurations` | ListAlt | Gestión de mezclas candidatas, exportación CSV |

### 8.3 Componentes Reutilizables

| Componente | Líneas | Descripción |
|-----------|--------|-------------|
| `DataTable.tsx` | 63 | Tabla paginada con headers sticky |
| `MetricsCard.tsx` | 36 | Tarjeta de métrica con color configurable |
| `CorrelationMatrix.tsx` | 44 | Heatmap de correlación (Plotly, escala RdBu, rango [-1, +1]) |
| `FeatureImportance.tsx` | 28 | Barras horizontales de importancia SHAP |
| `ShapSummary.tsx` | 72 | Summary plot tipo beeswarm (Plotly) |
| `ShapWaterfall.tsx` | 64 | Gráfico waterfall de explicación individual |
| `ParametricExploration.tsx` | 133 | Barrido 1D con banda de incertidumbre |
| `MultivariableExploration.tsx` | 143 | Superficie de respuesta 2D (Plotly heatmap) |
| `ConfigurationComparison.tsx` | 179 | Comparación lado a lado con SHAP y guardado |

### 8.4 Página: Data Explorer

- **Selector de dataset** (dropdown con los 3 datasets)
- **Tarjetas de estadísticas** descriptivas por variable (media, std, rango)
- **Matriz de correlación** interactiva (heatmap Plotly)
- **Histogramas de distribución** por feature (Recharts BarChart)
- **Tabla de datos** paginada con 100 filas

### 8.5 Página: Model Training

- **Formulario de entrenamiento:** algoritmo, n_estimators, max_depth, learning_rate
- **Lista de modelos** entrenados con botones de selección
- **Métricas:** R², MAE, RMSE en tarjetas con código de color
- **Scatter plot** de Actual vs Predicho con línea de referencia diagonal
- **Predicción individual** con 8 campos de entrada y resultado con **intervalo de confianza**: `"34.5 MPa [29.1 — 39.9] (95% CI)"`

### 8.6 Página: Explanations

- **Selector de modelo** + botón "Compute SHAP"
- **Feature Importance:** barras horizontales ordenadas
- **SHAP Summary:** scatter por feature coloreado por valor
- **Dependence Plot:** scatter con feature de interacción automática
- **Explicación individual:** formulario + waterfall + interpretación en español

### 8.7 Página: Exploration Lab

3 pestañas (tabs):
- **Paramétrica:** config base + slider de rango → curva con banda de incertidumbre
- **Multivariable:** 2 variables + rangos → heatmap de predicciones
- **Comparación:** 2 formularios lado a lado → gráfico comparativo + SHAP + guardado

### 8.8 Página: Configurations

- **Tabla** con: Label, Cement, Fly Ash, Water, ..., Predicción, 95% CI, Candidata, Acciones
- **Checkbox** para marcar/desmarcar candidata (filas candidatas resaltadas en verde)
- **Botón eliminar** por fila
- **Exportar Todo CSV** / **Exportar Solo Candidatas**

---

## 9. API REST - Especificación Completa

### 9.1 Base URL

```
http://localhost:8000/api
```

### 9.2 Endpoints Completos

#### Datasets (6 endpoints)

```
GET  /datasets                              → Lista todos los datasets
GET  /datasets/unified/summary?sources=...  → Resumen unificado (filtrable por fuente)
GET  /datasets/{name}/summary               → Estadísticas descriptivas
GET  /datasets/{name}/correlations          → Matriz de correlación
GET  /datasets/{name}/sample?n=10&offset=0  → Muestra de datos
GET  /datasets/{name}/distributions?bins=20 → Histogramas
```

#### Models (6 endpoints)

```
GET  /models                                → Lista modelos entrenados
POST /models/train                          → Entrenar nuevo modelo
GET  /models/{id}/metrics                   → Métricas de evaluación
POST /models/{id}/predict                   → Predicción puntual
POST /models/{id}/predict/uncertainty       → Predicción con intervalo 95% CI
POST /models/{id}/predict/batch             → Predicción por lote
```

#### Explanations (5 endpoints)

```
POST /explanations/{id}/compute             → Calcular valores SHAP
GET  /explanations/{id}/summary             → Datos para summary plot
GET  /explanations/{id}/importance          → Importancia de features
POST /explanations/{id}/predict             → Explicación de predicción individual
GET  /explanations/{id}/dependence/{feat}   → Datos de dependence plot
```

#### Exploration (3 endpoints)

```
POST /exploration/parametric                → Barrido paramétrico 1D
POST /exploration/multivariable             → Exploración superficie 2D
POST /exploration/compare                   → Comparación de configuraciones
```

#### Configurations (5 endpoints)

```
POST   /configurations                      → Guardar configuración
GET    /configurations                      → Listar todas
PATCH  /configurations/{id}/validate        → Marcar como candidata
DELETE /configurations/{id}                 → Eliminar
GET    /configurations/export?only_candidates=false → Exportar CSV
```

**Total: 25+ endpoints REST**

### 9.3 Documentación Interactiva

FastAPI genera automáticamente documentación Swagger UI en:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 10. Suite de Tests

### 10.1 Resumen

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `test_data_service.py` | 11 | Carga, listado, estadísticas, correlación, unificado |
| `test_model_service.py` | 9 | Entrenamiento RF/GB, predicción, métricas, incertidumbre |
| `test_xai_service.py` | 6 | SHAP values, importancia, waterfall, dependence |
| `test_exploration_service.py` | 3 | Barrido paramétrico, superficie 2D, comparación |
| `test_configuration_service.py` | 7 | CRUD, persistencia, exportación CSV |
| **Total** | **35** | **Todos pasan ✓** |

### 10.2 Tests Destacados

**Consistencia SHAP:** Verifica que `base_value + sum(shap_values) ≈ prediction` con tolerancia de 1.0 MPa.

**Calidad de modelo:** Valida que RF logre R² > 0.85 y GB logre R² > 0.80.

**Incertidumbre coherente:** Verifica que `lower_bound ≤ prediction ≤ upper_bound` y que `std_dev > 0`.

**Persistencia de configuraciones:** Verifica que las configuraciones guardadas sobrevivan al reinicio del servicio (lectura de JSON en disco).

### 10.3 Ejecución

```bash
cd backend
python -m pytest tests/ -v
```

Resultado esperado:
```
35 passed in ~5 seconds
```

---

## 11. Stack Tecnológico

### 11.1 Backend

| Librería | Versión | Rol |
|----------|---------|-----|
| FastAPI | 0.115.6 | Framework web async |
| Uvicorn | 0.34.0 | Servidor ASGI |
| pandas | 2.2.3 | Manipulación de datos |
| NumPy | 1.26.4 | Cómputos numéricos |
| scikit-learn | 1.6.0 | Modelos ML (RF, GB, métricas) |
| SHAP | 0.46.0 | Explicabilidad (TreeExplainer) |
| Pydantic | 2.10.4 | Validación de datos |
| pytest | 8.3.4 | Framework de testing |

### 11.2 Frontend

| Librería | Versión | Rol |
|----------|---------|-----|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9.3 | Tipado estático |
| Material-UI | 7.3.8 | Componentes de UI |
| Recharts | 3.7.0 | Gráficos (línea, barras, scatter) |
| Plotly.js | 3.3.1 | Visualizaciones avanzadas (heatmap, waterfall) |
| Axios | 1.13.5 | Cliente HTTP |
| React Router | 7.13.0 | Routing SPA |
| Vite | 7.3.1 | Build tool |

---

## 12. Instrucciones de Ejecución

### 12.1 Requisitos Previos

- Python 3.12+
- Node.js 18+
- npm

### 12.2 Backend

```bash
# Instalar dependencias
cd mdi/backend
pip install -r requirements.txt

# Generar datasets sintéticos (solo la primera vez)
python -m app.data.generate_datasets

# Ejecutar tests
python -m pytest tests/ -v

# Levantar servidor (desarrollo)
uvicorn app.main:app --reload
# → http://localhost:8000
# → Documentación: http://localhost:8000/docs
```

### 12.3 Frontend

```bash
# Instalar dependencias
cd mdi/frontend
npm install

# Levantar servidor de desarrollo
npm run dev
# → http://localhost:5173

# Build de producción
npm run build
```

### 12.4 Flujo de Verificación Completo

1. Levantar backend (`uvicorn app.main:app --reload`)
2. Levantar frontend (`npm run dev`)
3. Abrir `http://localhost:5173`
4. **Data Explorer:** Seleccionar dataset, ver estadísticas y correlaciones
5. **Model Training:** Entrenar un Random Forest, verificar R² > 0.85
6. **Explanations:** Computar SHAP, ver importancia de features
7. **Exploration Lab:** Hacer barrido paramétrico de fly_ash, ver superficie 2D
8. **Configurations:** Guardar una mezcla, marcar como candidata, exportar CSV

---

## 13. Resumen de Archivos

### 13.1 Estructura Completa

```
mdi/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                    (74 líneas)
│   │   ├── main.py                      (29 líneas)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py               (271 líneas, 30+ modelos Pydantic)
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── datasets.py              (61 líneas, 6 endpoints)
│   │   │   ├── models.py                (77 líneas, 6 endpoints)
│   │   │   ├── explanations.py          (51 líneas, 5 endpoints)
│   │   │   ├── exploration.py           (50 líneas, 3 endpoints)
│   │   │   └── configurations.py        (52 líneas, 5 endpoints)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── data_service.py          (163 líneas)
│   │   │   ├── model_service.py         (173 líneas)
│   │   │   ├── xai_service.py           (186 líneas)
│   │   │   ├── exploration_service.py   (135 líneas)
│   │   │   └── configuration_service.py (110 líneas)
│   │   └── data/
│   │       ├── concrete.csv             (1,030 muestras)
│   │       ├── concrete_xai.csv         (500 muestras)
│   │       ├── geopolymer.csv           (400 muestras)
│   │       └── generate_datasets.py     (generador de datos sintéticos)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_data_service.py         (11 tests)
│   │   ├── test_model_service.py        (9 tests)
│   │   ├── test_xai_service.py          (6 tests)
│   │   ├── test_exploration_service.py  (3 tests)
│   │   └── test_configuration_service.py (7 tests)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      (100 líneas, 5 rutas)
│   │   ├── main.tsx                     (10 líneas)
│   │   ├── api/
│   │   │   └── client.ts               (101 líneas, 20+ funciones)
│   │   ├── pages/
│   │   │   ├── DataExplorer.tsx         (177 líneas)
│   │   │   ├── ModelTraining.tsx        (250 líneas)
│   │   │   ├── Explanations.tsx         (253 líneas)
│   │   │   ├── ExplorationLab.tsx       (73 líneas)
│   │   │   └── Configurations.tsx       (138 líneas)
│   │   └── components/
│   │       ├── DataTable.tsx            (63 líneas)
│   │       ├── MetricsCard.tsx          (36 líneas)
│   │       ├── CorrelationMatrix.tsx    (44 líneas)
│   │       ├── FeatureImportance.tsx    (28 líneas)
│   │       ├── ShapSummary.tsx          (72 líneas)
│   │       ├── ShapWaterfall.tsx        (64 líneas)
│   │       ├── ParametricExploration.tsx (133 líneas)
│   │       ├── MultivariableExploration.tsx (143 líneas)
│   │       └── ConfigurationComparison.tsx (179 líneas)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
└── INFORME_TECNICO_MDI.md              (este archivo)
```

### 13.2 Estadísticas Finales

| Métrica | Valor |
|---------|-------|
| Archivos de código backend (Python) | 16 |
| Archivos de código frontend (TS/TSX) | 14 |
| Total archivos de código | 30 |
| Líneas de código backend | ~2,021 |
| Líneas de código frontend | ~1,847 |
| **Total líneas de código** | **~3,868** |
| Endpoints API REST | 25+ |
| Tests automatizados | 35 (100% passing) |
| Datasets | 3 (1,930 muestras totales) |
| Algoritmos ML | 2 (Random Forest, Gradient Boosting) |
| Método XAI | SHAP (TreeExplainer) |
| Páginas de UI | 5 |
| Componentes reutilizables | 9 |
