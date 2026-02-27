import { createContext, useContext, useState, type ReactNode } from "react";
import type { DerivedMaterialProperties } from "../utils/materialProperties";

interface MaterialPropertiesContextValue {
  properties: DerivedMaterialProperties | null;
  setProperties: (props: DerivedMaterialProperties | null) => void;
}

const MaterialPropertiesContext = createContext<MaterialPropertiesContextValue>({
  properties: null,
  setProperties: () => {},
});

export function MaterialPropertiesProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<DerivedMaterialProperties | null>(null);
  return (
    <MaterialPropertiesContext.Provider value={{ properties, setProperties }}>
      {children}
    </MaterialPropertiesContext.Provider>
  );
}

export function useMaterialProperties() {
  return useContext(MaterialPropertiesContext);
}
