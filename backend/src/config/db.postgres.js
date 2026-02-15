// src/config/db.postgres.js
import pkg from "pg";
import { config } from "./index.js";

const { Pool } = pkg;

export const pgPool = new Pool({
  host: config.postgres.host,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  port: config.postgres.port,
});


// 연결 테스트
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ (db.postgres.js)PostgreSQL database connected successfully!');
    client.release(); // 연결 해제
  } catch (error) {
    console.error('❌ (db.postgres.js)PostgreSQL connection failed:', error.message);
  }
}

// testConnection();

export default pgPool;