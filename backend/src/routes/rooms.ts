import { Router, Response } from 'express';
import { pool } from '../db/connection';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 회의실 목록 조회
router.get('/', async (req, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, capacity, created_at FROM rooms ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회의실 상세 조회
router.get('/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, description, capacity, created_at FROM rooms WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '회의실을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회의실 등록 (인증 필요)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, capacity } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '회의실 이름을 입력해주세요.' });
    }

    const result = await pool.query(
      'INSERT INTO rooms (name, description, capacity) VALUES ($1, $2, $3) RETURNING id, name, description, capacity, created_at',
      [name.trim(), description || '', capacity || 10]
    );

    res.status(201).json({
      message: '회의실이 등록되었습니다.',
      room: result.rows[0]
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회의실 수정 (인증 필요)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, capacity } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '회의실 이름을 입력해주세요.' });
    }

    const result = await pool.query(
      'UPDATE rooms SET name = $1, description = $2, capacity = $3 WHERE id = $4 RETURNING id, name, description, capacity, created_at',
      [name.trim(), description || '', capacity || 10, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '회의실을 찾을 수 없습니다.' });
    }

    res.json({
      message: '회의실이 수정되었습니다.',
      room: result.rows[0]
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회의실 삭제 (인증 필요)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM rooms WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '회의실을 찾을 수 없습니다.' });
    }

    res.json({ message: '회의실이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

