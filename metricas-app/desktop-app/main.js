const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');
const log = require('electron-log');

// Redirigir todos los console.log y console.error a un archivo de registro
console.log = log.log;
console.error = log.error;

let mainWindow;
let port;
let pollingInterval;

function calculateChecksum(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const leastSigByte = sum & 0xFF;
  const hexString = leastSigByte.toString(16).toUpperCase().padStart(2, '0');
  return Buffer.from(hexString, 'ascii');
}

function buildKretzCommand() {
  const STX = 0x02;
  const ETX = 0x04;
  const payload = Buffer.from('C011524', 'ascii');
  const baseBuffer = Buffer.concat([Buffer.from([STX]), payload]);
  const checksumBuffer = calculateChecksum(baseBuffer);
  return Buffer.concat([baseBuffer, checksumBuffer, Buffer.from([ETX])]);
}

function generateEAN13(plu, pesoKilos) {
  const prefix = '2';
  const pluStr = plu.toString().padStart(6, '0');
  // El peso se convierte a gramos (5 dígitos)
  const pesoGramos = Math.round(pesoKilos * 1000);
  const pesoStr = pesoGramos.toString().padStart(5, '0').slice(-5);

  const baseCode = prefix + pluStr + pesoStr; // 12 dígitos

  // Cálculo del dígito verificador EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(baseCode[i], 10);
    sum += (i % 2 === 0) ? digit * 1 : digit * 3;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return baseCode + checksum;
}

let isReconnecting = false;
let currentActivePort = 'COM5';
let isPortConnected = false;

function broadcastBalanzaStatus(extra = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('balanza-status', {
      connected: isPortConnected,
      port: currentActivePort,
      currentWeight: global.currentReading || 0,
      currentPlu: global.currentPlu || null,
      isStable: (global.stableCount || 0) >= 2,
      scaleWasEmpty: global.scaleWasEmpty,
      ...extra
    });
  }
}

async function resolveSerialPort(preferredPort) {
  try {
    const ports = await SerialPort.list();
    console.log('Puertos seriales detectados en el sistema:', ports.map(p => `${p.path} (${p.manufacturer || 'Desconocido'})`));
    
    // Si el puerto configurado existe, usarlo
    const match = ports.find(p => p.path.toUpperCase() === preferredPort.toUpperCase());
    if (match) return match.path;

    // Si no está el configurado pero hay un puerto USB serial disponible, usar el primero
    const usbMatch = ports.find(p => 
      (p.manufacturer && !p.manufacturer.toLowerCase().includes('bluetooth')) ||
      (p.pnpId && p.pnpId.toUpperCase().includes('USB')) ||
      p.path.toUpperCase().startsWith('COM')
    );
    if (usbMatch) {
      console.log(`Puerto ${preferredPort} no disponible. Auto-seleccionando puerto: ${usbMatch.path}`);
      return usbMatch.path;
    }
  } catch (err) {
    console.error('Error listando puertos seriales:', err.message);
  }
  return preferredPort;
}

async function initSerialPort() {
  if (isReconnecting) return;

  // Limpiar cualquier intervalo y puerto previo antes de abrir uno nuevo
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  if (port) {
    try {
      port.removeAllListeners();
      if (port.isOpen) {
        port.close();
      }
    } catch (e) {
      console.error('Error limpiando puerto previo:', e.message);
    }
    port = null;
  }

  let preferredPort = 'COM5';
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.comPort) {
        preferredPort = config.comPort;
      }
    } else {
      fs.writeFileSync(configPath, JSON.stringify({ comPort: 'COM5' }, null, 2));
      console.log('Archivo de configuración creado en:', configPath);
    }
  } catch (err) {
    console.error('Error al manejar config.json:', err);
  }

  const comPort = await resolveSerialPort(preferredPort);
  currentActivePort = comPort;
  isPortConnected = false;
  broadcastBalanzaStatus({ statusText: 'Conectando...' });

  try {
    port = new SerialPort({
      path: comPort,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });
  } catch (err) {
    console.error('Error instanciando SerialPort:', err.message);
    scheduleReconnect();
    return;
  }

  let isWaitingForResponse = false;
  let timeoutCount = 0;

  function scheduleReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;
    isPortConnected = false;
    broadcastBalanzaStatus({ connected: false, statusText: 'Reconectando...' });
    
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    
    if (port) {
      try {
        port.removeAllListeners();
        if (port.isOpen) {
          port.close();
        }
      } catch (e) {}
      port = null;
    }
    
    console.log('Intentando reconectar con la balanza en 3 segundos...');
    setTimeout(() => {
      isReconnecting = false;
      initSerialPort();
    }, 3000);
  }

  port.open((err) => {
    if (err) {
      console.error('Error al abrir el puerto serie de la balanza:', err.message);
      scheduleReconnect();
      return;
    }

    isPortConnected = true;
    console.log(`Puerto serie ${comPort} abierto exitosamente. Iniciando polling a la balanza...`);
    broadcastBalanzaStatus({ connected: true, statusText: 'Balanza conectada' });

    // Polling a 450ms: tiempo óptimo para Kretz a 9600 baudios sin saturar el microcontrolador
    pollingInterval = setInterval(() => {
      if (port && port.isOpen) {
        // Backpressure con destrabe rápido si la balanza no contestó
        if (isWaitingForResponse) {
          timeoutCount++;
          if (timeoutCount >= 3) { // ~1.3 segundos sin respuesta -> forzar destrabe
            isWaitingForResponse = false;
            timeoutCount = 0;
          }
          return;
        }

        isWaitingForResponse = true;
        timeoutCount = 0;

        const command = buildKretzCommand();
        port.write(command, (writeErr) => {
          if (writeErr) {
            console.error('Error escribiendo en el puerto serie:', writeErr.message);
            isWaitingForResponse = false;
          }
        });
      }
    }, 450);
  });

  let dataBuffer = Buffer.alloc(0);
  global.currentReading = undefined;
  global.currentPlu = undefined;
  global.stableCount = 0;
  global.scaleWasEmpty = true; 
  global.lastSentPlu = null;
  global.lastSentWeight = null;

  port.on('data', (data) => {
    dataBuffer = Buffer.concat([dataBuffer, data]);

    while (true) {
      const startIdx = dataBuffer.indexOf(0x07);
      
      if (startIdx === -1) {
        dataBuffer = Buffer.alloc(0);
        break;
      }

      if (startIdx > 0) {
        dataBuffer = dataBuffer.subarray(startIdx);
      }

      // Verificamos si hay un segundo inicio anidado (fragmento corrupto)
      const nextStart = dataBuffer.indexOf(0x07, 1);
      const endIdx = dataBuffer.indexOf(0x04);

      if (endIdx !== -1) {
        if (nextStart !== -1 && nextStart < endIdx) {
          // Tenemos 0x07 ... 0x07 ... 0x04 -> El primer 0x07 es basura huérfana
          dataBuffer = dataBuffer.subarray(nextStart);
          continue;
        }

        // Trama completa recibida
        isWaitingForResponse = false; // Liberamos el polling
        const frame = dataBuffer.subarray(0, endIdx + 1);

        if (frame.length >= 20) {
          const statusCode = frame.subarray(6, 8).toString('ascii');
          
          if (statusCode === '01') { 
            // 01 = Peso ESTABLE certificado por la balanza Kretz
            const pluStr = frame.subarray(8, 14).toString('ascii');
            const pesoStr = frame.subarray(14, 20).toString('ascii');
            
            const plu = parseInt(pluStr, 10);
            let pesoKilos;
            
            if (pesoStr.includes('.')) {
              pesoKilos = parseFloat(pesoStr);
            } else {
              pesoKilos = parseInt(pesoStr, 10) / 1000;
            }

            if (isNaN(pesoKilos)) {
              pesoKilos = 0;
            }

            // Detección de balanza vacía o retiro de lata:
            // 1. Si el peso es menor a 200g (plato vacío sin lata)
            if (pesoKilos < 0.200) {
              global.scaleWasEmpty = true;
              global.lastSentPlu = null;
              global.lastSentWeight = null;
            }

            // 2. Si el peso bajó abruptamente respecto a lo último medido o enviado
            if (global.currentReading !== undefined && (global.currentReading - pesoKilos) >= 0.200) {
              global.scaleWasEmpty = true;
            }
            if (global.lastSentWeight !== null && global.lastSentWeight !== undefined && (global.lastSentWeight - pesoKilos) >= 0.200) {
              global.scaleWasEmpty = true;
            }

            // Tolerancia por delta (<= 15 gramos) para absorber ruido de 5g en flotantes:
            const deltaCurrent = global.currentReading !== undefined ? Math.abs(pesoKilos - global.currentReading) : 999;
            const isSameWeight = deltaCurrent <= 0.015;
            const isSamePlu = (plu === global.currentPlu);

            if (isSameWeight && isSamePlu) {
              global.stableCount = (global.stableCount || 0) + 1;
            } else {
              global.currentReading = pesoKilos;
              global.currentPlu = plu;
              global.stableCount = 1;
            }

            // Broadcast de estado a la UI
            broadcastBalanzaStatus();

            // Como Kretz ya valida estabilidad con status '01', requerir 2 lecturas consecutivas (~900ms) es óptimo
            if (global.stableCount >= 2 && pesoKilos >= 0.200) {
              const esMismoGusto = (plu === global.lastSentPlu);
              const pesoCasiIdentico = (global.lastSentWeight !== null && global.lastSentWeight !== undefined && Math.abs(pesoKilos - global.lastSentWeight) < 0.08);

              // Disparar si: la balanza se vació O es distinto sabor O el peso cambió claramente
              if (global.scaleWasEmpty || !esMismoGusto || !pesoCasiIdentico) {
                global.scaleWasEmpty = false;
                global.lastSentPlu = plu;
                global.lastSentWeight = pesoKilos;

                const internal_code = generateEAN13(plu, pesoKilos);

                if (mainWindow && mainWindow.webContents) {
                  mainWindow.webContents.send('balanza-data', { plu, peso: pesoKilos, internal_code });
                }
              }
            }
          } else {
            // Estado inestable o cero (movimiento de lata sobre el plato)
            if (global.stableCount > 0) {
              global.stableCount = 0;
            }
            // El movimiento físico es señal de que se está manipulando o cambiando la lata
            global.scaleWasEmpty = true;
            broadcastBalanzaStatus({ isStable: false, statusText: 'Estabilizando...' });
          }
        }
        dataBuffer = dataBuffer.subarray(endIdx + 1);
      } else {
        if (nextStart !== -1) {
          dataBuffer = dataBuffer.subarray(nextStart);
          continue;
        }
        break;
      }
    }
  });

  port.on('close', () => {
    console.log('El puerto serie se ha cerrado.');
    scheduleReconnect();
  });

  port.on('error', (err) => {
    console.error('Error de puerto serie:', err.message);
    scheduleReconnect();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Los Bambinos",
    // icon: "ruta/al/icono.ico" // Puedes agregar un icono más adelante
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Agregamos preload.js aquí
    }
  });

  // Cargar la URL de Vercel (o localhost si no está en ENV)
  mainWindow.loadURL(process.env.DEPLOY_URL || 'https://los-bambinos-app.vercel.app/');

  // Interceptar la selección del puerto serial para la API Web Serial (si se sigue usando)
  mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      console.log('Puertos disponibles encontrados (Web Serial):', portList);
      callback(portList[0].portId);
    } else {
      callback('');
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'serial') return true;
    return false;
  });

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') return true;
    return false;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Iniciamos la balanza automáticamente al crear la ventana
  initSerialPort();

  ipcMain.on('request-balanza-data', (event) => {
    broadcastBalanzaStatus();
    if (global.stableCount >= 2 && global.currentReading > 0.05 && global.currentPlu) {
      // Forzamos un re-envío del estado actual estable
      const internal_code = generateEAN13(global.currentPlu, global.currentReading);
      event.sender.send('balanza-data', { plu: global.currentPlu, peso: global.currentReading, internal_code });
    }
  });

  ipcMain.on('force-capture-balanza', (event) => {
    if (global.currentReading && global.currentReading > 0.05 && global.currentPlu) {
      const internal_code = generateEAN13(global.currentPlu, global.currentReading);
      global.lastSentPlu = global.currentPlu;
      global.lastSentWeight = global.currentReading;
      global.scaleWasEmpty = false;
      event.sender.send('balanza-data', { plu: global.currentPlu, peso: global.currentReading, internal_code });
      broadcastBalanzaStatus({ statusText: 'Peso capturado manualmente' });
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pollingInterval) clearInterval(pollingInterval);
  if (port && port.isOpen) port.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
