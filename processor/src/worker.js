const express = require('express');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const app = express();
app.use(express.json());

/**
 * Función que simula un trabajo intensivo (facturación, imagen, scraping).
 * Aquí simplemente dormiremos unos milisegundos.
 */
function simulateHeavyTask(data) {
  return new Promise((resolve) => {
    const workTime = Math.floor(Math.random() * 3000) + 2000; // 2–5 segundos aleatorio
    setTimeout(() => {
      resolve({ result: `Facturación completada para pedido ${data.orderId}` });
    }, workTime);
  });
}

// Si estamos dentro de un Worker Thread, ejecutamos la tarea y notificamos
if (!isMainThread) {
  simulateHeavyTask(workerData)
    .then((result) => {
      // Al terminar, hacemos POST al servicio notifier
      return axios.post(workerData.notifyUrl, {
        orderId: workerData.orderId,
        message: result.result
      });
    })
    .catch(err => {
      console.error('Error en Worker:', err.message);
    })
    .finally(() => {
      // Informar al proceso padre que ya terminó
      parentPort.postMessage({ status: 'done' });
    });
  return; // Evitar que el hilo principal siga ejecutando el servidor
}

// Solo el hilo principal llega aquí: levantamos el servidor Express
app.post('/process', (req, res) => {
  const { orderId, payload, notifyUrl } = req.body;
  if (!orderId || !notifyUrl) {
    return res.status(400).json({ error: 'orderId y notifyUrl son obligatorios' });
  }

  // Creamos un nuevo Worker para cada petición
  const worker = new Worker(__filename, {
    workerData: { orderId, payload, notifyUrl }
  });

  worker.on('message', () => {
    console.log(`Worker finalizó tarea para pedido ${orderId}`);
  });
  worker.on('error', (err) => {
    console.error('Error en Worker:', err.message);
  });
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker terminó con código ${code}`);
    }
  });

  // Respondemos de inmediato que la tarea está encolada
  return res.json({ status: 'en_proceso', orderId });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  // ¡Aquí es clave usar backticks para que la variable PORT se interpolé!
  console.log(`Processor service corriendo en puerto ${PORT}`);
});

