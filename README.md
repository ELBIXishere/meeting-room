# 회의실 예약 시스템

Vue3 + Express + PostgreSQL 기반의 회의실 예약 시스템입니다.

## 기능

- 회원가입/로그인 (JWT 인증)
- 회의실 등록/수정/삭제 (수용 인원 설정)
- 30분 단위 타임슬롯 예약
- 블록 테이블 형태의 예약 현황 조회
- 다크모드/라이트모드 지원
- 내 예약 조회 및 취소
- **🤖 AI 챗봇 예약 비서** (OpenAI GPT 기반)
  - 자연어로 회의실 검색 ("이번 주에 20명 회의실 알려줘")
  - 대화형 예약 진행
  - 예약 현황 조회

## 기술 스택

- **Frontend**: Vue3, Vite, Pinia, Vue Router
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Infrastructure**: Docker, docker-compose

## 환경 설정

### 1. 환경 변수 파일 생성

```bash
# 루트 디렉토리
cp .env.example .env

# 백엔드 (로컬 개발 시)
cp backend/.env.example backend/.env

# 프론트엔드 (로컬 개발 시)
cp frontend/.env.example frontend/.env
```

### 2. 환경 변수 설명

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `POSTGRES_USER` | PostgreSQL 사용자 | meetingroom |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 | (설정 필요) |
| `POSTGRES_DB` | PostgreSQL 데이터베이스명 | meetingroom |
| `POSTGRES_PORT` | PostgreSQL 외부 포트 | 15432 |
| `BACKEND_PORT` | 백엔드 서버 포트 | 3001 |
| `JWT_SECRET` | JWT 시크릿 키 (32자 이상 권장) | (설정 필요) |
| `JWT_EXPIRES_IN` | JWT 만료 시간 | 7d |
| `FRONTEND_PORT` | 프론트엔드 서버 포트 | 5173 |
| `VITE_API_URL` | 백엔드 API URL | http://localhost:3001 |
| `OPENAI_API_KEY` | OpenAI API 키 (챗봇 기능) | (설정 필요) |

## 빠른 시작

### Docker로 실행 (권장)

```bash
# 환경 변수 파일 생성
cp .env.example .env

# 전체 스택 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up -d --build
```

실행 후:
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3001
- PostgreSQL: localhost:15432

### 로컬 개발 환경

#### 1. PostgreSQL만 Docker로 실행

```bash
docker-compose up postgres -d
```

#### 2. 백엔드 실행

```bash
cd backend
cp .env.example .env  # 환경 변수 설정
npm install
npm run dev
```

#### 3. 프론트엔드 실행

```bash
cd frontend
cp .env.example .env  # 환경 변수 설정
npm install
npm run dev
```

## API 엔드포인트

### 인증

- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

### 회의실

- `GET /api/rooms` - 회의실 목록
- `GET /api/rooms/:id` - 회의실 상세
- `POST /api/rooms` - 회의실 등록 (인증 필요)
- `PUT /api/rooms/:id` - 회의실 수정 (인증 필요)
- `DELETE /api/rooms/:id` - 회의실 삭제 (인증 필요)

### 예약

- `GET /api/reservations` - 예약 목록 (room_id, date, user_id 필터)
- `POST /api/reservations` - 예약 생성 (인증 필요)
- `DELETE /api/reservations/:id` - 예약 취소 (인증 필요, 본인 예약만)

### AI 챗봇

- `POST /api/chatbot` - 챗봇 메시지 전송 (인증 필요)
- `GET /api/chatbot/quick-info` - 빠른 정보 조회 (인증 필요)

## 프로젝트 구조

```
meetingroom/
├── .env                    # 환경 변수 (gitignore)
├── .env.example            # 환경 변수 템플릿
├── docker-compose.yml
├── frontend/
│   ├── .env                # 프론트엔드 환경 변수
│   ├── .env.example
│   ├── Dockerfile
│   ├── src/
│   │   ├── views/          # 페이지 컴포넌트
│   │   ├── components/     # 재사용 컴포넌트
│   │   ├── stores/         # Pinia 스토어
│   │   ├── router/         # Vue Router
│   │   └── api/            # API 클라이언트
│   └── package.json
├── backend/
│   ├── .env                # 백엔드 환경 변수
│   ├── .env.example
│   ├── Dockerfile
│   ├── src/
│   │   ├── routes/         # API 라우트
│   │   ├── middleware/     # 인증 미들웨어
│   │   └── db/             # DB 연결 및 스키마
│   └── package.json
└── README.md
```

## Docker 명령어

```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 로그 확인
docker-compose logs -f

# 특정 서비스 재시작
docker-compose restart frontend
docker-compose restart backend

# 볼륨 포함 완전 삭제
docker-compose down -v
```

## AI 챗봇 설정

AI 챗봇 기능을 사용하려면 OpenAI API 키가 필요합니다.

1. [OpenAI Platform](https://platform.openai.com)에서 API 키 발급
2. 백엔드 `.env` 파일에 추가:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

### 챗봇 사용 예시

- "이번 주 금요일에 20명 회의실 예약해줘"
- "내일 오후 2시부터 4시까지 가능한 회의실 알려줘"
- "이번 주 전체 예약 현황 보여줘"
- "가장 큰 회의실은 어디야?"

### 기존 DB에 수용 인원 컬럼 추가 (업그레이드 시)

```sql
-- backend/src/db/migrations/add_capacity.sql 실행
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 10;
```

## 보안 주의사항

- `.env` 파일은 절대 git에 커밋하지 마세요
- 프로덕션 환경에서는 강력한 `JWT_SECRET`을 사용하세요
- 프로덕션 환경에서는 `POSTGRES_PASSWORD`를 안전하게 설정하세요
- `OPENAI_API_KEY`는 외부에 노출되지 않도록 주의하세요

## 라이선스

MIT
