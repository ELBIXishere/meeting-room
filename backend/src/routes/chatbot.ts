import { Router, Response } from 'express';
import { pool } from '../db/connection';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Groq from 'groq-sdk';

const router = Router();

// Groq 클라이언트 초기화
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 예약 생성 함수
const createReservation = async (
  userId: number,
  roomId: number,
  reservationDate: string,
  startTime: string,
  endTime: string
): Promise<{ success: boolean; message: string; reservation?: any }> => {
  try {
    // 30분 단위 검증
    const isValid30MinSlot = (time: string): boolean => {
      const [hours, minutes] = time.split(':').map(Number);
      return minutes === 0 || minutes === 30;
    };

    if (!isValid30MinSlot(startTime) || !isValid30MinSlot(endTime)) {
      return { success: false, message: '시간은 30분 단위로만 선택할 수 있습니다.' };
    }

    // 시간 비교
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return { success: false, message: '종료 시간은 시작 시간보다 이후여야 합니다.' };
    }

    // 회의실 존재 확인
    const roomCheck = await pool.query('SELECT id, name FROM rooms WHERE id = $1', [roomId]);
    if (roomCheck.rows.length === 0) {
      return { success: false, message: '회의실을 찾을 수 없습니다.' };
    }

    // 중복 예약 확인
    const overlapCheck = await pool.query(
      `SELECT id FROM reservations 
       WHERE room_id = $1 
       AND reservation_date = $2 
       AND (start_time < $4 AND end_time > $3)`,
      [roomId, reservationDate, startTime, endTime]
    );

    if (overlapCheck.rows.length > 0) {
      return { success: false, message: '해당 시간에 이미 예약이 있습니다.' };
    }

    // 예약 생성
    const result = await pool.query(
      `INSERT INTO reservations (room_id, user_id, reservation_date, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, room_id, user_id, reservation_date, start_time, end_time, created_at`,
      [roomId, userId, reservationDate, startTime, endTime]
    );

    return {
      success: true,
      message: `${roomCheck.rows[0].name} 예약이 완료되었습니다! (${reservationDate} ${startTime}~${endTime})`,
      reservation: result.rows[0]
    };
  } catch (error) {
    console.error('Create reservation error:', error);
    return { success: false, message: '예약 생성 중 오류가 발생했습니다.' };
  }
};

// 예약 취소 함수
const cancelReservation = async (
  userId: number,
  reservationId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    // 예약 조회
    const reservation = await pool.query(
      `SELECT r.id, r.user_id, r.reservation_date, r.start_time, r.end_time, rooms.name as room_name
       FROM reservations r
       JOIN rooms ON r.room_id = rooms.id
       WHERE r.id = $1`,
      [reservationId]
    );

    if (reservation.rows.length === 0) {
      return { success: false, message: '예약을 찾을 수 없습니다.' };
    }

    // 본인 예약인지 확인
    if (reservation.rows[0].user_id !== userId) {
      return { success: false, message: '본인의 예약만 취소할 수 있습니다.' };
    }

    const res = reservation.rows[0];
    
    // 예약 삭제
    await pool.query('DELETE FROM reservations WHERE id = $1', [reservationId]);

    return {
      success: true,
      message: `${res.room_name} 예약이 취소되었습니다. (${res.reservation_date} ${res.start_time.slice(0,5)}~${res.end_time.slice(0,5)})`
    };
  } catch (error) {
    console.error('Cancel reservation error:', error);
    return { success: false, message: '예약 취소 중 오류가 발생했습니다.' };
  }
};

// Function definitions for Groq
const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: '회의실 예약을 생성합니다. 사용자가 예약을 요청할 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          room_id: {
            type: 'number',
            description: '예약할 회의실 ID'
          },
          reservation_date: {
            type: 'string',
            description: '예약 날짜 (YYYY-MM-DD 형식)'
          },
          start_time: {
            type: 'string',
            description: '시작 시간 (HH:MM 형식, 30분 단위, 예: 09:00, 09:30, 10:00)'
          },
          end_time: {
            type: 'string',
            description: '종료 시간 (HH:MM 형식, 30분 단위, 예: 10:00, 10:30, 11:00)'
          }
        },
        required: ['room_id', 'reservation_date', 'start_time', 'end_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reservation',
      description: '예약을 취소합니다. 사용자가 본인의 예약을 취소하려 할 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: {
            type: 'number',
            description: '취소할 예약 ID'
          }
        },
        required: ['reservation_id']
      }
    }
  }
];

// 현재 날짜 및 이번 주 정보 가져오기
const getWeekInfo = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  // 다음 7일 날짜 생성
  const nextDays: { date: string; dayName: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    nextDays.push({
      date: d.toISOString().split('T')[0],
      dayName: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + '요일'
    });
  }
  
  return {
    today: today.toISOString().split('T')[0],
    dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek],
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
    nextDays,
  };
};

// 회의실 목록 가져오기
const getRooms = async () => {
  const result = await pool.query(
    'SELECT id, name, description, capacity FROM rooms ORDER BY capacity DESC'
  );
  return result.rows;
};

// 특정 기간의 예약 목록 가져오기
const getReservations = async (startDate: string, endDate: string) => {
  const result = await pool.query(
    `SELECT r.id, r.room_id, r.reservation_date, r.start_time, r.end_time,
            rooms.name as room_name, rooms.capacity, users.username
     FROM reservations r
     JOIN rooms ON r.room_id = rooms.id
     JOIN users ON r.user_id = users.id
     WHERE r.reservation_date BETWEEN $1 AND $2
     ORDER BY r.reservation_date, r.start_time`,
    [startDate, endDate]
  );
  return result.rows;
};

// 특정 회의실의 가용 시간 찾기
const findAvailableSlots = async (roomId: number, date: string) => {
  const reservations = await pool.query(
    `SELECT start_time, end_time FROM reservations 
     WHERE room_id = $1 AND reservation_date = $2 
     ORDER BY start_time`,
    [roomId, date]
  );

  const workingHours = { start: '09:00', end: '18:00' };
  const slots: { start: string; end: string }[] = [];
  let currentTime = workingHours.start;

  for (const res of reservations.rows) {
    const startTime = res.start_time.slice(0, 5);
    const endTime = res.end_time.slice(0, 5);
    if (currentTime < startTime) {
      slots.push({ start: currentTime, end: startTime });
    }
    currentTime = endTime;
  }

  if (currentTime < workingHours.end) {
    slots.push({ start: currentTime, end: workingHours.end });
  }

  return slots;
};

// 챗봇 API 엔드포인트
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user!.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: '메시지를 입력해주세요.' });
    }

    // API 키 확인
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: 'Groq API 키가 설정되지 않았습니다. 관리자에게 문의하세요.',
      });
    }

    const weekInfo = getWeekInfo();
    const rooms = await getRooms();
    const reservations = await getReservations(weekInfo.weekStart, weekInfo.weekEnd);
    
    // 현재 사용자의 예약 내역 가져오기
    const userReservations = await pool.query(
      `SELECT r.id, r.room_id, r.reservation_date, r.start_time, r.end_time, rooms.name as room_name
       FROM reservations r
       JOIN rooms ON r.room_id = rooms.id
       WHERE r.user_id = $1 AND r.reservation_date >= $2
       ORDER BY r.reservation_date, r.start_time`,
      [userId, weekInfo.today]
    );

    // 컨텍스트 정보 구성
    let contextInfo = `
## 현재 정보
- 오늘 날짜: ${weekInfo.today} (${weekInfo.dayOfWeek}요일)
- 이번 주: ${weekInfo.weekStart} ~ ${weekInfo.weekEnd}
- 다음 7일: ${weekInfo.nextDays.map(d => `${d.date}(${d.dayName})`).join(', ')}

## 등록된 회의실
${rooms.length > 0 
  ? rooms.map(r => `- ${r.name} (ID: ${r.id}, 수용인원: ${r.capacity}명) ${r.description || ''}`).join('\n')
  : '등록된 회의실이 없습니다.'}

## 이번 주 전체 예약 현황
${reservations.length > 0 
  ? reservations.map(r => `- ${r.reservation_date} ${r.start_time.slice(0,5)}~${r.end_time.slice(0,5)}: ${r.room_name} (예약자: ${r.username})`).join('\n')
  : '이번 주 예약이 없습니다.'}

## 현재 사용자의 예약 (취소 가능)
${userReservations.rows.length > 0 
  ? userReservations.rows.map(r => `- 예약ID: ${r.id}, ${r.reservation_date} ${r.start_time.slice(0,5)}~${r.end_time.slice(0,5)}: ${r.room_name}`).join('\n')
  : '예약 내역이 없습니다.'}
`;

    // 시스템 프롬프트
    const systemPrompt = `당신은 회의실 예약을 도와주는 친절한 AI 비서입니다.

${contextInfo}

## 역할
1. 사용자가 원하는 조건(날짜, 시간, 인원 등)에 맞는 회의실을 찾아줍니다.
2. 예약 가능 여부를 확인해줍니다.
3. 예약 현황을 안내합니다.
4. **사용자가 예약을 요청하면 create_reservation 함수를 호출해서 실제로 예약을 생성합니다.**
5. **사용자가 예약 취소를 요청하면 cancel_reservation 함수를 호출해서 예약을 취소합니다.**

## 예약 규칙
- 시간은 30분 단위로만 예약 가능합니다 (예: 09:00, 09:30, 10:00)
- 업무 시간은 09:00~18:00입니다.
- 이미 예약된 시간에는 중복 예약이 불가능합니다.

## 응답 규칙
- 항상 한국어로 친절하게 답변합니다.
- 날짜/시간 정보는 명확하게 전달합니다.
- 예약 가능한 옵션을 구체적으로 제시합니다.
- 이모지를 적절히 사용해 친근하게 답변합니다.
- 응답은 간결하게 유지합니다 (3-5문장).
- "내일", "이번 주 금요일" 같은 표현은 실제 날짜로 변환해서 안내합니다.
- 사용자가 명확히 예약 의사를 밝히면 바로 create_reservation 함수를 호출합니다.
- 예약 완료 후에는 예약 정보를 확인해줍니다.`;

    // 대화 히스토리 구성
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Groq API 호출 (llama-3.3-70b-versatile 모델 사용) - Function Calling 지원
    let completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
      tools,
      tool_choice: 'auto',
    });

    let responseMessage = completion.choices[0]?.message;
    
    // Function Call 처리
    while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolResults: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        let result: { success: boolean; message: string; reservation?: any };
        
        if (functionName === 'create_reservation') {
          result = await createReservation(
            userId,
            functionArgs.room_id,
            functionArgs.reservation_date,
            functionArgs.start_time,
            functionArgs.end_time
          );
        } else if (functionName === 'cancel_reservation') {
          result = await cancelReservation(userId, functionArgs.reservation_id);
        } else {
          result = { success: false, message: '알 수 없는 기능입니다.' };
        }
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      
      // 도구 호출 결과를 포함하여 다시 API 호출
      messages.push({
        role: 'assistant',
        content: responseMessage.content,
        tool_calls: responseMessage.tool_calls,
      });
      messages.push(...toolResults);
      
      completion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
        tools,
        tool_choice: 'auto',
      });
      
      responseMessage = completion.choices[0]?.message;
    }

    const botReply = responseMessage?.content || '죄송합니다. 응답을 생성하지 못했습니다.';

    res.json({
      success: true,
      reply: botReply,
    });
  } catch (error: any) {
    console.error('Chatbot error:', error);
    
    if (error.message?.includes('API')) {
      return res.status(500).json({
        error: 'API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    res.status(500).json({ error: '챗봇 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

// 빠른 응답용 API
router.get('/quick-info', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const weekInfo = getWeekInfo();
    const rooms = await getRooms();
    const reservations = await getReservations(weekInfo.weekStart, weekInfo.weekEnd);

    res.json({
      success: true,
      weekInfo,
      rooms,
      thisWeekReservations: reservations,
    });
  } catch (error) {
    console.error('Quick info error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
