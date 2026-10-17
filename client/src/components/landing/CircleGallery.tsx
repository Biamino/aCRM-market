import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";

export interface GalleryItem {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface Props {
  items: GalleryItem[];
  /** авто-вращение, градусов в секунду (0 — выключено) */
  autoSpin?: number;
  /** сопротивление броску: 0 — долго крутится по инерции, 1 — почти сразу встаёт */
  throwResistance?: number;
  /** сколько первая фотография стоит одна, прежде чем из неё раскроется кольцо, с */
  holdDuration?: number;
  /** длительность раскрытия кольца, с */
  introDuration?: number;
  /** задержка появления (ждём прелоадер), с */
  introDelay?: number;
  showNumbers?: boolean;
  className?: string;
}

const DRAG_THRESHOLD = 6;
/** доля раскрытия, на которую каждая следующая карточка отстаёт от предыдущей */
const STAGGER = 0.05;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Кольцо карточек-фото по мотивам React Bits Pro «Circle Gallery» (своя реализация на motion/react).
 * Сначала видна одна фотография, затем из неё по спирали раскрывается кольцо. Кольцо крутится
 * всегда — наведение его не останавливает; клик останавливает и приближает карточку,
 * после закрытия вращение продолжается. Можно крутить перетаскиванием и бросать с инерцией.
 */
export default function CircleGallery({
  items,
  autoSpin = 6,
  throwResistance = 0.35,
  holdDuration = 0.9,
  introDuration = 1.3,
  introDelay = 0,
  showNumbers = true,
  className = "",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduce = useReducedMotion() ?? false;
  const rotation = useMotionValue(0);
  /** раскрытие из одной фотографии в кольцо: 0 — стопка, 1 — кольцо */
  const spread = useMotionValue(reduce ? 1 : 0);
  const radius = useMotionValue(0);
  const [open, setOpen] = useState<number | null>(null);
  const [ready, setReady] = useState(reduce);
  /** первая фотография загружена — без неё «одна фотография в начале» была бы пустой карточкой */
  const [firstShown, setFirstShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFirstShown(true), 1500); // не ждём медленную сеть вечно
    return () => window.clearTimeout(t);
  }, []);
  const drag = useRef({ active: false, moved: 0, lastAngle: 0, lastTime: 0, velocity: 0 });
  /** кадр инерции после броска (0 — инерции нет) */
  const inertia = useRef(0);
  /** когда закончился последний бросок: клик сразу после него — часть жеста, не выбор карточки */
  const thrownAt = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // геометрия как в референсе: крупные вертикальные карточки внахлёст, стоят ровно
  const n = items.length;
  const side = Math.min(size.w, size.h);
  const cardH = side * 0.34;
  const cardW = cardH * 0.78;
  const ringRadius = Math.max(0, side / 2 - cardH / 2 - 6);
  useEffect(() => radius.set(ringRadius), [radius, ringRadius]);

  // интро: одна фотография → пауза → кольцо раскрывается по спирали
  const introStart = !reduce && side > 0 && firstShown;
  useEffect(() => {
    if (!introStart) return;
    rotation.set(-110);
    const controls = [
      animate(spread, 1, { delay: introDelay + holdDuration, duration: introDuration, ease: "linear" }),
      animate(rotation, 0, {
        delay: introDelay + holdDuration,
        duration: introDuration * 1.15,
        ease: [0.22, 1, 0.36, 1],
        onComplete: () => setReady(true),
      }),
    ];
    return () => controls.forEach((c) => c.stop());
    // запускаем один раз: известен размер и видна первая фотография
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introStart]);

  // вращается всегда, кроме открытой карточки и перетаскивания
  useEffect(() => {
    if (reduce || !autoSpin || !ready || open !== null) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!drag.current.active && !inertia.current) rotation.set(rotation.get() + (autoSpin * (now - last)) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, autoSpin, ready, open, rotation]);

  useEffect(() => () => cancelAnimationFrame(inertia.current), []);

  useEffect(() => {
    if (open === null) return;
    cancelAnimationFrame(inertia.current);
    inertia.current = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % n));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + n) % n));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, n]);

  /** угол курсора вокруг центра кольца, градусы */
  const pointerAngle = (e: React.PointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  function onPointerDown(e: React.PointerEvent) {
    if (!ready || open !== null || e.button !== 0) return;
    cancelAnimationFrame(inertia.current);
    inertia.current = 0;
    drag.current = { active: true, moved: 0, lastAngle: pointerAngle(e), lastTime: performance.now(), velocity: 0 };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const angle = pointerAngle(e);
    let delta = angle - d.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastTime);
    d.moved += Math.abs(delta) * (side / 2) * (Math.PI / 180);
    if (d.moved > DRAG_THRESHOLD) {
      if (!rootRef.current!.hasPointerCapture(e.pointerId)) rootRef.current!.setPointerCapture(e.pointerId);
      rotation.set(rotation.get() + delta);
    }
    d.velocity = d.velocity * 0.6 + (delta / dt) * 1000 * 0.4; // град/с, сглаженная
    d.lastAngle = angle;
    d.lastTime = now;
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (d.moved <= DRAG_THRESHOLD) return;
    thrownAt.current = performance.now();
    if (reduce) return;
    // бросок: скорость затухает экспоненциально, тем быстрее, чем больше сопротивление
    const friction = 0.985 - throwResistance * 0.05; // доля скорости, остающаяся за 1/60 с
    let velocity = d.velocity;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rotation.set(rotation.get() + velocity * dt);
      velocity *= Math.pow(friction, dt * 60);
      inertia.current = Math.abs(velocity) > 2 ? requestAnimationFrame(step) : 0;
    };
    inertia.current = requestAnimationFrame(step);
  }

  if (n === 0) return null;
  const current = open === null ? null : items[open];

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full touch-pan-y select-none ${ready ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {side > 0 && (
        <ul
          aria-label="Модели ASDEM"
          className={`absolute left-1/2 top-1/2 h-0 w-0 transition-[filter,opacity] duration-500 ${
            current ? "pointer-events-none opacity-25 blur-[3px]" : ""
          }`}
        >
          {items.map((item, i) => (
            <Card
              key={item.src + i}
              item={item}
              index={i}
              count={n}
              width={cardW}
              height={cardH}
              rotation={rotation}
              spread={spread}
              radius={radius}
              reduce={reduce}
              hidden={open === i}
              onLoad={i === 0 ? () => setFirstShown(true) : undefined}
              showNumber={showNumbers}
              onOpen={() => {
                if (performance.now() - thrownAt.current < 250) return; // это был бросок, не клик
                setOpen(i);
              }}
            />
          ))}
        </ul>
      )}

      <AnimatePresence>
        {current && open !== null && (
          <motion.figure
            key="open"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.img
              layoutId={reduce ? undefined : `circle-${open}`}
              src={current.src}
              alt={current.alt}
              className="h-[74%] w-auto max-w-full rounded-[10px] object-cover shadow-[0_30px_60px_-30px_rgba(43,39,51,0.5)]"
              style={{ aspectRatio: "3 / 4" }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
            />
            <figcaption className="text-center" onClick={(e) => e.stopPropagation()}>
              <p className="label text-ink">{current.title}</p>
              {current.subtitle && <p className="mt-1 text-xs text-dim">{current.subtitle}</p>}
              <div className="mt-3 flex items-center justify-center gap-4">
                <Link to={current.href} className="label text-brand-deep underline underline-offset-4">
                  Смотреть модель
                </Link>
                <button type="button" className="label cursor-pointer text-dim hover:text-ink" onClick={() => setOpen(null)}>
                  Закрыть
                </button>
              </div>
            </figcaption>
          </motion.figure>
        )}
      </AnimatePresence>
    </div>
  );
}

function Card({
  item,
  index,
  count,
  width,
  height,
  rotation,
  spread,
  radius,
  reduce,
  hidden,
  showNumber,
  onOpen,
  onLoad,
}: {
  item: GalleryItem;
  index: number;
  count: number;
  width: number;
  height: number;
  rotation: MotionValue<number>;
  spread: MotionValue<number>;
  radius: MotionValue<number>;
  reduce: boolean;
  hidden: boolean;
  showNumber: boolean;
  onOpen: () => void;
  onLoad?: () => void;
}) {
  // карточка стоит ровно, двигается только её центр по окружности (старт — сверху)
  const base = (360 / count) * index - 90;
  // каждая следующая карточка выходит из стопки чуть позже — получается спираль
  const progress = useTransform(spread, (s) =>
    easeOut(clamp01((s - index * STAGGER) / (1 - (count - 1) * STAGGER))),
  );
  const x = useTransform(() => {
    const a = ((base + rotation.get()) * Math.PI) / 180;
    return Math.cos(a) * radius.get() * progress.get();
  });
  const y = useTransform(() => {
    const a = ((base + rotation.get()) * Math.PI) / 180;
    return Math.sin(a) * radius.get() * progress.get();
  });
  // в стопке видна первая фотография: она сверху и чуть крупнее; в кольце — внахлёст по порядку
  const scale = useTransform(progress, (p) => (index === 0 ? 1.18 - 0.18 * p : 0.9 + 0.1 * p));

  return (
    <motion.li
      className="absolute left-0 top-0"
      style={{ width, height, marginLeft: -width / 2, marginTop: -height / 2, x, y, scale, zIndex: count - index }}
    >
      <button
        type="button"
        // видимый номер — в начале имени, как требует WCAG 2.5.3 (label in name)
        aria-label={`${String(index + 1).padStart(3, "0")} ${item.title}${item.subtitle ? `, ${item.subtitle}` : ""} — открыть фото`}
        className="relative block h-full w-full cursor-pointer overflow-hidden rounded-[10px] bg-muted shadow-[0_22px_40px_-24px_rgba(43,39,51,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-deep"
        onClick={onOpen}
      >
        {!hidden && (
          <motion.img
            layoutId={reduce ? undefined : `circle-${index}`}
            src={item.src}
            alt=""
            draggable={false}
            onLoad={onLoad}
            className="h-full w-full object-cover"
          />
        )}
        {showNumber && (
          <span className="label absolute left-2.5 top-2 text-[10px] font-semibold text-paper drop-shadow-[0_1px_2px_rgba(43,39,51,0.7)]">
            {String(index + 1).padStart(3, "0")}
          </span>
        )}
      </button>
    </motion.li>
  );
}
