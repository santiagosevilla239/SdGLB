"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ConnectionMode = "WEB_SERIAL" | "PROXY";

interface LogEntry {
  type: "RX" | "TX" | "INFO" | "ERROR";
  hex: string;
  ascii: string;
  timestamp: string;
}

export function ScaleTester() {
  const [mode, setMode] = useState<ConnectionMode>("PROXY");
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Configuración Serial
  const [baudRate, setBaudRate] = useState(9600);
  const [dataBits, setDataBits] = useState(8);
  const [parity, setParity] = useState<"none" | "even" | "odd">("none");
  const [stopBits, setStopBits] = useState(1);

  // Proxy state
  const [proxyPorts, setProxyPorts] = useState<{ path: string; manufacturer: string }[]>([]);
  const [selectedProxyPort, setSelectedProxyPort] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Web Serial API state
  const webPortRef = useRef<any>(null);
  const webReaderRef = useRef<any>(null);
  const webWriterRef = useRef<any>(null);
  const webKeepReadingRef = useRef(false);

  // Inputs para envío
  const [sendText, setSendText] = useState("");
  const [sendHex, setSendHex] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const addLog = useCallback((type: "RX" | "TX" | "INFO" | "ERROR", hex: string = "", ascii: string = "") => {
    setLogs((prev) => [
      ...prev,
      {
        type,
        hex,
        ascii,
        timestamp: new Date().toISOString().split("T")[1].slice(0, 12),
      },
    ]);
  }, []);

  // --------------- PROXY MODE ----------------
  const fetchProxyPorts = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/ports");
      const data = await res.json();
      setProxyPorts(data);
      if (data.length > 0 && !selectedProxyPort) setSelectedProxyPort(data[0].path);
      addLog("INFO", "", "Puertos del proxy actualizados.");
    } catch (err: any) {
      addLog("ERROR", "", `No se pudo conectar al proxy: ${err.message}`);
    }
  };

  const connectProxy = () => {
    if (!selectedProxyPort) return;
    addLog("INFO", "", `Conectando a WS Proxy...`);
    
    wsRef.current = new WebSocket("ws://localhost:3001");
    
    wsRef.current.onopen = () => {
      addLog("INFO", "", "WS Conectado. Abriendo puerto...");
      wsRef.current?.send(
        JSON.stringify({
          type: "CONNECT",
          config: {
            path: selectedProxyPort,
            baudRate,
            dataBits,
            stopBits,
            parity,
          },
        })
      );
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "CONNECTED") {
        setIsConnected(true);
        addLog("INFO", "", `Puerto ${data.path} abierto exitosamente en Proxy.`);
      } else if (data.type === "DATA") {
        addLog("RX", data.hex, data.ascii);
      } else if (data.type === "ERROR") {
        addLog("ERROR", "", data.message);
        setIsConnected(false);
      } else if (data.type === "CLOSED") {
        setIsConnected(false);
        addLog("INFO", "", "Puerto cerrado en Proxy.");
      }
    };

    wsRef.current.onerror = (err) => {
      addLog("ERROR", "", "Error en conexión WS con Proxy.");
      setIsConnected(false);
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
    };
  };

  const disconnectProxy = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "DISCONNECT" }));
      wsRef.current.close();
    }
  };

  // --------------- WEB SERIAL MODE ----------------
  const connectWebSerial = async () => {
    const nav = navigator as any;
    if (!nav.serial) {
      addLog("ERROR", "", "Web Serial API no está soportada en este navegador (usá Chrome/Edge).");
      return;
    }

    try {
      addLog("INFO", "", "Solicitando puerto al usuario...");
      const port = await nav.serial.requestPort();
      webPortRef.current = port;

      addLog("INFO", "", `Abriendo puerto nativo a ${baudRate} baudios...`);
      await port.open({
        baudRate,
        dataBits,
        stopBits,
        parity,
      });

      setIsConnected(true);
      addLog("INFO", "", "Puerto nativo abierto exitosamente.");
      
      webKeepReadingRef.current = true;
      
      // Lanzar el bucle de lectura sin bloquear
      readWebSerialLoop();

    } catch (err: any) {
      addLog("ERROR", "", `Error al abrir puerto nativo: ${err.message}`);
      setIsConnected(false);
    }
  };

  const readWebSerialLoop = async () => {
    while (webPortRef.current && webPortRef.current.readable && webKeepReadingRef.current) {
      const reader = webPortRef.current.readable.getReader();
      webReaderRef.current = reader;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const hex = Array.from(value as Uint8Array).map(b => b.toString(16).padStart(2, "0")).join("");
            const ascii = new TextDecoder().decode(value as Uint8Array);
            addLog("RX", hex, ascii);
          }
        }
      } catch (error: any) {
        addLog("ERROR", "", `Error de lectura: ${error.message}`);
      } finally {
        reader.releaseLock();
      }
    }
  };

  const disconnectWebSerial = async () => {
    webKeepReadingRef.current = false;
    if (webReaderRef.current) {
      await webReaderRef.current.cancel();
      webReaderRef.current = null;
    }
    if (webPortRef.current) {
      try {
        await webPortRef.current.close();
        addLog("INFO", "", "Puerto nativo cerrado.");
      } catch (err: any) {
        addLog("ERROR", "", `Error al cerrar puerto nativo: ${err.message}`);
      }
      webPortRef.current = null;
    }
    setIsConnected(false);
  };

  // --------------- SENDER ----------------
  const sendData = async (payloadHex: string, payloadAscii: string) => {
    if (!isConnected) {
      addLog("ERROR", "", "No hay puerto abierto para enviar.");
      return;
    }

    try {
      if (mode === "PROXY") {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "WRITE", payload: payloadHex }));
          addLog("TX", payloadHex, payloadAscii);
        }
      } else {
        if (webPortRef.current && webPortRef.current.writable) {
          const writer = webPortRef.current.writable.getWriter();
          webWriterRef.current = writer;
          
          const bytes = [];
          for (let i = 0; i < payloadHex.length; i += 2) {
            bytes.push(parseInt(payloadHex.substr(i, 2), 16));
          }
          const uint8array = new Uint8Array(bytes);
          
          await writer.write(uint8array);
          writer.releaseLock();
          addLog("TX", payloadHex, payloadAscii);
        }
      }
    } catch (err: any) {
      addLog("ERROR", "", `Error al enviar: ${err.message}`);
    }
  };

  const handleSendText = () => {
    const bytes = Array.from(new TextEncoder().encode(sendText));
    const hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("");
    sendData(hex, sendText);
  };

  const handleSendHex = () => {
    const cleanHex = sendHex.replace(/\s+/g, "");
    if (!/^[0-9A-Fa-f]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
      addLog("ERROR", "", "Formato Hex inválido. Deben ser pares (ej: 05 0A)");
      return;
    }
    // Reconstruir ASCII para display (sólo representativo)
    let asciiStr = "";
    for (let i = 0; i < cleanHex.length; i += 2) {
      const code = parseInt(cleanHex.substr(i, 2), 16);
      asciiStr += (code >= 32 && code <= 126) ? String.fromCharCode(code) : ".";
    }
    sendData(cleanHex, asciiStr);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel Izquierdo: Configuración */}
      <div className="col-span-1 space-y-6">
        <section className="bg-bg-canvas border border-border-subtle rounded-lg p-5 shadow-sm">
          <h2 className="text-[16px] font-medium text-text-primary mb-4 flex items-center gap-2">
            <i className="ti ti-settings"></i>
            Configuración de Conexión
          </h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-text-secondary">Modo de Conexión</label>
              <div className="flex bg-bg-surface p-1 rounded-md border border-border-subtle">
                <button
                  type="button"
                  onClick={() => { if(!isConnected) setMode("PROXY") }}
                  className={`flex-1 text-[12px] py-1.5 rounded-sm transition-colors ${mode === "PROXY" ? "bg-white text-text-primary shadow-sm font-medium" : "text-text-secondary hover:text-text-primary"}`}
                >
                  Proxy (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => { if(!isConnected) setMode("WEB_SERIAL") }}
                  className={`flex-1 text-[12px] py-1.5 rounded-sm transition-colors ${mode === "WEB_SERIAL" ? "bg-white text-text-primary shadow-sm font-medium" : "text-text-secondary hover:text-text-primary"}`}
                >
                  Web Serial API
                </button>
              </div>
            </div>

            {mode === "PROXY" && (
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="block text-[12px] font-medium text-text-secondary">Puerto COM</label>
                  <button onClick={fetchProxyPorts} className="text-[11px] text-brand hover:underline">
                    Actualizar
                  </button>
                </div>
                <select 
                  value={selectedProxyPort} 
                  onChange={(e) => setSelectedProxyPort(e.target.value)}
                  disabled={isConnected}
                  className="w-full h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px] text-text-primary focus:ring-2 focus:ring-brand-soft-bg outline-none disabled:opacity-50"
                >
                  <option value="" disabled>Seleccione un puerto</option>
                  {proxyPorts.map(p => (
                    <option key={p.path} value={p.path}>{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}</option>
                  ))}
                </select>
                {proxyPorts.length === 0 && (
                  <p className="text-[11px] text-warning mt-1">Asegurate de correr `node server.js` en scale-proxy.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-text-secondary">Baud Rate</label>
                <select value={baudRate} onChange={e=>setBaudRate(Number(e.target.value))} disabled={isConnected} className="w-full h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px] text-text-primary">
                  <option value={4800}>4800</option>
                  <option value={9600}>9600 (Kretz default)</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-text-secondary">Data Bits</label>
                <select value={dataBits} onChange={e=>setDataBits(Number(e.target.value))} disabled={isConnected} className="w-full h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px] text-text-primary">
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-text-secondary">Parity</label>
                <select value={parity} onChange={e=>setParity(e.target.value as any)} disabled={isConnected} className="w-full h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px] text-text-primary">
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-text-secondary">Stop Bits</label>
                <select value={stopBits} onChange={e=>setStopBits(Number(e.target.value))} disabled={isConnected} className="w-full h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px] text-text-primary">
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              {!isConnected ? (
                <button 
                  onClick={mode === "PROXY" ? connectProxy : connectWebSerial}
                  className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-medium rounded-md text-[13px] transition-colors flex items-center justify-center gap-2"
                >
                  <i className="ti ti-plug"></i> Conectar
                </button>
              ) : (
                <button 
                  onClick={mode === "PROXY" ? disconnectProxy : disconnectWebSerial}
                  className="w-full h-10 bg-danger hover:bg-danger-hover text-white font-medium rounded-md text-[13px] transition-colors flex items-center justify-center gap-2"
                >
                  <i className="ti ti-plug-x"></i> Desconectar
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="bg-bg-canvas border border-border-subtle rounded-lg p-5 shadow-sm">
          <h2 className="text-[16px] font-medium text-text-primary mb-4 flex items-center gap-2">
            <i className="ti ti-command"></i>
            Botones Rápidos (Kretz)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => sendData("05", ".")}
              disabled={!isConnected}
              className="h-10 border border-border-strong rounded-md text-[12px] font-medium hover:bg-black/5 disabled:opacity-50 transition-colors"
              title="Solicitar peso (Hex 05)"
            >
              ENQ (0x05)
            </button>
            <button 
              onClick={() => sendData("50", "P")}
              disabled={!isConnected}
              className="h-10 border border-border-strong rounded-md text-[12px] font-medium hover:bg-black/5 disabled:opacity-50 transition-colors"
              title="Solicitar peso (P)"
            >
              P
            </button>
            <button 
              onClick={() => sendData("57", "W")}
              disabled={!isConnected}
              className="h-10 border border-border-strong rounded-md text-[12px] font-medium hover:bg-black/5 disabled:opacity-50 transition-colors"
              title="Solicitar peso (W)"
            >
              W
            </button>
            <button 
              onClick={() => sendData("0D0A", "\\r\\n")}
              disabled={!isConnected}
              className="h-10 border border-border-strong rounded-md text-[12px] font-medium hover:bg-black/5 disabled:opacity-50 transition-colors"
              title="Salto de línea (Enter)"
            >
              CR LF
            </button>
          </div>
        </section>
      </div>

      {/* Panel Derecho: Consola y Envío Manual */}
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <section className="bg-bg-canvas border border-border-subtle rounded-lg shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-surface/50">
            <h2 className="text-[16px] font-medium text-text-primary flex items-center gap-2">
              <i className="ti ti-terminal-2"></i>
              Consola Serial
            </h2>
            <button 
              onClick={() => setLogs([])}
              className="text-[12px] text-text-secondary hover:text-danger flex items-center gap-1"
            >
              <i className="ti ti-trash"></i> Limpiar
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed bg-[#1E1E1E] text-[#D4D4D4]">
            {logs.length === 0 ? (
              <div className="text-[#6B6B6B] italic">Sin actividad. Conecta el puerto para ver tráfico.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 flex">
                  <span className="text-[#858585] mr-3 shrink-0">[{log.timestamp}]</span>
                  <span className={`shrink-0 w-8 font-bold ${
                    log.type === 'RX' ? 'text-[#4EC9B0]' : 
                    log.type === 'TX' ? 'text-[#CE9178]' : 
                    log.type === 'ERROR' ? 'text-[#F14C4C]' : 'text-[#569CD6]'
                  }`}>
                    {log.type}
                  </span>
                  {log.type === 'INFO' || log.type === 'ERROR' ? (
                    <span>{log.ascii || log.hex}</span>
                  ) : (
                    <div className="flex flex-1 flex-wrap break-all">
                      {log.hex && <span className="text-[#B5CEA8] mr-4 uppercase">Hex: {log.hex.match(/.{1,2}/g)?.join(' ')}</span>}
                      {log.ascii && <span className="text-[#D4D4D4]">Ascii: {log.ascii.replace(/[\x00-\x1F\x7F-\x9F]/g, '.')}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>

        <section className="bg-bg-canvas border border-border-subtle rounded-lg p-5 shadow-sm">
          <h2 className="text-[16px] font-medium text-text-primary mb-4 flex items-center gap-2">
            <i className="ti ti-send"></i>
            Envío Manual Customizado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={sendText} 
                onChange={e=>setSendText(e.target.value)}
                placeholder="Texto a enviar (ASCII)" 
                disabled={!isConnected}
                className="flex-1 h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px]"
              />
              <button 
                onClick={handleSendText}
                disabled={!isConnected || !sendText}
                className="h-10 px-4 bg-brand text-white font-medium rounded-md text-[13px] hover:bg-brand-hover disabled:opacity-50"
              >
                Enviar Texto
              </button>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={sendHex} 
                onChange={e=>setSendHex(e.target.value)}
                placeholder="Hex a enviar (ej: 05 0A)" 
                disabled={!isConnected}
                className="flex-1 h-10 px-3 border border-border-strong rounded-md bg-bg-canvas text-[13px]"
              />
              <button 
                onClick={handleSendHex}
                disabled={!isConnected || !sendHex}
                className="h-10 px-4 bg-brand text-white font-medium rounded-md text-[13px] hover:bg-brand-hover disabled:opacity-50"
              >
                Enviar Hex
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
