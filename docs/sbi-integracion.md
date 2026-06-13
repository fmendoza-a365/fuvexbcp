# Integración de la API Externa de SBI - Fuvex Manager

Este documento detalla el funcionamiento, configuración y mantenimiento del módulo de integración con la API de SBI.

---

## 📋 Descripción General

El módulo de integración SBI permite la consulta y almacenamiento local de información crediticia, planilla e historial financiero consolidado provisto por la API de SBI. Los datos se consultan a través del endpoint `/datos`, y las respuestas se normalizan para mostrarse interactivamente en el panel administrativo, además de guardarse en el historial local en base de datos.

---

## ⚙️ Variables de Entorno (.env)

El servicio requiere las siguientes variables de entorno en el archivo de configuración del backend (`apps/backend/.env` localmente o `apps/backend/.env.production` en la droplet):

```env
# URL del Servidor Principal
SBI_API_BASE_URL=https://api-sbi.work

# URL de Servidores Alternativos/Legado
SBI_API_LEGACY_URL=https://api-sbi.com.mx
SBI_API_APP_URL=https://sbi-app.com

# IP pública esperada de la API
SBI_API_ALLOWED_IP=34.133.21.245

# Credenciales de Autenticación
SBI_API_USER=jarcos@a365.com.pe
SBI_API_KEY=jhgrjh65638nbgfdb53bgh65

# Configuraciones Operativas
SBI_TIMEOUT_SECONDS=30
SBI_VERIFY_SSL=true

# Modo de Autenticación Soportado
# Opciones: header_bearer, header_x_api_key, body_user_key, query_user_key
SBI_AUTH_MODE=header_bearer
```

---

## 🔒 Métodos de Autenticación

El servicio `SbiApiService` es flexible y permite alternar la estrategia de envío de credenciales modificando la variable `SBI_AUTH_MODE`:

1. **`header_bearer` (Defecto):** Envía el token a través del header estándar `Authorization: Bearer <API_KEY>`.
2. **`header_x_api_key`:** Envía la key mediante el header personalizado `x-api-key: <API_KEY>`.
3. **`body_user_key`:** Modifica el método de consulta a `POST` y adjunta el usuario y la key en formato JSON en el cuerpo (`body`) de la petición.
4. **`query_user_key`:** Adjunta las credenciales directamente en los parámetros de la URL (`?key=<KEY>&usuario=<USER>`).

---

## ⚠️ Diagnóstico del Error 202 (Usuario no autorizado)

Si el servidor responde con un código de estado `401`/`403` o el objeto de respuesta reporta el código de error `202`, la plataforma mostrará un mensaje de advertencia claro en la interfaz indicando:
> *“La API SBI respondió: Usuario no autorizado (error_id: 202). Esto puede indicar que la API Key no está activa, no tiene permisos suficientes o que la IP pública de salida de esta droplet no está autorizada por el proveedor.”*

### Pasos para resolverlo:
1. **Comprobar IP:** Copiar la IP pública mostrada en el panel de configuración (o ejecutando `curl -4 ifconfig.me` en el droplet) y verificar con el proveedor si está en su lista blanca (whitelist).
2. **Comprobar API Key:** Comprobar que la key en el archivo `.env.production` en el servidor es la correcta y no tiene espacios ni caracteres extraños.
3. **Comprobar Usuario:** Comprobar que el usuario configurado coincide exactamente con el entregado por el proveedor.

---

## 💻 Diagnóstico desde Consola (CLI)

Puedes ejecutar el diagnóstico técnico completo directamente en la consola de tu máquina local o de la droplet ejecutando:

```bash
# Local
npm run sbi:test --workspace backend

# Droplet (Dentro del contenedor backend)
docker exec -it fuvex_app_prod npm run sbi:test
```

El script imprimirá en pantalla y en logs:
- El estado de las variables (enmascarando la API Key por seguridad).
- Resolución DNS del dominio.
- Conexión de red de salida e IP pública.
- Respuesta HTTP directa y códigos de error si existieran.

---

## 📂 Logs Operativos

El sistema escribe todas las peticiones con fecha, hora, usuario de la plataforma y duración en el archivo:
`storage/logs/sbi.log` (mapeado directamente en el volumen de tu droplet en `/opt/fuvex/storage/logs/sbi.log`).

---

## 🛠 Extensión a Nuevos Endpoints

Para agregar nuevos endpoints de la API de SBI en el futuro:
1. Abre el archivo de servicio centralizado en `apps/backend/src/services/sbi.ts`.
2. Añade un nuevo método estático en la clase `SbiApiService`. Por ejemplo:
   ```typescript
   static async queryDeudasPorEntidad(userId: string | null, documento: string): Promise<SbiResponse> {
     return this.request(userId, '/deudas-entidad', { documento });
   }
   ```
3. Registra el nuevo endpoint en el enrutador en `apps/backend/src/routes/sbi.ts`.

---

## ⏱️ Sincronización Automática Futura (Job Cron)

Se ha estructurado la lógica de consulta para ser completamente automatizable mediante jobs. Para activar un cron job en el futuro:

1. Crea un script en el backend (`apps/backend/src/scripts/sbi-cron-sync.ts`) que consulte los registros pendientes y ejecute `SbiApiService.queryDatos()`:
   ```typescript
   // Ejemplo de Job de Sincronización
   async function syncJob() {
     const prospectos = await prisma.sale.findMany({ where: { estado: 'PROSPECTO_NUEVO' } });
     for (const p of prospectos) {
       await SbiApiService.queryDatos(null, p.dni_cliente, 12);
     }
   }
   ```
2. Agrégalo al planificador de tareas de Node.js o agrégalo en el crontab del sistema de la droplet:
   ```bash
   0 2 * * * docker exec fuvex_app_prod node dist/src/scripts/sbi-cron-sync.js
   ```
