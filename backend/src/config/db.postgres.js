// src/config/db.postgres.js
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;


export const pgPool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_NAME,
  port: Number(process.env.PG_PORT),
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