const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let activePort = null;

// Endpoint to list available ports
app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'CONNECT') {
        const { path, baudRate, dataBits, stopBits, parity } = data.config;
        
        if (activePort) {
          if (activePort.isOpen) activePort.close();
          activePort = null;
        }

        console.log(`Attempting to open port ${path} with config:`, data.config);

        activePort = new SerialPort({
          path,
          baudRate: parseInt(baudRate, 10),
          dataBits: parseInt(dataBits, 10) || 8,
          stopBits: parseInt(stopBits, 10) || 1,
          parity: parity || 'none',
          autoOpen: false
        });

        activePort.open((err) => {
          if (err) {
            console.error('Error opening port:', err.message);
            ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
            return;
          }
          console.log(`Port ${path} opened successfully.`);
          ws.send(JSON.stringify({ type: 'CONNECTED', path }));
        });

        activePort.on('data', (dataBuffer) => {
          // Send data as hex string to client
          const hex = dataBuffer.toString('hex');
          const ascii = dataBuffer.toString('ascii');
          console.log(`RX: ${hex} | ${ascii.replace(/[\x00-\x1F\x7F-\x9F]/g, '.')}`);
          ws.send(JSON.stringify({ type: 'DATA', hex, ascii }));
        });

        activePort.on('error', (err) => {
          console.error('Port error:', err.message);
          ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
        });

        activePort.on('close', () => {
          console.log(`Port ${path} closed.`);
          ws.send(JSON.stringify({ type: 'CLOSED' }));
        });
      }

      if (data.type === 'DISCONNECT') {
        if (activePort && activePort.isOpen) {
          activePort.close();
          activePort = null;
        }
      }

      if (data.type === 'WRITE') {
        if (activePort && activePort.isOpen) {
          // Data payload expected in HEX string (e.g. "05" for ENQ)
          const buffer = Buffer.from(data.payload, 'hex');
          activePort.write(buffer, (err) => {
            if (err) {
              console.error('Write error:', err.message);
              ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
            } else {
              console.log(`TX: ${data.payload}`);
            }
          });
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Port is not open' }));
        }
      }

    } catch (err) {
      console.error('WS Message parsing error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    if (activePort && activePort.isOpen) {
      activePort.close();
      activePort = null;
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Scale Proxy Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});
