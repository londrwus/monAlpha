"use client";

import { motion } from "framer-motion";

const orbs = [
  { size: 300, x: "15%", y: "20%", delay: 0, duration: 20 },
  { size: 200, x: "70%", y: "30%", delay: 2, duration: 25 },
  { size: 150, x: "40%", y: "60%", delay: 4, duration: 18 },
  { size: 250, x: "80%", y: "70%", delay: 1, duration: 22 },
  { size: 100, x: "25%", y: "80%", delay: 3, duration: 15 },
];

export default function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, rgba(61, 122, 92, ${0.08 - i * 0.01}) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
          animate={{
            x: [0, 30, -20, 15, 0],
            y: [0, -25, 15, -10, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
