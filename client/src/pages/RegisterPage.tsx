import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  if (done)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-3xl">Заявка отправлена</h1>
        <p className="mt-4 text-sm leading-relaxed text-dim">
          Администратор проверит данные и откроет доступ к ценам и остаткам. Обычно это занимает один
          рабочий день.
        </p>
        <Link to="/" className="btn-ghost mt-8 inline-flex">
          Вернуться в каталог
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl">Заявка на доступ</h1>
      <p className="mt-2 text-sm text-dim">
        Регистрация закрытая: доступ к ценам и заказам откроется после одобрения администратором.
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!acceptTerms || !acceptPrivacy) {
            setError("Необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await api("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                ...form,
                acceptedTermsAt: new Date().toISOString(),
                acceptedPrivacyAt: new Date().toISOString(),
              }),
            });
            setDone(true);
          } catch (err: any) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="name" className="label mb-1 block text-dim">
            Контактное лицо <span aria-hidden="true">*</span>
          </label>
          <input id="name" required autoComplete="name" value={form.name} onChange={set("name")} className="input" />
        </div>
        <div>
          <label htmlFor="company" className="label mb-1 block text-dim">
            Компания / магазин
          </label>
          <input id="company" autoComplete="organization" value={form.company} onChange={set("company")} className="input" />
        </div>
        <div>
          <label htmlFor="phone" className="label mb-1 block text-dim">
            Телефон
          </label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} className="input" />
        </div>
        <div>
          <label htmlFor="reg-email" className="label mb-1 block text-dim">
            E-mail <span aria-hidden="true">*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="label mb-1 block text-dim">
            Пароль <span aria-hidden="true">*</span>
          </label>
          <input
            id="reg-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            className="input"
          />
          <p className="mt-1 text-xs text-dim">Не менее 6 символов.</p>
        </div>

        <fieldset className="space-y-3 border-t border-line pt-4">
          <legend className="label mb-2 text-dim">Юридические согласия</legend>
          <label className="flex cursor-pointer gap-3 text-xs leading-relaxed text-dim">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-deep)]"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
            />
            <span>
              Принимаю{" "}
              <Link to="/legal/terms" className="text-brand-deep underline" target="_blank" rel="noreferrer">
                Пользовательское соглашение
              </Link>
              ,{" "}
              <Link to="/legal/offer" className="text-brand-deep underline" target="_blank" rel="noreferrer">
                Публичную оферту
              </Link>{" "}
              и{" "}
              <Link to="/legal/cookies" className="text-brand-deep underline" target="_blank" rel="noreferrer">
                Политику cookie
              </Link>
              .
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 text-xs leading-relaxed text-dim">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-deep)]"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              required
            />
            <span>
              Даю{" "}
              <Link to="/legal/consent" className="text-brand-deep underline" target="_blank" rel="noreferrer">
                согласие на обработку персональных данных
              </Link>{" "}
              и подтверждаю ознакомление с{" "}
              <Link to="/legal/privacy" className="text-brand-deep underline" target="_blank" rel="noreferrer">
                Политикой конфиденциальности
              </Link>
              .
            </span>
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="border border-red-700 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn w-full" disabled={busy || !acceptTerms || !acceptPrivacy}>
          {busy ? "Отправляем…" : "Отправить заявку"}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-sm text-dim">
        Уже есть доступ?{" "}
        <Link to="/login" className="text-brand-deep underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
