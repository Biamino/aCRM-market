import { useEffect, useState } from "react";
import logo from "../assets/asdem-logo.png";

const SESSION_KEY = "asdem_preloader_done";

/**
 * Fashion splash inspired by 21st Preloader (slide-up exit),
 * adapted to ASDEM logo + palette №4504. CSS-only motion.
 */
export default function Preloader() {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      document.body.style.overflow = prevOverflow;
      setVisible(false);
      return;
    }

    const show = window.setTimeout(() => setReady(true), 60);
    const exit = window.setTimeout(() => setExiting(true), 1500);
    const done = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      document.body.style.overflow = prevOverflow;
      setVisible(false);
    }, 2300);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(show);
      window.clearTimeout(exit);
      window.clearTimeout(done);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`preloader fixed inset-0 z-[100] flex items-center justify-center bg-ink ${
        exiting ? "preloader--exit" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      aria-label="Загрузка ASDEM"
    >
      <div className={`preloader__mark ${ready ? "preloader__mark--in" : ""}`}>
        <img src={logo} alt="ASDEM" width={280} height={80} className="h-14 w-auto md:h-20" />
        <span className="preloader__line" aria-hidden="true" />
      </div>
    </div>
  );
}
