const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'http://nginx:8080/process';
const NOTIFIER_URL = process.env.NOTIFIER_URL || 'http://notifier:5000/notify';

app.post('/api/facturar', async (req, res) => {
  const { orderId, payload } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'orderId es obligatorio' });
  }
  const task = { orderId, payload: payload || {}, notifyUrl: NOTIFIER_URL };
  try {
    const response = await axios.post(PROCESSOR_URL, task, { timeout: 2000 });
    return res.json({
      status: 'tarea_recibida',
      orderId,
      processorResponse: response.data
    });
  } catch (err) {
    console.error('Error al encolar tarea:', err.message);
    return res.status(500).json({ error: 'No se pudo encolar la tarea' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway service en puerto ${PORT}`);
});
