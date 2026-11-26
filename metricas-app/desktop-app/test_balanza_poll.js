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
    console.error('Error al abrir el puerto serie de la balanza:', err.message);
    process.exit(1);
  }
  console.log('Puerto serie abierto. Iniciando polling cada 1 segundo por 60 segundos...');
  
  pollingInterval = setInterval(() => {
    if (port.isOpen) {
      const command = buildKretzCommand();
      port.write(command, (writeErr) => {
        if (writeErr) console.error('Error escribiendo:', writeErr.message);
      });
    }
  }, 1000);
});

let dataBuffer = Buffer.alloc(0);

port.on('data', (data) => {
  dataBuffer = Buffer.concat([dataBuffer, data]);

  if (dataBuffer.length > 0 && dataBuffer[0] !== 0x07) {
    const startIdx = dataBuffer.indexOf(0x07);
    if (startIdx !== -1) {
      dataBuffer = dataBuffer.subarray(startIdx);
    } else {
      dataBuffer = Buffer.alloc(0);
    }
  }

  if (dataBuffer.length >= 20) {
    const isSuccess = dataBuffer.subarray(6, 8).toString('ascii') === '01';
    
    if (isSuccess) {
      const pluStr = dataBuffer.subarray(8, 14).toString('ascii');
      const pesoStr = dataBuffer.subarray(14, 20).toString('ascii');
      
      const plu = parseInt(pluStr, 10);
      const pesoKilos = parseInt(pesoStr, 10) / 1000;

      console.log(`[${new Date().toISOString().substring(11, 19)}] PLU: ${plu} | Peso: ${pesoKilos} kg`);
    } else {
      console.log(`Error código: ${dataBuffer.subarray(6, 8).toString('ascii')}`);
    }
    dataBuffer = Buffer.alloc(0);
  }
});

port.on('error', (err) => {
  console.error('Error de puerto serie:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Finalizando prueba de polling de 60 segundos.');
  clearInterval(pollingInterval);
  process.exit(0);
}, 60000);
