import { q } from "./db.js";

/**
 * Номер для сравнения: только цифры, без местного префикса.
 * «0700 123 456» (KG) и «8 701 846 3971» (KZ/RU) приводятся к виду, совпадающему
 * с хвостом международного «+996 700 123 456» / «+7 701 846 3971».
 */
export function phoneKey(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = d.slice(1);
  return d.replace(/^0+/, "");
}

/** Один номер, записанный по-разному: короткий совпадает с хвостом длинного (не короче 9 цифр). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = phoneKey(a);
  const y = phoneKey(b);
  if (x.length < 9 || y.length < 9) return false;
  return x.endsWith(y) || y.endsWith(x);
}

export interface CrmCustomerMatch {
  id: number;
  name: string;
  /** по какому контакту нашли */
  by: "email" | "phone";
}

/**
 * Клиент в CRM текущего филиала с тем же e-mail или телефоном (телефон ищем и среди WhatsApp).
 * Совпадение по e-mail важнее; среди равных — самая старая карточка. Архивные не берём.
 */
export async function findCrmCustomer(contact: {
  email?: string | null;
  phone?: string | null;
}): Promise<CrmCustomerMatch | null> {
  const email = contact.email?.trim().toLowerCase() || null;
  const phone = phoneKey(contact.phone);
  if (!email && phone.length < 9) return null;

  // RIGHT(…, 9) сужает выборку в SQL, точное сравнение — samePhone
  const rows = await q<{ id: number; name: string; contact_type: string; value: string }>(
    `SELECT c.id, c.name, cc.contact_type, cc.value
     FROM customer_contacts cc
     JOIN customers c ON c.id = cc.customer_id
     WHERE COALESCE(c.is_archived, 0) = 0
       AND ((cc.contact_type = 'email' AND LOWER(TRIM(cc.value)) = ?)
         OR (cc.contact_type IN ('phone', 'whatsapp') AND RIGHT(REGEXP_REPLACE(cc.value, '[^0-9]', ''), 9) = ?))
     ORDER BY c.id`,
    [email ?? "", phone.length >= 9 ? phone.slice(-9) : "-"],
  );
  const byEmail = rows.find((r) => r.contact_type === "email");
  if (byEmail) return { id: Number(byEmail.id), name: byEmail.name, by: "email" };
  const byPhone = rows.find((r) => r.contact_type !== "email" && samePhone(r.value, contact.phone));
  return byPhone ? { id: Number(byPhone.id), name: byPhone.name, by: "phone" } : null;
}
