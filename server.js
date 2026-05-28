const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// Middleware
// =====================================================
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// =====================================================
// Database Configuration
// Railway provides DATABASE_URL automatically when PostgreSQL is added
// =====================================================
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// =====================================================
// Database Initialization
// =====================================================
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS novedades (
        id SERIAL PRIMARY KEY,
        plu VARCHAR(255) NOT NULL,
        posicion VARCHAR(255) NOT NULL,
        fecha DATE NOT NULL,
        estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
        descripcion TEXT,
        cantidad INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(plu, posicion, fecha)
      );
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plu_posicion_fecha
      ON novedades(plu, posicion, fecha);
    `);

    // ── Tabla transporte_guardados ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS transporte_guardados (
        id           SERIAL PRIMARY KEY,
        client_id    VARCHAR(100) NOT NULL UNIQUE,
        fecha        DATE NOT NULL,
        documento    VARCHAR(255) NOT NULL,
        ubicacion    TEXT NOT NULL,
        estado       VARCHAR(60) NOT NULL DEFAULT 'PENDIENTE DESPACHO',
        fecha_despacho DATE,
        nota         TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transporte_client_id
      ON transporte_guardados(client_id);
    `);

    // ── Tabla tombstone: client_ids borrados permanentemente ──
    // Evita que cualquier dispositivo (incluso con código viejo) re-cree un registro borrado
    await client.query(`
      CREATE TABLE IF NOT EXISTS transporte_deleted (
        client_id  VARCHAR(100) PRIMARY KEY,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    client.release();
  }
}

// =====================================================
// API Routes
// =====================================================

/**
 * GET /api/novedades
 * Get all novedades, optionally filtered by estado
 */
app.get('/api/novedades', async (req, res) => {
  try {
    const { estado } = req.query;
    let query = 'SELECT * FROM novedades ORDER BY fecha DESC, created_at DESC';
    const params = [];

    if (estado) {
      query = 'SELECT * FROM novedades WHERE estado = $1 ORDER BY fecha DESC, created_at DESC';
      params.push(estado);
    }

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching novedades:', err);
    res.status(500).json({
      success: false,
      error: 'Error fetching novedades',
      message: err.message,
    });
  }
});

/**
 * GET /api/novedades/search
 * Search novedades by multiple criteria
 */
app.get('/api/novedades/search', async (req, res) => {
  try {
    const { plu, posicion, fecha, estado } = req.query;
    let query = 'SELECT * FROM novedades WHERE 1=1';
    const params = [];

    if (plu) {
      query += ` AND plu ILIKE $${params.length + 1}`;
      params.push(`%${plu}%`);
    }
    if (posicion) {
      query += ` AND posicion ILIKE $${params.length + 1}`;
      params.push(`%${posicion}%`);
    }
    if (fecha) {
      query += ` AND fecha = $${params.length + 1}`;
      params.push(fecha);
    }
    if (estado) {
      query += ` AND estado = $${params.length + 1}`;
      params.push(estado);
    }

    query += ' ORDER BY fecha DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error searching novedades:', err);
    res.status(500).json({
      success: false,
      error: 'Error searching novedades',
      message: err.message,
    });
  }
});

/**
 * GET /api/novedades/:id
 * Get a single novedad by ID
 */
app.get('/api/novedades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM novedades WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Novedad not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching novedad:', err);
    res.status(500).json({
      success: false,
      error: 'Error fetching novedad',
      message: err.message,
    });
  }
});

/**
 * POST /api/novedades
 * Create a new novedad
 */
app.post('/api/novedades', async (req, res) => {
  try {
    const { plu, posicion, fecha, estado = 'PENDIENTE', descripcion, cantidad } = req.body;

    // Validate required fields
    if (!plu || !posicion || !fecha) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plu, posicion, fecha',
      });
    }

    // Try to insert, on conflict update (upsert)
    const result = await pool.query(
      `INSERT INTO novedades (plu, posicion, fecha, estado, descripcion, cantidad, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (plu, posicion, fecha)
       DO UPDATE SET
         estado = EXCLUDED.estado,
         descripcion = EXCLUDED.descripcion,
         cantidad = EXCLUDED.cantidad,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [plu, posicion, fecha, estado, descripcion, cantidad]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Novedad created/updated successfully',
    });
  } catch (err) {
    console.error('Error creating novedad:', err);
    res.status(500).json({
      success: false,
      error: 'Error creating novedad',
      message: err.message,
    });
  }
});

/**
 * PUT /api/novedades/:id
 * Update a novedad by ID
 * CRITICAL: This endpoint handles the status update fix
 */
app.put('/api/novedades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, descripcion, cantidad } = req.body;

    // Validate that at least one field is being updated
    if (!estado && !descripcion && cantidad === undefined) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update provided',
      });
    }

    // Get current record to merge updates
    const currentResult = await pool.query('SELECT * FROM novedades WHERE id = $1', [id]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Novedad not found',
      });
    }

    const current = currentResult.rows[0];
    const newEstado = estado !== undefined ? estado : current.estado;
    const newDescripcion = descripcion !== undefined ? descripcion : current.descripcion;
    const newCantidad = cantidad !== undefined ? cantidad : current.cantidad;

    // Update the record
    const result = await pool.query(
      `UPDATE novedades
       SET estado = $1, descripcion = $2, cantidad = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [newEstado, newDescripcion, newCantidad, id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Novedad updated successfully',
    });
  } catch (err) {
    console.error('Error updating novedad:', err);
    res.status(500).json({
      success: false,
      error: 'Error updating novedad',
      message: err.message,
    });
  }
});

/**
 * PUT /api/novedades/bulk/update
 * Bulk update multiple novedades
 */
app.put('/api/novedades/bulk/update', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, estado, descripcion, cantidad }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'updates must be a non-empty array',
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { id, estado, descripcion, cantidad } = update;

        const currentResult = await pool.query('SELECT * FROM novedades WHERE id = $1', [id]);
        if (currentResult.rows.length === 0) {
          errors.push({ id, error: 'Not found' });
          continue;
        }

        const current = currentResult.rows[0];
        const newEstado = estado !== undefined ? estado : current.estado;
        const newDescripcion = descripcion !== undefined ? descripcion : current.descripcion;
        const newCantidad = cantidad !== undefined ? cantidad : current.cantidad;

        const result = await pool.query(
          `UPDATE novedades
           SET estado = $1, descripcion = $2, cantidad = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING *`,
          [newEstado, newDescripcion, newCantidad, id]
        );

        results.push(result.rows[0]);
      } catch (err) {
        errors.push({ id: update.id, error: err.message });
      }
    }

    res.json({
      success: true,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${results.length} novedades${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
    });
  } catch (err) {
    console.error('Error bulk updating novedades:', err);
    res.status(500).json({
      success: false,
      error: 'Error bulk updating novedades',
      message: err.message,
    });
  }
});

/**
 * DELETE /api/novedades/:id
 * Delete a novedad by ID
 */
app.delete('/api/novedades/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM novedades WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Novedad not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Novedad deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting novedad:', err);
    res.status(500).json({
      success: false,
      error: 'Error deleting novedad',
      message: err.message,
    });
  }
});

/**
 * POST /api/novedades/bulk/delete
 * Delete multiple novedades by IDs
 */
app.post('/api/novedades/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids must be a non-empty array',
      });
    }

    // Create placeholders for parameterized query
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `DELETE FROM novedades WHERE id IN (${placeholders}) RETURNING *`,
      ids
    );

    res.json({
      success: true,
      data: result.rows,
      deleted: result.rows.length,
      message: `Deleted ${result.rows.length} novedades`,
    });
  } catch (err) {
    console.error('Error bulk deleting novedades:', err);
    res.status(500).json({
      success: false,
      error: 'Error bulk deleting novedades',
      message: err.message,
    });
  }
});

// =====================================================
// Transporte Guardados Routes
// =====================================================

/**
 * GET /api/transporte
 * Retorna todos los guardados ordenados por fecha desc
 */
app.get('/api/transporte', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transporte_guardados ORDER BY fecha DESC, created_at DESC'
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching transporte:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/transporte
 * Upsert por client_id — crea o actualiza el registro
 */
app.post('/api/transporte', async (req, res) => {
  try {
    const { client_id, fecha, documento, ubicacion, estado, fecha_despacho, nota } = req.body;

    if (!client_id || !fecha || !documento || !ubicacion) {
      return res.status(400).json({ success: false, error: 'Faltan campos: client_id, fecha, documento, ubicacion' });
    }

    // Si el registro fue borrado, no permitir re-insertarlo (protección anti ping-pong)
    const tomb = await pool.query(
      'SELECT 1 FROM transporte_deleted WHERE client_id = $1',
      [client_id]
    );
    if (tomb.rows.length > 0) {
      return res.status(200).json({ success: true, skipped: true, message: 'Registro borrado — no se re-inserta' });
    }

    const result = await pool.query(
      `INSERT INTO transporte_guardados
         (client_id, fecha, documento, ubicacion, estado, fecha_despacho, nota, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (client_id) DO UPDATE SET
         fecha          = EXCLUDED.fecha,
         documento      = EXCLUDED.documento,
         ubicacion      = EXCLUDED.ubicacion,
         estado         = EXCLUDED.estado,
         fecha_despacho = EXCLUDED.fecha_despacho,
         nota           = EXCLUDED.nota,
         updated_at     = CURRENT_TIMESTAMP
       RETURNING *`,
      [client_id, fecha, documento, ubicacion,
       estado || 'PENDIENTE DESPACHO',
       fecha_despacho || null,
       nota || '']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error upserting transporte:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/transporte/bulk
 * Upsert masivo — recibe array de guardados
 */
app.post('/api/transporte/bulk', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'records debe ser un array no vacío' });
    }

    // Cargar tombstones para saltar registros borrados
    const tombRes = await pool.query('SELECT client_id FROM transporte_deleted');
    const deletedSet = new Set(tombRes.rows.map(t => t.client_id));

    const results = [];
    for (const r of records) {
      const { client_id, fecha, documento, ubicacion, estado, fecha_despacho, nota } = r;
      if (!client_id || !fecha || !documento || !ubicacion) continue;
      if (deletedSet.has(client_id)) continue; // no re-insertar registros borrados

      const row = await pool.query(
        `INSERT INTO transporte_guardados
           (client_id, fecha, documento, ubicacion, estado, fecha_despacho, nota, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (client_id) DO UPDATE SET
           fecha          = EXCLUDED.fecha,
           documento      = EXCLUDED.documento,
           ubicacion      = EXCLUDED.ubicacion,
           estado         = EXCLUDED.estado,
           fecha_despacho = EXCLUDED.fecha_despacho,
           nota           = EXCLUDED.nota,
           updated_at     = CURRENT_TIMESTAMP
         RETURNING *`,
        [client_id, fecha, documento, ubicacion,
         estado || 'PENDIENTE DESPACHO',
         fecha_despacho || null,
         nota || '']
      );
      results.push(row.rows[0]);
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    console.error('Error bulk upserting transporte:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/transporte/:clientId
 * Elimina un guardado por su client_id
 */
app.delete('/api/transporte/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      'DELETE FROM transporte_guardados WHERE client_id = $1 RETURNING *',
      [clientId]
    );

    // Registrar el tombstone SIEMPRE (aunque el registro no exista aún),
    // para bloquear re-inserciones por race conditions o dispositivos con código viejo
    await pool.query(
      `INSERT INTO transporte_deleted (client_id)
       VALUES ($1)
       ON CONFLICT (client_id) DO NOTHING`,
      [clientId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: result.rows.length > 0 ? 'Guardado eliminado' : 'Guardado marcado como eliminado'
    });
  } catch (err) {
    console.error('Error deleting transporte:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/status
 * Health check endpoint
 */
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Novedades API is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/stats
 * Get statistics about novedades
 */
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'SOLUCIONADO' THEN 1 ELSE 0 END) as solucionados,
        SUM(CASE WHEN estado = 'CANCELADO' THEN 1 ELSE 0 END) as cancelados,
        SUM(cantidad) as total_cantidad
      FROM novedades
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      error: 'Error fetching stats',
      message: err.message,
    });
  }
});

// =====================================================
// Error Handling
// =====================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

// =====================================================
// Server Startup
// =====================================================
async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`
================================
Novedades API Server Running
================================
Environment: ${process.env.NODE_ENV || 'development'}
Port: ${PORT}
Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}
================================
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});

start();
