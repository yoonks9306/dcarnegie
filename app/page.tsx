"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { principles } from "@/lib/principles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MemoHistory = { cycleNumber: number; dayNumber: number; content: string; updatedAt: string; startDay: string };
type StudyDay = { day: string; cycleNumber: number; dayNumber: number; principleIds: number[]; memo: string; history: MemoHistory[] };

function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" })
    .format(new Date(`${value}T00:00:00`));
}

function cycleDayDate(startDay: string, dayNumber: number) {
  const date = new Date(`${startDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}

export default function Home() {
  const [day, setDay] = useState("");
  const [study, setStudy] = useState<StudyDay | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [selectedPrincipleId, setSelectedPrincipleId] = useState(1);

  const loadStudy = useCallback(async (studyDay: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/study?day=${studyDay}`, { cache: "no-store" });
      const data = await response.json() as StudyDay & { error?: string };
      if (response.status === 401) {
        setSignedOut(true);
        setStudy(null);
        return;
      }
      if (!response.ok) throw new Error(data.error || "오늘의 원칙을 불러오지 못했어요.");
      setStudy(data);
      setMemo(data.memo);
      setSignedOut(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "오늘의 원칙을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = localDay();
    setDay(today);
    void loadStudy(today);
  }, [loadStudy]);

  const saveMemo = useCallback(async (content: string) => {
    if (!study || !day) throw new Error("오늘의 원칙을 먼저 불러와 주세요.");
    const response = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "memo", cycleNumber: study.cycleNumber, dayNumber: study.dayNumber, day, content }),
    });
    const data = await response.json() as { error?: string; deleted?: boolean };
    if (!response.ok) throw new Error(data.error || "메모를 저장하지 못했어요.");
    await loadStudy(day);
    setNotice(data.deleted ? "오늘 메모를 지웠어요." : content.trim() ? "오늘 메모를 저장했어요." : "오늘 메모가 없습니다.");
  }, [day, loadStudy, study]);

  async function submitMemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try { await saveMemo(memo); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "메모를 저장하지 못했어요."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!study) return;
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "save_daily_reflection",
        title: "하루 복기 메모 저장",
        description: "오늘 받은 두 원칙에 대한 선택 메모를 저장하거나 비웁니다.",
        inputSchema: { type: "object", properties: { content: { type: "string", maxLength: 3000 } }, required: ["content"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const content = (input as { content?: unknown })?.content;
          if (typeof content !== "string" || content.length > 3000) throw new Error("메모는 3,000자 이내로 입력해 주세요.");
          await saveMemo(content);
          setMemo(content);
          return { saved: !!content.trim(), cycleNumber: study.cycleNumber, dayNumber: study.dayNumber };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [saveMemo, study]);

  const todaysPrinciples = useMemo(() => study?.principleIds.map((id) => principles[id - 1]) ?? [], [study]);
  const memoHistory = study?.history ?? [];
  const percent = study ? `${(study.dayNumber / 15) * 100}%` : "0%";

  const selectedPrinciple = principles[selectedPrincipleId - 1];

  return <div className="app-shell">
    <header className="topbar"><div className="brand">데일 카네기 코칭</div></header>
    <main className="coach">
      {loading && <p className="status-line" role="status">오늘의 원칙을 불러오는 중입니다.</p>}
      {signedOut && <p className="status-line" role="status">로그인하면 오늘의 원칙과 복기 메모를 확인할 수 있어요.</p>}
      {error && <p className="status-line error" role="alert">{error} <button onClick={() => day && void loadStudy(day)}>다시 불러오기</button></p>}

      <Tabs defaultValue="daily" className="coach-tabs">
        <TabsList className="mode-tabs" aria-label="학습 방식">
          <TabsTrigger value="daily">오늘의 실천 과제</TabsTrigger>
          <TabsTrigger value="learning">학습 모드</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
      {study && <>
        <section className="cycle-summary" aria-label="진행 상황">
          <div className="cycle-line"><span>{study.cycleNumber}회차</span><span>{study.dayNumber}일차 / 15일</span></div>
          <progress className="cycle-progress" max={15} value={study.dayNumber} aria-label={`${study.cycleNumber}회차 ${study.dayNumber}일차`} />
          <h1>오늘의 두 가지 실천 과제</h1>
          <p className="date-line">{readableDate(study.day)}</p>
        </section>

        <section className="principle-list" aria-label="오늘의 원칙">
          {todaysPrinciples.map((principle, index) => <article className="principle" key={principle.id}>
            <div className="principle-number">오늘의 원칙 {index + 1} <span>제 {principle.id}원칙</span></div>
            <h2>{principle.title}</h2>
            <p className="principle-point">{principle.point}</p>
            <section className="example"><h3>적용 사례</h3><p>{principle.example}</p></section>
            <section className="prism"><h3>Prism</h3><p>{principle.prism}</p></section>
          </article>)}
        </section>

        <section className="memo-section">
          <div className="section-heading"><h2>하루 복기 메모</h2><span>선택</span></div>
          <p className="memo-prompt">오늘 두 원칙을 떠올리며 기억해 둘 일을 적어두세요.</p>
          <form onSubmit={submitMemo}>
            <Textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={3000} rows={5} aria-label="하루 복기 메모" placeholder="오늘 있었던 일, 건넨 말, 다음에 해보고 싶은 행동…" />
            <div className="memo-actions"><span>{memo.length} / 3000</span><Button type="submit" disabled={busy || loading || (!memo.trim() && !study.memo)}>{busy ? "저장 중" : "메모 저장"}</Button></div>
          </form>
          {notice && <p className="notice" role="status">{notice}</p>}
        </section>

        <section className="memo-history">
          <h2>지난 메모</h2>
          {memoHistory.length ? <ol>{memoHistory.map((entry) => <li key={`${entry.cycleNumber}-${entry.dayNumber}`}>
            <div className="memo-meta"><span>{entry.cycleNumber}회차 · {entry.dayNumber}일차</span><time dateTime={cycleDayDate(entry.startDay, entry.dayNumber)}>{readableDate(cycleDayDate(entry.startDay, entry.dayNumber))}</time></div>
            <p>{entry.content}</p>
          </li>)}</ol> : <p>아직 저장한 메모가 없습니다.</p>}
        </section>
      </>}
        </TabsContent>

        <TabsContent value="learning">
          <section className="learning-heading">
            <p className="eyebrow">전체 목차</p>
            <h1>30개 원칙</h1>
            <p>원칙을 골라 핵심과 적용 사례를 살펴보세요.</p>
          </section>
          <div className="learning-layout">
            <nav className="principle-index" aria-label="전체 원칙 목차">
              {principles.map((principle) => <button
                type="button"
                key={principle.id}
                className={selectedPrincipleId === principle.id ? "index-item selected" : "index-item"}
                aria-current={selectedPrincipleId === principle.id ? "true" : undefined}
                onClick={() => setSelectedPrincipleId(principle.id)}
              >
                <span className="index-number">{String(principle.id).padStart(2, "0")}</span>
                <span>{principle.title}</span>
              </button>)}
            </nav>
            <article className="learning-detail" aria-live="polite">
              <p className="principle-number">제 {selectedPrinciple.id}원칙</p>
              <h2>{selectedPrinciple.title}</h2>
              <p className="principle-point">{selectedPrinciple.point}</p>
              <section className="example"><h3>적용 사례</h3><p>{selectedPrinciple.example}</p></section>
              <section className="prism"><h3>Prism</h3><p>{selectedPrinciple.prism}</p></section>
            </article>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  </div>;
}
