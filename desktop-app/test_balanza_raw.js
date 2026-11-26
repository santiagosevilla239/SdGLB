const { SerialPort } = require('serialport');

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

const port = new SerialPort({
  path: 'COM4',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  autoOpen: false,
});

let pollingInterval;

port.open((err) => {
  if (err) {
    console.error('Error al abrir el puerto serie:', err.message);
    process.exit(1);
  }
  console.log('Puerto serie abierto. Leyendo datos RAW por 15 segundos...');
  
  pollingInterval = setInterval(() => {
    if (port.isOpen) {
      port.write(buildKretzCommand(), (writeErr) => {
        if (writeErr) console.error('Error escribiendo:', writeErr.message);
      });
    }
  }, 1000);
});

let dataBuffer = Buffer.alloc(0);

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

    const endIdx = dataBuffer.indexOf(0x04);

    if (endIdx !== -1) {
      const frame = dataBuffer.subarray(0, endIdx + 1);

      if (frame.length >= 20) {
        const statusCode = frame.subarray(6, 8).toString('ascii');
        
        console.log(`[RAW ASCII] ${frame.toString('ascii')}`);
        
        if (statusCode === '01') {
          const pluStr = frame.subarray(8, 14).toString('ascii');
          const pesoStr = frame.subarray(14, 20).toString('ascii');
          
          const plu = parseInt(pluStr, 10);
          const pesoKilos = parseInt(pesoStr, 10) / 1000;

          console.log(` -> PLU: ${pluStr} (${plu}) | Peso: ${pesoStr} (${pesoKilos} kg)`);
        } else {
          console.log(` -> Error de balanza código: ${statusCode}`);
        }
      }
      dataBuffer = dataBuffer.subarray(endIdx + 1);
    } else {
      break;
    }
  }
});

setTimeout(() => {
  console.log('Finalizando prueba RAW.');
  clearInterval(pollingInterval);
  process.exit(0);
}, 15000);
