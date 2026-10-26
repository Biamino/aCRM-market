# Разделение маркета на два сайта

| Сайт | Домен | Филиал / база CRM | CRM-бэкенд |
|---|---|---|---|
| ASDEM | https://asdem.shop | `asdem1` → `crm_v1` | crm-backend :8080 (crm.asdem.shop) |
| ASDEM Пижамы | https://asdem-pijamy.shop | `asdem2` → `crm_dordoi` | crm-dordoi :8081 (dordoi.space) |

Оба домена смотрят на один VPS `169.58.191.246` (DNS для `asdem-pijamy.shop` и `www.` уже указывает туда,
проверено 2026-10-26).

## Состояние прода сейчас (снято 2026-10-26)

- Один процесс `acrm-market.service` (node :4000, `/opt/acrm-market`, env `/etc/acrm-market.env`),
  в `BRANCHES` два филиала, на сайте переключатель филиалов.
- Аккаунты маркета лежат в `crm_v1` (`ACCOUNTS_DB_NAME=crm_v1`): 2 аккаунта — админ (#1) и клиент (#2).
  Клиент #2 привязан только к `asdem2` (клиент CRM #299), у него 1 веб-заказ в `crm_dordoi`.
- `web_product_details`: crm_v1 — 141 видимая модель, crm_dordoi — 372. Своих фото маркета нет (`uploads` пуст),
  показываются фото CRM из `/opt/crm-backend/uploads` и `/opt/crm-dordoi/uploads`.
- DB-пользователь `acrm_market@127.0.0.1` имеет ALL на обе базы.
- nginx: `asdem.shop` → proxy :4000; сертификаты Let's Encrypt, certbot.timer работает.
- ufw пускает только 22/80/443, но node слушает `*:4000` (не только localhost).
- Ресурсы: 4 CPU, 7.8 ГБ RAM (свободно ~5.5), диск 88 ГБ свободно — второй процесс node влезает спокойно.

## Целевая архитектура

```
                      nginx :443
        ┌───────────────┴────────────────┐
  asdem.shop                     asdem-pijamy.shop (+ www → 301)
        │                                │
  acrm-market@asdem :4000        acrm-market@pijamy :4001      ← один код /opt/acrm-market,
  env /etc/acrm-market/asdem.env env /etc/acrm-market/pijamy.env   два экземпляра systemd
  client/dist-asdem              client/dist-pijamy             ← клиент собран под каждый сайт
  uploads /var/lib/acrm-market/asdem   /var/lib/acrm-market/pijamy
        │                                │
  DB user acrm_market → crm_v1   DB user acrm_pijamy → crm_dordoi
  (CRM + web_* + аккаунты)       (CRM + web_* + аккаунты)
```

Принципы:

1. **Один репозиторий, один код, одна сборка сервера.** Сайты отличаются только env-файлом и сборкой клиента.
   Доработки UI делаем один раз — оба сайта получают их при деплое.
2. **Каждый сайт — один филиал.** `BRANCHES` с одним элементом; в интерфейсе филиалов нет вообще
   (переключатель удалён), регистрации/админка/sitemap работают по одной базе.
3. **id филиала не меняем** (`asdem1`, `asdem2`): он записан в `web_account_customers` и в путях фото.
   Меняется только отображаемое имя.
4. **Аккаунты раздельные:** у каждого сайта своя база аккаунтов = своя база CRM. Логин на asdem.shop
   не действует на asdem-pijamy.shop (разные домены — разный localStorage, разные `JWT_SECRET`).
5. **Изоляция:** отдельный DB-пользователь на сайт с правами только на свою базу; node слушает 127.0.0.1.

## Доработки кода (сделать вместе с UI, до деплоя)

Сервер:
- [ ] `server/src/index.ts` — `app.listen(PORT, process.env.HOST ?? "127.0.0.1")`.
- [ ] `server/src/product-media.ts` — `UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads")`,
      чтобы фото двух сайтов не жили в одной папке кода.
- [ ] `server/src/seo.ts` — бренд в title/описании товара из `SITE_NAME` (сейчас зашит `ASDEM`).

Клиент (профиль сайта через режимы Vite: `client/.env.asdem`, `client/.env.pijamy`):
- [ ] `VITE_SITE_NAME`, `VITE_SITE_TITLE`, `VITE_SITE_DESCRIPTION`, контакты (WhatsApp, телефон, e-mail) —
      в `client/src/legal/company.ts` и `landing/shared.tsx` брать из `import.meta.env`.
- [ ] `client/index.html` — плейсхолдеры `%SITE_NAME%`, `%SITE_TITLE%`, `%SITE_DESCRIPTION%`, телефон в JSON-LD;
      расширить плагин `siteUrl` в `vite.config.ts` (сейчас подставляет только `%SITE_URL%`).
- [ ] `site.webmanifest`, `og-image.jpg`, логотипы/иконки — если у второго сайта свои, класть в
      `client/public-<site>/` и выбирать через `publicDir` по режиму.
- [x] Филиалы убраны из интерфейса целиком: нет переключателя, названия филиала в корзине/заказах/админке,
      FAQ «Asdem 1 и Asdem 2», цифры «склада-филиала». **Ломает текущий прод с двумя филиалами** —
      выкатывать только вместе с разделением.
- [x] Профиль сайта: `VITE_SITE` (`client/.env.asdem`, `client/.env.pijamy`), телефоны/e-mail в
      `client/src/legal/company.ts`; скрипты `build:asdem` / `build:pijamy` в `client/package.json`.
- [ ] ~~Скрипт `build:sites`~~ (заменён скриптами выше) в корневом `package.json`:
      `vite build --mode asdem --outDir dist-asdem` и `vite build --mode pijamy --outDir dist-pijamy`.

## Деплой (один раз, после доработок)

Ожидаемое время ~40 мин, простой asdem.shop — только перезапуск (секунды).
Шаблоны лежат рядом: `deploy/systemd/`, `deploy/env/`, `deploy/nginx/`, `deploy/sql/`.

### 0. Бэкап
```bash
mysqldump --single-transaction crm_v1 web_accounts web_price_groups web_account_customers \
  > /root/backup/market-accounts-$(date +%F).sql
cp /etc/acrm-market.env /root/backup/
mysqldump --single-transaction crm_dordoi > /root/backup/crm_dordoi-$(date +%F).sql   # на всякий случай
```

### 1. Код и сборка (как пользователь crm)
```bash
git archive <commit> | tar -x -C /opt/acrm-market
cd /opt/acrm-market && npm ci
npm run build -w server
SITE_URL=https://asdem.shop        npm run build:asdem  -w client
SITE_URL=https://asdem-pijamy.shop npm run build:pijamy -w client
mkdir -p /var/lib/acrm-market/{asdem,pijamy}/uploads   # владелец crm
```

### 2. База для второго сайта
```sql
CREATE USER 'acrm_pijamy'@'127.0.0.1' IDENTIFIED BY '<новый пароль>';
GRANT ALL PRIVILEGES ON crm_dordoi.* TO 'acrm_pijamy'@'127.0.0.1';
```
Создать таблицы аккаунтов в `crm_dordoi` (web_* витрины там уже есть):
```bash
cd /opt/acrm-market/server && set -a && . /etc/acrm-market/pijamy.env && set +a && npm run db:schema
```
Перенести аккаунты: `mysql < deploy/sql/split-accounts.sql` (копирует аккаунты в crm_dordoi,
привязки `asdem2` переносит, из crm_v1 их удаляет).

### 3. systemd
```bash
install -m644 deploy/systemd/acrm-market@.service /etc/systemd/system/
mkdir -p /etc/acrm-market && chmod 750 /etc/acrm-market
# asdem.env — из /etc/acrm-market.env: BRANCHES только asdem1, UPLOAD_DIR, CLIENT_DIST=dist-asdem
# pijamy.env — новый JWT_SECRET (openssl rand -hex 32), пароль acrm_pijamy
chmod 640 /etc/acrm-market/*.env && chown root:crm /etc/acrm-market/*.env
systemctl daemon-reload
systemctl enable --now acrm-market@pijamy          # :4001, проверить curl 127.0.0.1:4001/api/branches
systemctl disable --now acrm-market && systemctl enable --now acrm-market@asdem   # переключение asdem.shop
```

### 4. nginx + SSL
```bash
cp deploy/nginx/asdem-pijamy.shop.conf /etc/nginx/sites-available/asdem-pijamy.shop
ln -s ../sites-available/asdem-pijamy.shop /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d asdem-pijamy.shop -d www.asdem-pijamy.shop
```
В `asdem.shop` добавить редиректы старых ссылок на товары второго филиала (сниппет в
`deploy/nginx/asdem.shop.redirects.conf`): `/product/:id?branch=asdem2` → `https://asdem-pijamy.shop/product/:id`
(id моделей те же — это id из `crm_dordoi`).

### 5. Проверка
- `https://asdem.shop/api/branches` → один филиал `asdem1`; на сайте нет переключателя.
- `https://asdem-pijamy.shop/api/branches` → один филиал `asdem2`; каталог 372 модели, фото CRM открываются.
- Вход админом на обоих сайтах, клиент #2 видит свой заказ на asdem-pijamy.shop.
- `/sitemap.xml` и `/robots.txt` на каждом домене со своим адресом.
- `https://asdem.shop/product/<id>?branch=asdem2` → 301 на asdem-pijamy.shop.
- `ss -ltnp | grep -E '400[01]'` — оба на 127.0.0.1.
- После проверки: `REVOKE ALL PRIVILEGES ON crm_dordoi.* FROM 'acrm_market'@'127.0.0.1';`
- Google Search Console / Яндекс Вебмастер: добавить asdem-pijamy.shop и отправить sitemap.

### Откат
`systemctl disable --now acrm-market@asdem acrm-market@pijamy && systemctl enable --now acrm-market`,
вернуть строки `web_account_customers` из бэкапа, убрать сайт из nginx. Старый `client/dist` и
`/etc/acrm-market.env` не удаляем до конца проверки.

## Открытые вопросы
1. Бренд второго сайта: название (как будет в шапке/title), логотип, цвета, WhatsApp/телефон менеджера.
2. Отображаемое имя филиала в `BRANCHES` для asdem-pijamy (сейчас «Asdem 2»).
3. Клиентские аккаунты: копировать всех на оба сайта (по умолчанию в скрипте) или каждого только туда,
   где у него есть привязка к CRM.
