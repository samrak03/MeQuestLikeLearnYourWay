
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mysqlConn } from '../config/db.mysql.js';
import { config } from '../config/index.js';

const SECRET_KEY = config.jwtSecret;

export const register = async (req, res) => {
    try {
        const { email, password, nickname } = req.body;
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
        }

        // 이메일 중복 확인
        const [existing] = await mysqlConn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: '이미 존재하는 이메일입니다.' });
        }

        // 비밀번호 해시
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성
        const [result] = await mysqlConn.query(
            'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)',
            [email, hashedPassword, nickname]
        );

        res.status(201).json({ message: '회원가입 성공', userId: result.insertId });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
        }

        // 사용자 조회
        const [users] = await mysqlConn.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }

        const user = users[0];

        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }

        // 토큰 발급
        const token = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            message: '로그인 성공',
            token,
            user: { id: user.id, email: user.email, nickname: user.nickname }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};
