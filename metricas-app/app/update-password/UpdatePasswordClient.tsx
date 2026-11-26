"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { changeUserPassword } from "@/actions/user";
import { signOut } from "@/actions/auth";

export default function UpdatePasswordClient({ email }: { email?: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    const res = await changeUserPassword(password);
    
    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      // Contraseña cambiada con éxito. Cerramos sesión y redirigimos.
      await signOut();
      router.push("/login?message=Contraseña actualizada exitosamente. Por favor, inicia sesión con tu nueva clave.");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-bg-surface p-5 font-sans">
      <div className="w-full max-w-[480px] bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-8 pb-4 flex justify-center border-b border-border-subtle">
          <Image
            src="/assets/logo.svg"
            alt="Los Bambinos"
            width={160}
            height={60}
            priority
            className="w-auto h-auto"
          />
        </div>

        <div className="p-8">
          <h1 className="text-[20px] font-medium mb-1 leading-tight text-text-primary text-center">
            Establecer Nueva Contraseña
          </h1>
          <p className="text-[12px] text-text-secondary mb-6 text-center">
            Ingresa tu nueva contraseña para la cuenta {email ? <strong>{email}</strong> : ""}.
          </p>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-brand text-white rounded-lg text-[14px] mb-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">
                <i className="ti ti-alert-circle text-[20px] text-white" aria-hidden="true"></i>
              </div>
              <div className="flex-1 font-bold leading-tight">{error}</div>
              <button 
                type="button"
                onClick={() => setError(null)}
                className="text-white/70 hover:text-white transition-colors shrink-0"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </div>
          )}

          <form onSubmit={handleUpdate} noValidate className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-text-primary tracking-[0.3px]">
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                className="w-full h-[44px] px-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary transition-all focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand hover:border-[#B0AFA8]"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-text-primary tracking-[0.3px]">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                required
                className="w-full h-[44px] px-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary transition-all focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand hover:border-[#B0AFA8]"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] inline-flex items-center justify-center gap-2 bg-success hover:bg-success-hover active:bg-success-active disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-[14px] font-medium transition-all"
            >
              {loading ? (
                <><i className="ti ti-loader-2 animate-spin text-[18px]"></i> Guardando...</>
              ) : (
                <><i className="ti ti-check text-[18px]"></i> Guardar Contraseña</>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
