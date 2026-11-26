const { SerialPort } = require('serialport');

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
  console.log('Puerto serie abierto. Escuchando cualquier dato entrante (sin enviar comandos)...');
});

port.on('data', (data) => {
  console.log(`\n=== DATOS RECIBIDOS (${data.length} bytes) ===`);
  console.log('HEX:', data.toString('hex'));
  console.log('ASCII:', data.toString('ascii'));
  console.log(`=======================\n`);
});

port.on('error', (err) => {
  console.error('Error de puerto serie:', err.message);
  process.exit(1);
});

// Timeout de 60 segundos para darte tiempo a apoyar el peso
setTimeout(() => {
  console.log('Timeout de 60 segundos completado. Finalizando script.');
  process.exit(0);
}, 60000);
