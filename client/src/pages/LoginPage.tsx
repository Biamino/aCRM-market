import { useState } from "react";
import { Link, useLocation, useNavigate, type Location } from "react-router-dom";
import { useAuth } from "../store";
import { usePageMeta } from "../usePageMeta";

export default function LoginPage() {
  usePageMeta({ title: "Вход для партнёров", noindex: true });
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl">Вход</h1>
      <p className="mt-2 text-sm text-dim">Доступ только для одобренных партнёров.</p>

      <form
        className="mt-8 space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const user = await login(email, password);
            if (from) navigate(`${from.pathname}${from.search}`, { replace: true });
            else navigate(user.role === "ADMIN" ? "/admin" : "/");
          } catch (err: any) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="email" className="label mb-1 block text-dim">
            E-mail
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label mb-1 block text-dim">
            Пароль
          </label>
          <div className="flex items-center gap-2">
            <input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            <button type="button" className="label cursor-pointer whitespace-nowrap text-dim hover:text-ink" onClick={() => setShowPass(!showPass)}>
              {showPass ? "Скрыть" : "Показать"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="border border-red-700 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn w-full" disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-sm text-dim">
        Нет доступа?{" "}
        <Link to="/register" className="text-brand-deep underline">
          Оставить заявку на регистрацию
        </Link>
      </p>
    </div>
  );
}
