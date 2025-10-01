import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const mysqlConn = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ (db.mysql.js)MySQL database connected successfully!');
        connection.release();
    } catch (error) {
        console.error('❌ (db.mysql.js)MySQL connection failed:', error.message);
    }
}

// testConnection();

// 선택: default도 함께 제공 (어디서든 임포트 호환)
export default mysqlConn;