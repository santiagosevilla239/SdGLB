const { SerialPort } = require('serialport');

function calculateChecksum(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const leastSigByte = sum & 0xFF;
  return Buffer.from(leastSigByte.toString(16).toUpperCase().padStart(2, '0'), 'ascii');
}

function buildKretzCommand() {
  const STX = 0x02;
  const ETX = 0x04;
  const payload = Buffer.from('C011524', 'ascii');
  const baseBuffer = Buffer.concat([Buffer.from([STX]), payload]);
  const checksumBuffer = calculateChecksum(baseBuffer);
  return Buffer.concat([baseBuffer, checksumBuffer, Buffer.from([ETX])]);
}

const port = new SerialPort({ path: 'COM4', baudRate: 9600, autoOpen: false });

port.open((err) => {
  if (err) return process.exit(1);
  console.log('Simulando lógica exacta de main.js por 30s...');
  setInterval(() => {
    if (port.isOpen) port.write(buildKretzCommand());
  }, 1000);
});

let dataBuffer = Buffer.alloc(0);
global.currentReading = undefined;
global.stableCount = 0;
global.lastSentPeso = -1;

port.on('data', (data) => {
  dataBuffer = Buffer.concat([dataBuffer, data]);

  if (dataBuffer.length > 0 && dataBuffer[0] !== 0x07) {
    const startIdx = dataBuffer.indexOf(0x07);
    dataBuffer = startIdx !== -1 ? dataBuffer.subarray(startIdx) : Buffer.alloc(0);
  }

  if (dataBuffer.length >= 20) {
    const isSuccess = dataBuffer.subarray(6, 8).toString('ascii') === '01';
    
    if (isSuccess) {
      const pesoStr = dataBuffer.subarray(14, 20).toString('ascii');
      const pesoKilos = pesoStr.includes('.') ? parseFloat(pesoStr) : parseInt(pesoStr, 10) / 1000;

      console.log(`[RAW PESO] ${pesoKilos}`);

      if (pesoKilos <= 0.05) global.lastSentPeso = 0;

      if (pesoKilos === global.currentReading) {
        global.stableCount++;
      } else {
        global.currentReading = pesoKilos;
        global.stableCount = 1;
      }

      console.log(` -> StableCount: ${global.stableCount}, LastSent: ${global.lastSentPeso}`);

      if (global.stableCount >= 2) {
        if (pesoKilos > 0.05 && pesoKilos !== global.lastSentPeso) {
          global.lastSentPeso = pesoKilos;
          console.log(`\n>>> ENVIANDO A LA UI: ${pesoKilos} kg <<<\n`);
        }
      }
    }
    dataBuffer = Buffer.alloc(0);
  }
});

setTimeout(() => process.exit(0), 30000);
