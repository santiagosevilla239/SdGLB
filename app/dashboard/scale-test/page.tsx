import { ScaleTester } from "./components/ScaleTester";

export const metadata = {
  title: "Scale Tester - Los Bambinos",
  description: "Herramienta de testing para balanza Kretz",
};

export default function ScaleTestPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
          Test de Balanza Kretz (Serial / Proxy)
        </h1>
        <p className="text-[14px] text-text-secondary">
          Entorno de pruebas avanzado para diagnosticar la comunicación con la balanza Kretz REPORT LT.
        </p>
      </div>

      <ScaleTester />
    </div>
  );
}
