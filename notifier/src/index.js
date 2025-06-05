const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.post('/notify', (req, res) => {
  const { orderId, message } = req.body;
  if (!orderId || !message) {
    return res.status(400).json({ error: 'Faltan orderId o message' });
  }

  // Simulación de push (se imprime en consola)
  console.log(
`==== Notificación PUSH ====
-> Pedido: ${orderId}
-> Mensaje: ${message}
==========================`
  );

  return res.json({ status: 'notificado', orderId });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Notifier service escuchando en puerto ${PORT}`);
});

