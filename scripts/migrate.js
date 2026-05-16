// scripts/migrate.js
require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");

async function migrate() {
  console.log("DB_HOST:", process.env.DB_HOST);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  console.log("Connected. Running migrations...");

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      due_date    DATE NOT NULL,
      due_time    TIME DEFAULT NULL,
      priority    TINYINT UNSIGNED NOT NULL DEFAULT 5,
      status      ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
      label       VARCHAR(100) DEFAULT NULL,
      user_email  VARCHAR(255) NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Safe column additions for existing installs
  const safeAdd = async (table, col, definition) => {
    try {
      await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition};`);
      console.log(`Added column: ${table}.${col}`);
    } catch {
      console.log(`Column ${table}.${col} already exists — skipping.`);
    }
  };

  await safeAdd("tasks", "label",    "VARCHAR(100) DEFAULT NULL AFTER status");
  await safeAdd("tasks", "due_time", "TIME DEFAULT NULL AFTER due_date");

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      task_id   INT UNSIGNED NOT NULL,
      sent_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type      ENUM('before_due','on_due','overdue') NOT NULL,
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

  // NEW: parse_logs — records every AI parse call for debugging
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS parse_logs (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_input    TEXT NOT NULL          COMMENT 'Raw text the user typed or dictated',
      llm_raw       TEXT                   COMMENT 'Exact JSON string returned by the LLM',
      final_tasks   TEXT                   COMMENT 'Final normalised tasks array saved to DB (JSON)',
      error         VARCHAR(500) DEFAULT NULL COMMENT 'Error message if parsing failed',
      model         VARCHAR(100) DEFAULT NULL,
      duration_ms   INT UNSIGNED DEFAULT NULL COMMENT 'Time taken for the LLM call in ms',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.execute(`
    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('default_user_email',   ''),
      ('smtp_host',            ''),
      ('smtp_port',            '587'),
      ('smtp_user',            ''),
      ('smtp_pass',            ''),
      ('smtp_from_name',       'TaskChaser'),
      ('reminder_days_before', '2'),
      ('reminder_time',        '09:00');
  `);

  console.log("✅ Migration complete.");
  await connection.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});