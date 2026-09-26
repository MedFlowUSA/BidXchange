'use client';
import { createContext, useContext, useState } from 'react';

const DemoPassportContext = createContext<{
  insuranceCurrent: boolean;
  setInsuranceCurrent: (current: boolean) => void;
}>({ insuranceCurrent: false, setInsuranceCurrent: () => {} });
/** In-memory fictional evidence only; no authenticated data or browser persistence. */
export function DemoPassportProvider({ children }: { children: React.ReactNode }) {
  const [insuranceCurrent, setInsuranceCurrent] = useState(false);
  return (
    <DemoPassportContext.Provider value={{ insuranceCurrent, setInsuranceCurrent }}>
      {children}
    </DemoPassportContext.Provider>
  );
}
export const useDemoPassport = () => useContext(DemoPassportContext);
