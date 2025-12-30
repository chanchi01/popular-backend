const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// ================== DATABASE ==================
const dbPath = path.join(__dirname, "database.db");
console.log("USANDO BASE:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error abriendo la base:", err.message);
  } else {
    console.log("Base de datos abierta correctamente");
  }
});

// ================== TABLAS ==================
db.serialize(() => {
  // MENU
  db.run(`
    CREATE TABLE IF NOT EXISTS menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      precio INTEGER,
      categoria TEXT
    )
  `);

  // PEDIDOS
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_mesa INTEGER,
      ubicacion TEXT,
      personas INTEGER,
      estado TEXT DEFAULT 'pendiente',
      fecha TEXT DEFAULT (datetime('now','localtime')),
      items TEXT
    )
  `);
});

// ================== ENDPOINTS ==================



// ---- MENU (Barra) ----
app.get("/menu", (req, res) => {
  db.all("SELECT * FROM menu", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put("/menu/:id/desactivar", (req, res) => {
  db.run(
    "UPDATE menu SET activo = 0 WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

// ✏️ ACTUALIZAR PRODUCTO (stock / activo)
app.put("/menu/:id", (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, stock, activo } = req.body;

  db.run(
    `
    UPDATE menu
    SET nombre = ?, categoria = ?, stock = ?, activo = ?
    WHERE id = ?
    `,
    [nombre, categoria, stock, activo, id],
    function (err) {
      if (err) {
        console.error("❌ ERROR UPDATE MENU:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    }
  );
});

app.put("/menu/:id", (req, res) => {
  const { nombre, categoria, stock, activo } = req.body;

  db.run(
    `
    UPDATE menu
    SET
      nombre = ?,
      categoria = ?,
      stock = ?,
      activo = ?
    WHERE id = ?
    `,
    [nombre, categoria, stock, activo, req.params.id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    }
  );
});

// 🧹 BORRAR PEDIDOS CERRADOS DEL DÍA
app.delete("/admin/limpiar-cerrados", (req, res) => {
  db.run(
    `
    DELETE FROM pedidos
    WHERE estado = 'cerrado'
    `,
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true, eliminados: this.changes });
    }
  );
});


// ---- CREAR PEDIDO (Barra) ----
app.post("/pedidos", (req, res) => {
  try {
    const {
      tipo,
      numero_mesa,
      ubicacion,
      personas,
      cliente,
      telefono,
      direccion,
      numero_pedido,
      hora_envio,
      items,
      nota
    } = req.body;

    // 📦 Parsear items
    let parsedItems = [];
    if (Array.isArray(items)) {
      parsedItems = items;
    } else if (typeof items === "string") {
      parsedItems = JSON.parse(items);
    } else {
      return res.status(400).json({ error: "Items inválidos" });
    }

    db.serialize(() => {
      // 🔒 Verificar stock (UNO POR UNO)
      for (const item of parsedItems) {
        db.get(
          "SELECT stock FROM menu WHERE id = ?",
          [item.id],
          (err, row) => {
            if (err || !row || row.stock < item.cantidad) {
              return res
                .status(400)
                .json({ error: `Stock insuficiente para ${item.nombre}` });
            }
          }
        );
      }

      // 👉 DELIVERY: TOMAR PEDIDO (POST)
app.post("/pedidos/:id/en-camino", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'en_camino' WHERE id = ?",
    [req.params.id],
    function () {
      res.json({ ok: true });
    }
  );
});

// 👉 DELIVERY: ENTREGADO (POST)
app.post("/pedidos/:id/entregado", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'entregado' WHERE id = ?",
    [req.params.id],
    function () {
      res.json({ ok: true });
    }
  );
});

      // 🔻 Descontar stock
      for (const item of parsedItems) {
        db.run(
          "UPDATE menu SET stock = stock - ? WHERE id = ?",
          [item.cantidad, item.id]
        );
      }

      // 📝 Insertar pedido
      db.run(
        `
        INSERT INTO pedidos (
          tipo,
          numero_mesa,
          ubicacion,
          personas,
          items,
          cliente,
          telefono,
          direccion,
          hora_envio,
          numero_pedido,
          nota,
          estado
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          tipo,
          numero_mesa,
          ubicacion,
          personas,
          JSON.stringify(parsedItems),
          cliente,
          telefono,
          direccion,
          hora_envio,
          numero_pedido,
          nota,
          "pendiente"
        ],
        function (err) {
          if (err) {
            console.error("❌ ERROR INSERT PEDIDO:", err.message);
            return res.status(500).json({ error: err.message });
          }

          res.json({ ok: true, id: this.lastID });
        }
      );
    });
  } catch (e) {
    console.error("❌ ERROR GENERAL:", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/menu", (req, res) => {
  const { nombre, categoria, stock } = req.body;

  db.run(
    `
    INSERT INTO menu (nombre, categoria, stock, activo)
    VALUES (?, ?, ?, 1)
    `,
    [nombre, categoria, stock],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
});


// ---- PEDIDOS PARA COCINA ----
app.get("/pedidos/cocina", (req, res) => {
  db.all(
    `
    SELECT * FROM pedidos
    WHERE estado IN ('pendiente', 'cocina_lista')
    ORDER BY fecha ASC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ---- PEDIDOS PARA MOZOS ----
app.get("/pedidos/mozos", (req, res) => {
  db.all(
    `
    SELECT * FROM pedidos
    WHERE estado IN ('pendiente', 'cocina_lista')
    ORDER BY fecha ASC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 👉 PEDIDOS DELIVERY
app.get("/pedidos/delivery", (req, res) => {
  db.all(
    `
    SELECT *
    FROM pedidos
    WHERE tipo = 'delivery'
      AND estado IN ('pendiente', 'en_camino')
    ORDER BY fecha ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// 👉 TOMAR DELIVERY
app.put("/pedidos/:id/en-camino", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'en_camino' WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

// 👉 MARCAR ENTREGADO
app.put("/pedidos/:id/entregado", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'entregado' WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

// 👉 Actualizar stock de un producto (Cocina)
app.put("/menu/:id/stock", (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;

  db.run(
    "UPDATE menu SET stock = ? WHERE id = ?",
    [stock, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    }
  );
});

// 👉 Activar / desactivar producto
app.put("/menu/:id/activo", (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  db.run(
    "UPDATE menu SET activo = ? WHERE id = ?",
    [activo, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    }
  );
});

// ---- HISTORIAL (Dueños) ----
app.get("/historial", (req, res) => {
  db.all(
    `
    SELECT * FROM pedidos
    WHERE estado = 'cerrado'
    ORDER BY fecha DESC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 👉 RESET TOTAL DEL SISTEMA (ADMIN)
app.delete("/admin/reset-sistema", (req, res) => {
  db.serialize(() => {
    db.run("DELETE FROM pedidos", (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.run("DELETE FROM menu", (err2) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }

        res.json({ ok: true });
      });
    });
  });
});

// ---- CAMBIOS DE ESTADO ----
app.put("/pedidos/:id/cocina", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'cocina_lista' WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

app.put("/pedidos/:id/mesa", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'mesa_armada' WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

app.put("/pedidos/:id/cerrar", (req, res) => {
  db.run(
    "UPDATE pedidos SET estado = 'cerrado' WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});


// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log("Backend corriendo en puerto", PORT);
});