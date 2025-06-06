# Backend Distribuido con Docker, NGINX y Notificaciones Push

Este repositorio contiene una arquitectura de microservicios en Node.js, empaquetada en contenedores Docker, con balanceo de carga mediante NGINX, worker threads para procesamiento en paralelo y un servicio de notificaciones push simulado.

## Descripción

La aplicación consta de tres microservicios principales:

1. **Gateway** (`gateway/`):  
   - Expone el endpoint público `POST /api/facturar`.  
   - Recibe solicitudes de facturación con `{ orderId, payload }`.  
   - Reenvía la tarea a NGINX en `http://nginx:8080/process`, incluyendo la URL de notificación.  
   - Responde inmediatamente con `{ status: "tarea_recibida", orderId, processorResponse }`.

2. **Processor** (`processor/`):  
   - Escucha `POST /process`.  
   - Para cada petición, crea un Worker Thread que simula un trabajo pesado (2–5 segundos).  
   - Al finalizar el Worker, hace `POST http://notifier:5000/notify` con `{ orderId, message }`.  
   - Devuelve al cliente `{ status: "en_proceso", orderId }` de inmediato.  
   - Se despliegan tres instancias idénticas (`processor1`, `processor2`, `processor3`) para balancear carga.

3. **Notifier** (`notifier/`):  
   - Escucha `POST /notify`.  
   - Al recibir `{ orderId, message }`, imprime en consola un bloque simulando la notificación push.  
   - Responde `{ status: "notificado", orderId }`.

4. **NGINX** (`nginx/nginx.conf`):  
   - Configurado como balanceador en el puerto 8080.  
   - Ruta `/process` redirige en round-robin a `processor1:4000`, `processor2:4000` y `processor3:4000`.

5. **Script de prueba de carga** (`scripts/load_test.sh`):  
   - Envía 20 peticiones concurrentes a `http://localhost:3000/api/facturar`.  
   - Permite validar el balanceo y la concurrencia de los workers.

## Requisitos

- **Docker** (versión 20.10 o superior)  
- **Docker Compose** (plugin `docker compose` v2.x)  
- (Opcional) **AWS CLI** + cuenta de AWS si se va a exponer la API vía AWS API Gateway

## Estructura de carpetas

```plaintext
backend-distribuido/
├── gateway/            # Código y Dockerfile del API Gateway
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js
│
├── processor/          # Código y Dockerfile del Processor Service
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── worker.js
│
├── notifier/           # Código y Dockerfile del Notifier Service
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js
│
├── nginx/              # Configuración de NGINX como balanceador
│   └── nginx.conf
│
├── docker-compose.yml  # Orquestación de todos los servicios
│
└── scripts/
    └── load_test.sh    # Script de prueba de carga (20 peticiones concurrentes)
```
# Instalación y puesta en marcha local
## Clonar el repositorio

bash
```
git clone https://github.com/tu_usuario/backend-distribuido.git
cd backend-distribuido
```
### Construir las imágenes Docker

bash
```
docker compose build
Levantar todos los servicios en segundo plano

```
bash
```
docker compose up -d
Verificar que los contenedores estén corriendo
```
bash
```
docker ps
# Deberías ver: gateway, nginx, processor1, processor2, processor3, notifier
Verificar logs básicos

Notifier:
```
bash
```
docker compose logs -f notifier
# Debe mostrar “Notifier service escuchando en puerto 5000”
Processor1 (puedes repetir con processor2, processor3):
```
bash
```
docker compose logs -f processor1
# Debe mostrar “Processor service corriendo en puerto 4000”
Gateway:
```
bash
```
docker compose logs -f gateway
# Debe mostrar “Gateway service en puerto 3000”
Uso
Probar un pedido manual
En una terminal distinta, ejecuta:
```
bash
```
curl -X POST http://localhost:3000/api/facturar \
  -H "Content-Type: application/json" \
  -d '{"orderId":"pedido-ejemplo","payload":{"amount":123}}'
```
### Debes recibir:
```
json
{
  "status": "tarea_recibida",
  "orderId": "pedido-ejemplo",
  "processorResponse": {
    "status": "en_proceso",
    "orderId": "pedido-ejemplo"
  }
}

```
### En los logs de algún processorX, verás:

yaml
```
Processor service corriendo en puerto 4000
Worker finalizó tarea para pedido pedido-ejemplo
En los logs de notifier, tras unos segundos:
```
diff
```
==== Notificación PUSH ====
-> Pedido: pedido-ejemplo
-> Mensaje: Facturación completada para pedido pedido-ejemplo
==========================
Probar carga concurrente (20 peticiones)
Ve a la carpeta scripts:
```
bash
```
cd scripts
Dale permisos de ejecución (si no los tiene):
```
bash
```
chmod +x load_test.sh
Ejecuta el script:
```
bash
```
./load_test.sh
En la salida verás:
```
rust
```
Iniciando prueba de carga: 20 peticiones concurrentes...
 -> petición 1 enviada
 …
 -> petición 20 enviada
Prueba de carga finalizada.
Observa en los logs de los contenedores:

Cada processorX muestra varias líneas “Worker finalizó tarea para pedido pedido-#”.

En notifier, aparecen 20 bloques de “Notificación PUSH” (uno por cada pedido).

Configuración de NGINX
El archivo nginx/nginx.conf define:
```

## nginx
```
events { }

http {
  upstream processors {
    server processor1:4000;
    server processor2:4000;
    server processor3:4000;
  }

  server {
    listen 8080;

    location /process {
      proxy_pass http://processors/process;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}
NGINX escucha en el puerto 8080.

El upstream processors agrupa las tres instancias del procesador.

Todas las peticiones a /process se distribuyen round-robin entre processor1:4000, processor2:4000 y processor3:4000.

Variables de entorno
Gateway

PROCESSOR_URL (por defecto http://nginx:8080/process)

NOTIFIER_URL (por defecto http://notifier:5000/notify)

Processor

NOTIFIER_URL (por defecto http://notifier:5000/notify)

Notifier

No requiere variables adicionales; escucha en 5000.

Estas URLs se inyectan automáticamente desde docker-compose.yml.

Eliminación de advertencias
Docker Compose muestra un warning:
```
## swift
```
/home/…/docker-compose.yml: the attribute `version` is obsolete…
Esto se debe a la línea version: '3.8'. Puedes eliminarla (o comentarla) sin afectar el funcionamiento:
```
### yaml
```
version: '3.8'
services:
  …
```
Luego reinicia:

bash
```
docker compose down
docker compose up -d
Exponer la API en AWS API Gateway (opcional)
Si deseas que el endpoint sea público a través de AWS API Gateway:

Despliega el proyecto en un servidor con IP pública (VPS o EC2):

Copia el proyecto al servidor.

Asegúrate de abrir el puerto 3000 en el firewall/securi­ty group.
```
Ejecuta:

bash
```
docker compose build
docker compose up -d
```
## Crear una REST API en AWS API Gateway:

En AWS Console, crea una API REST (Regional).

Crea un recurso /facturar con método POST.

En “Integration type”, elige HTTP y pon como endpoint:

arduino
```
http://<IP_PÚBLICA>:3000/api/facturar
Haz deploy a un stage (prod).
```
Probar desde fuera:

bash
```
curl -X POST https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/facturar \
  -H "Content-Type: application/json" \
  -d '{"orderId":"pedido-aws","payload":{"amount":500}}'
```
## Licencia
## Este proyecto se entrega como parte de la asignatura de Arquitectura de Software. No incluye licencia comercial. Cualquier uso fuera de este contexto requiere permiso del autor.

