import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "asdem_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, "accepted");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Уведомление о cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/95 px-4 py-4 shadow-[0_-8px_30px_rgba(48,48,68,0.08)] backdrop-blur-sm md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-dim md:text-sm">
          Сайт использует необходимые cookie и локальное хранилище для входа и корзины. Подробнее — в{" "}
          <Link to="/legal/cookies" className="text-brand-deep underline">
            Политике cookie
          </Link>{" "}
          и{" "}
          <Link to="/legal/privacy" className="text-brand-deep underline">
            Политике конфиденциальности
          </Link>
          .
        </p>
        <button type="button" className="btn shrink-0 px-6" onClick={accept}>
          Понятно
        </button>
      </div>
    </div>
  );
}
