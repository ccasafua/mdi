import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { listDatasets } from "../api/client";

export interface DatasetInfo {
  name: string;
  description: string;
  num_samples: number;
}

interface DatasetContextValue {
  datasets: DatasetInfo[];
  selectedDataset: string;
  setSelectedDataset: (name: string) => void;
  refreshDatasets: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextValue>({
  datasets: [],
  selectedDataset: "concrete",
  setSelectedDataset: () => {},
  refreshDatasets: async () => {},
});

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("concrete");

  const refreshDatasets = useCallback(async () => {
    const res = await listDatasets();
    setDatasets(res.data);
  }, []);

  useEffect(() => {
    refreshDatasets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DatasetContext.Provider value={{ datasets, selectedDataset, setSelectedDataset, refreshDatasets }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  return useContext(DatasetContext);
}
