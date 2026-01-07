import { Router, Response } from 'express';
import { pool } from '../db/connection';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 30분 단위 검증 함수
const isValid30MinSlot = (time: string): boolean => {
  const [hours, minutes] = time.split(':').map(Number);
  return minutes === 0 || minutes === 30;
};

// 시간 문자열을 분으로 변환
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// 예약 목록 조회 (날짜/회의실 필터)
router.get('/', async (req, res: Response) => {
  try {
    const { room_id, date, user_id } = req.query;
    
    let query = `
      SELECT r.id, r.room_id, r.user_id, r.reservation_date, r.start_time, r.end_time, r.created_at,
             rooms.name as room_name, users.username
      FROM reservations r
      JOIN rooms ON r.room_id = rooms.id
      JOIN users ON r.user_id = users.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (room_id) {
      query += ` AND r.room_id = $${paramIndex}`;
      params.push(room_id);
      paramIndex++;
    }

    if (date) {
      query += ` AND r.reservation_date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND r.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    query += ' ORDER BY r.reservation_date, r.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 예약 생성 (인증 필요)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, reservation_date, start_time, end_time } = req.body;
    const user_id = req.user!.id;

    // 필수 필드 검증
    if (!room_id || !reservation_date || !start_time || !end_time) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    // 30분 단위 검증
    if (!isValid30MinSlot(start_time) || !isValid30MinSlot(end_time)) {
      return res.status(400).json({ error: '시간은 30분 단위로만 선택할 수 있습니다.' });
    }

    // 시작 시간이 종료 시간보다 이전인지 확인
    const startMinutes = timeToMinutes(start_time);
    const endMinutes = timeToMinutes(end_time);

    if (startMinutes >= endMinutes) {
      return res.status(400).json({ error: '종료 시간은 시작 시간보다 이후여야 합니다.' });
    }

    // 회의실 존재 확인
    const roomCheck = await pool.query('SELECT id FROM rooms WHERE id = $1', [room_id]);
    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: '회의실을 찾을 수 없습니다.' });
    }

    // 중복 예약 확인 (시간 겹침 체크)
    const overlapCheck = await pool.query(
      `SELECT id FROM reservations 
       WHERE room_id = $1 
       AND reservation_date = $2 
       AND (
         (start_time < $4 AND end_time > $3)
       )`,
      [room_id, reservation_date, start_time, end_time]
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(409).json({ error: '해당 시간에 이미 예약이 있습니다.' });
    }

    // 예약 생성
    const result = await pool.query(
      `INSERT INTO reservations (room_id, user_id, reservation_date, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, room_id, user_id, reservation_date, start_time, end_time, created_at`,
      [room_id, user_id, reservation_date, start_time, end_time]
    );

    res.status(201).json({
      message: '예약이 완료되었습니다.',
      reservation: result.rows[0]
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 예약 취소 (본인 예약만 가능)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = req.user!.id;

    // 예약 조회
    const reservation = await pool.query(
      'SELECT id, user_id FROM reservations WHERE id = $1',
      [id]
    );

    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    }

    // 본인 예약인지 확인
    if (reservation.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: '본인의 예약만 취소할 수 있습니다.' });
    }

    // 예약 삭제
    await pool.query('DELETE FROM reservations WHERE id = $1', [id]);

    res.json({ message: '예약이 취소되었습니다.' });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 예약 목록 조회
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.user!.id;

    const result = await pool.query(
      `SELECT r.id, r.room_id, r.user_id, r.reservation_date, r.start_time, r.end_time, r.created_at,
              rooms.name as room_name
       FROM reservations r
       JOIN rooms ON r.room_id = rooms.id
       WHERE r.user_id = $1
       ORDER BY r.reservation_date DESC, r.start_time`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get my reservations error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

