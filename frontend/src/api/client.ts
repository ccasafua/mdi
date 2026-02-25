import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

// --- Datasets ---
export const listDatasets = () => api.get("/datasets");
export const getDatasetSummary = (name: string) =>
  api.get(`/datasets/${name}/summary`);
export const getDatasetSample = (name: string, n = 10, offset = 0) =>
  api.get(`/datasets/${name}/sample`, { params: { n, offset } });
export const getDatasetDistributions = (name: string, bins = 20) =>
  api.get(`/datasets/${name}/distributions`, { params: { bins } });
export const getCorrelations = (name: string) =>
  api.get(`/datasets/${name}/correlations`);
export const getUnifiedSummary = (sources?: string) =>
  api.get("/datasets/unified/summary", { params: sources ? { sources } : {} });

// --- Models ---
export const listModels = () => api.get("/models");
export const trainModel = (params: {
  algorithm: string;
  test_size?: number;
  n_estimators?: number;
  max_depth?: number | null;
  learning_rate?: number;
}) => api.post("/models/train", params);
export const getModelMetrics = (modelId: string) =>
  api.get(`/models/${modelId}/metrics`);
export const predict = (modelId: string, inputData: Record<string, number>) =>
  api.post(`/models/${modelId}/predict`, inputData);
export const predictWithUncertainty = (
  modelId: string,
  inputData: Record<string, number>
) => api.post(`/models/${modelId}/predict/uncertainty`, inputData);

// --- Explanations ---
export const computeShap = (modelId: string) =>
  api.post(`/explanations/${modelId}/compute`);
export const getShapSummary = (modelId: string) =>
  api.get(`/explanations/${modelId}/summary`);
export const getFeatureImportance = (modelId: string) =>
  api.get(`/explanations/${modelId}/importance`);
export const explainPrediction = (
  modelId: string,
  inputData: Record<string, number>
) => api.post(`/explanations/${modelId}/predict`, inputData);
export const getDependenceData = (modelId: string, feature: string) =>
  api.get(`/explanations/${modelId}/dependence/${feature}`);

// --- Exploration ---
export const parametricSweep = (params: {
  model_id: string;
  base_config: Record<string, number>;
  sweep_feature: string;
  min_val: number;
  max_val: number;
  steps: number;
}) => api.post("/exploration/parametric", params);

export const multivariableExploration = (params: {
  model_id: string;
  base_config: Record<string, number>;
  variable_ranges: { feature: string; min_val: number; max_val: number; steps: number }[];
}) => api.post("/exploration/multivariable", params);

export const compareConfigurations = (params: {
  model_id: string;
  configurations: Record<string, number>[];
  labels: string[];
}) => api.post("/exploration/compare", params);

// --- Configurations ---
export const saveConfiguration = (params: {
  label: string;
  values: Record<string, number>;
  model_id: string;
  predicted_strength: number;
  lower_bound?: number;
  upper_bound?: number;
  is_candidate?: boolean;
}) => api.post("/configurations", params);

export const listConfigurations = () => api.get("/configurations");

export const markValidationCandidate = (configId: string) =>
  api.patch(`/configurations/${configId}/validate`);

export const deleteConfiguration = (configId: string) =>
  api.delete(`/configurations/${configId}`);

export const exportConfigurations = (onlyCandidates = false) =>
  api.get("/configurations/export", {
    params: { only_candidates: onlyCandidates },
    responseType: "blob",
  });

export default api;
