# Novedades API REST

API REST profesional para la gestión de Novedades Muebles, reemplazando el sistema anterior basado en Google Sheets + Apps Script.

## 🚀 Características

- ✅ **API REST completa** con Node.js + Express
- ✅ **Base de datos PostgreSQL** para persistencia confiable
- ✅ **CORS habilitado** para integración con frontend
- ✅ **Endpoints CRUD** para crear, leer, actualizar y eliminar novedades
- ✅ **Búsqueda avanzada** por PLU, posición, fecha y estado
- ✅ **Operaciones en lote** para actualizaciones y eliminaciones
- ✅ **Estadísticas** automáticas de novedades
- ✅ **Validación de datos** con constraints de base de datos
- ✅ **Manejo de errores** robusto
- ✅ **Escalable** - listo para producción

## 📋 Requisitos Previos

### Local (Desarrollo)
- Node.js (v14 o superior)
- npm o yarn
- PostgreSQL (v12 o superior)

### Cloud (Railway)
- Cuenta en Railway (railway.app)
- Cuenta de GitHub (para conectar el repositorio)

## 🔧 Instalación Local

### 1. Clonar el repositorio

```bash
cd C:\Users\USUARIO\Desktop\novedades-api
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar PostgreSQL local

#### En Windows:

**Opción A: Usando pgAdmin4**
1. Descargar e instalar desde https://www.pgadmin.org/download/
2. Abrir pgAdmin4
3. Conectarse con el servidor PostgreSQL local
4. Crear nueva base de datos llamada `novedades_muebles`

**Opción B: Usando psql en línea de comandos**
```bash
# Conectarse a PostgreSQL
psql -U postgres

# En el prompt de PostgreSQL:
CREATE DATABASE novedades_muebles;
```

### 4. Configurar variables de entorno

Copiar `.env.example` a `.env`:
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales de PostgreSQL:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_NAME=novedades_muebles
```

### 5. Iniciar el servidor

**Modo desarrollo (con recarga automática):**
```bash
npm run dev
```

**Modo producción:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

## 📡 Endpoints de la API

### 1. Obtener todas las novedades
```http
GET /api/novedades
```

Parámetros de query opcionales:
- `estado`: Filtrar por estado (PENDIENTE, SOLUCIONADO, CANCELADO)

Ejemplo:
```bash
curl http://localhost:5000/api/novedades
curl http://localhost:5000/api/novedades?estado=PENDIENTE
```

### 2. Buscar novedades
```http
GET /api/novedades/search
```

Parámetros de query:
- `plu`: Buscar por PLU (búsqueda parcial)
- `posicion`: Buscar por posición (búsqueda parcial)
- `fecha`: Buscar por fecha exacta (YYYY-MM-DD)
- `estado`: Filtrar por estado

Ejemplo:
```bash
curl "http://localhost:5000/api/novedades/search?plu=123&estado=PENDIENTE"
```

### 3. Obtener una novedad por ID
```http
GET /api/novedades/:id
```

Ejemplo:
```bash
curl http://localhost:5000/api/novedades/1
```

### 4. Crear una novedad
```http
POST /api/novedades
Content-Type: application/json

{
  "plu": "123456",
  "posicion": "A1",
  "fecha": "2024-05-27",
  "estado": "PENDIENTE",
  "descripcion": "Producto dañado",
  "cantidad": 1
}
```

Respuesta exitosa (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "plu": "123456",
    "posicion": "A1",
    "fecha": "2024-05-27",
    "estado": "PENDIENTE",
    "descripcion": "Producto dañado",
    "cantidad": 1,
    "created_at": "2024-05-27T10:30:00Z",
    "updated_at": "2024-05-27T10:30:00Z"
  },
  "message": "Novedad created/updated successfully"
}
```

### 5. Actualizar una novedad (CRÍTICO: Soluciona el bug de revertir estado)
```http
PUT /api/novedades/:id
Content-Type: application/json

{
  "estado": "SOLUCIONADO",
  "descripcion": "Producto reparado",
  "cantidad": 1
}
```

Respuesta exitosa:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "plu": "123456",
    "posicion": "A1",
    "fecha": "2024-05-27",
    "estado": "SOLUCIONADO",
    "descripcion": "Producto reparado",
    "cantidad": 1,
    "created_at": "2024-05-27T10:30:00Z",
    "updated_at": "2024-05-27T10:40:00Z"
  },
  "message": "Novedad updated successfully"
}
```

### 6. Actualizar múltiples novedades
```http
PUT /api/novedades/bulk/update
Content-Type: application/json

{
  "updates": [
    {
      "id": 1,
      "estado": "SOLUCIONADO"
    },
    {
      "id": 2,
      "estado": "CANCELADO"
    }
  ]
}
```

### 7. Eliminar una novedad
```http
DELETE /api/novedades/:id
```

### 8. Eliminar múltiples novedades
```http
POST /api/novedades/bulk/delete
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

### 9. Obtener estadísticas
```http
GET /api/stats
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "total": "150",
    "pendientes": "45",
    "solucionados": "100",
    "cancelados": "5",
    "total_cantidad": "2500"
  }
}
```

### 10. Health Check
```http
GET /api/status
```

## 🌐 Despliegue en Railway

### 1. Crear cuenta en Railway
- Ir a https://railway.app
- Registrarse con GitHub

### 2. Crear un nuevo proyecto

a) **Opción 1: Desde GitHub (Recomendado)**
- En Railway Dashboard: "New Project"
- Seleccionar "Deploy from GitHub repo"
- Autorizar Railway para acceder a tus repos
- Seleccionar el repositorio `novedades-api`
- Railway detectará automáticamente que es un proyecto Node.js

b) **Opción 2: Desde plantilla**
- En Railway Dashboard: "New Project"
- Seleccionar "Node.js + PostgreSQL"

### 3. Configurar variables de entorno

En el proyecto de Railway:
1. Ir a "Variables"
2. Añadir las variables:

```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://miguelbusta5.github.io/novedades-muebles
```

**Las variables de base de datos se añaden automáticamente:**
- Railway crea automáticamente una base de datos PostgreSQL
- Los valores de `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` se inyectan automáticamente

### 4. Desplegar

- Railway detecta cambios en el repositorio automáticamente
- Cada push a la rama principal despliega automáticamente
- Puedes ver los logs en tiempo real en el dashboard

### 5. Obtener la URL de la API

- En Railway Dashboard, ir a tu servicio Node.js
- Ver "Deployments"
- La URL será similar a: `https://novedades-api-prod.railway.app`

## 🔄 Migración de datos desde Google Sheets

Si tienes datos en el Google Sheets anterior:

### Opción 1: Manual
1. Exportar los datos desde Google Sheets como CSV
2. Importarlos en pgAdmin4 a la tabla `novedades`

### Opción 2: Script de migración
```javascript
// Crear un script migration.js
const fs = require('fs');
const csv = require('csv-parse/sync');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Leer CSV y insertar en la base de datos
// (Ver archivo migration.js si existe)
```

## 🐛 Solución del Bug Original

**Problema:** Editar una novedad de "PENDIENTE" a "SOLUCIONADO" y guardar, pero la sincronización la revertía a "PENDIENTE".

**Causa:** El backend (Apps Script) no persistía correctamente los cambios de estado.

**Solución:** El nuevo endpoint `PUT /api/novedades/:id` realiza una actualización atómica directamente en la base de datos PostgreSQL, garantizando que:
1. El estado se actualiza permanentemente
2. No hay revertencias después de sincronizar
3. Los cambios se persisten inmediatamente
4. No hay conflictos con sincronizaciones automáticas

## 🔐 Seguridad

- ✅ Validación de entrada
- ✅ Prepared statements contra SQL injection
- ✅ CORS configurado
- ✅ Variables sensibles en .env
- ✅ Manejo seguro de errores
- ✅ Constraints de base de datos

**Próximas mejoras:**
- Autenticación con JWT
- Rate limiting
- Logging detallado
- Validación de esquema con Joi

## 📝 Notas de Desarrollo

### Estructura de la tabla novedades

```sql
CREATE TABLE novedades (
  id SERIAL PRIMARY KEY,
  plu VARCHAR(255) NOT NULL,
  posicion VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
  descripcion TEXT,
  cantidad INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plu, posicion, fecha)  -- Una novedad única por PLU+Posición+Fecha
);
```

### Estados válidos
- `PENDIENTE`: Novedad registrada, pendiente de solución
- `SOLUCIONADO`: Novedad resuelta
- `CANCELADO`: Novedad cancelada

### Indices para rendimiento
- Índice en `(plu, posicion, fecha)` para búsquedas rápidas

## 🆘 Solución de problemas

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
**Causa:** PostgreSQL no está corriendo
**Solución:** 
```bash
# En Windows, iniciar PostgreSQL
psql -U postgres

# O revisar en Services que PostgreSQL esté corriendo
```

### Error: "database novedades_muebles does not exist"
**Causa:** La base de datos no ha sido creada
**Solución:**
```bash
psql -U postgres
CREATE DATABASE novedades_muebles;
```

### Error: "Connection timeout"
**Causa:** Credenciales incorrectas o PostgreSQL no accesible
**Solución:** Verificar variables en `.env`

### Los cambios no se despliegan en Railway
**Causa:** Rama no actualizada o cambios no pusheados
**Solución:**
```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

## 📞 Contacto y soporte

Para reportar bugs o sugerir mejoras, crear un issue en el repositorio de GitHub.

---

**Última actualización:** 2024-05-27  
**Versión:** 1.0.0  
**Autor:** Novedades Muebles Dev Team
