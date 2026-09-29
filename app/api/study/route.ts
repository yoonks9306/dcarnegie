import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

type Cycle = { id: number; cycleNumber: number; startDay: string };
type Assignment = { firstPrincipleId: number; secondPrincipleId: number };

function validDay(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function elapsedDays(startDay: string, endDay: string) {
  return Math.floor((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000);
}

function shuffledPrinciples(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const deck = Array.from({ length: 30 }, (_, index) => index + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function unavailable() {
  return NextResponse.json({ error: "오늘의 원칙을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
}

async function getOrCreateCycle(db: D1Database, userId: string, day: string, cycleNumber: number): Promise<Cycle> {
  await db.prepare("INSERT OR IGNORE INTO coaching_cycles (user_id, cycle_number, start_day) VALUES (?, ?, ?)")
    .bind(userId, cycleNumber, day).run();
  const cycle = await db.prepare("SELECT id, cycle_number AS cycleNumber, start_day AS startDay FROM coaching_cycles WHERE user_id = ? AND cycle_number = ?")
    .bind(userId, cycleNumber).first<Cycle>();
  if (!cycle) throw new Error("Could not create coaching cycle");

  const deck = shuffledPrinciples(`${userId}:${cycle.cycleNumber}:${cycle.startDay}`);
  const statements = Array.from({ length: 15 }, (_, index) => db.prepare(
    "INSERT OR IGNORE INTO cycle_principles (cycle_id, day_number, first_principle_id, second_principle_id) VALUES (?, ?, ?, ?)"
  ).bind(cycle.id, index + 1, deck[index * 2], deck[index * 2 + 1]));
  await db.batch(statements);
  return cycle;
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const requestedDay = request.nextUrl.searchParams.get("day");
  if (!validDay(requestedDay)) return NextResponse.json({ error: "날짜를 확인해 주세요." }, { status: 400 });

  try {
    const db = env.DB;
    if (!db) throw new Error("DB binding unavailable");
    let cycle = await db.prepare("SELECT id, cycle_number AS cycleNumber, start_day AS startDay FROM coaching_cycles WHERE user_id = ? ORDER BY cycle_number DESC LIMIT 1")
      .bind(userId).first<Cycle>();
    let dayNumber = cycle ? elapsedDays(cycle.startDay, requestedDay) + 1 : 1;
    if (!cycle || dayNumber > 15 || dayNumber < 1) {
      cycle = await getOrCreateCycle(db, userId, requestedDay, (cycle?.cycleNumber ?? 0) + 1);
      dayNumber = 1;
    }

    let assignment = await db.prepare("SELECT first_principle_id AS firstPrincipleId, second_principle_id AS secondPrincipleId FROM cycle_principles WHERE cycle_id = ? AND day_number = ?")
      .bind(cycle.id, dayNumber).first<Assignment>();
    if (!assignment) {
      await getOrCreateCycle(db, userId, cycle.startDay, cycle.cycleNumber);
      assignment = await db.prepare("SELECT first_principle_id AS firstPrincipleId, second_principle_id AS secondPrincipleId FROM cycle_principles WHERE cycle_id = ? AND day_number = ?")
        .bind(cycle.id, dayNumber).first<Assignment>();
    }
    if (!assignment) throw new Error("Daily principles are unavailable");

    const [memo, history] = await Promise.all([
      db.prepare("SELECT content, updated_at AS updatedAt FROM daily_memos WHERE user_id = ? AND cycle_number = ? AND day_number = ?")
        .bind(userId, cycle.cycleNumber, dayNumber).first<{ content: string; updatedAt: string }>(),
      db.prepare("SELECT m.cycle_number AS cycleNumber, m.day_number AS dayNumber, m.content, m.updated_at AS updatedAt, c.start_day AS startDay FROM daily_memos m JOIN coaching_cycles c ON c.user_id = m.user_id AND c.cycle_number = m.cycle_number WHERE m.user_id = ? ORDER BY m.updated_at DESC LIMIT 60")
        .bind(userId).all(),
    ]);
    return NextResponse.json({
      day: requestedDay,
      cycleNumber: cycle.cycleNumber,
      dayNumber,
      principleIds: [assignment.firstPrincipleId, assignment.secondPrincipleId],
      memo: memo?.content ?? "",
      history: history.results,
    });
  } catch (error) {
    console.error("study GET", error);
    return unavailable();
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "메모를 확인해 주세요." }, { status: 400 }); }
  const requestedDay = typeof body.day === "string" ? body.day : null;
  const cycleNumber = Number(body.cycleNumber);
  const dayNumber = Number(body.dayNumber);
  if (body.type !== "memo" || !validDay(requestedDay) || !Number.isInteger(cycleNumber) || cycleNumber < 1 || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 15 || typeof body.content !== "string" || body.content.length > 3000) {
    return NextResponse.json({ error: "메모를 확인해 주세요." }, { status: 400 });
  }
  try {
    const db = env.DB;
    if (!db) throw new Error("DB binding unavailable");
    const current = await db.prepare("SELECT id, cycle_number AS cycleNumber, start_day AS startDay FROM coaching_cycles WHERE user_id = ? ORDER BY cycle_number DESC LIMIT 1")
      .bind(userId).first<Cycle>();
    const currentDayNumber = current ? elapsedDays(current.startDay, requestedDay) + 1 : 0;
    if (!current || current.cycleNumber !== cycleNumber || currentDayNumber !== dayNumber || currentDayNumber > 15) {
      return NextResponse.json({ error: "오늘 메모만 저장할 수 있어요. 화면을 새로고침해 주세요." }, { status: 409 });
    }
    const now = new Date().toISOString();
    if (!body.content.trim()) {
      await db.prepare("DELETE FROM daily_memos WHERE user_id = ? AND cycle_number = ? AND day_number = ?")
        .bind(userId, cycleNumber, dayNumber).run();
      return NextResponse.json({ ok: true, deleted: true });
    }
    await db.prepare("INSERT INTO daily_memos (user_id, cycle_number, day_number, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, cycle_number, day_number) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at")
      .bind(userId, cycleNumber, dayNumber, body.content.trim(), now, now).run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("study POST", error);
    return unavailable();
  }
}
