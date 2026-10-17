import type { ReactNode } from "react";
import AnimatedContent from "../bits/AnimatedContent";
import { COMPANY } from "../../legal/company";

/** Ссылка на менеджера: WhatsApp, если номер задан в реквизитах, иначе e-mail поддержки. */
export const managerHref = COMPANY.whatsapp
  ? `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent("Здравствуйте! Хочу узнать про опт ASDEM.")}`
  : `mailto:${COMPANY.supportEmail}`;
export const managerLabel = COMPANY.whatsapp ? "Написать в WhatsApp" : "Написать менеджеру";

/** Мягкое появление при прокрутке (React Bits AnimatedContent); stagger — по дочерним элементам. */
export function Reveal({
  children,
  className = "",
  stagger = 0,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <AnimatedContent
      className={className}
      distance={28}
      duration={0.9}
      ease="power3.out"
      blur={6}
      threshold={0.15}
      stagger={stagger}
      delay={delay}
    >
      {children}
    </AnimatedContent>
  );
}

export function SectionHead({
  id,
  eyebrow,
  title,
  children,
  dark = false,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <Reveal className="max-w-2xl">
      <p className={`label ${dark ? "text-brand" : "text-dim"}`}>{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
        {title}
      </h2>
      {children && (
        <div className={`mt-5 space-y-3 text-sm leading-relaxed md:text-base ${dark ? "text-paper/70" : "text-dim"}`}>
          {children}
        </div>
      )}
    </Reveal>
  );
}

export const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);
