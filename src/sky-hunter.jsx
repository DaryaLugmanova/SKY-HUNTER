import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Zap, Shield, TrendingUp, Clock } from 'lucide-react';

const SkyHunter = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [activeBuffs, setActiveBuffs] = useState({
    speed: false,
    shield: false,
    double: false,
    slow: false,
    invincible: false
  });
  const buffTimeoutsRef = useRef({});
  const keyStateRef = useRef({
    left: false,
    right: false,
    up: false,
    space: false
  });

  const gameRef = useRef({
    swift: { x: 100, y: 300, velocity: 0, rotation: 0, wingFlap: 0 },
    clouds: [],
    insects: [],
    fly: null,
    particles: [],
    camera: 0,
    speed: 2,
    speedFactor: 1,
    flapCooldown: 0,
    comboCount: 0,
    lastFlySpawn: 0,
    insectsCollected: 0,
    invincibleTimer: 0,
    cloudHitCooldown: 0,
    isMobile: false
  });

  const lastTimeRef = useRef(performance.now());

  // Game constants
  const GRAVITY = 0.22;
  const JUMP_FORCE = -6.2;
  const BASE_SPEED = 2;

  const computeSpeed = useCallback((buffs) => {
    if (buffs.slow) return 1;
    if (buffs.speed) return 3.5;
    return BASE_SPEED;
  }, []);

  const clampSpeedFactor = (value) => Math.min(1.6, Math.max(0.6, value));

  const COLORS = {
    gray: { points: 1, color: '#9CA3AF', buff: null },
    green: { points: 2, color: '#10B981', buff: 'speed' },
    yellow: { points: 3, color: '#FBBF24', buff: 'shield' },
    red: { points: 5, color: '#EF4444', buff: 'double' },
    purple: { points: 8, color: '#8B5CF6', buff: 'slow' }
  };

  const INSECT_TYPES = Object.keys(COLORS);

  useEffect(() => {
    gameRef.current.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const spawnCloud = useCallback(() => {
    const game = gameRef.current;
    return {
      x: game.camera + 800 + Math.random() * 200,
      y: Math.random() * 500 + 50,
      width: 80 + Math.random() * 100,
      height: 40 + Math.random() * 40,
      speedMod: 0.3 + Math.random() * 0.4,
      opacity: 0.6 + Math.random() * 0.4
    };
  }, []);

  const spawnInsect = useCallback(() => {
    const game = gameRef.current;
    const type = INSECT_TYPES[Math.floor(Math.random() * INSECT_TYPES.length)];
    return {
      x: game.camera + 800 + Math.random() * 300,
      y: Math.random() * 500 + 50,
      type,
      size: 12,
      bobOffset: Math.random() * Math.PI * 2,
      speedMod: 0.5 + Math.random() * 0.3,
      shimmer: Math.random() * Math.PI * 2
    };
  }, []);

  const spawnFly = useCallback(() => {
    const game = gameRef.current;
    return {
      x: game.camera + 800,
      y: Math.random() * 400 + 100,
      size: 25,
      bobOffset: 0,
      pulse: 0
    };
  }, []);

  // Initial spawn functions (for game start)
  const spawnCloudInitial = useCallback((index) => {
    return {
      x: 200 + index * 100 + Math.random() * 50,
      y: Math.random() * 500 + 50,
      width: 80 + Math.random() * 100,
      height: 40 + Math.random() * 40,
      speedMod: 0.3 + Math.random() * 0.4,
      opacity: 0.6 + Math.random() * 0.4
    };
  }, []);

  const spawnInsectInitial = useCallback((index) => {
    const type = INSECT_TYPES[Math.floor(Math.random() * INSECT_TYPES.length)];
    return {
      x: 200 + index * 60 + Math.random() * 40,
      y: Math.random() * 500 + 50,
      type,
      size: 12,
      bobOffset: Math.random() * Math.PI * 2,
      speedMod: 0.5 + Math.random() * 0.3,
      shimmer: Math.random() * Math.PI * 2
    };
  }, []);

  const createCollectionParticles = useCallback((x, y, color) => {
    const game = gameRef.current;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 30,
        maxLife: 30,
        color,
        type: 'flash'
      });
    }
  }, []);

  const createCloudHitParticles = useCallback((x, y) => {
    const game = gameRef.current;
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40,
        maxLife: 40,
        color: '#FFFFFF',
        type: 'smoke',
        size: Math.random() * 10 + 5
      });
    }
  }, []);

  const checkCollision = useCallback((a, b, aSize, bSize) => {
    const distance = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    return distance < aSize + bSize;
  }, []);

  const activateBuff = useCallback((buff) => {
    if (!buff) return;
    
    const game = gameRef.current;
    if (buffTimeoutsRef.current[buff]) {
      clearTimeout(buffTimeoutsRef.current[buff]);
    }

    setActiveBuffs(prev => {
      const next = { ...prev, [buff]: true };
      if (buff === 'speed' || buff === 'slow') {
        game.speed = computeSpeed(next);
      }
      return next;
    });
    
    buffTimeoutsRef.current[buff] = setTimeout(() => {
      setActiveBuffs(prev => {
        const next = { ...prev, [buff]: false };
        if (buff === 'speed' || buff === 'slow') {
          game.speed = computeSpeed(next);
        }
        return next;
      });
      buffTimeoutsRef.current[buff] = null;
    }, 3000);
  }, [computeSpeed]);

  const resetGame = useCallback(() => {
    const game = gameRef.current;

    game.swift = { x: 100, y: 300, velocity: 0, rotation: 0, wingFlap: 0 };
    game.clouds = [];
    game.insects = [];
    game.fly = null;
    game.particles = [];
    game.camera = 0;
    game.speed = BASE_SPEED;
    game.speedFactor = 1;
    game.flapCooldown = 0;
    game.comboCount = 0;
    game.lastFlySpawn = 0;
    game.insectsCollected = 0;
    game.invincibleTimer = 0;
    game.cloudHitCooldown = 0;

    setScore(0);
    setLives(3);
    setCombo(0);
    setIsPaused(false);
    setActiveBuffs({
      speed: false,
      shield: false,
      double: false,
      slow: false,
      invincible: false
    });
    Object.values(buffTimeoutsRef.current).forEach((timerId) => {
      if (timerId) clearTimeout(timerId);
    });
    buffTimeoutsRef.current = {};
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    const game = gameRef.current;
    game.clouds = Array(4).fill(0).map((_, i) => spawnCloudInitial(i));
    game.insects = Array(12).fill(0).map((_, i) => spawnInsectInitial(i));
    lastTimeRef.current = performance.now();
    setGameState('playing');
  }, [resetGame, spawnCloudInitial, spawnInsectInitial]);

  useEffect(() => {
    const handleGlobalEnter = (e) => {
      if (e.code !== 'Enter' && e.key !== 'Enter') return;
      e.preventDefault();

      if (gameState === 'menu' || gameState === 'gameOver') {
        startGame();
        return;
      }

      if (gameState === 'playing') {
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalEnter);
    return () => window.removeEventListener('keydown', handleGlobalEnter);
  }, [gameState, startGame]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    let animationId;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = 800 * dpr;
    canvas.height = 600 * dpr;
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const flap = () => {
      if (!isPaused) {
        game.swift.velocity = JUMP_FORCE;
      }
    };

    // Universal input handlers
    const handleMouseDown = () => flap();
    const handleTouchStart = (e) => {
      e.preventDefault();
      flap();
    };
    const handleKeyDown = (e) => {
      const code = e.code;
      if (code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Space') {
        e.preventDefault();
      }

      if (code === 'ArrowLeft') keyStateRef.current.left = true;
      if (code === 'ArrowRight') keyStateRef.current.right = true;
      if (code === 'ArrowUp') keyStateRef.current.up = true;
      if (code === 'Space') keyStateRef.current.space = true;

      if (code === 'ArrowUp' || code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight') {
        if (game.flapCooldown <= 0) {
          flap();
          game.flapCooldown = 6;
        }
      }
    };

    const handleKeyUp = (e) => {
      const code = e.code;
      if (code === 'ArrowLeft') keyStateRef.current.left = false;
      if (code === 'ArrowRight') keyStateRef.current.right = false;
      if (code === 'ArrowUp') keyStateRef.current.up = false;
      if (code === 'Space') keyStateRef.current.space = false;
    };
    const handleBlur = () => setIsPaused(true);
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPaused(true);
    };

    let lastTouchX = null;
    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const touchX = e.touches[0].clientX;
      if (lastTouchX === null) {
        lastTouchX = touchX;
        return;
      }
      const deltaX = touchX - lastTouchX;
      if (Math.abs(deltaX) >= 15) {
        const direction = deltaX > 0 ? 1 : -1;
        game.speedFactor = clampSpeedFactor(game.speedFactor + direction * 0.08);
        lastTouchX = touchX;
      }
    };
    const handleTouchEnd = () => {
      lastTouchX = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Update game logic
    const updateGame = (dt) => {
      // Update camera
      const baseSpeed = computeSpeed(activeBuffs);
      game.speed = baseSpeed * game.speedFactor;
      game.camera += game.speed * dt;

      // Continuous input (hold keys)
      const decelRate = 0.05;
      if (keyStateRef.current.left) {
        game.speedFactor = clampSpeedFactor(game.speedFactor - 0.08 * dt);
      } else if (keyStateRef.current.right) {
        game.speedFactor = clampSpeedFactor(game.speedFactor + 0.08 * dt);
      } else {
        if (game.speedFactor > 1) {
          game.speedFactor = clampSpeedFactor(game.speedFactor - decelRate * dt);
        } else if (game.speedFactor < 1) {
          game.speedFactor = clampSpeedFactor(game.speedFactor + decelRate * dt);
        }
      }
      if (game.flapCooldown > 0) {
        game.flapCooldown -= dt;
      }
      if (keyStateRef.current.up || keyStateRef.current.space || keyStateRef.current.left || keyStateRef.current.right) {
        if (game.flapCooldown <= 0) {
          game.swift.velocity = JUMP_FORCE;
          game.flapCooldown = 6;
        }
      }
      
      // Update swift physics with gravity
      game.swift.velocity += GRAVITY;
      game.swift.y += game.swift.velocity;
      
      // Stop at boundaries and reset velocity
      if (game.swift.y >= 580) {
        game.swift.y = 580;
        game.swift.velocity = 0;
      }
      if (game.swift.y <= 20) {
        game.swift.y = 20;
        game.swift.velocity = 0;
      }
      
      game.swift.wingFlap += 0.3;

      // Cooldown for cloud hits
      if (game.cloudHitCooldown > 0) {
        game.cloudHitCooldown--;
      }

      // Update invincibility from combo
      if (game.invincibleTimer > 0) {
        game.invincibleTimer--;
        if (game.invincibleTimer === 0) {
          setActiveBuffs(prev => ({ ...prev, invincible: false }));
        }
      }

      // Update particles
      game.particles = game.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.type === 'smoke') {
          p.vx *= 0.95;
          p.vy *= 0.95;
        }
        return p.life > 0;
      });

      // Spawn clouds (increase difficulty over time)
      const difficulty = Math.min(1, game.camera / 5000);
      const cloudCap = Math.round(6 + difficulty * 8);
      const cloudSpawnChance = 0.012 + difficulty * 0.03;
      if (game.clouds.length < cloudCap && Math.random() < cloudSpawnChance) {
        game.clouds.push(spawnCloud());
      }

      // Spawn insects
      if (game.insects.length < 15 && Math.random() < 0.05) {
        game.insects.push(spawnInsect());
      }

      // Spawn fly
      if (!game.fly && game.insectsCollected - game.lastFlySpawn >= 5 && Math.random() < 0.01) {
        game.fly = spawnFly();
      }

      // Check collisions with clouds
      const isInvincible = activeBuffs.invincible || activeBuffs.shield;
      game.clouds.forEach(cloud => {
        const swiftWorldX = game.swift.x + game.camera;
        const cloudHitboxWidth = (cloud.width / 2) * 0.6;
        const cloudHitboxHeight = (cloud.height / 2) * 0.7;
        
        const dx = swiftWorldX - cloud.x;
        const dy = game.swift.y - cloud.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const swiftSize = 20;
        const cloudSize = Math.max(cloudHitboxWidth, cloudHitboxHeight);
        
        if (distance < swiftSize + cloudSize) {
          if (!isInvincible && game.cloudHitCooldown === 0) {
            createCloudHitParticles(game.swift.x, game.swift.y);
            game.cloudHitCooldown = 60;
            setLives(prev => {
              const newLives = prev - 1;
              if (newLives <= 0) {
                setGameState('gameOver');
                setHighScore(h => Math.max(h, score));
              }
              return Math.max(0, newLives);
            });
            game.comboCount = 0;
            setCombo(0);
          }
          if (activeBuffs.shield && game.cloudHitCooldown === 0) {
            createCloudHitParticles(game.swift.x, game.swift.y);
            game.cloudHitCooldown = 60;
            setActiveBuffs(prev => ({ ...prev, shield: false }));
          }
        }
      });

      // Check collisions with insects
      const swiftWorldX = game.swift.x + game.camera;
      game.insects = game.insects.filter(insect => {
        if (checkCollision({x: swiftWorldX, y: game.swift.y}, insect, 25, insect.size)) {
          const insectData = COLORS[insect.type];
          const points = insectData.points * (activeBuffs.double ? 2 : 1);
          
          createCollectionParticles(insect.x - game.camera, insect.y, insectData.color);
          
          setScore(s => s + points);
          game.comboCount++;
          game.insectsCollected++;
          setCombo(game.comboCount);

          if (insectData.buff) {
            activateBuff(insectData.buff);
          }

          if (game.comboCount === 3) {
            setScore(s => s + 5);
          } else if (game.comboCount === 6) {
            setScore(s => s + 15);
          } else if (game.comboCount === 10) {
            game.invincibleTimer = 180;
            setActiveBuffs(prev => ({ ...prev, invincible: true }));
          }

          return false;
        }
        return insect.x > game.camera - 100;
      });

      // Check collision with fly
      if (game.fly) {
        if (checkCollision({x: swiftWorldX, y: game.swift.y}, game.fly, 25, game.fly.size)) {
          createCollectionParticles(game.fly.x - game.camera, game.fly.y, '#FF1493');
          setLives(prev => Math.min(5, prev + 1));
          game.lastFlySpawn = game.insectsCollected;
          game.fly = null;
        }
      }

      // Update fly
      if (game.fly) {
        game.fly.pulse += 0.1;
        if (game.fly.x < game.camera - 100) {
          game.fly = null;
        }
      }

      // Clean up clouds
      game.clouds = game.clouds.filter(cloud => cloud.x > game.camera - 200);
    };

    const gameLoop = (time) => {
      let delta = (time - lastTimeRef.current) / 16.666; // 60 FPS = 1
      lastTimeRef.current = time;
      
      // Clamp delta to prevent huge jumps when tab is inactive
      delta = Math.min(delta, 3);

      // Update game logic
      if (!isPaused) {
        updateGame(delta);
      }

      // Render game
      ctx.clearRect(0, 0, 800, 600);

      // Sky gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(0.5, '#B0E0E6');
      gradient.addColorStop(1, '#E0F6FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);

      // Clouds
      game.clouds.forEach(cloud => {
        const screenX = cloud.x - game.camera;
        // Only draw if on screen
        if (screenX > -200 && screenX < 1000) {
          ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
          ctx.beginPath();
          ctx.ellipse(screenX, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = `rgba(230, 230, 230, ${cloud.opacity * 0.5})`;
          ctx.beginPath();
          ctx.ellipse(screenX - cloud.width * 0.3, cloud.y + 5, cloud.width / 3, cloud.height / 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(screenX + cloud.width * 0.3, cloud.y + 5, cloud.width / 3, cloud.height / 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Insects
      game.insects.forEach(insect => {
        const screenX = insect.x - game.camera;
        const bob = Math.sin(Date.now() / 200 + insect.bobOffset) * 3;
        const y = insect.y + bob;
        
        // Shimmer effect
        insect.shimmer += 0.1;
        const shimmerAlpha = Math.sin(insect.shimmer) * 0.3 + 0.7;
        
        ctx.fillStyle = COLORS[insect.type].color;
        ctx.globalAlpha = shimmerAlpha;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS[insect.type].color;
        
        // Body
        ctx.beginPath();
        ctx.arc(screenX, y, insect.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(screenX + insect.size * 0.6, y, insect.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Wings (subtle)
        ctx.strokeStyle = `${COLORS[insect.type].color}44`;
        ctx.lineWidth = 2;
        const wingFlap = Math.sin(Date.now() / 100) * 5;
        ctx.beginPath();
        ctx.moveTo(screenX - insect.size * 0.3, y);
        ctx.lineTo(screenX - insect.size - wingFlap, y - insect.size * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(screenX - insect.size * 0.3, y);
        ctx.lineTo(screenX - insect.size - wingFlap, y + insect.size * 0.8);
        ctx.stroke();
      });

      // Fly
      if (game.fly) {
        const screenX = game.fly.x - game.camera;
        const bob = Math.sin(Date.now() / 150) * 5;
        const y = game.fly.y + bob;
        const pulse = Math.sin(game.fly.pulse) * 0.3 + 0.7;
        
        // Body - larger and different shape
        ctx.fillStyle = '#2C3E50';
        ctx.shadowBlur = 25 * pulse;
        ctx.shadowColor = '#FF1493';
        ctx.beginPath();
        ctx.ellipse(screenX, y, game.fly.size * 0.7, game.fly.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.fillStyle = '#1A252F';
        ctx.beginPath();
        ctx.arc(screenX + game.fly.size * 0.5, y, game.fly.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (red for fly)
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(screenX + game.fly.size * 0.6, y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(screenX + game.fly.size * 0.6, y + 3, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;

        // Wings - more detailed for fly
        const wingBeat = Math.sin(Date.now() / 80) * 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX - game.fly.size * 0.3, y - wingBeat, game.fly.size * 0.8, game.fly.size * 0.4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(screenX - game.fly.size * 0.3, y + wingBeat, game.fly.size * 0.8, game.fly.size * 0.4, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring
        ctx.strokeStyle = `rgba(255, 20, 147, ${0.4 * pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenX, y, game.fly.size * 1.5 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Heart icon to indicate life bonus
        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('❤', screenX - 8, y - game.fly.size - 10);
      }

      // Particles
      game.particles.forEach(particle => {
        const screenX = particle.x;
        const alpha = particle.life / particle.maxLife;
        
        if (particle.type === 'flash') {
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 10;
          ctx.shadowColor = particle.color;
          ctx.beginPath();
          ctx.arc(screenX, particle.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        } else if (particle.type === 'smoke') {
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(screenX, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Swift
      ctx.save();
      ctx.translate(game.swift.x, game.swift.y);

      // Bobbing animation
      const verticalBob = Math.sin(game.swift.wingFlap * 0.5) * 2;
      ctx.translate(0, verticalBob);

      // Glow effect when invincible
      if (activeBuffs.invincible) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
      }

      // Wing flapping
      const wingAngle = Math.sin(game.swift.wingFlap) * 0.4;

      // Left wing (back)
      ctx.fillStyle = '#2C3E50';
      ctx.beginPath();
      ctx.save();
      ctx.rotate(wingAngle);
      ctx.moveTo(-5, -5);
      ctx.quadraticCurveTo(-35, -20, -40, -8);
      ctx.quadraticCurveTo(-38, -2, -5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Right wing (back)
      ctx.beginPath();
      ctx.save();
      ctx.rotate(-wingAngle);
      ctx.moveTo(-5, 5);
      ctx.quadraticCurveTo(-35, 20, -40, 8);
      ctx.quadraticCurveTo(-38, 2, -5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Body (darker blue-grey on top)
      ctx.fillStyle = '#34495E';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // White belly
      ctx.fillStyle = '#F8F9FA';
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail feathers
      ctx.fillStyle = '#2C3E50';
      ctx.beginPath();
      ctx.moveTo(-22, -4);
      ctx.lineTo(-32, -8);
      ctx.lineTo(-28, -2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, 4);
      ctx.lineTo(-32, 8);
      ctx.lineTo(-28, 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-34, 0);
      ctx.lineTo(-28, 0);
      ctx.closePath();
      ctx.fill();

      // Head
      ctx.fillStyle = '#2C3E50';
      ctx.beginPath();
      ctx.arc(18, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(28, -2);
      ctx.lineTo(28, 2);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath();
      ctx.arc(20, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(20.5, -2.5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState, score, activeBuffs, isPaused, spawnCloud, spawnInsect, spawnFly, checkCollision, activateBuff, createCollectionParticles, createCloudHitParticles, computeSpeed, GRAVITY, JUMP_FORCE]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '"Fredoka", "Comic Sans MS", cursive',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes slideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .game-button {
          padding: 16px 32px;
          font-size: 20px;
          font-weight: 700;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 8px 0 rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.3);
          position: relative;
          top: 0;
        }
        
        .game-button:hover {
          top: -4px;
          box-shadow: 0 12px 0 rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.3);
        }
        
        .game-button:active {
          top: 4px;
          box-shadow: 0 4px 0 rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.3);
        }
        
        .buff-icon {
          animation: pulse 1s infinite;
        }
      `}</style>

      {gameState === 'menu' && (
        <div style={{
          textAlign: 'center',
          color: 'white',
          animation: 'float 3s ease-in-out infinite'
        }}>
          <h1 style={{
            fontSize: '72px',
            margin: '0 0 20px 0',
            textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            fontWeight: 700
          }}>
            Небесный Охотник
          </h1>
          <p style={{
            fontSize: '24px',
            marginBottom: '40px',
            opacity: 0.9
          }}>
            Собирай мошек, уклоняйся от облаков!
          </p>
          <button
            className="game-button"
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
              color: 'white'
            }}
          >
            Начать игру
          </button>
          {highScore > 0 && (
            <div style={{
              marginTop: '30px',
              fontSize: '20px',
              opacity: 0.8
            }}>
              Рекорд: {highScore}
            </div>
          )}
          <div style={{
            marginTop: '40px',
            fontSize: '16px',
            opacity: 0.7,
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            {gameRef.current.isMobile ? 
              '📱 Касайтесь экрана, чтобы взлететь' :
              '🖱️ Управление: клик мыши, пробел или стрелка вверх'
            }
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{
              border: '6px solid rgba(255,255,255,0.3)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              background: '#87CEEB',
              touchAction: 'none'
            }}
          />
          
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            right: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            animation: 'slideIn 0.5s ease-out'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '12px 24px',
              borderRadius: '50px',
              fontWeight: 700,
              fontSize: '24px',
              color: '#2C3E50',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              Очки: {score}
            </div>
            
            <button
              className="game-button"
              onClick={() => setIsPaused(!isPaused)}
              style={{
                background: 'rgba(255,255,255,0.95)',
                color: '#2C3E50',
                padding: '12px 24px',
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
            </button>
            
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '12px 24px',
              borderRadius: '50px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              {Array(lives).fill(0).map((_, i) => (
                <Heart key={i} size={24} fill="#EF4444" color="#EF4444" />
              ))}
            </div>
          </div>

          {combo > 0 && (
            <div style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '50px',
              fontWeight: 700,
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: 'pulse 0.5s ease-in-out'
            }}>
              Комбо: {combo}×
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {activeBuffs.speed && (
              <div className="buff-icon" style={{
                background: '#10B981',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
              }}>
                <Zap size={20} /> Ускорение
              </div>
            )}
            {activeBuffs.shield && (
              <div className="buff-icon" style={{
                background: '#FBBF24',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
              }}>
                <Shield size={20} /> Щит
              </div>
            )}
            {activeBuffs.double && (
              <div className="buff-icon" style={{
                background: '#EF4444',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
              }}>
                <TrendingUp size={20} /> ×2 Очков
              </div>
            )}
            {activeBuffs.slow && (
              <div className="buff-icon" style={{
                background: '#8B5CF6',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
              }}>
                <Clock size={20} /> Замедление
              </div>
            )}
            {activeBuffs.invincible && (
              <div className="buff-icon" style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.5)'
              }}>
                ⭐ Неуязвимость
              </div>
            )}
          </div>
          
          {isPaused && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '20px'
            }}>
              <div style={{
                background: 'white',
                padding: '40px 60px',
                borderRadius: '30px',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
              }}>
                <h2 style={{
                  fontSize: '48px',
                  margin: '0 0 20px 0',
                  color: '#2C3E50',
                  fontWeight: 700
                }}>
                  Пауза
                </h2>
                <button
                  className="game-button"
                  onClick={() => setIsPaused(false)}
                  style={{
                    background: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
                    color: 'white'
                  }}
                >
                  Продолжить
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'gameOver' && (
        <div style={{
          textAlign: 'center',
          color: 'white',
          animation: 'float 3s ease-in-out infinite'
        }}>
          <h1 style={{
            fontSize: '64px',
            margin: '0 0 20px 0',
            textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            fontWeight: 700
          }}>
            Игра окончена!
          </h1>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px',
            fontWeight: 600
          }}>
            Очки: {score}
          </div>
          {score === highScore && score > 0 && (
            <div style={{
              fontSize: '28px',
              color: '#FFD700',
              marginBottom: '20px',
              fontWeight: 600,
              textShadow: '2px 2px 0 rgba(0,0,0,0.3)'
            }}>
              🏆 Новый рекорд!
            </div>
          )}
          {highScore > 0 && score !== highScore && (
            <div style={{
              fontSize: '24px',
              marginBottom: '20px',
              opacity: 0.8
            }}>
              Лучший результат: {highScore}
            </div>
          )}
          <button
            className="game-button"
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
              color: 'white',
              marginTop: '20px'
            }}
          >
            Играть снова
          </button>
        </div>
      )}
    </div>
  );
};

export default SkyHunter;
