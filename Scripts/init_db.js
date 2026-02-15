
import mysqlPool from '../backend/src/config/db.mysql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSchema() {
    try {
        const sqlPath = path.join(__dirname, '../MeQuest-DB/create_users_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const connection = await mysqlPool.getConnection();
        await connection.query(sql);
        console.log("✅ Users table created successfully.");
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating users table:", error);
        process.exit(1);
    }
}

runSchema();
