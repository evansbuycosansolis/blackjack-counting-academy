"use client";
import { Card as PlayingCard } from "@/engine/cards";
import { useGame } from "@/stores/game-store";
import { motion, useReducedMotion, useAnimationControls } from "motion/react";
import { useLayoutEffect, useRef } from "react";
export function Card({
  card,
  hidden = false,
  index = 0,
  small = false,
  table = false,
  flight = false,
}: {
  card?: PlayingCard;
  hidden?: boolean;
  index?: number;
  small?: boolean;
  table?: boolean;
  flight?: boolean;
}) {
  const configuredSpeed = useGame((s) => s.speed),
    reduced = useReducedMotion(),
    speed = reduced ? 0 : configuredSpeed;
  const element = useRef<HTMLDivElement>(null),
    controls = useAnimationControls();
  useLayoutEffect(() => {
    const shoe =
      table && flight && !reduced
        ? element.current?.closest(".felt")?.querySelector(".shoe-visual")
        : null;
    if (shoe && element.current) {
      const origin = shoe.getBoundingClientRect(),
        target = element.current.getBoundingClientRect();
      controls.set({
        x: origin.left - target.left,
        y: origin.top - target.top,
        opacity: 0,
        rotate: 12,
      });
    }
    void controls.start({
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      rotateY: hidden ? 180 : 0,
      transition: {
        duration: speed,
        delay: reduced ? 0 : index * speed * 0.15,
      },
    });
  }, [controls, flight, hidden, index, reduced, speed, table]);
  return (
    <motion.div
      ref={element}
      layout={table}
      layoutId={table && card ? `table-card-${card.id}` : undefined}
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={controls}
      transition={{ duration: speed, delay: index * speed * 0.25 }}
      className={`playing-card ${hidden ? "card-back" : ""} ${small ? "small-card" : ""} ${card && ["♥", "♦"].includes(card.suit) ? "red-card" : ""}`}
      aria-label={
        hidden
          ? "Hidden dealer card"
          : card
            ? `${card.rank} ${card.suit}`
            : "Card"
      }
    >
      {hidden ? (
        <div className="card-back-inner">♠</div>
      ) : card ? (
        <>
          <span className="card-corner">
            {card.rank}
            <small>{card.suit}</small>
          </span>
          <span className="card-suit">{card.suit}</span>
          <span className="card-corner corner-bottom">
            {card.rank}
            <small>{card.suit}</small>
          </span>
        </>
      ) : null}
    </motion.div>
  );
}
