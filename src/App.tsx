import { useState, useEffect, useRef, useCallback, KeyboardEvent, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Settings, 
  ShoppingBag, 
  Trophy, 
  RotateCcw, 
  Zap,
  ChevronLeft,
  ChevronRight,
  ArrowUp
} from 'lucide-react';

// --- Constants ---
const LANES = 3;
const LANE_WIDTH = 100;
const PLAYER_SIZE = 40;
const OBSTACLE_SIZE = 50;
const AURA_SIZE = 30;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const FLOW_STATE_DURATION = 10000; // 10s

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'SHOP';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  glow: boolean;
}

interface Obstacle {
  id: number;
  lane: number;
  y: number;
  type: 'BLOCK' | 'AURA';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('vibe-surfer-highscore');
    return saved ? parseInt(saved) : 0;
  });
  const [auraCount, setAuraCount] = useState(0);
  const [isFlowState, setIsFlowState] = useState(false);
  const [playerLane, setPlayerLane] = useState(1); // 0, 1, 2
  const [gameOverText, setGameOverText] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const speedRef = useRef(INITIAL_SPEED);
  const lastTimeRef = useRef<number>(0);
  const flowStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOverMessages = [
    "Aura points deducted.",
    "Bro forgot how to swipe.",
    "Touch grass (or just try again).",
    "L + Ratio + Crashed.",
    "Main character energy depleted.",
    "Skill issue detected.",
    "Vibe check failed."
  ];

  // --- Game Logic ---

  const spawnObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES);
    const isAura = Math.random() > 0.8;
    const newObstacle: Obstacle = {
      id: Date.now() + Math.random(),
      lane,
      y: -100,
      type: isAura ? 'AURA' : 'BLOCK'
    };
    obstaclesRef.current.push(newObstacle);
  }, []);

  const createParticles = (x: number, y: number, color: string, count = 10, options: Partial<Particle> = {}) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: Math.random() * 0.5 + 0.5,
        color,
        size: Math.random() * 4 + 2,
        glow: options.glow ?? true,
        ...options
      });
    }
  };

  const triggerShake = (duration = 200) => {
    setIsShaking(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setIsShaking(false), duration);
  };

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
    setAuraCount(0);
    setIsFlowState(false);
    setPlayerLane(1);
    speedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    particlesRef.current = [];
    lastTimeRef.current = performance.now();
  };

  const endGame = () => {
    setGameState('GAME_OVER');
    setGameOverText(gameOverMessages[Math.floor(Math.random() * gameOverMessages.length)]);
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('vibe-surfer-highscore', score.toString());
    }
    if (flowStateTimerRef.current) clearTimeout(flowStateTimerRef.current);
  };

  const activateFlowState = () => {
    setIsFlowState(true);
    setAuraCount(0);
    triggerShake(500);
    
    // Massive burst
    createParticles(window.innerWidth / 2, window.innerHeight / 2, '#00ffff', 100, { size: 6, glow: true });
    createParticles(window.innerWidth / 2, window.innerHeight / 2, '#ff00ff', 50, { size: 4, glow: true });
    
    if (flowStateTimerRef.current) clearTimeout(flowStateTimerRef.current);
    flowStateTimerRef.current = setTimeout(() => {
      setIsFlowState(false);
    }, FLOW_STATE_DURATION);
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING') return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Increase speed
    speedRef.current += SPEED_INCREMENT;

    // Spawn obstacles
    if (Math.random() < 0.02 * (speedRef.current / 5)) {
      spawnObstacle();
    }

    // Update obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => {
      obs.y += speedRef.current;

      // Collision detection
      const canvas = canvasRef.current;
      if (canvas) {
        const laneX = (canvas.width / 2) - (LANE_WIDTH * 1.5) + (obs.lane * LANE_WIDTH) + (LANE_WIDTH / 2);
        const playerX = (canvas.width / 2) - (LANE_WIDTH * 1.5) + (playerLane * LANE_WIDTH) + (LANE_WIDTH / 2);
        const playerY = canvas.height - 100;

        const dx = Math.abs(laneX - playerX);
        const dy = Math.abs(obs.y - playerY);

        if (dx < (PLAYER_SIZE + OBSTACLE_SIZE) / 2 && dy < (PLAYER_SIZE + OBSTACLE_SIZE) / 2) {
          if (obs.type === 'AURA') {
            setAuraCount(prev => {
              const next = prev + 1;
              if (next >= 10 && !isFlowState) {
                activateFlowState();
              }
              return next;
            });
            // Enhanced Aura collection effect
            createParticles(laneX, obs.y, '#00ffff', 20, { size: 5, glow: true });
            createParticles(laneX, obs.y, '#ffffff', 10, { size: 2, glow: false });
            triggerShake(100);
            return false;
          } else {
            if (isFlowState) {
              createParticles(laneX, obs.y, '#ff00ff', 30, { size: 6, glow: true });
              setScore(s => s + 50);
              triggerShake(150);
              return false;
            } else {
              endGame();
              return false;
            }
          }
        }
      }

      return obs.y < window.innerHeight + 100;
    });

    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98; // Friction
      p.vy *= 0.98;
      p.life -= 0.02 / p.maxLife;
      return p.life > 0;
    });

    // Player Trail
    const canvas = canvasRef.current;
    if (canvas) {
      const centerX = canvas.width / 2;
      const startX = centerX - (LANE_WIDTH * 1.5);
      const playerX = startX + playerLane * LANE_WIDTH + (LANE_WIDTH / 2);
      const playerY = canvas.height - 100;
      
      if (Math.random() < (isFlowState ? 0.8 : 0.3)) {
        createParticles(playerX, playerY + 20, isFlowState ? '#ff00ff' : '#00ffff', 1, {
          vx: (Math.random() - 0.5) * 2,
          vy: speedRef.current * 0.5,
          size: isFlowState ? 8 : 4,
          glow: isFlowState,
          maxLife: 0.3
        });
      }
    }

    setScore(s => s + 1);

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Screen Shake
    if (isShaking) {
      const sx = (Math.random() - 0.5) * 10;
      const sy = (Math.random() - 0.5) * 10;
      ctx.translate(sx, sy);
    }

    // Draw Highway
    const centerX = canvas.width / 2;
    const startX = centerX - (LANE_WIDTH * 1.5);

    // Perspective lines
    ctx.strokeStyle = isFlowState ? '#ff00ff' : '#bc13fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= LANES; i++) {
      const x = startX + i * LANE_WIDTH;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    // Horizontal moving lines
    ctx.globalAlpha = 0.3;
    const lineSpacing = 100;
    const offset = (performance.now() * speedRef.current * 0.1) % lineSpacing;
    for (let y = offset; y < canvas.height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + LANES * LANE_WIDTH, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Draw Obstacles
    obstaclesRef.current.forEach(obs => {
      const x = startX + obs.lane * LANE_WIDTH + (LANE_WIDTH / 2);
      ctx.shadowBlur = 15;
      ctx.shadowColor = obs.type === 'AURA' ? '#00ffff' : '#ff00ff';
      
      if (obs.type === 'AURA') {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(x, obs.y, AURA_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(x - OBSTACLE_SIZE / 2, obs.y - OBSTACLE_SIZE / 2, OBSTACLE_SIZE, OBSTACLE_SIZE);
      }
      ctx.shadowBlur = 0;
    });

    // Draw Player
    const playerX = startX + playerLane * LANE_WIDTH + (LANE_WIDTH / 2);
    const playerY = canvas.height - 100;
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = isFlowState ? '#00ffff' : '#bc13fe';
    ctx.fillStyle = isFlowState ? '#00ffff' : 'white';
    
    // Simple surfer shape
    ctx.beginPath();
    ctx.moveTo(playerX, playerY - PLAYER_SIZE / 2);
    ctx.lineTo(playerX - PLAYER_SIZE / 2, playerY + PLAYER_SIZE / 2);
    ctx.lineTo(playerX + PLAYER_SIZE / 2, playerY + PLAYER_SIZE / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowBlur = 10 * p.life;
        ctx.shadowColor = p.color;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1.0;

    // Reset translation if shaking
    if (isShaking) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  // --- Input Handlers ---
  const handleKeyDown = (e: KeyboardEvent) => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowLeft') setPlayerLane(l => Math.max(0, l - 1));
    if (e.key === 'ArrowRight') setPlayerLane(l => Math.min(LANES - 1, l + 1));
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) {
      setPlayerLane(l => Math.max(0, l - 1));
    } else {
      setPlayerLane(l => Math.min(LANES - 1, l + 1));
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#050505] font-sans overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onTouchStart={handleTouchStart}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#bc13fe,transparent_70%)]" />
      </div>

      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* UI Overlays */}
      <AnimatePresence>
        {gameState === 'MENU' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10"
          >
            <motion.h1 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="text-6xl md:text-8xl font-display font-bold tracking-tighter mb-2 glow-text italic"
            >
              VIBE SURFER
            </motion.h1>
            <p className="text-neon-blue font-mono text-sm tracking-widest mb-12 opacity-80">ZERO PING // OFFLINE EDITION</p>
            
            <div className="flex flex-col gap-4 w-64">
              <button 
                onClick={startGame}
                className="group relative flex items-center justify-center gap-3 bg-white text-black py-4 rounded-full font-bold text-xl transition-all hover:scale-105 active:scale-95 overflow-hidden"
              >
                <Play fill="currentColor" size={24} />
                START SURFING
                <div className="absolute inset-0 bg-neon-blue/20 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition-all">
                  <ShoppingBag size={20} />
                  <span className="text-sm font-medium">AURA</span>
                </button>
                <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition-all">
                  <Settings size={20} />
                  <span className="text-sm font-medium">VIBES</span>
                </button>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-2 text-white/40 font-mono text-xs">
              <Trophy size={14} />
              BEST: {highScore.toLocaleString()}
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Score</span>
                <span className="text-4xl font-display font-bold glow-text">{score.toLocaleString()}</span>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Aura</span>
                <div className="flex gap-1 mt-1">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i}
                      className={`w-2 h-6 rounded-full transition-all duration-300 ${
                        i < auraCount 
                          ? 'bg-neon-blue shadow-[0_0_10px_#00ffff]' 
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {isFlowState && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                <div className="text-6xl font-display font-black italic glow-pink animate-pulse">FLOW STATE</div>
                <div className="text-sm font-mono text-neon-pink tracking-[0.5em] mt-2">INVINCIBLE</div>
              </motion.div>
            )}

            <div className="flex justify-center gap-12 mb-8 md:hidden">
               <div className="flex flex-col items-center opacity-30">
                  <ChevronLeft size={32} />
                  <span className="text-[10px] font-mono mt-1">SWIPE</span>
               </div>
               <div className="flex flex-col items-center opacity-30">
                  <ArrowUp size={32} />
                  <span className="text-[10px] font-mono mt-1">AIR</span>
               </div>
               <div className="flex flex-col items-center opacity-30">
                  <ChevronRight size={32} />
                  <span className="text-[10px] font-mono mt-1">SWIPE</span>
               </div>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-20"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-neon-pink font-display text-2xl font-bold mb-2 uppercase tracking-tighter">Vibe Check Failed</h2>
              <div className="text-5xl font-display font-black mb-8 italic text-white">{gameOverText}</div>
              
              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl mb-8">
                <div className="grid grid-cols-2 gap-12">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-white/40 uppercase mb-1">Final Score</span>
                    <span className="text-3xl font-display font-bold">{score.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-white/40 uppercase mb-1">Best Run</span>
                    <span className="text-3xl font-display font-bold text-neon-blue">{highScore.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={startGame}
                  className="flex items-center justify-center gap-3 bg-white text-black py-4 px-12 rounded-full font-bold text-xl transition-all hover:scale-105 active:scale-95"
                >
                  <RotateCcw size={24} />
                  RUN IT BACK
                </button>
                <button 
                  onClick={() => setGameState('MENU')}
                  className="text-white/40 hover:text-white transition-colors font-mono text-sm uppercase tracking-widest"
                >
                  Back to Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flow State Screen Flash */}
      <AnimatePresence>
        {isFlowState && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neon-pink pointer-events-none z-0"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
