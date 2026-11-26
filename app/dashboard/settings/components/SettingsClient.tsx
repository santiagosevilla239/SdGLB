"use client";

import { useState, useTransition } from "react";
import { changeUserPassword, createBranchWithUser, createEmpleado } from "@/actions/user";
import { toast } from "react-toastify";

interface SettingsClientProps {
  role: string;
  initialBranches: any[];
  userEmail?: string;
}

export default function SettingsClient({ role, initialBranches, userEmail }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"security" | "branches">("security");
  const [isPending, startTransition] = useTransition();

  // Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // New Branch State
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchEmail, setBranchEmail] = useState("");
  const [branchPassword, setBranchPassword] = useState("");
  const [isCentral, setIsCentral] = useState(false);

  // New Employee State
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      const res = await changeUserPassword(newPassword);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Contraseña actualizada exitosamente.");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (branchPassword.length < 6) {
      toast.error("La contraseña temporal debe tener al menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      const res = await createBranchWithUser(
        branchName,
        branchAddress,
        branchEmail,
        branchPassword,
        isCentral
      );

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Sucursal creada exitosamente. Se ha enviado un correo con las credenciales.");
        setBranchName("");
        setBranchAddress("");
        setBranchEmail("");
        setBranchPassword("");
        setIsCentral(false);
      }
    });
  };

  const handleCreateEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (empPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      const res = await createEmpleado(empName, empEmail, empPassword);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Empleado creado exitosamente.");
        setEmpName("");
        setEmpEmail("");
        setEmpPassword("");
      }
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium text-text-primary leading-tight mb-1">
          Ajustes
        </h1>
        <p className="text-[14px] text-text-secondary">
          Tu cuenta{role === "admin" ? " y las sucursales que trabajan con la fábrica" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-6 items-start">
        {/* Cambiar Contraseña */}
        <section className="bg-bg-canvas border border-border-subtle rounded-xl p-6 shadow-sm">
          <h2 className="text-[20px] font-medium text-text-primary mb-2">Cambiar tu contraseña</h2>
          <p className="text-[14px] text-text-secondary leading-normal mb-4">
            Si la cambiás, la próxima vez que entres tenés que usar la nueva. ({userEmail})
          </p>

          <form onSubmit={handlePasswordChange}>
            <div className="field-group">
              <label className="field-label">Contraseña nueva</label>
              <input
                type="password"
                required
                className="input"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Repetila</label>
              <input
                type="password"
                required
                className="input"
                placeholder="La misma de arriba"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary btn-lg btn-block mt-2"
            >
              <i className="ti ti-check" aria-hidden="true"></i>
              {isPending ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        </section>

        {role === "admin" && (
          <>
            {/* Crear Sucursal */}
            <section className="bg-bg-canvas border border-border-subtle rounded-xl p-6 shadow-sm">
              <h2 className="text-[20px] font-medium text-text-primary mb-2">Crear una sucursal</h2>
              <p className="text-[14px] text-text-secondary leading-normal mb-4">
                La sucursal nueva va a poder pedirte mercadería con este usuario y esta contraseña.
              </p>

              <form onSubmit={handleCreateBranch}>
                <div className="field-group">
                  <label className="field-label">Nombre de la sucursal</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="Ej: Suc. Centro"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Dirección</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="Ej: Av. Principal 123"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Mail para entrar</label>
                  <input
                    type="email"
                    required
                    className="input"
                    placeholder="sucursal@ejemplo.com"
                    value={branchEmail}
                    onChange={(e) => setBranchEmail(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Contraseña</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="Mínimo 6 caracteres"
                    value={branchPassword}
                    onChange={(e) => setBranchPassword(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setIsCentral(!isCentral)}>
                  <input
                    type="checkbox"
                    className="w-[18px] h-[18px] accent-success cursor-pointer shrink-0"
                    checked={isCentral}
                    readOnly
                  />
                  <label className="text-[14px] text-text-primary select-none cursor-pointer">
                    Es punto de venta de fábrica
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-primary btn-lg btn-block"
                >
                  <i className="ti ti-building-store" aria-hidden="true"></i>
                  {isPending ? "Creando..." : "Crear sucursal"}
                </button>
              </form>
            </section>

            {/* Lista de Sucursales */}
            <section className="bg-bg-canvas border border-border-subtle rounded-xl p-6 shadow-sm md:col-span-2 xl:col-span-1">
              <h2 className="text-[20px] font-medium text-text-primary mb-2">Sucursales</h2>
              <p className="text-[14px] text-text-secondary leading-normal mb-4">
                Las que hoy le pueden pedir mercadería a la fábrica.
              </p>

              <div className="overflow-x-auto rounded-lg border border-border-subtle">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-bg-surface border-b border-border-subtle">
                    <tr>
                      <th className="px-5 py-3 text-[13px] font-medium text-text-secondary whitespace-nowrap">Sucursal</th>
                      <th className="px-5 py-3 text-[13px] font-medium text-text-secondary whitespace-nowrap">Dirección</th>
                      <th className="px-5 py-3 text-[13px] font-medium text-text-secondary whitespace-nowrap text-right">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {initialBranches.length > 0 ? (
                      initialBranches.map((branch) => (
                        <tr key={branch.id} className="hover:bg-bg-surface transition-colors">
                          <td className="px-5 py-3 text-[14px] text-text-primary font-medium">{branch.name}</td>
                          <td className="px-5 py-3 text-[14px] text-text-secondary">{branch.address || "—"}</td>
                          <td className="px-5 py-3 text-right">
                            {branch.is_central ? (
                              <span className="pill pill-confirmado">Fábrica</span>
                            ) : (
                              <span className="pill pill-despachado">Sucursal</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-[14px] text-text-tertiary">
                          Todavía no hay sucursales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {role !== "admin" && role !== "empleado" && (
          <section className="bg-bg-canvas border border-border-subtle rounded-xl p-6 shadow-sm">
            <h2 className="text-[20px] font-medium text-text-primary mb-2">Crear empleado</h2>
            <p className="text-[14px] text-text-secondary leading-normal mb-4">
              Creá un usuario para tus empleados. No van a poder ver precios ni métricas, pero sí gestionar pedidos e inventario.
            </p>

            <form onSubmit={handleCreateEmpleado}>
              <div className="field-group">
                <label className="field-label">Nombre del empleado</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Ej: Juan Pérez"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Mail para entrar</label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="empleado@sucursal.com"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Contraseña</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary btn-lg btn-block mt-2"
              >
                <i className="ti ti-user-plus" aria-hidden="true"></i>
                {isPending ? "Creando..." : "Crear empleado"}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
