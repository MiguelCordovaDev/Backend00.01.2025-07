require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASS,
  database: process.env.MYSQLBBDD,
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log("MySQL conectado correctamente");
}

// Crea tablas si no existen
async function ensureSchema() {
  // users
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      google_id VARCHAR(100) UNIQUE,
      username VARCHAR(150),
      display_name VARCHAR(200),
      email VARCHAR(200),
      avatar_url VARCHAR(500),
      provider VARCHAR(50) NOT NULL DEFAULT 'google',
      role ENUM('user','courier','admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_google_id (google_id)
    ) ENGINE=InnoDB;
  `);

  // packages
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_number VARCHAR(50) UNIQUE NOT NULL,
      sender_id INT NOT NULL,
      receiver_name VARCHAR(200) NOT NULL,
      receiver_phone VARCHAR(30),
      receiver_address TEXT NOT NULL,
      description TEXT,
      weight DECIMAL(10,2),
      status ENUM('pending','picked_up','in_transit','out_for_delivery','delivered','cancelled') DEFAULT 'pending',
      courier_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP NULL,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tracking (tracking_number),
      INDEX idx_sender (sender_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB;
  `);

  // package_locations
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS package_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_id INT NOT NULL,
      latitude DECIMAL(10,8) NULL,
      longitude DECIMAL(11,8) NULL,
      location_name VARCHAR(300),
      description TEXT,
      status VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      INDEX idx_package (package_id),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB;
  `);

  // messages
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_id INT,
      sender_id INT NOT NULL,
      receiver_id INT,
      message TEXT NOT NULL,
      type ENUM('notification','chat','system') DEFAULT 'chat',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_package (package_id),
      INDEX idx_sender (sender_id),
      INDEX idx_receiver (receiver_id)
    ) ENGINE=InnoDB;
  `);
  console.log("✅ Esquema verificado/creado");
}

const UserModel = {
  async findOrCreateFromGoogle(profile) {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE google_id = ?",
      [profile.id]
    );
    if (rows.length) return rows[0];

    const username =
      profile.emails?.[0]?.value?.split("@")[0] ||
      profile.displayName ||
      `user_${Date.now()}`;
    const [result] = await pool.execute(
      `INSERT INTO users (google_id, username, display_name, email, avatar_url, provider, role)
       VALUES (?, ?, ?, ?, ?, 'google', 'user')`,
      [
        profile.id,
        username,
        profile.displayName || username,
        profile.emails?.[0]?.value || null,
        profile.photos?.[0]?.value || null,
      ]
    );
    const [created] = await pool.execute("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);
    return created[0];
  },
  async findById(id) {
    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0] || null;
  },
};

const PackageModel = {
  // Genera tracking en Node validando unicidad
  async generateTracking() {
    let tracking;
    let tries = 0;
    while (tries < 25) {
      tracking =
        "PKG" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
      const [r] = await pool.execute(
        "SELECT COUNT(*) AS c FROM packages WHERE tracking_number = ?",
        [tracking]
      );
      if (r[0].c === 0) break;
      tries++;
    }
    return tracking;
  },
  async create(data) {
    const tracking = await this.generateTracking();
    const [res] = await pool.execute(
      `INSERT INTO packages (tracking_number, sender_id, receiver_name, receiver_phone, receiver_address, description, weight, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        tracking,
        data.sender_id,
        data.receiver_name,
        data.receiver_phone || null,
        data.receiver_address,
        data.description || null,
        data.weight || null,
      ]
    );
    return { id: res.insertId, tracking_number: tracking };
  },
  async findByTracking(tracking) {
    const [rows] = await pool.execute(
      `SELECT p.*, u.username AS sender_username, c.username AS courier_username
       FROM packages p
       LEFT JOIN users u ON p.sender_id = u.id
       LEFT JOIN users c ON p.courier_id = c.id
       WHERE p.tracking_number = ?`,
      [tracking]
    );
    return rows[0] || null;
  },
  async getByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM packages WHERE sender_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },
  async updateStatus(packageId, status, courierId = null) {
    await pool.execute(
      `UPDATE packages SET status = ?, courier_id = ?, updated_at = NOW() WHERE id = ?`,
      [status, courierId, packageId]
    );
  },
};

const LocationModel = {
  async add(packageId, data) {
    await pool.execute(
      `INSERT INTO package_locations (package_id, latitude, longitude, location_name, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        packageId,
        data.latitude ?? null,
        data.longitude ?? null,
        data.location_name || null,
        data.description || null,
        data.status || null,
      ]
    );
  },
  async getByPackage(packageId) {
    const [rows] = await pool.execute(
      `SELECT * FROM package_locations WHERE package_id = ? ORDER BY created_at DESC`,
      [packageId]
    );
    return rows;
  },
};

const MessageModel = {
  async create(data) {
    const [res] = await pool.execute(
      `INSERT INTO messages (package_id, sender_id, receiver_id, message, type)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.package_id,
        data.sender_id,
        data.receiver_id ?? null,
        data.message,
        data.type || "chat",
      ]
    );
    return res.insertId;
  },
  async getByPackage(packageId) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.username AS sender_username, u.avatar_url
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.package_id = ?
       ORDER BY m.created_at ASC`,
      [packageId]
    );
    return rows;
  },
};

module.exports = {
  pool,
  testConnection,
  ensureSchema,
  UserModel,
  PackageModel,
  LocationModel,
  MessageModel,
};
