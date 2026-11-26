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

port.open((err) => {
  if (err) {
    console.error('Error al abrir el puerto serie de la balanza:', err.message);
    process.exit(1);
  }
  console.log('Puerto serie abierto. Enviando comando 1524 a la balanza...');
  
  const command = buildKretzCommand();
  port.write(command, (writeErr) => {
    if (writeErr) {
      console.error('Error escribiendo en el puerto:', writeErr.message);
    }
  });
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

  // La respuesta del comando 1524 tiene muchos datos.
  // 07h(1) + TIPO(1) + ID(2) + GRUPO(2) + RESP(2) + DATOS(43) + CHK(2) + 04h(1) = 54 bytes aprox
  // Para estar seguros, comprobamos si tenemos al menos 20 bytes para leer PLU y peso
  if (dataBuffer.length >= 20) {
    const isSuccess = dataBuffer.subarray(6, 8).toString('ascii') === '01';
    
    if (isSuccess) {
      const pluStr = dataBuffer.subarray(8, 14).toString('ascii');
      const pesoStr = dataBuffer.subarray(14, 20).toString('ascii');
      
      const plu = parseInt(pluStr, 10);
      const pesoKilos = parseInt(pesoStr, 10) / 1000;

      console.log(`\n=== DATOS RECIBIDOS ===`);
      console.log(`PLU: ${plu}`);
      console.log(`Peso: ${pesoKilos} kg`);
      console.log(`=======================\n`);
      
      process.exit(0);
    } else {
      console.log(`La balanza respondió con código: ${dataBuffer.subarray(6, 8).toString('ascii')}`);
      process.exit(1);
    }
  }
});

port.on('error', (err) => {
  console.error('Error de puerto serie:', err.message);
  process.exit(1);
});

// Timeout de 5 segundos
setTimeout(() => {
  console.log('Timeout: No se recibió respuesta de la balanza en 5 segundos.');
  process.exit(1);
}, 5000);
