#!/usr/bin/env bash

# Número de peticiones concurrentes
NUM_REQUESTS=20
GATEWAY_URL="http://localhost:3000/api/facturar"

echo "Iniciando prueba de carga: $NUM_REQUESTS peticiones concurrentes..."

for i in $(seq 1 $NUM_REQUESTS); do
  (
    curl -s -X POST "$GATEWAY_URL" \
      -H "Content-Type: application/json" \
      -d "{\"orderId\": \"pedido-$i\", \"payload\": { \"amount\": $(( RANDOM % 100 + 1 )) }}" \
      && echo " -> petición $i enviada"
  ) &
done

wait
echo "Prueba de carga finalizada."

