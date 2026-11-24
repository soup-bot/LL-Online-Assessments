"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { Clock, ListChecks } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const START_SECONDS = 24 * 60 + 18;

/** Decorative phone mockup + floating exam chips for the login brand panel. */
export function ExamCluster() {
  const reduce = useReducedMotion();
  const [seconds, setSeconds] = useState(START_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : START_SECONDS)), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div aria-hidden className="relative mx-auto flex h-124 w-full max-w-xl items-center justify-center">
      <Phone reduce={reduce} />
      <Student reduce={reduce} />

      <Chip delay={0.45} rotate={-5} drift={8} duration={6} reduce={reduce} className="left-0 top-4 w-52">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Clock className="size-4" />
          Time remaining
        </div>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-slate-900">
          {mm}:{ss}
        </p>
      </Chip>

      <Chip delay={0.6} rotate={6} drift={9} duration={7.5} reduce={reduce} className="bottom-16 right-0 w-44">
        <div className="flex items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f08a6b] text-2xl font-bold text-white">
            A
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-900">87%</p>
            <p className="text-xs text-slate-500">14 / 16 marks</p>
          </div>
        </div>
      </Chip>

      <Chip delay={0.9} rotate={4} drift={7} duration={7} reduce={reduce} className="right-2 top-6">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <span className="grid size-7 place-items-center rounded-full bg-[#f08a6b]/20 text-[#f08a6b]">
            <ListChecks className="size-4" />
          </span>
          8 questions · 16 marks
        </div>
      </Chip>

    </div>
  );
}

/** Floating student whose finger reaches the phone's screen. */
function Student({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24, y: 24 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.3 }}
      className="absolute bottom-0 left-0 w-64"
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -12, 0], rotate: [-1, 1, -1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/floating-student.png"
          alt=""
          width={965}
          height={1252}
          priority
          className="h-auto w-full"
        />
      </motion.div>
    </motion.div>
  );
}

function Phone({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 16 }}
      className="relative translate-x-10"
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/phone-exam.png"
          alt=""
          width={819}
          height={1435}
          priority
          className="h-120 w-auto"
        />
      </motion.div>
    </motion.div>
  );
}

function Chip({
  children,
  className = "",
  delay,
  rotate,
  drift,
  duration,
  reduce,
}: {
  children: ReactNode;
  className?: string;
  delay: number;
  rotate: number;
  drift: number;
  duration: number;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95, rotate }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate }}
      transition={{ type: "spring", stiffness: 120, damping: 16, delay }}
      className={`absolute ${className}`}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -drift, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        className="rounded-2xl bg-[#f4efe4] p-4 shadow-xl shadow-black/20"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
