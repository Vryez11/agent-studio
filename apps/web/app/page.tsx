import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 className="page-title">Agent Studio</h1>
      <p className="muted" style={{ marginBottom: '2rem' }}>
        다단계 LLM 에이전트를 정의하고, 실행하고, 모니터링하세요.
      </p>
      <div className="grid grid-cols-3">
        <Link href="/agents" className="card" style={{ display: 'block' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>에이전트</h3>
          <p className="muted">
            정의된 에이전트 목록과 단계 구성 확인, 새 Run 시작.
          </p>
        </Link>
        <Link
          href="/agents/new"
          className="card"
          style={{ display: 'block' }}
        >
          <h3 style={{ marginBottom: '0.5rem' }}>새 에이전트 만들기</h3>
          <p className="muted">
            빌더에서 단계, 모델, 프롬프트를 정의해 새 에이전트 생성.
          </p>
        </Link>
        <Link href="/runs" className="card" style={{ display: 'block' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>실행 히스토리</h3>
          <p className="muted">
            과거 Run의 단계별 결과, 토큰, 비용, 소요시간 조회.
          </p>
        </Link>
      </div>
    </div>
  );
}
