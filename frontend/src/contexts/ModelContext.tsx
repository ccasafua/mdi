import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { listModels } from "../api/client";

export interface ModelInfo {
  model_id: string;
  algorithm: string;
  r2: number;
  mae?: number;
  rmse?: number;
}

interface ModelContextValue {
  models: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  refreshModels: () => Promise<void>;
}

const ModelContext = createContext<ModelContextValue>({
  models: [],
  selectedModel: "",
  setSelectedModel: () => {},
  refreshModels: async () => {},
});

export function ModelProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  const refreshModels = useCallback(async () => {
    const res = await listModels();
    setModels(res.data);
    if (res.data.length > 0 && !selectedModel) {
      setSelectedModel(res.data[0].model_id);
    }
  }, [selectedModel]);

  useEffect(() => {
    refreshModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ModelContext.Provider value={{ models, selectedModel, setSelectedModel, refreshModels }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  return useContext(ModelContext);
}
