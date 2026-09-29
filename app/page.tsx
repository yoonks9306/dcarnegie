"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { principles } from "@/lib/principles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STORAGE_KEY = "dcarnegie.coaching.v1";
const STORAGE_VERSION = 1;

type StoredMemo = { day: string; cycleNumber: number; dayNumber: number; startDay: string; content: string; updatedAt: string };
type LocalData = { version: 1; startedAt: string; memos: Record<string, StoredMemo> };

function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date(`${value}T00:00:00`));
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function elapsedDays(startDay: string, endDay: string) {
  return Math.max(0, Math.floor((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000));
}

function shuffledPrinciples(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const deck = Array.from({ length: 30 }, (_, index) => index + 1);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function newLocalData(): LocalData {
  return { version: STORAGE_VERSION, startedAt: localDay(), memos: {} };
}

function readLocalData(): LocalData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return newLocalData();
    const data = JSON.parse(raw) as Partial<LocalData>;
    if (data.version !== STORAGE_VERSION || !isDay(data.startedAt) || !data.memos || typeof data.memos !== "object") return newLocalData();
    const memos = Object.fromEntries(Object.entries(data.memos).filter(([, entry]) => {
      const memo = entry as Partial<StoredMemo>;
      return isDay(memo.day) && isDay(memo.startDay) && typeof memo.content === "string" && memo.content.length <= 3000 && typeof memo.updatedAt === "string";
    })) as Record<string, StoredMemo>;
    return { version: STORAGE_VERSION, startedAt: data.startedAt, memos };
  } catch {
    return newLocalData();
  }
}

function writeLocalData(data: LocalData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function Home() {
  const [data, setData] = useState<LocalData | null>(null);
  const [memo, setMemo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedPrincipleId, setSelectedPrincipleId] = useState(1);
  const importInputRef = useRef<HTMLInputElement>(null);
  const today = localDay();

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage exists only after the client mounts. */
  useEffect(() => {
    const stored = readLocalData();
    writeLocalData(stored);
    setData(stored);
    setMemo(stored.memos[today]?.content ?? "");
  }, [today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const study = useMemo(() => {
    if (!data) return null;
    const elapsed = elapsedDays(data.startedAt, today);
    const cycleNumber = Math.floor(elapsed / 15) + 1;
    const dayNumber = (elapsed % 15) + 1;
    const startDay = addDays(data.startedAt, (cycleNumber - 1) * 15);
    const deck = shuffledPrinciples(`${data.startedAt}:${cycleNumber}`);
    return { day: today, cycleNumber, dayNumber, startDay, principleIds: [deck[(dayNumber - 1) * 2], deck[(dayNumber - 1) * 2 + 1]] };
  }, [data, today]);

  const todaysPrinciples = useMemo(() => study?.principleIds.map((id) => principles[id - 1]) ?? [], [study]);
  const memoHistory = useMemo(() => data ? Object.values(data.memos).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [], [data]);
  const selectedPrinciple = principles[selectedPrincipleId - 1];

  function saveMemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !study) return;
    setError("");
    setNotice("");
    const nextMemos = { ...data.memos };
    if (memo.trim()) {
      nextMemos[today] = { day: today, cycleNumber: study.cycleNumber, dayNumber: study.dayNumber, startDay: study.startDay, content: memo.trim(), updatedAt: new Date().toISOString() };
    } else {
      delete nextMemos[today];
    }
    const nextData = { ...data, memos: nextMemos };
    try {
      writeLocalData(nextData);
      setData(nextData);
      setMemo(nextMemos[today]?.content ?? "");
      setNotice(memo.trim() ? "이 브라우저에 메모를 저장했어요." : "오늘 메모를 지웠어요.");
    } catch {
      setError("브라우저 저장 공간을 사용할 수 없습니다.");
    }
  }

  function exportData() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `d-carnegie-backup-${today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("백업 파일을 내보냈어요.");
  }

  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const imported = JSON.parse(await file.text()) as Partial<LocalData>;
      if (imported.version !== STORAGE_VERSION || !isDay(imported.startedAt) || !imported.memos || typeof imported.memos !== "object") throw new Error();
      const normalized: LocalData = { version: STORAGE_VERSION, startedAt: imported.startedAt, memos: {} };
      for (const [key, entry] of Object.entries(imported.memos)) {
        const value = entry as Partial<StoredMemo>;
        if (!isDay(value.day) || !isDay(value.startDay) || typeof value.content !== "string" || value.content.length > 3000 || typeof value.updatedAt !== "string") throw new Error();
        normalized.memos[key] = value as StoredMemo;
      }
      writeLocalData(normalized);
      setData(normalized);
      setMemo(normalized.memos[today]?.content ?? "");
      setNotice("백업 기록을 이 브라우저로 가져왔어요.");
    } catch {
      setError("올바른 D. Carnegie 백업 파일이 아닙니다.");
    }
  }

  function clearData() {
    if (!window.confirm("이 브라우저에 저장된 모든 메모와 진행 기록을 지울까요? 이 작업은 되돌릴 수 없습니다.")) return;
    const reset = newLocalData();
    writeLocalData(reset);
    setData(reset);
    setMemo("");
    setError("");
    setNotice("이 브라우저의 모든 기록을 삭제했어요.");
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="wordmark" aria-label="D. Carnegie 데일리 코칭">
        <span className="wordmark-script">D. Carnegie</span>
        <span className="wordmark-subtitle">DAILY PRACTICE</span>
      </div>
      <span className="local-badge">PRIVATE · LOCAL</span>
    </header>
    <main className="coach">
      <aside className="privacy-note" aria-label="개인정보 안내">
        <span className="privacy-icon" aria-hidden="true">◌</span>
        <div><strong>기록은 이 브라우저에만 남습니다.</strong><p>회원가입도, 서버 전송도 없습니다. 다른 사람은 물론 사이트 운영자도 메모 내용을 볼 수 없어요.</p></div>
      </aside>
      {error && <p className="status-line error" role="alert">{error}</p>}
      {notice && <p className="notice global-notice" role="status">{notice}</p>}

      <Tabs defaultValue="daily" className="coach-tabs">
        <TabsList className="mode-tabs" aria-label="학습 방식">
          <TabsTrigger value="daily">오늘의 실천 과제</TabsTrigger>
          <TabsTrigger value="learning">학습 모드</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          {!study && <p className="status-line" role="status">오늘의 원칙을 준비하고 있습니다.</p>}
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
              <div className="section-heading"><h2>하루 복기 메모</h2><span>브라우저 보관</span></div>
              <p className="memo-prompt">오늘 두 원칙을 떠올리며 기억해 둘 일을 적어두세요. 저장 버튼을 누를 때만 이 브라우저에 기록됩니다.</p>
              <form onSubmit={saveMemo}>
                <Textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={3000} rows={5} aria-label="하루 복기 메모" placeholder="오늘 있었던 일, 건넨 말, 다음에 해보고 싶은 행동…" />
                <div className="memo-actions"><span>{memo.length} / 3000</span><Button type="submit">{memo.trim() ? "이 브라우저에 저장" : "오늘 메모 지우기"}</Button></div>
              </form>
            </section>
            <section className="memo-history">
              <h2>지난 메모</h2>
              {memoHistory.length ? <ol>{memoHistory.map((entry) => <li key={entry.day}>
                <div className="memo-meta"><span>{entry.cycleNumber}회차 · {entry.dayNumber}일차</span><time dateTime={entry.day}>{readableDate(entry.day)}</time></div>
                <p>{entry.content}</p>
              </li>)}</ol> : <p>아직 이 브라우저에 저장한 메모가 없습니다.</p>}
            </section>
            <section className="data-tools" aria-labelledby="data-tools-title">
              <div><h2 id="data-tools-title">내 기록 관리</h2><p>기기를 바꾸기 전에 백업하고, 다른 브라우저에서 다시 가져올 수 있습니다.</p></div>
              <div className="data-actions">
                <Button type="button" variant="outline" onClick={exportData}>기록 내보내기</Button>
                <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>기록 가져오기</Button>
                <button type="button" className="delete-data" onClick={clearData}>모든 기록 삭제</button>
                <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
              </div>
              <p className="data-footnote">시크릿 모드 또는 브라우저 데이터 삭제 시 기록이 사라질 수 있습니다. 공용 기기에서는 사용 후 기록을 삭제하세요.</p>
            </section>
          </>}
        </TabsContent>

        <TabsContent value="learning">
          <section className="learning-heading"><p className="eyebrow">전체 목차</p><h1>30개 원칙</h1><p>원칙을 골라 핵심과 적용 사례를 살펴보세요.</p></section>
          <div className="learning-layout">
            <nav className="principle-index" aria-label="전체 원칙 목차">
              {principles.map((principle) => <button type="button" key={principle.id} className={selectedPrincipleId === principle.id ? "index-item selected" : "index-item"} aria-current={selectedPrincipleId === principle.id ? "true" : undefined} onClick={() => setSelectedPrincipleId(principle.id)}>
                <span className="index-number">{String(principle.id).padStart(2, "0")}</span><span>{principle.title}</span>
              </button>)}
            </nav>
            <article className="learning-detail" aria-live="polite">
              <p className="principle-number">제 {selectedPrinciple.id}원칙</p><h2>{selectedPrinciple.title}</h2><p className="principle-point">{selectedPrinciple.point}</p>
              <section className="example"><h3>적용 사례</h3><p>{selectedPrinciple.example}</p></section><section className="prism"><h3>Prism</h3><p>{selectedPrinciple.prism}</p></section>
            </article>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  </div>;
}
