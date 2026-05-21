import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Play, RotateCcw, Trophy } from "lucide-react";
import Card from "../../components/Card";
import type { GameScore, TravelAppData } from "../../types";
import { createId } from "../../utils/id";

interface FurDodgeGamePageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

type GameState = "ready" | "playing" | "finished";

interface FallingFur {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  spin: number;
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 420;
const PLAYER_Y = 358;
const PLAYER_RADIUS = 15;
const MAX_SAVED_SCORES = 50;

const formatTime = (seconds: number) => `${seconds.toFixed(1)}초`;

const getTopScores = (scores: GameScore[]) =>
  scores
    .slice()
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

export default function FurDodgeGamePage({ data, setData, onBack }: FurDodgeGamePageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const playerXRef = useRef(CANVAS_WIDTH / 2);
  const fursRef = useRef<FallingFur[]>([]);
  const nextFurIdRef = useRef(1);
  const startedAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const lastSpawnAtRef = useRef(0);
  const scoreRef = useRef(0);

  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [survivedSeconds, setSurvivedSeconds] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaved, setScoreSaved] = useState(false);

  const topScores = useMemo(() => getTopScores(data.gameScores ?? []), [data.gameScores]);

  const drawScene = (ctx: CanvasRenderingContext2D, currentScore: number, furs: FallingFur[]) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#dff7ff");
    gradient.addColorStop(1, "#fef3c7");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.ellipse(60, 54, 42, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(230, 88, 54, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 16px system-ui";
    ctx.fillText(`점수 ${currentScore}`, 14, 28);

    for (const fur of furs) {
      ctx.save();
      ctx.translate(fur.x, fur.y);
      ctx.rotate(fur.spin);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-fur.size * 0.55, -fur.size * 0.4);
      ctx.bezierCurveTo(-fur.size * 0.15, -fur.size * 0.9, fur.size * 0.45, fur.size * 0.15, fur.size * 0.1, fur.size * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    const playerX = playerXRef.current;
    ctx.fillStyle = "#14b8a6";
    ctx.beginPath();
    ctx.arc(playerX, PLAYER_Y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(playerX - 5, PLAYER_Y - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(playerX + 5, PLAYER_Y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerX, PLAYER_Y + 2, 6, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.fillRect(0, PLAYER_Y + PLAYER_RADIUS + 20, CANVAS_WIDTH, 3);
  };

  const stopFrame = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const startGame = () => {
    stopFrame();
    fursRef.current = [];
    playerXRef.current = CANVAS_WIDTH / 2;
    nextFurIdRef.current = 1;
    startedAtRef.current = performance.now();
    lastFrameAtRef.current = startedAtRef.current;
    lastSpawnAtRef.current = startedAtRef.current;
    scoreRef.current = 0;
    setScore(0);
    setSurvivedSeconds(0);
    setPlayerName("");
    setScoreSaved(false);
    setGameState("playing");
  };

  const movePlayer = (delta: number) => {
    playerXRef.current = Math.max(PLAYER_RADIUS, Math.min(CANVAS_WIDTH - PLAYER_RADIUS, playerXRef.current + delta));
  };

  const setPlayerFromPointer = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    playerXRef.current = Math.max(PLAYER_RADIUS, Math.min(CANVAS_WIDTH - PLAYER_RADIUS, x));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return undefined;

    if (gameState !== "playing") {
      drawScene(context, score, fursRef.current);
      return undefined;
    }

    const finishGame = (finalScore: number, finalSeconds: number) => {
      stopFrame();
      setScore(finalScore);
      setSurvivedSeconds(finalSeconds);
      setGameState("finished");
    };

    const spawnFur = (elapsedSeconds: number) => {
      const difficulty = Math.min(1, elapsedSeconds / 28);
      const burstCount = elapsedSeconds > 24 && Math.random() < 0.32 ? 2 : 1;

      for (let index = 0; index < burstCount; index += 1) {
        fursRef.current.push({
          id: nextFurIdRef.current,
          x: 18 + Math.random() * (CANVAS_WIDTH - 36),
          y: -24 - index * 22,
          size: 14 + Math.random() * 14,
          speed: 122 + difficulty * 155 + Math.random() * 92,
          drift: -44 + Math.random() * 88,
          spin: Math.random() * Math.PI,
        });
        nextFurIdRef.current += 1;
      }
    };

    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.034, (now - lastFrameAtRef.current) / 1000);
      const elapsedSeconds = (now - startedAtRef.current) / 1000;
      const currentScore = Math.floor(elapsedSeconds * 10);
      const spawnDelay = Math.max(185, 620 - elapsedSeconds * 14);

      lastFrameAtRef.current = now;
      scoreRef.current = currentScore;
      setScore(currentScore);

      if (now - lastSpawnAtRef.current > spawnDelay) {
        spawnFur(elapsedSeconds);
        lastSpawnAtRef.current = now;
      }

      fursRef.current = fursRef.current
        .map((fur) => ({
          ...fur,
          x: fur.x + fur.drift * deltaSeconds,
          y: fur.y + fur.speed * deltaSeconds,
          spin: fur.spin + deltaSeconds * 2.3,
        }))
        .filter((fur) => fur.y < CANVAS_HEIGHT + 30);

      for (const fur of fursRef.current) {
        const distance = Math.hypot(fur.x - playerXRef.current, fur.y - PLAYER_Y);
        if (distance < PLAYER_RADIUS + fur.size * 0.62) {
          finishGame(currentScore, elapsedSeconds);
          return;
        }
      }

      drawScene(context, currentScore, fursRef.current);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return stopFrame;
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameState !== "playing") return;
      if (event.key === "ArrowLeft") movePlayer(-24);
      if (event.key === "ArrowRight") movePlayer(24);
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
          <h1 className="text-2xl font-black text-slate-900">하늘에서 내려오는 털 피하기</h1>
        </div>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-4 py-3 text-white">
          <div>
            <p className="text-xs font-bold text-white/70">현재 점수</p>
            <p className="text-2xl font-black">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-white/70">생존 시간</p>
            <p className="text-lg font-black">{formatTime(gameState === "playing" ? score / 10 : survivedSeconds)}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={(event) => setPlayerFromPointer(event.clientX)}
            onPointerMove={(event) => {
              if (gameState === "playing") setPlayerFromPointer(event.clientX);
            }}
            className="block aspect-[320/420] w-full touch-none"
          />

          {gameState !== "playing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/55 p-5 text-center backdrop-blur-[1px]">
              <div className="w-full rounded-lg bg-white/95 p-4 shadow-soft">
                <p className="text-3xl">💈</p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {gameState === "ready" ? "털비가 내린다" : `게임 끝! ${score}점`}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {gameState === "ready" ? "드래그하거나 좌우 버튼으로 피하면 돼." : `${formatTime(survivedSeconds)} 버텼어.`}
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

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => movePlayer(-34)}
            disabled={gameState !== "playing"}
            className="flex h-12 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            onClick={() => movePlayer(34)}
            disabled={gameState !== "playing"}
            className="flex h-12 items-center justify-center rounded-lg bg-white font-black text-slate-800 shadow-sm disabled:text-slate-300"
          >
            <ChevronRight size={26} />
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
