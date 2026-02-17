// Scripts/reset_password.js
// 사용법: node reset_password.js <email> <new_password>
// 주의: backend 폴더의 .env 설정을 사용하기 위해 backend 폴더 루트에서 실행하거나 경로를 맞춰주세요.
// 예: cd backend && node ../Scripts/reset_password.js test@example.com new1234

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 로드 (backend/.env를 찾도록 노력함)
// 스크립트 위치: ROOT/Scripts/reset_password.js
// 타겟 .env 위치: ROOT/backend/.env
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_NAME || 'mequest',
};

async function resetPassword() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('❌ 사용법: node reset_password.js <이메일> <새비밀번호>');
        process.exit(1);
    }

    const [email, newPassword] = args;

    console.log(`🔌 DB 연결 시도: ${dbConfig.host} / ${dbConfig.database} ...`);
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ DB 연결 성공');

        // 1. 사용자 확인
        const [users] = await connection.execute('SELECT id, email FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.error(`❌ 사용자 찾기 실패: ${email} 에 해당하는 사용자가 없습니다.`);
            process.exit(1);
        }

        const user = users[0];
        console.log(`🔍 사용자 확인: ID=${user.id}, Email=${user.email}`);

        // 2. 비밀번호 해싱
        console.log('🔑 비밀번호 해싱 중...');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. 업데이트
        await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);
        console.log(`✨ 비밀번호가 성공적으로 변경되었습니다!`);
        console.log(`👉 이제 로그인 페이지에서 새 비밀번호로 로그인하세요.`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        if (connection) await connection.end();
    }
}

resetPassword();
