import React, { useMemo } from 'react';

type CommonOceanBackgroundProps = {
  className?: string;
};

/* ============================================================
   UNDERWATER FISH SPRITE
============================================================ */
function FishSprite({
  top,
  left,
  scale,
  duration,
  delay,
  direction = 1,
}: {
  top: string;
  left: string;
  scale: number;
  duration: number;
  delay: number;
  direction?: number;
}) {
  return (
    <div
      className="absolute pointer-events-none fish-swim select-none"
      style={{
        top,
        left,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        transform: `scale(${scale * direction}, ${scale})`,
      }}
    >
      <svg width="84" height="38" viewBox="0 0 90 42" fill="none">
        <path
          d="M14 21C25 8 43 5 58 12C65 15 70 19 75 21C70 23 65 27 58 30C43 37 25 34 14 21Z"
          fill="rgba(186, 245, 255, 0.28)"
        />
        <path d="M14 21L2 10L6 21L2 32L14 21Z" fill="rgba(125, 225, 245, 0.24)" />
        <path
          d="M38 11C40 4 47 3 51 11"
          stroke="rgba(215, 250, 255, 0.35)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="61" cy="18" r="2.2" fill="rgba(255, 255, 255, 0.85)" />
      </svg>
    </div>
  );
}

function FishSchool() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
      <FishSprite top="18%" left="-12%" scale={0.78} duration={26} delay={0} />
      <FishSprite top="34%" left="-18%" scale={0.55} duration={32} delay={-8} />
      <FishSprite top="54%" left="-10%" scale={0.68} duration={28} delay={-14} />
      <FishSprite top="72%" left="-15%" scale={0.48} duration={35} delay={-5} />
      <FishSprite top="86%" left="-20%" scale={0.60} duration={30} delay={-19} />
    </div>
  );
}

/**
 * Global CommonOceanBackground
 *
 * BALANCED OCEAN BLUE THEME (In-Between Dark and Light):
 * Perfectly calibrated rich oceanic cerulean & sapphire blue from top to bottom.
 * Not blindingly light, not pitch black — comfortable, radiant, and high contrast.
 */
export default function CommonOceanBackground({
  className = '',
}: CommonOceanBackgroundProps) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: `${2 + ((index * 17) % 96)}%`,
        size: `${3 + ((index * 11) % 8)}px`,
        duration: `${11 + ((index * 5) % 12)}s`,
        delay: `${-((index * 2) % 14)}s`,
        drift: `${-45 + ((index * 31) % 90)}px`,
      })),
    [],
  );

  const currents = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        id: index,
        top: `${14 + index * 12}%`,
        duration: `${13 + (index % 5) * 2.5}s`,
        delay: `${-(index % 6) * 1.8}s`,
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden select-none ${className}`}
    >
      {/* =========================================================
          BASE BALANCED OCEAN GRADIENT: IN BETWEEN LIGHT AND DARK
         ========================================================= */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              #036398 0%,
              #025584 16%,
              #024872 34%,
              #013d62 52%,
              #013252 70%,
              #012742 86%,
              #011e33 100%
            )
          `,
        }}
      />

      {/* =========================================================
          RADIANT OCEANIC GLOW OVERLAYS
         ========================================================= */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 130% 65% at 50% 0%, rgba(56, 189, 248, 0.22), transparent 70%),
            radial-gradient(ellipse 90% 75% at 15% 35%, rgba(14, 165, 233, 0.16), transparent 60%),
            radial-gradient(ellipse 100% 85% at 85% 65%, rgba(2, 132, 199, 0.14), transparent 65%),
            radial-gradient(ellipse 85% 85% at 50% 50%, transparent 45%, rgba(1, 20, 38, 0.55) 100%)
          `,
        }}
      />

      {/* =========================================================
          SUBTLE SHIMMERING OCEAN CAUSTICS
         ========================================================= */}
      <div className="ocean-balanced-caustic opacity-35" />

      {/* =========================================================
          LARGE OCEANIC AMBIENT GLOWS
         ========================================================= */}
      <div
        className="
          absolute
          -left-32
          top-[8%]
          h-[680px]
          w-[680px]
          rounded-full
          bg-[#38bdf8]/15
          blur-[135px]
          animate-[oceanFloatA_20s_ease-in-out_infinite]
        "
      />

      <div
        className="
          absolute
          right-[-120px]
          top-[32%]
          h-[720px]
          w-[720px]
          rounded-full
          bg-[#0ea5e9]/14
          blur-[140px]
          animate-[oceanFloatB_23s_ease-in-out_infinite]
        "
      />

      <div
        className="
          absolute
          bottom-[-100px]
          left-[25%]
          h-[750px]
          w-[750px]
          rounded-full
          bg-[#0284c7]/12
          blur-[140px]
          animate-[oceanFloatC_25s_ease-in-out_infinite]
        "
      />

      {/* =========================================================
          SWIMMING FISH SCHOOL
         ========================================================= */}
      <FishSchool />

      {/* =========================================================
          DEPTH BATHYMETRIC GRID (Subtle Gridlines)
         ========================================================= */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.35))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.35))',
        }}
      />

      {/* =========================================================
          SONAR PULSE RINGS
         ========================================================= */}
      <div
        className="
          absolute
          right-[6%]
          top-[15%]
          h-[510px]
          w-[510px]
          rounded-full
          border
          border-cyan-300/22
          animate-[sonarPulse_9s_ease-in-out_infinite]
        "
      />

      <div
        className="
          absolute
          right-[12%]
          top-[23%]
          h-[340px]
          w-[340px]
          rounded-full
          border
          border-cyan-300/18
          animate-[sonarPulse_9s_ease-in-out_2.5s_infinite]
        "
      />

      {/* =========================================================
          HORIZONTAL OCEAN CURRENT STREAMS
         ========================================================= */}
      <div className="absolute inset-0">
        {currents.map((line) => (
          <div
            key={line.id}
            className="absolute left-[-30%] h-px w-[160%]"
            style={{
              top: line.top,
              opacity: 0.28 - line.id * 0.02,
            }}
          >
            <div
              className="
                h-full
                w-[30%]
                rounded-full
                bg-gradient-to-r
                from-transparent
                via-cyan-200/50
                to-transparent
                shadow-[0_0_10px_rgba(56,189,248,0.4)]
              "
              style={{
                animation: `oceanCurrent ${line.duration} linear ${line.delay} infinite`,
              }}
            />
          </div>
        ))}
      </div>

      {/* =========================================================
          FLOATING OCEAN BUBBLES
         ========================================================= */}
      <div className="absolute inset-0">
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="
              absolute
              bottom-[-30px]
              rounded-full
              border
              border-cyan-200/40
              bg-white/18
              shadow-[0_0_10px_rgba(125,230,255,0.35)]
            "
            style={{
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animation: `oceanBubble ${bubble.duration} ease-in-out ${bubble.delay} infinite`,
              ['--ocean-drift' as string]: bubble.drift,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes oceanFloatA {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(55px, 35px, 0) scale(1.06); }
        }
        @keyframes oceanFloatB {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-60px, 45px, 0) scale(1.06); }
        }
        @keyframes oceanFloatC {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(35px, -40px, 0) scale(1.08); }
        }
        @keyframes oceanCurrent {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(450%); }
        }
        @keyframes oceanBubble {
          0% {
            transform: translate3d(0, 0, 0) scale(0.70);
            opacity: 0;
          }
          10% { opacity: 0.55; }
          50% {
            transform: translate3d(var(--ocean-drift), -55vh, 0) scale(1);
            opacity: 0.35;
          }
          100% {
            transform: translate3d(calc(var(--ocean-drift) * -0.5), -118vh, 0) scale(1.15);
            opacity: 0;
          }
        }
        @keyframes fishSwim {
          0% { transform: translateX(-130px) translateY(0); }
          50% { transform: translateX(55vw) translateY(14px); }
          100% { transform: translateX(115vw) translateY(-8px); }
        }
        .fish-swim {
          animation-name: fishSwim;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes sonarPulse {
          0%, 100% {
            opacity: 0.18;
            transform: scale(1);
          }
          50% {
            opacity: 0.60;
            transform: scale(1.05);
          }
        }
        .ocean-balanced-caustic {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(ellipse 25% 8% at 25% 15%, rgba(125, 235, 255, 0.20), transparent 70%),
            radial-gradient(ellipse 30% 10% at 72% 22%, rgba(56, 189, 248, 0.18), transparent 70%),
            radial-gradient(ellipse 35% 10% at 45% 65%, rgba(14, 165, 233, 0.15), transparent 70%);
          filter: blur(8px);
          animation: causticDrift 20s ease-in-out infinite;
        }
        @keyframes causticDrift {
          0% { transform: translate3d(-2%, -2%, 0) rotate(-1deg); }
          50% { transform: translate3d(2%, 2%, 0) rotate(1deg); }
          100% { transform: translate3d(-2%, -2%, 0) rotate(-1deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
