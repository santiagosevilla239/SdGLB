"use client";

import { useState, useEffect } from "react";
import { logIn, recoverPassword } from "@/actions/auth";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const msg = params.get("message");
      if (msg) {
        setSuccessMsg(msg);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation matching wireframe logic
    if (!email && !password) {
      setError("Faltan datos. Completá usuario y contraseña para entrar.");
      setLoading(false);
      return;
    }

    if (!email) {
      setError("Falta el usuario.");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Te falta la contraseña.");
      setLoading(false);
      return;
    }

    const result = await logIn(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.user) {
      setUser(result.user);
      router.push("/dashboard");
      router.refresh();
    } else {
      setLoading(false);
      setError("Respuesta inesperada del servidor.");
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (!email) {
      setError("Falta el correo.");
      setLoading(false);
      return;
    }

    const result = await recoverPassword(email);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg(
        "Te hemos enviado un correo con el enlace para recuperar tu contraseña.",
      );
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen grid place-items-center bg-bg-surface p-5 font-sans">
      <div className="w-full max-w-[880px] bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[1.1fr_1fr] min-h-[440px] shadow-sm">
        {/* Zona de marca (izquierda) */}
        <div className="bg-bg-canvas p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border-subtle">
          {/* Identificador superior */}
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-medium uppercase tracking-wider">
            <span
              className="w-2 h-2 rounded-full bg-brand shrink-0"
              aria-hidden="true"
            ></span>
            Los Bambinos · Sistema interno
          </div>

          {/* Logo central */}
          <div className="flex items-center justify-center flex-1 py-12">
            <Image
              src="/assets/logo.svg"
              alt="Los Bambinos"
              width={220}
              height={83}
              priority
              className="w-auto h-auto"
              style={{ height: "auto" }}
            />
          </div>

          {/* Tagline inferior */}
          <p className="border-l-[3px] border-brand pl-3 italic text-text-secondary text-[12px] leading-relaxed"></p>
        </div>

        {/* Zona de formulario (derecha) */}
        <div className="bg-bg-elevated p-8 flex flex-col justify-center">
          <h1 className="text-[20px] font-medium mb-1 leading-tight text-text-primary">
            {isRecovering ? "Recuperar Contraseña" : "Hola de nuevo"}
          </h1>
          <p className="text-[12px] text-text-secondary mb-6">
            {isRecovering
              ? "Ingresa tu correo y te enviaremos un enlace para crear una nueva clave."
              : "Ingresá con tu usuario y contraseña para seguir trabajando."}
          </p>

          {/* Alerta de error (Estilo Toast) */}
          {/* Alerta de error (Alta Visibilidad) */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-brand text-white rounded-lg text-[14px] mb-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">
                <i
                  className="ti ti-alert-circle text-[20px] text-white"
                  aria-hidden="true"
                ></i>
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

          {successMsg && (
            <div className="flex items-center gap-3 p-4 bg-success text-white rounded-lg text-[14px] mb-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">
                <i
                  className="ti ti-check text-[20px] text-white"
                  aria-hidden="true"
                ></i>
              </div>
              <div className="flex-1 font-bold leading-tight">{successMsg}</div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-white/70 hover:text-white transition-colors shrink-0"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </div>
          )}

          {isRecovering ? (
            <form onSubmit={handleRecovery} noValidate className="space-y-5">
              <div className="space-y-2">
                <label
                  className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  htmlFor="email_rec"
                >
                  Correo Electrónico
                </label>
                <input
                  id="email_rec"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  className={`w-full h-[44px] px-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary transition-all focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand hover:border-[#B0AFA8] ${error && !email ? "border-brand" : ""}`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] inline-flex items-center justify-center gap-2 bg-success hover:bg-success-hover active:bg-success-active disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-[14px] font-medium transition-all"
              >
                {loading ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin text-[18px]"></i>{" "}
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="ti ti-mail text-[18px]"></i> Enviar enlace
                  </>
                )}
              </button>

              <p className="text-center mt-6 pt-5 border-t border-border-subtle text-[11px] text-text-secondary">
                ¿Lo recordaste?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRecovering(false);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-text-primary font-medium hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} noValidate className="space-y-5">
              {/* Campo usuario */}
              <div className="space-y-2">
                <label
                  className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  htmlFor="email"
                >
                  Usuario
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="El mail asignado a tu usuario"
                  autoComplete="username"
                  className={`w-full h-[44px] px-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary transition-all focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand hover:border-[#B0AFA8] ${error && !email ? "border-brand" : ""}`}
                />
              </div>

              {/* Campo contraseña */}
              <div className="space-y-2">
                <label
                  className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  htmlFor="password"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="La que te dieron al empezar"
                    autoComplete="current-password"
                    className={`w-full h-[44px] pl-[14px] pr-[44px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary transition-all focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand hover:border-[#B0AFA8] ${error && !password ? "border-brand" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-0 right-0 w-[44px] h-[44px] flex items-center justify-center text-text-secondary rounded-md hover:bg-bg-surface hover:text-text-primary transition-colors"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    <i
                      className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-[18px]`}
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovering(true);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-brand hover:underline font-medium leading-normal"
                  >
                    ¿Olvidé mi contraseña?
                  </button>
                </div>
              </div>

              {/* Mantenerme conectado */}
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-text-primary select-none group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-[18px] h-[18px] accent-success cursor-pointer"
                />
                <span className="group-hover:text-text-primary transition-colors">
                  Mantenerme conectado en esta computadora
                </span>
              </label>

              {/* Botón submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] inline-flex items-center justify-center gap-2 bg-success hover:bg-success-hover active:bg-success-active disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-[14px] font-medium transition-all"
              >
                {loading ? (
                  <>
                    <i
                      className="ti ti-loader-2 animate-spin text-[18px]"
                      aria-hidden="true"
                    ></i>
                    Entrando...
                  </>
                ) : (
                  <>
                    <i
                      className="ti ti-login-2 text-[18px]"
                      aria-hidden="true"
                    ></i>
                    Entrar al sistema
                  </>
                )}
              </button>
            </form>
          )}

          {/* Pie del formulario */}
          {!isRecovering && (
            <p className="text-center mt-6 pt-5 border-t border-border-subtle text-[11px] text-text-secondary">
              ¿Problemas para entrar?{" "}
              <a
                href="mailto:admin@losbambinos.com"
                className="text-text-primary font-medium hover:underline"
              >
                Avisale al administrador
              </a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
