'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type GameStatus = 'ready' | 'playing' | 'paused' | 'result' | 'gameOver';
type Outcome = 'hit' | 'miss' | 'escaped' | null;
type Enemy = { id: number; x: number; groundY: number; height: number; cover: 'wall' | 'car' | 'window' | 'rubble'; outcome: Outcome };

const TOTAL_ROUNDS = 20;
const ENEMY_SLOTS = [
  { x: 0.16, groundY: 0.72, height: 0.26, cover: 'car' },
  { x: 0.31, groundY: 0.62, height: 0.22, cover: 'wall' },
  { x: 0.49, groundY: 0.68, height: 0.29, cover: 'rubble' },
  { x: 0.66, groundY: 0.55, height: 0.19, cover: 'window' },
  { x: 0.82, groundY: 0.7, height: 0.27, cover: 'wall' },
  { x: 0.73, groundY: 0.82, height: 0.31, cover: 'car' },
  { x: 0.41, groundY: 0.83, height: 0.34, cover: 'rubble' },
] as const;

const visibleFor = (round: number) => Math.round(1700 - ((round - 1) / 19) * 1050);
const gapFor = (round: number) => Math.round(800 - ((round - 1) / 19) * 550);
const percentage = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(0);
  const continuationRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<GameStatus>('ready');
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const hasShotRef = useRef(false);
  const lastSlotRef = useRef(-1);
  const [status, setStatus] = useState<GameStatus>('ready');
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [hasShot, setHasShot] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [crosshair, setCrosshair] = useState({ x: 50, y: 50, visible: false });
  const [shotFlash, setShotFlash] = useState(false);

  const changeStatus = useCallback((next: GameStatus) => { statusRef.current = next; setStatus(next); }, []);
  const stopClock = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    timerRef.current = null; rafRef.current = null;
  }, []);
  const schedule = useCallback((duration: number, next: () => void, showCountdown: boolean) => {
    stopClock(); remainingRef.current = duration; deadlineRef.current = performance.now() + duration; continuationRef.current = next;
    const paintCountdown = () => {
      const remaining = Math.max(0, deadlineRef.current - performance.now()); remainingRef.current = remaining;
      if (showCountdown) setTimeLeft(remaining);
      if (remaining > 0 && statusRef.current === 'playing') rafRef.current = requestAnimationFrame(paintCountdown);
    };
    if (showCountdown) paintCountdown();
    timerRef.current = window.setTimeout(next, duration);
  }, [stopClock]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current; const arena = arenaRef.current;
    if (!canvas || !arena) return;
    const bounds = arena.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(bounds.width * ratio)); canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const width = bounds.width; const height = bounds.height; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#5e625d'); sky.addColorStop(0.38, '#747166'); sky.addColorStop(0.72, '#393b37'); sky.addColorStop(1, '#1a1c1b'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const haze = ctx.createRadialGradient(width * .55, height * .31, 10, width * .55, height * .31, width * .52);
    haze.addColorStop(0, 'rgba(235, 206, 138, .20)'); haze.addColorStop(1, 'rgba(235, 206, 138, 0)'); ctx.fillStyle = haze; ctx.fillRect(0, 0, width, height);
    const buildings = [[0, .25, .3], [.11, .42, .21], [.2, .2, .34], [.35, .38, .25], [.47, .15, .33], [.6, .29, .28], [.73, .17, .36], [.88, .37, .22]];
    buildings.forEach(([x, top, buildingWidth], index) => {
      const bx = x * width; const by = top * height; const bw = buildingWidth * width; const bh = height - by;
      ctx.fillStyle = index % 2 ? '#454844' : '#3a3d3c'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#2f322f'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw * .72, by - 18); ctx.lineTo(bx + bw, by + 8); ctx.lineTo(bx + bw, by + 30); ctx.lineTo(bx, by + 30); ctx.closePath(); ctx.fill();
      for (let wy = by + 28; wy < height * .72; wy += 26) for (let wx = bx + 14; wx < bx + bw - 8; wx += 22) { ctx.fillStyle = ((wx + wy + index) % 3 === 0) ? '#1d201f' : 'rgba(202, 166, 92, .16)'; ctx.fillRect(wx, wy, 9, 12); }
    });
    ctx.fillStyle = 'rgba(28, 30, 28, .74)'; ctx.beginPath(); ctx.moveTo(0, height * .74); ctx.lineTo(width * .18, height * .65); ctx.lineTo(width * .43, height * .73); ctx.lineTo(width * .6, height * .62); ctx.lineTo(width, height * .71); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#202321'; ctx.fillRect(0, height * .83, width, height * .17); ctx.strokeStyle = 'rgba(205, 183, 127, .18)'; ctx.lineWidth = 2; ctx.setLineDash([20, 28]); ctx.beginPath(); ctx.moveTo(width * .47, height); ctx.lineTo(width * .53, height * .73); ctx.stroke(); ctx.setLineDash([]);
    const smoke = (x: number, y: number, size: number) => { for (let i = 0; i < 5; i += 1) { ctx.fillStyle = `rgba(36, 38, 36, ${.09 - i * .012})`; ctx.beginPath(); ctx.arc(x + i * size * .12, y - i * size * .3, size * (.28 + i * .11), 0, Math.PI * 2); ctx.fill(); } };
    smoke(width * .18, height * .57, 70); smoke(width * .79, height * .49, 92);
    ctx.fillStyle = '#2d302c'; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(0, height * .75); ctx.lineTo(width * .1, height * .67); ctx.lineTo(width * .2, height); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(width, height); ctx.lineTo(width, height * .7); ctx.lineTo(width * .86, height * .76); ctx.lineTo(width * .78, height); ctx.closePath(); ctx.fill();
    if (enemy) {
      const x = enemy.x * width; const base = enemy.groundY * height; const bodyHeight = enemy.height * height; const bodyWidth = bodyHeight * .34; const hit = enemy.outcome === 'hit'; const failed = enemy.outcome === 'miss' || enemy.outcome === 'escaped';
      ctx.save(); if (hit) { ctx.translate(x + bodyWidth * .42, base); ctx.rotate(.28); ctx.translate(-x, -base); }
      ctx.shadowBlur = hit ? 22 : 11; ctx.shadowColor = hit ? '#ff3f2e' : 'rgba(0,0,0,.8)'; ctx.fillStyle = hit ? '#9f2721' : failed ? '#242624' : '#141615'; ctx.fillRect(x - bodyWidth / 2, base - bodyHeight * .67, bodyWidth, bodyHeight * .65); ctx.beginPath(); ctx.arc(x, base - bodyHeight * .82, bodyWidth * .31, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hit ? '#ffd16e' : '#8c8c75'; ctx.fillRect(x - bodyWidth * .12, base - bodyHeight * .84, bodyWidth * .24, bodyWidth * .08); ctx.fillStyle = '#0e100f'; ctx.fillRect(x + bodyWidth * .25, base - bodyHeight * .57, bodyWidth * .62, bodyWidth * .12); ctx.restore(); ctx.shadowBlur = 0;
      if (hit) { ctx.strokeStyle = '#ffb14e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, base - bodyHeight * .55, bodyWidth * .9, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = enemy.cover === 'car' ? '#4c504b' : enemy.cover === 'window' ? '#292d2a' : '#3f413c'; ctx.fillRect(x - bodyWidth * .9, base - bodyHeight * .27, bodyWidth * 1.8, bodyHeight * .32); ctx.fillStyle = 'rgba(214, 192, 137, .18)'; ctx.fillRect(x - bodyWidth * .76, base - bodyHeight * .2, bodyWidth * .26, bodyHeight * .05);
    }
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(0, 0, width, 7); ctx.fillRect(0, height - 7, width, 7); if (shotFlash) { ctx.fillStyle = 'rgba(255, 224, 137, .13)'; ctx.fillRect(0, 0, width, height); }
  }, [enemy, shotFlash]);

  useEffect(() => { const arena = arenaRef.current; if (!arena) return; const observer = new ResizeObserver(drawScene); observer.observe(arena); drawScene(); return () => observer.disconnect(); }, [drawScene]);
  const finishGame = useCallback((finalHits: number) => { stopClock(); setEnemy(null); setTimeLeft(0); continuationRef.current = null; changeStatus(finalHits === 0 ? 'gameOver' : 'result'); }, [changeStatus, stopClock]);
  const beginRoundRef = useRef<(nextRound: number) => void>(() => undefined);
  const resolveRound = useCallback((outcome: Exclude<Outcome, null>) => {
    if (statusRef.current !== 'playing' || hasShotRef.current) return;
    stopClock(); hasShotRef.current = true; setHasShot(true); setTimeLeft(0); const currentRound = roundRef.current; const nextHits = hitsRef.current + (outcome === 'hit' ? 1 : 0); const nextMisses = missesRef.current + (outcome === 'hit' ? 0 : 1);
    hitsRef.current = nextHits; missesRef.current = nextMisses; setHits(nextHits); setMisses(nextMisses); setEnemy((current) => current ? { ...current, outcome } : null);
    const continueAfterEffect = () => { setEnemy(null); if (currentRound >= TOTAL_ROUNDS) { finishGame(nextHits); return; } schedule(gapFor(currentRound), () => beginRoundRef.current(currentRound + 1), false); };
    schedule(360, continueAfterEffect, false);
  }, [finishGame, hasShot, schedule, stopClock]);
  const startRound = useCallback((nextRound: number) => {
    if (statusRef.current !== 'playing') return; roundRef.current = nextRound; setRound(nextRound); hasShotRef.current = false; setHasShot(false); let nextSlot = Math.floor(Math.random() * ENEMY_SLOTS.length); if (ENEMY_SLOTS.length > 1 && nextSlot === lastSlotRef.current) nextSlot = (nextSlot + 1) % ENEMY_SLOTS.length; lastSlotRef.current = nextSlot; const slot = ENEMY_SLOTS[nextSlot]; setEnemy({ id: nextRound, ...slot, outcome: null }); const duration = visibleFor(nextRound); setTimeLeft(duration); schedule(duration, () => resolveRound('escaped'), true);
  }, [resolveRound, schedule]);
  beginRoundRef.current = startRound;
  const startGame = useCallback(() => { stopClock(); roundRef.current = 0; hitsRef.current = 0; missesRef.current = 0; hasShotRef.current = false; lastSlotRef.current = -1; setRound(0); setHits(0); setMisses(0); setEnemy(null); setHasShot(false); setTimeLeft(0); setShotFlash(false); changeStatus('playing'); schedule(500, () => startRound(1), false); }, [changeStatus, schedule, startRound, stopClock]);
  const pauseGame = useCallback(() => { if (statusRef.current !== 'playing' || !continuationRef.current) return; remainingRef.current = Math.max(0, deadlineRef.current - performance.now()); stopClock(); changeStatus('paused'); }, [changeStatus, stopClock]);
  const resumeGame = useCallback(() => { if (statusRef.current !== 'paused' || !continuationRef.current) return; changeStatus('playing'); schedule(Math.max(1, remainingRef.current), continuationRef.current, Boolean(enemy && !hasShot)); }, [changeStatus, enemy, hasShot, schedule]);
  useEffect(() => { const pauseOnLeave = () => pauseGame(); const onVisibility = () => { if (document.hidden) pauseGame(); }; window.addEventListener('blur', pauseOnLeave); document.addEventListener('visibilitychange', onVisibility); return () => { window.removeEventListener('blur', pauseOnLeave); document.removeEventListener('visibilitychange', onVisibility); stopClock(); }; }, [pauseGame, stopClock]);
  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => { const rect = event.currentTarget.getBoundingClientRect(); setCrosshair({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100, visible: true }); };
  const handleShot = (event: React.MouseEvent<HTMLDivElement>) => {
    if (statusRef.current !== 'playing' || !enemy || hasShotRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const targetX = enemy.x * rect.width; const base = enemy.groundY * rect.height; const targetHeight = enemy.height * rect.height; const targetWidth = targetHeight * .34; const inBody = Math.abs(x - targetX) < targetWidth * .58 && y > base - targetHeight && y < base; const inHead = Math.hypot(x - targetX, y - (base - targetHeight * .82)) < targetWidth * .38;
    setShotFlash(true); window.setTimeout(() => setShotFlash(false), 90); resolveRound(inBody || inHead ? 'hit' : 'miss');
  };
  const accuracy = percentage(hits, hits + misses); const timerPercent = round ? Math.max(0, Math.min(100, (timeLeft / visibleFor(round)) * 100)) : 0; const overlay = status !== 'playing';
  return <main className="game-shell"><section className="game-frame" aria-label="RUIN SIGHT 1인칭 슈팅 게임"><header className="mission-header"><div><p className="eyebrow">RUIN SIGHT / SECTOR 07</p><h1>폐허의 사수</h1></div><button className="pause-button" type="button" onClick={status === 'paused' ? resumeGame : pauseGame} disabled={status !== 'playing' && status !== 'paused'}>{status === 'paused' ? '▶ 계속하기' : 'Ⅱ 일시정지'}</button></header><div className="hud" aria-live="polite"><div><span>기회</span><strong>{String(round).padStart(2, '0')}<em>/20</em></strong></div><div><span>명중</span><strong className="hit-count">{String(hits).padStart(2, '0')}</strong></div><div><span>실패</span><strong>{String(misses).padStart(2, '0')}</strong></div><div className="accuracy"><span>명중률</span><strong>{accuracy}%</strong></div></div><div className="arena" ref={arenaRef} onMouseMove={handleMove} onMouseEnter={() => setCrosshair((point) => ({ ...point, visible: true }))} onMouseLeave={() => setCrosshair((point) => ({ ...point, visible: false }))} onClick={handleShot}><canvas ref={canvasRef} className="scene" aria-label="도시 폐허 전장" /><div className={`crosshair ${crosshair.visible && status === 'playing' ? 'visible' : ''}`} style={{ left: `${crosshair.x}%`, top: `${crosshair.y}%` }} aria-hidden="true"><i /><b /><i /><b /></div><div className="rifle" aria-hidden="true"><div className="rifle-stock" /><div className="rifle-body" /><div className="rifle-barrel" /><div className="rifle-sight" /></div>{status === 'playing' && enemy && !hasShot && <div className="timer"><span style={{ width: `${timerPercent}%` }} /></div>}{overlay && <div className="overlay">{status === 'ready' && <><p className="overlay-kicker">LONG RANGE PROTOCOL</p><h2>한 발의 판단.<br />스무 번의 기회.</h2><p>마우스로 조준점을 움직이고, 적이 보일 때 좌클릭하세요.<br />각 적에게 발사할 수 있는 탄환은 한 발뿐입니다.</p><button className="primary-button" type="button" onClick={startGame}>작전 시작</button></>}{status === 'paused' && <><p className="overlay-kicker">MISSION PAUSED</p><h2>전장 정지</h2><p>남은 시간은 안전하게 보존되었습니다.</p><button className="primary-button" type="button" onClick={resumeGame}>계속하기</button></>}{status === 'result' && <><p className="overlay-kicker">MISSION COMPLETE</p><h2>{hits} / 20 명중</h2><p>명중률 {accuracy}% · 실패 {misses}회<br />당신의 판단은 폐허 속에서 빛났습니다.</p><button className="primary-button" type="button" onClick={startGame}>다시 시작</button></>}{status === 'gameOver' && <><p className="overlay-kicker danger">NO CONTACT</p><h2>GAME OVER</h2><p>스무 번의 기회 동안 단 한 번도 적중하지 못했습니다.<br />조준점을 더 오래 적 위에 두고 발사해 보세요.</p><button className="primary-button danger-button" type="button" onClick={startGame}>재도전</button></>}</div>}</div><footer className="briefing"><span>마우스 이동: 조준</span><span>좌클릭: 단발 사격</span><span>적 노출 시간은 점점 짧아집니다</span></footer></section></main>;
}
