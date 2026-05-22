# agent-studio

다단계 LLM 에이전트를 정의·실행·모니터링하는 웹 플랫폼.

## 개념

- **Agent**: 순서가 있는 N개의 Stage 모음. DB에 저장되는 데이터 (코드 아님).
- **Stage**: LLM 호출 한 번을 정의하는 단위. systemPrompt, model, provider, input template, output schema 등을 가짐.
- **AgentVersion**: Agent 정의의 불변 스냅샷. 프롬프트를 수정하면 새 version row 생성. 과거 Run의 재현성 보장.
- **Run**: Agent 한 번의 실행. 단계별 결과/토큰/비용 추적.
- **StageResult**: Run 안의 각 Stage 실행 결과.

## 구조

```
agent-studio/
├─ apps/
│  ├─ api/            # Fastify 서버 + Prisma (MySQL)
│  └─ web/            # Next.js 15 관리 UI
├─ packages/
│  ├─ shared/         # 공통 타입 + Zod 스키마
│  ├─ runtime/        # Stage executor, template resolver
│  └─ providers/      # Anthropic / OpenAI 어댑터
└─ pnpm-workspace.yaml
```

## 시작하기

### 사전 요구

- Node.js 20.10+
- pnpm 9+
- MySQL 8+

### 설치

```bash
pnpm install

# API 환경변수 (DB 연결, LLM API 키)
cp apps/api/.env.example apps/api/.env

# 웹 환경변수 (API URL)
cp apps/web/.env.example apps/web/.env.local
```

`apps/api/.env`에는 최소 다음을 채워야 합니다:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/agent_studio"
```

> `.env`는 각 앱 디렉토리에 둡니다. Prisma는 `schema.prisma`와 같은 폴더의
> `.env`를 자동 로드하고, API 서버도 `apps/api/`에서 실행되므로 위치가 일관됩니다.
> Next.js는 `apps/web/`에서 `.env.local` 등을 자동 로드합니다.

### DB 마이그레이션

먼저 MySQL에 데이터베이스를 생성:

```sql
CREATE DATABASE agent_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

이후:

```bash
pnpm db:generate     # Prisma client 생성
pnpm db:migrate      # 마이그레이션 적용
pnpm db:studio       # (옵션) DB 브라우저
```

### 개발 서버

```bash
pnpm dev             # api + web 동시 실행
```

- API: http://localhost:4000
- Web: http://localhost:3000
