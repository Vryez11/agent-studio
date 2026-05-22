export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Agent Studio</h1>
      <p>다단계 LLM 에이전트를 정의·실행·모니터링하는 플랫폼.</p>
      <ul>
        <li>
          <a href="/agents">에이전트 목록</a> (구현 예정)
        </li>
        <li>
          <a href="/runs">실행 히스토리</a> (구현 예정)
        </li>
      </ul>
      <p style={{ marginTop: '2rem', color: '#888', fontSize: '0.875rem' }}>
        API: {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}
      </p>
    </main>
  );
}
