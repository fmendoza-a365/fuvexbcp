# 🏦 Fuvex Manager A365

Plataforma integral de gestión de ventas de crédito y simulación financiera para **Banco de Crédito del Perú (BCP)**. Administra todo el pipeline de ventas de crédito — desde la captura de leads hasta el desembolso — con acceso jerárquico basado en roles, analítica en tiempo real, consulta de riesgo crediticio vía Infoburo, y un simulador de crédito BCP integrado.

---

## 📋 Tabla de Contenido

- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Variables de Entorno](#-variables-de-entorno)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Modelos de Base de Datos](#-modelos-de-base-de-datos)
- [Simulador de Crédito BCP](#-simulador-de-crédito-bcp)
- [Seguridad](#-seguridad)
- [Docker](#-docker)
- [Scripts](#-scripts)

---

## 🛠 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | Node.js 20, Express 5, TypeScript, Prisma ORM 5, SQLite |
| **Frontend Web** | React 19, Vite 8, Tailwind CSS 4, TypeScript, Recharts, React Router 7, Lucide Icons, jsPDF |
| **Mobile** | React Native 0.81, Expo SDK 54, TypeScript |
| **Infraestructura** | Docker (multi-stage Alpine), Docker Compose |
| **Seguridad** | JWT, bcrypt, Helmet, CORS, express-rate-limit |
| **Servicios Externos** | Infoburo (RCC/riesgo crediticio), RENIEC (consulta DNI), Expo Push Notifications |

---

## 📁 Estructura del Proyecto

```
fuvex-manager-a365/
├── apps/
│   ├── backend/           # API REST (Express + Prisma + SQLite)
│   │   ├── prisma/        # Schema, migraciones y seeds
│   │   └── src/
│   │       ├── routes/    # Endpoints: users, sales, simulator, rcc
│   │       ├── services/  # Lógica: simulator, hierarchy, storage
│   │       └── middleware/ # Upload, auth
│   ├── web/               # Dashboard web (React + Vite + Tailwind)
│   │   └── src/pages/     # Login, Dashboard, Simulator, UserManagement, Sales
│   ├── mobile/            # App móvil (React Native + Expo)
│   │   └── src/           # Components, utils, constants
│   └── storage/           # Servicio de almacenamiento de archivos
├── design-system/
│   ├── fuvex-bcp/         # Design system BCP
│   └── fuvex-manager/     # Design system Manager
├── Recursos/              # Assets: logos, Excel de convenios
├── scripts/               # Scripts de mantenimiento
├── docker-compose.yml
├── Dockerfile
└── package.json           # Monorepo con npm workspaces
```

---

## ⚙️ Requisitos Previos

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** y **Docker Compose** (opcional, para contenedorización)
- **Git**

---

## 🚀 Instalación

### Opción 1: Desarrollo local

```bash
# 1. Clonar el repositorio
git clone https://github.com/fmendoza-a365/fuvexbcp.git
cd fuvexbcp

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp apps/backend/.env.example apps/backend/.env
# Editar apps/backend/.env con tus valores

# 4. Ejecutar migraciones de base de datos
cd apps/backend
npx prisma migrate dev

# 5. Ejecutar seeds
npx ts-node src/seed.ts              # Datos base (admin, usuarios)
npx ts-node src/simulator_seed.ts    # Datos del simulador BCP

# 6. Iniciar el backend
npm run dev

# 7. En otra terminal, iniciar el frontend web
cd apps/web
npm run dev

# 8. (Opcional) Iniciar la app mobile
cd apps/mobile
npm start
```

### Opción 2: Con Docker

```bash
# Construir y levantar todos los servicios
docker-compose up --build

# O usar el script de inicio
# Windows:
INICIAR_SISTEMA.bat
# Linux/Mac:
./start-fuvex.sh
```

---

## 🔐 Variables de Entorno

Crear el archivo `apps/backend/.env` basado en `.env.example`:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del backend | `3001` |
| `DATABASE_URL` | URL de conexión SQLite | `file:./dev.db` |
| `JWT_SECRET` | Secret para tokens JWT (⚠️ usar uno fuerte) | `tu-secreto-super-seguro` |
| `JWT_EXPIRES_IN` | Duración del token | `24h` |
| `INFOBURO_USER` | Usuario API Infoburo | `tu-usuario` |
| `INFOBURO_PASS` | Password API Infoburo | `tu-password` |
| `INFOBURO_URL` | Endpoint Infoburo | `https://api.infoburo.com/...` |
| `CORS_ORIGIN` | Orígenes permitidos para CORS | `http://localhost:5173` |

---

## 📡 Endpoints de la API

### Autenticación — `/api/users`

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/users/login` | Iniciar sesión | ❌ |
| POST | `/api/users/register` | Registrar usuario | ✅ Admin |
| GET | `/api/users` | Listar usuarios | ✅ Admin |
| PUT | `/api/users/:id` | Actualizar usuario | ✅ Admin |
| DELETE | `/api/users/:id` | Eliminar usuario | ✅ Admin |
| GET | `/api/users/hierarchy` | Obtener jerarquía | ✅ |

### Ventas — `/api/sales`

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/sales` | Listar ventas (filtrado por rol) | ✅ |
| POST | `/api/sales` | Crear venta | ✅ |
| PUT | `/api/sales/:id` | Actualizar venta | ✅ |
| DELETE | `/api/sales/:id` | Eliminar venta | ✅ Admin |
| GET | `/api/sales/stats` | Estadísticas y analítica | ✅ |
| POST | `/api/sales/:id/documents` | Subir documentos | ✅ |

### Simulador — `/api/simulator`

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/simulator/convenios` | Listar convenios | ✅ |
| GET | `/api/simulator/cargos/:convenioId` | Cargos por convenio | ✅ |
| POST | `/api/simulator/calcular` | Calcular simulación | ✅ |
| GET | `/api/simulator/config` | Configuración global | ✅ Admin |
| POST | `/api/simulator/rules` | Crear regla convenio-cargo | ✅ Admin |
| DELETE | `/api/simulator/rules/:id` | Eliminar regla | ✅ Admin |

### RCC — `/api/rcc`

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/rcc/consultar` | Consultar RCC/Infoburo | ✅ |
| GET | `/api/rcc/historial/:dni` | Historial de consultas | ✅ |

---

## 🗄 Modelos de Base de Datos

### User
Gestión de usuarios con roles jerárquicos: `admin`, `gerente`, `supervisor`, `vendedor`.

### Venta
Registro de ventas de crédito con estados: `captado`, `en_evaluacion`, `aprobado`, `desembolsado`, `rechazado`.

### Convenio
Convenios institucionales (FFAA, Salud, Gobierno, Educación) con configuración de RCI, periodo de gracia y reserva.

### Cargo
Cargos asociados a convenios con reglas específicas de elegibilidad.

### ConvenioCargoRegla
Reglas que vinculan convenios con cargos, definiendo RCI específico y edad máxima permitida.

### ConfiguracionGlobal
Variables globales del simulador: TEA, costo de envío, tasa de desgravamen.

---

## 🧮 Simulador de Crédito BCP

El simulador permite calcular cuotas mensuales para créditos de consumo BCP basándose en:

- **20 convenios** institucionales
- **78 cargos** únicos
- **116 reglas** de convenio-cargo con RCI específicos
- **TEA:** 10.99%
- **Seguro de desgravamen:** 0.0767% mensual
- **Costo envío estado de cuenta:** S/10.00

### Parámetros de cálculo:
- Monto del crédito (S/)
- Plazo en meses
- Convenio y cargo del cliente
- Si envía estado de cuenta físico
- Periodo de gracia

### Ejecutar seed del simulador:
```bash
cd apps/backend
npx ts-node src/simulator_seed.ts
```

---

## 🔒 Seguridad

### Medidas implementadas:
- ✅ Autenticación JWT con tokens expirables
- ✅ Passwords hasheados con bcrypt
- ✅ Helmet para headers de seguridad HTTP
- ✅ CORS configurado por origen
- ✅ Rate limiting para prevenir abuso
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Validación de inputs en endpoints críticos
- ✅ Prisma ORM (previene SQL injection)

### ⚠️ Recomendaciones de seguridad:

1. **Rotar secretos:** Si el `.env` fue expuesto alguna vez, cambiar `JWT_SECRET` y credenciales de Infoburo inmediatamente
2. **No usar localStorage para tokens:** Considerar httpOnly cookies para almacenar JWT en el frontend web
3. **Eliminar datos del historial de git:** Ejecutar `git filter-repo` si el `.env` fue commiteado en el pasado
4. **Implementar HTTPS:** Nunca exponer el backend sin TLS en producción
5. **Auditoría de eliminaciones:** El endpoint `DELETE /api/sales` elimina permanentemente — considerar soft delete
6. **Validación de uploads:** Verificar tipos MIME reales, no solo extensiones de archivo

---

## 🐳 Docker

```bash
# Construir imagen
docker build -t fuvex-manager .

# Levantar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 📜 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar backend en modo desarrollo |
| `npm run build` | Compilar TypeScript |
| `npm run start` | Iniciar backend en producción |
| `npx prisma migrate dev` | Ejecutar migraciones |
| `npx prisma studio` | Abrir Prisma Studio (GUI de BD) |
| `npx ts-node src/seed.ts` | Seed de datos base |
| `npx ts-node src/simulator_seed.ts` | Seed del simulador BCP |

---

## 📄 Licencia

Proyecto privado — Banco de Crédito del Perú (BCP).

---

*Desarrollado por A365 — 2026*