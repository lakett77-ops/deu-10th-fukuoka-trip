import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, RotateCcw, Trophy } from "lucide-react";
import Card from "../../components/Card";
import type { GameScore, TravelAppData } from "../../types";
import { createId } from "../../utils/id";

interface FurDodgeGamePageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

type GameState = "ready" | "playing" | "finished";

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  spinSpeed: number;
  kind: "fur" | "orb";
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 420;
const PLAYER_START_X = CANVAS_WIDTH / 2;
const PLAYER_START_Y = 338;
const PLAYER_RADIUS = 13;
const PLAYER_HITBOX_RADIUS = 4.2;
const PLAYER_STEP = 18;
const MAX_SAVED_SCORES = 50;
const MAX_BULLETS = 560;

const formatTime = (seconds: number) => `${seconds.toFixed(1)}초`;

const getTopScores = (scores: GameScore[]) =>
  scores
    .slice()
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function FurDodgeGamePage({ data, setData, onBack }: FurDodgeGamePageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const playerXRef = useRef(PLAYER_START_X);
  const playerYRef = useRef(PLAYER_START_Y);
  const bulletsRef = useRef<Bullet[]>([]);
  const nextBulletIdRef = useRef(1);
  const startedAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const lastRainAtRef = useRef(0);
  const lastAimedAtRef = useRef(0);
  const lastRingAtRef = useRef(0);
  const lastSpiralAtRef = useRef(0);
  const spiralAngleRef = useRef(0);
  const scoreRef = useRef(0);

  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [survivedSeconds, setSurvivedSeconds] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaved, setScoreSaved] = useState(false);

  const topScores = useMemo(() => getTopScores(data.gameScores ?? []), [data.gameScores]);

  const drawBullet = (ctx: CanvasRenderingContext2D, bullet: Bullet) => {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.spin);

    if (bullet.kind === "orb") {
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, bullet.size * 1.5);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(0.45, bullet.color);
      glow.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = bullet.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-bullet.size * 0.7, -bullet.size * 0.35);
      ctx.bezierCurveTo(-bullet.size * 0.1, -bullet.size * 1.1, bullet.size * 0.75, bullet.size * 0.15, bullet.size * 0.15, bullet.size);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawScene = (ctx: CanvasRenderingContext2D, currentScore: number, bullets: Bullet[]) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#172554");
    gradient.addColorStop(0.58, "#312e81");
    gradient.addColorStop(1, "#ecfeff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.13)";
    for (let y = 36; y < CANVAS_HEIGHT; y += 38) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
    }
    for (let x = 28; x < CANVAS_WIDTH; x += 42) {
      ctx.fillRect(x, 0, 1, CANVAS_HEIGHT);
    }

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 16px system-ui";
    ctx.fillText(`점수 ${currentScore}`, 14, 28);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "700 12px system-ui";
    ctx.fillText("상급 탄막", 245, 27);

    for (const bullet of bullets) {
      drawBullet(ctx, bullet);
    }

    const playerX = playerXRef.current;
    const playerY = playerYRef.current;
    ctx.fillStyle = "#14b8a6";
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(playerX - 4.5, playerY - 3, 2.2, 0, Math.PI * 2);
    ctx.arc(playerX + 4.5, playerY - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerX, playerY + 3, 5.5, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_HITBOX_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const stopFrame = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const resetGameRefs = () => {
    const now = performance.now();
    bulletsRef.current = [];
    playerXRef.current = PLAYER_START_X;
    playerYRef.current = PLAYER_START_Y;
    nextBulletIdRef.current = 1;
    startedAtRef.current = now;
    lastFrameAtRef.current = now;
    lastRainAtRef.current = now;
    lastAimedAtRef.current = now;
    lastRingAtRef.current = now;
    lastSpiralAtRef.current = now;
    spiralAngleRef.current = -Math.PI / 2;
    scoreRef.current = 0;
  };

  const startGame = () => {
    stopFrame();
    resetGameRefs();
    setScore(0);
    setSurvivedSeconds(0);
    setPlayerName("");
    setScoreSaved(false);
    setGameState("playing");
  };

  const addBullet = (bullet: Omit<Bullet, "id">) => {
    bulletsRef.current.push({
      ...bullet,
      id: nextBulletIdRef.current,
    });
    nextBulletIdRef.current += 1;
  };

  const movePlayer = (dx: number, dy: number) => {
    playerXRef.current = clamp(playerXRef.current + dx, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
    playerYRef.current = clamp(playerYRef.current + dy, 74, CANVAS_HEIGHT - PLAYER_RADIUS - 10);
  };

  const setPlayerFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    playerXRef.current = clamp(x, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
    playerYRef.current = clamp(y, 74, CANVAS_HEIGHT - PLAYER_RADIUS - 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return undefined;

    if (gameState !== "playing") {
      drawScene(context, score, bulletsRef.current);
      return undefined;
    }

    const finishGame = (finalScore: number, finalSeconds: number) => {
      stopFrame();
      setScore(finalScore);
      setSurvivedSeconds(finalSeconds);
      setGameState("finished");
    };

    const spawnRain = (difficulty: number) => {
      const count = 3 + Math.floor(difficulty * 4);
      for (let index = 0; index < count; index += 1) {
        addBullet({
          x: 12 + Math.random() * (CANVAS_WIDTH - 24),
          y: -16 - index * 8,
          vx: -48 + Math.random() * 96,
          vy: 170 + difficulty * 96 + Math.random() * 72,
          size: 7 + Math.random() * 4,
          color: index % 2 === 0 ? "#e0f2fe" : "#fde68a",
          spin: Math.random() * Math.PI,
          spinSpeed: -4 + Math.random() * 8,
          kind: "fur",
        });
      }
    };

    const spawnAimedFan = (difficulty: number) => {
      const originX = 28 + Math.random() * (CANVAS_WIDTH - 56);
      const originY = 18;
      const baseAngle = Math.atan2(playerYRef.current - originY, playerXRef.current - originX);
      const fanCount = 7 + Math.floor(difficulty * 5);
      const spread = 0.42 + difficulty * 0.18;
      const speed = 132 + difficulty * 98;

      for (let index = 0; index < fanCount; index += 1) {
        const ratio = fanCount === 1 ? 0 : index / (fanCount - 1);
        const angle = baseAngle - spread / 2 + ratio * spread;
        addBullet({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5.6,
          color: "#fb7185",
          spin: 0,
          spinSpeed: 5,
          kind: "orb",
        });
      }
    };

    const spawnRing = (elapsedSeconds: number, difficulty: number) => {
      const originX = 64 + Math.random() * (CANVAS_WIDTH - 128);
      const originY = 92 + Math.sin(elapsedSeconds * 0.75) * 36;
      const count = 18 + Math.floor(difficulty * 18);
      const speed = 74 + difficulty * 58;
      const offset = elapsedSeconds * 0.85;

      for (let index = 0; index < count; index += 1) {
        const angle = offset + (Math.PI * 2 * index) / count;
        addBullet({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4.8,
          color: index % 2 === 0 ? "#a78bfa" : "#38bdf8",
          spin: 0,
          spinSpeed: 3,
          kind: "orb",
        });
      }
    };

    const spawnSpiral = (difficulty: number) => {
      const originX = CANVAS_WIDTH / 2 + Math.sin(spiralAngleRef.current * 0.7) * 58;
      const originY = 58;
      const speed = 118 + difficulty * 52;

      for (let arm = 0; arm < 4; arm += 1) {
        const angle = spiralAngleRef.current + (Math.PI * 2 * arm) / 4;
        addBullet({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5.2,
          color: arm % 2 === 0 ? "#facc15" : "#2dd4bf",
          spin: 0,
          spinSpeed: 4,
          kind: "orb",
        });
      }

      spiralAngleRef.current += 0.23 + difficulty * 0.06;
    };

    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.032, (now - lastFrameAtRef.current) / 1000);
      const elapsedSeconds = (now - startedAtRef.current) / 1000;
      const difficulty = Math.min(1, elapsedSeconds / 24);
      const currentScore = Math.floor(elapsedSeconds * 14);

      lastFrameAtRef.current = now;
      if (currentScore !== scoreRef.current) {
        scoreRef.current = currentScore;
        setScore(currentScore);
      }

      if (now - lastRainAtRef.current > Math.max(115, 220 - elapsedSeconds * 3.4)) {
        spawnRain(difficulty);
        lastRainAtRef.current = now;
      }

      if (now - lastAimedAtRef.current > Math.max(430, 820 - elapsedSeconds * 8)) {
        spawnAimedFan(difficulty);
        lastAimedAtRef.current = now;
      }

      if (now - lastRingAtRef.current > Math.max(900, 1550 - elapsedSeconds * 12)) {
        spawnRing(elapsedSeconds, difficulty);
        lastRingAtRef.current = now;
      }

      if (now - lastSpiralAtRef.current > Math.max(82, 135 - elapsedSeconds * 1.1)) {
        spawnSpiral(difficulty);
        lastSpiralAtRef.current = now;
      }

      bulletsRef.current = bulletsRef.current
        .map((bullet) => ({
          ...bullet,
          x: bullet.x + bullet.vx * deltaSeconds,
          y: bullet.y + bullet.vy * deltaSeconds,
          spin: bullet.spin + bullet.spinSpeed * deltaSeconds,
        }))
        .filter((bullet) => bullet.x > -32 && bullet.x < CANVAS_WIDTH + 32 && bullet.y > -40 && bullet.y < CANVAS_HEIGHT + 40)
        .slice(-MAX_BULLETS);

      for (const bullet of bulletsRef.current) {
        const distance = Math.hypot(bullet.x - playerXRef.current, bullet.y - playerYRef.current);
        if (distance < PLAYER_HITBOX_RADIUS + bullet.size * 0.72) {
          finishGame(currentScore, elapsedSeconds);
          return;
        }
      }

      drawScene(context, currentScore, bulletsRef.current);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return stopFrame;
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameState !== "playing") return;
      if (event.key === "ArrowLeft") movePlayer(-PLAYER_STEP, 0);
      if (event.key === "ArrowRight") movePlayer(PLAYER_STEP, 0);
      if (event.key === "ArrowUp") movePlayer(0, -PLAYER_STEP);
      if (event.key === "ArrowDown") movePlayer(0, PLAYER_STEP);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  const saveScore = () => {
    const name = playerName.trim();
    if (!name) {
      alert("랭킹에 올릴 이름을 입력해줘.");
      return;
    }

    const newScore: GameScore = {
      id: createId("game-score"),
      playerName: name,
      score,
      survivedSeconds,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      gameScores: [newScore, ...(current.gameScores ?? [])]
        .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_SAVED_SCORES),
    }));
    setScoreSaved(true);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-lg bg-white shadow-sm" aria-label="뒤로">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-teal-600">미니게임</p>
          <h1 className="text-2xl font-black text-slate-900">털 탄막 생존게임</h1>
        </div>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-4 py-3 text-white">
          <div>
            <p className="text-xs font-bold text-white/70">현재 점수</p>
            <p className="text-2xl font-black">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-white/70">난이도</p>
            <p className="text-lg font-black">상급</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={(event) => setPlayerFromPointer(event.clientX, event.clientY)}
            onPointerMove={(event) => {
              if (gameState === "playing") setPlayerFromPointer(event.clientX, event.clientY);
            }}
            className="block aspect-[320/420] w-full touch-none"
          />

          {gameState !== "playing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 p-5 text-center backdrop-blur-[1px]">
              <div className="w-full rounded-lg bg-white/95 p-4 shadow-soft">
                <p className="text-3xl">💈</p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {gameState === "ready" ? "상급 털 탄막" : `게임 끝! ${score}점`}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {gameState === "ready" ? "작은 주황색 피격점만 안 맞으면 살아." : `${formatTime(survivedSeconds)} 버텼어.`}
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-500 font-black text-white"
                >
                  {gameState === "ready" ? <Play size={18} /> : <RotateCcw size={18} />}
                  {gameState === "ready" ? "시작하기" : "다시 하기"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
          <div />
          <button
            type="button"
            onClick={() => movePlayer(0, -PLAYER_STEP)}
            disabled={gameState !== "playing"}
            className="flex h-11 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronUp size={24} />
          </button>
          <div />
          <button
            type="button"
            onClick={() => movePlayer(-PLAYER_STEP, 0)}
            disabled={gameState !== "playing"}
            className="flex h-11 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => movePlayer(0, PLAYER_STEP)}
            disabled={gameState !== "playing"}
            className="flex h-11 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronDown size={24} />
          </button>
          <button
            type="button"
            onClick={() => movePlayer(PLAYER_STEP, 0)}
            disabled={gameState !== "playing"}
            className="flex h-11 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </Card>

      {gameState === "finished" && (
        <Card className="space-y-3 border-amber-100 bg-amber-50/80">
          <div>
            <p className="text-sm font-bold text-amber-700">랭킹 등록</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">{score}점 기록 남기기</h2>
          </div>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            maxLength={12}
            placeholder="이름 입력"
            disabled={scoreSaved}
            className="h-12 w-full rounded-lg border border-amber-200 px-3 font-bold disabled:bg-white/60"
          />
          <button
            type="button"
            onClick={saveScore}
            disabled={scoreSaved}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 font-black text-slate-950 disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Trophy size={18} />
            {scoreSaved ? "등록 완료" : "랭킹에 올리기"}
          </button>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy size={19} className="text-amber-500" />
          <h2 className="text-lg font-black text-slate-900">친구들 레이팅 TOP 3</h2>
        </div>
        {topScores.length ? (
          <div className="space-y-2">
            {topScores.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                <div className={`grid h-9 w-9 place-items-center rounded-lg font-black ${index === 0 ? "bg-amber-300 text-slate-950" : "bg-white text-slate-700"}`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-900">{item.playerName}</p>
                  <p className="text-xs font-bold text-slate-500">{formatTime(item.survivedSeconds)} 생존</p>
                </div>
                <p className="text-xl font-black text-teal-600">{item.score}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
            <p className="font-black text-slate-900">아직 랭킹이 비어 있어</p>
            <p className="mt-1 text-sm font-bold text-slate-500">첫 기록 남기는 사람이 바로 1등이야.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
