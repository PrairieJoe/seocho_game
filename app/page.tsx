'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type GameStatus = 'ready' | 'playing' | 'paused' | 'gameOver';
type Enemy = { x: number; y: number; radius: number; speed: number; hp: number; maxHp: number; elite: boolean };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };
type Engine = {
  width: number; height: number; player: { x: number; y: number; health: number; invulnerable: number };
  enemies: Enemy[]; bullets: Bullet[]; particles: Particle[]; keys: Set<string>;
  elapsed: number; score: number; spawnClock: number; autoFireClock: number; manualFireClock: number; hudClock: number; lastFrame: number;
};

const STORAGE_KEY = 'neon-survivor-high-score-v1';
const SETTINGS = { playerSpeed: 315, autoFireEvery: 0.42, manualFireEvery: 0.14, bulletSpeed: 620, difficultyEvery: 20, startingSpawnEvery: 1.05, minimumSpawnEvery: 0.25, maxEnemies: 70 } as const;
const getTier = (elapsed: number) => Math.floor(elapsed / SETTINGS.difficultyEvery) + 1;
const getSpawnEvery = (tier: number) => Math.max(SETTINGS.minimumSpawnEvery, SETTINGS.startingSpawnEvery - (tier - 1) * 0.1);
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const freshEngine = (): Engine => ({ width: 960, height: 580, player: { x: 480, y: 290, health: 3, invulnerable: 0 }, enemies: [], bullets: [], particles: [], keys: new Set(), elapsed: 0, score: 0, spawnClock: 0, autoFireClock: 0, manualFireClock: 0, hudClock: 0, lastFrame: performance.now() });

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const statusRef = useRef<GameStatus>('ready');
  const [status, setStatus] = useState<GameStatus>('ready');
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [health, setHealth] = useState(3);
  const [highScore, setHighScore] = useState(0);

  const publishHud = useCallback((engine: Engine) => { setScore(engine.score); setElapsed(engine.elapsed); setHealth(engine.player.health); }, []);
  const setGameStatus = useCallback((next: GameStatus) => { statusRef.current = next; setStatus(next); }, []);
  const shootAt = useCallback((targetX: number, targetY: number) => {
    const engine = engineRef.current;
    if (!engine || statusRef.current !== 'playing') return;
    const dx = targetX - engine.player.x; const dy = targetY - engine.player.y; const distance = Math.hypot(dx, dy) || 1;
    engine.bullets.push({ x: engine.player.x, y: engine.player.y, vx: (dx / distance) * SETTINGS.bulletSpeed, vy: (dy / distance) * SETTINGS.bulletSpeed, life: 1.35 });
  }, []);
  const resetGame = useCallback(() => {
    const previous = engineRef.current; const engine = freshEngine();
    if (previous) { engine.width = previous.width; engine.height = previous.height; engine.player.x = engine.width / 2; engine.player.y = engine.height / 2; }
    engineRef.current = engine; publishHud(engine); setGameStatus('playing');
  }, [publishHud, setGameStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const saved = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '0', 10); setHighScore(Number.isFinite(saved) && saved > 0 ? saved : 0); } catch { setHighScore(0); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current = freshEngine();
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio)); canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const engine = engineRef.current;
      if (engine) { engine.width = Math.max(1, rect.width); engine.height = Math.max(1, rect.height); engine.player.x = Math.min(Math.max(engine.player.x, 22), engine.width - 22); engine.player.y = Math.min(Math.max(engine.player.y, 22), engine.height - 22); }
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const trackedKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
    const onKeyDown = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if (trackedKeys.includes(key)) { event.preventDefault(); engineRef.current?.keys.add(key); } };
    const onKeyUp = (event: KeyboardEvent) => engineRef.current?.keys.delete(event.key.toLowerCase());
    const onVisibility = () => { if (document.hidden && statusRef.current === 'playing') setGameStatus('paused'); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); document.addEventListener('visibilitychange', onVisibility);

    const burst = (engine: Engine, x: number, y: number, color: string, amount: number) => {
      for (let i = 0; i < amount; i += 1) { const angle = Math.random() * Math.PI * 2; const speed = 35 + Math.random() * 120; const life = 0.25 + Math.random() * 0.38; engine.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color }); }
    };
    const spawnEnemy = (engine: Engine, tier: number) => {
      if (engine.enemies.length >= SETTINGS.maxEnemies) return;
      const edge = Math.floor(Math.random() * 4); const padding = 34; let x = 0; let y = 0;
      if (edge === 0) { x = Math.random() * engine.width; y = -padding; } else if (edge === 1) { x = engine.width + padding; y = Math.random() * engine.height; } else if (edge === 2) { x = Math.random() * engine.width; y = engine.height + padding; } else { x = -padding; y = Math.random() * engine.height; }
      const elite = engine.elapsed >= 60 && Math.random() < Math.min(0.38, 0.16 + (tier - 4) * 0.025); const hp = 1 + Math.floor((tier - 1) / 3) + (elite ? 2 : 0);
      engine.enemies.push({ x, y, radius: elite ? 18 : 13, speed: (elite ? 103 : 72) * (1 + (tier - 1) * 0.13) * (0.85 + Math.random() * 0.3), hp, maxHp: hp, elite });
    };
    const update = (engine: Engine, dt: number) => {
      if (statusRef.current !== 'playing') return;
      engine.elapsed += dt; engine.spawnClock += dt; engine.autoFireClock += dt; engine.manualFireClock = Math.max(0, engine.manualFireClock - dt); engine.hudClock += dt; engine.player.invulnerable = Math.max(0, engine.player.invulnerable - dt);
      const tier = getTier(engine.elapsed); let moveX = 0; let moveY = 0;
      if (engine.keys.has('w') || engine.keys.has('arrowup')) moveY -= 1; if (engine.keys.has('s') || engine.keys.has('arrowdown')) moveY += 1; if (engine.keys.has('a') || engine.keys.has('arrowleft')) moveX -= 1; if (engine.keys.has('d') || engine.keys.has('arrowright')) moveX += 1;
      const magnitude = Math.hypot(moveX, moveY) || 1;
      engine.player.x = Math.min(engine.width - 18, Math.max(18, engine.player.x + (moveX / magnitude) * SETTINGS.playerSpeed * dt)); engine.player.y = Math.min(engine.height - 18, Math.max(18, engine.player.y + (moveY / magnitude) * SETTINGS.playerSpeed * dt));
      if (engine.spawnClock >= getSpawnEvery(tier)) { engine.spawnClock = 0; spawnEnemy(engine, tier); }
      if (engine.autoFireClock >= SETTINGS.autoFireEvery && engine.enemies.length) { engine.autoFireClock = 0; const nearest = engine.enemies.reduce((best, enemy) => Math.hypot(enemy.x - engine.player.x, enemy.y - engine.player.y) < Math.hypot(best.x - engine.player.x, best.y - engine.player.y) ? enemy : best); shootAt(nearest.x, nearest.y); }
      for (const bullet of engine.bullets) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt; }
      engine.bullets = engine.bullets.filter((bullet) => bullet.life > 0 && bullet.x > -30 && bullet.x < engine.width + 30 && bullet.y > -30 && bullet.y < engine.height + 30);
      for (const enemy of engine.enemies) { const dx = engine.player.x - enemy.x; const dy = engine.player.y - enemy.y; const distance = Math.hypot(dx, dy) || 1; enemy.x += (dx / distance) * enemy.speed * dt; enemy.y += (dy / distance) * enemy.speed * dt; }
      for (let bulletIndex = engine.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) { const bullet = engine.bullets[bulletIndex]; const enemyIndex = engine.enemies.findIndex((enemy) => Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + 5); if (enemyIndex >= 0) { const enemy = engine.enemies[enemyIndex]; enemy.hp -= 1; engine.bullets.splice(bulletIndex, 1); burst(engine, bullet.x, bullet.y, enemy.elite ? '#fbbf24' : '#ff4d8d', 4); if (enemy.hp <= 0) { engine.score += enemy.elite ? 45 : 10; burst(engine, enemy.x, enemy.y, enemy.elite ? '#fbbf24' : '#fb4b86', enemy.elite ? 18 : 10); engine.enemies.splice(enemyIndex, 1); } } }
      for (let index = engine.enemies.length - 1; index >= 0; index -= 1) { const enemy = engine.enemies[index]; if (Math.hypot(enemy.x - engine.player.x, enemy.y - engine.player.y) < enemy.radius + 14 && engine.player.invulnerable <= 0) { engine.enemies.splice(index, 1); engine.player.health -= 1; engine.player.invulnerable = 1.05; burst(engine, engine.player.x, engine.player.y, '#61f5ff', 20); if (engine.player.health <= 0) { const finalScore = engine.score; try { const saved = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '0', 10); const next = Math.max(Number.isFinite(saved) ? saved : 0, finalScore); window.localStorage.setItem(STORAGE_KEY, String(next)); setHighScore(next); } catch { /* Local storage is optional. */ } publishHud(engine); setGameStatus('gameOver'); } break; } }
      for (const particle of engine.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; } engine.particles = engine.particles.filter((particle) => particle.life > 0);
      if (engine.hudClock > 0.12) { engine.hudClock = 0; publishHud(engine); }
    };
    const draw = (engine: Engine) => {
      const context = canvas.getContext('2d'); if (!context) return; const ratio = Math.min(window.devicePixelRatio || 1, 2); context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, engine.width, engine.height);
      const background = context.createRadialGradient(engine.width / 2, engine.height / 2, 0, engine.width / 2, engine.height / 2, Math.max(engine.width, engine.height) * .72); background.addColorStop(0, '#17203e'); background.addColorStop(1, '#070a18'); context.fillStyle = background; context.fillRect(0, 0, engine.width, engine.height);
      context.strokeStyle = 'rgba(112,159,255,.12)'; context.lineWidth = 1; for (let x = 0; x < engine.width; x += 38) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, engine.height); context.stroke(); } for (let y = 0; y < engine.height; y += 38) { context.beginPath(); context.moveTo(0, y); context.lineTo(engine.width, y); context.stroke(); }
      for (const particle of engine.particles) { context.globalAlpha = particle.life / particle.maxLife; context.fillStyle = particle.color; context.fillRect(particle.x - 2, particle.y - 2, 4, 4); } context.globalAlpha = 1;
      for (const bullet of engine.bullets) { context.shadowBlur = 14; context.shadowColor = '#7df9ff'; context.fillStyle = '#d9feff'; context.beginPath(); context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2); context.fill(); } context.shadowBlur = 0;
      for (const enemy of engine.enemies) { context.save(); context.translate(enemy.x, enemy.y); context.rotate(engine.elapsed * (enemy.elite ? 2.8 : 1.5)); context.shadowBlur = enemy.elite ? 20 : 12; context.shadowColor = enemy.elite ? '#fbbf24' : '#fb4b86'; context.fillStyle = enemy.elite ? '#fbbf24' : '#fb4b86'; context.beginPath(); for (let point = 0; point < 6; point += 1) { const angle = point * Math.PI / 3; const radius = point % 2 === 0 ? enemy.radius : enemy.radius * .66; const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius; if (point === 0) context.moveTo(px, py); else context.lineTo(px, py); } context.closePath(); context.fill(); context.restore(); if (enemy.maxHp > 1) { context.fillStyle = 'rgba(255,255,255,.15)'; context.fillRect(enemy.x - 15, enemy.y - enemy.radius - 10, 30, 3); context.fillStyle = enemy.elite ? '#fff2a8' : '#ffb1ca'; context.fillRect(enemy.x - 15, enemy.y - enemy.radius - 10, 30 * (enemy.hp / enemy.maxHp), 3); } }
      const blinking = engine.player.invulnerable > 0 && Math.floor(engine.player.invulnerable * 14) % 2 === 0; if (!blinking) { context.save(); context.translate(engine.player.x, engine.player.y); context.shadowBlur = 22; context.shadowColor = '#61f5ff'; context.fillStyle = '#61f5ff'; context.beginPath(); context.moveTo(0, -18); context.lineTo(13, 14); context.lineTo(0, 9); context.lineTo(-13, 14); context.closePath(); context.fill(); context.fillStyle = '#e7ffff'; context.beginPath(); context.arc(0, 2, 4, 0, Math.PI * 2); context.fill(); context.restore(); } context.shadowBlur = 0;
    };
    let frameId = 0; const loop = (now: number) => { const engine = engineRef.current; if (engine) { const dt = Math.min(.05, Math.max(0, (now - engine.lastFrame) / 1000)); engine.lastFrame = now; update(engine, dt); draw(engine); } frameId = requestAnimationFrame(loop); }; frameId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); document.removeEventListener('visibilitychange', onVisibility); };
  }, [publishHud, setGameStatus, shootAt]);

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => { const engine = engineRef.current; if (!engine || statusRef.current !== 'playing' || engine.manualFireClock > 0) return; const rect = event.currentTarget.getBoundingClientRect(); engine.manualFireClock = SETTINGS.manualFireEvery; shootAt(event.clientX - rect.left, event.clientY - rect.top); };
  const tier = getTier(elapsed); const actionLabel = status === 'paused' ? '계속하기' : status === 'gameOver' ? '다시 시작' : '게임 시작';

  return <main className="game-shell"><section className="game-card" aria-label="Neon Survivor top-down shooter game"><header className="game-header"><div><p className="eyebrow">NEON SURVIVOR</p><h1>끝까지 버텨라</h1></div><button className="soundless-button" type="button" onClick={() => setGameStatus(status === 'playing' ? 'paused' : 'playing')} disabled={status === 'ready' || status === 'gameOver'}>{status === 'playing' ? 'Ⅱ 일시정지' : '▶ 재개'}</button></header><div className="hud" aria-live="polite"><div className="hud-item"><span>점수</span><strong>{score.toLocaleString()}</strong></div><div className="hud-item"><span>생존</span><strong>{formatTime(elapsed)}</strong></div><div className="hud-item"><span>위험도</span><strong>LV. {tier}</strong></div><div className="hud-item health"><span>에너지</span><strong>{Array.from({ length: 3 }, (_, index) => <i key={index} className={index < health ? 'active' : ''}>◆</i>)}</strong></div></div><div className="arena-wrap"><canvas ref={canvasRef} className="game-canvas" onPointerDown={handleCanvasPointerDown} aria-label="게임 화면: 키보드로 움직이고 마우스로 발사합니다." />{status !== 'playing' && <div className="game-overlay">{status === 'ready' && <><p className="overlay-kicker">SURVIVAL PROTOCOL</p><h2>한 번 더,<br />빛나는 밤을.</h2><p>WASD 또는 방향키로 이동하세요.<br />가까운 적을 자동 공격하며, 클릭으로 직접 발사합니다.</p></>}{status === 'paused' && <><p className="overlay-kicker">PAUSED</p><h2>전투 일시정지</h2><p>잠시 숨을 고른 뒤 다시 적 무리 속으로 뛰어드세요.</p></>}{status === 'gameOver' && <><p className="overlay-kicker">SYSTEM OFFLINE</p><h2>기록: {score.toLocaleString()}점</h2><p>{formatTime(elapsed)} 동안 버텼습니다.<br />최고 기록은 {highScore.toLocaleString()}점입니다.</p></>}<button className="primary-button" type="button" onClick={resetGame}>{actionLabel}</button></div>}</div><footer className="game-footer"><span>자동 사격 활성화</span><span>클릭: 커서 방향 사격</span><span>20초마다 위험도 상승</span><span>최고 기록 {highScore.toLocaleString()}</span></footer></section></main>;
}
