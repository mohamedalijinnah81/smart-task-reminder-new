// scripts/migrate.js
// Run with: node scripts/migrate.js
// This creates all tables from scratch.

const mysql = require("mysql2/promise");
require("dotenv").config({ path: ".env.local" });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  console.log("Running migrations...");

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title         VARCHAR(255) NOT NULL,
      description   TEXT,
      due_date      DATE NOT NULL,
      priority      TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT '1-10 scale',
      status        ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
      user_email    VARCHAR(255) NOT NULL COMMENT 'Who to remind',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      task_id     INT UNSIGNED NOT NULL,
      sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type        ENUM('before_due','on_due','overdue') NOT NULL,
      INDEX idx_task_id (task_id),
      CONSTRAINT fk_reminder_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      setting_key   VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed default settings
  await connection.execute(`
    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('default_user_email', ''),
      ('smtp_host', ''),
      ('smtp_port', '587'),
      ('smtp_user', ''),
      ('smtp_pass', ''),
      ('smtp_from_name', 'Task Reminder'),
      ('reminder_days_before', '2');
  `);

  console.log("✅ Migration complete.");
  await connection.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});