// controllers/problem.controller.js
import mysqlPool from '../config/db.mysql.js';

// 문제 등록
export async function createProblem(req, res) {
  try {
    const { user_id, topic, question_text, answer_text, level } = req.body;

    if (!topic || !question_text || !answer_text) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    // DB 저장
    const [result] = await mysqlPool.query(
      'INSERT INTO problems (user_id, topic, question_text, answer_text, level) VALUES (?, ?, ?, ?, ?)',
      [user_id || null, topic, question_text, answer_text, level || 1]
    );

    res.status(201).json({
      id: result.insertId,
      message: '문제가 성공적으로 저장되었습니다.'
    });
  } catch (err) {
    console.error('❌ Problem insert error:', err.message);
    res.status(500).json({ error: 'DB Insert Failed', details: err.message });
  }
}

// 문제 목록 조회
export async function getProblems(req, res) {
  try {
    const [rows] = await mysqlPool.query(
      'SELECT id, topic, question_text, answer_text, level, created_at FROM problems ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Problem fetch error:', err.message);
    res.status(500).json({ error: 'DB Fetch Failed', details: err.message });
  }
}
