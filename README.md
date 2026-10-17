# ACRM Market — закрытый B2B-магазин

Version 2 облачной системы: закрытый оптовый каталог поверх баз C++ CRM
(`frontend_backend_package`). Маркет работает с несколькими **филиалами**: у каждого
своя CRM и своя база (по умолчанию **Asdem 1** → `crm_v1`, **Asdem 2** → `crm_dordoi`).
Товары, пачки, остатки, заказы, клиенты и долги филиала живут только в его базе.

## Архитектура данных

```
┌──────────────┐    ┌──────────────────────────┐
│ CRM Asdem 1  │───▶│ crm_v1      (+ web_*)    │◀──┐ X-Branch: asdem1
└──────────────┘    └──────────────────────────┘   │
┌──────────────┐    ┌──────────────────────────┐   │
│ CRM Asdem 2  │───▶│ crm_dordoi  (+ web_*)    │◀──┤ X-Branch: asdem2
└──────────────┘    └──────────────────────────┘   │
                    ┌──────────────────────────┐   │   ┌─────────────┐
                    │ аккаунты маркета         │◀──┴───│ Market API  │
                    │ (ACCOUNTS_DB_NAME)       │       └─────────────┘
                    └──────────────────────────┘
```

На сайте покупатель выбирает филиал переключателем: каталог, корзина, заказы и
админка показываются по выбранному. Клиент шлёт заголовок `X-Branch`, сервер
(`server/src/db.ts`) направляет все запросы к CRM в базу этого филиала. Корзина
у каждого филиала своя — заказ уходит в один филиал.

Аккаунт покупателя один на все филиалы. Карточка клиента (`customers`) в CRM
филиала создаётся при первом заказе там и запоминается в `web_account_customers`.

Таблицы CRM не меняются. Маркет добавляет:

| Таблица | Где | Назначение |
|---|---|---|
| `web_accounts` | база аккаунтов | B2B-логины (общие для филиалов) |
| `web_price_groups` | база аккаунтов | ценовые множители (Стандарт / Опт+ / VIP) |
| `web_account_customers` | база аккаунтов | клиент CRM аккаунта в каждом филиале |
| `web_product_details` | база филиала | карточка витрины + `is_visible` (какие модели показать) |
| `web_product_images` | база филиала | фото маркета (`uploads/<филиал>/…`, путь в БД) |
| `web_consignment_items` | база филиала | позиции реализации |
| `web_settings` | база филиала | настройки аналитики |

Заказы с сайта пишутся в общие `orders` / `order_items` по правилам CRM:
статус `new`, позиции-черновики с выбранным цветом (`order_items.color`), без резерва.
Дальше пайплайн CRM: `new → warehouse` (резерв пачек) `→ ready` (собрано) `→ completed`
(списание + начисление долга `charge` в `customer_ledger`). Логика переходов
повторяет C++ бэкенд — см. `server/src/crm.ts`.

`npm run db:schema` также идемпотентно создаёт колонки/таблицы свежей CRM
(`product_categories`, `product_colors`, `product_photos`, `order_items.color/picked`,
`orders.discount_sum`), если C++ бэкенд на этой базе ещё не запускался.

## Стек

- **Клиент:** React + Vite + TypeScript, Tailwind CSS 4, Recharts
- **Сервер:** Express + TypeScript, `mysql2`, JWT
- **БД:** MariaDB 11 (`crm_v1`, `crm_dordoi`), порт хоста **3307**

## Запуск

### 1. База (один раз)

```bash
docker compose up -d

# если базы пустые — загрузить дамп CRM в базу каждого филиала
# (crm_dordoi создаётся при первом запуске контейнера, server/db/docker-init):
docker exec -i acrm-mariadb mariadb -ucrm -pcrm_pass crm_v1 \
  < "/Users/molva/Downloads/frontend_backend_package (1)/crm_v1_frontend_dump.sql"

# …или только схему CRM (--force: таблица import_raw_rows несовместима с MariaDB 11)
docker exec -i acrm-mariadb mariadb --force -uroot -pcrm_root crm_dordoi < server/db/database_schema_v1.sql

# web_* таблицы + демо-аккаунты и демо-товары во всех филиалах (не затирает данные CRM;
# только для локальной базы — на другом DB_HOST нужен SEED_FORCE=1)
npm run db:setup

# только схема витрины (видимость, фото), без пересоздания демо
npm run db:schema
```

### 2. Приложение

```bash
npm install
npm run dev
```

- Сайт: http://localhost:5173  
- API:  http://localhost:4000  

Параметры БД (по умолчанию как в `docker-compose.yml`):

```
DB_HOST=127.0.0.1  DB_PORT=3307  DB_USER=crm  DB_PASSWORD=crm_pass
```

Филиалы задаются JSON-ом. У каждой CRM свои фото — укажите её `crmUploadDir`
(как `CRM_UPLOAD_DIR` бэкенда) или адрес бэкенда:

```
BRANCHES='[{"id":"asdem1","name":"Asdem 1","db":"crm_v1","crmUploadDir":"/srv/crm1/uploads"},
           {"id":"asdem2","name":"Asdem 2","db":"crm_dordoi","crmApiOrigin":"http://127.0.0.1:8081"}]'
ACCOUNTS_DB_NAME=crm_v1   # где хранить аккаунты маркета (по умолчанию база первого филиала)
```

`id` филиала попадает в ссылки на фото и в `web_account_customers` — после запуска его не меняют.

### Прод: SEO и раздача клиента

```
SITE_URL=https://asdem.kg     # адрес маркета: canonical, OG, sitemap (и при сборке клиента)
CLIENT_DIST=/srv/market/dist  # по умолчанию ../client/dist — если собран, сервер раздаёт его сам
```

Если клиент собран (`SITE_URL=… npm run build -w client`), API-сервер сам отдаёт SPA со сжатием и кэшем
(`/assets` — год, `index.html` — без кэша) и подставляет title/OG в `/product/:id` — превью ссылок
в WhatsApp/Telegram показывают фото и название модели. `GET /robots.txt` и `/sitemap.xml` (модели всех
филиалов, категории, документы) отдаёт сервер — если перед ним nginx со своей статикой, проксируйте эти
два пути на API. Фото из админки сжимаются в WebP (до 1600 px + превью 640 px).

### 3. Тесты

```bash
npm test -w server         # юнит + интеграционные; нужна локальная MariaDB, база пересоздаётся сидом
npm run test:unit -w server
```

## Демо-доступы маркета

| Роль | Логин | Пароль |
|---|---|---|
| Админ маркета | `admin@market.ru` | `admin123` |
| Клиент (Стандарт) | `client@shop.ru` | `client123` |
| Клиент (Опт+) | `opt@moda.ru` | `client123` |
| Клиент (VIP) | `vip@trend.ru` | `client123` |
| Ожидает одобрения | `new@client.ru` | `client123` |

`npm run db:setup` пересоздаёт только WEB-демо-товары и web-аккаунты;
импортированные из Microinvest товары/заказы CRM не трогает.

## Что реализовано (ТЗ 6.1–6.4)

- Закрытая регистрация → одобрение → карточка в `customers` филиала при первом заказе
- Филиалы Asdem 1 / Asdem 2: переключатель на сайте и в админке, своя корзина и заказы у каждого
- Каталог и остатки из `products` / `product_variants` / `packs` / `pack_items`
- Остаток общий на модель (как в CRM); цвета — из `product_colors` (с hex), переключаются на карточке
- Цены по `wholesale_price` × ценовая группа; гость цены не видит
- Корзина: только полные пачки, резерв в CRM
- История заказов клиента по `customer_id`
- Аналитика и текстовые выводы по общим продажам/долгам/поставщикам
- Расширенная карточка в `web_product_details`
- Админ включает/скрывает модели CRM на витрине и загружает фото по цветам (не в CRM);
  если своих фото нет — показываются фото из CRM (`product_photos`)
- Категории — из справочника CRM `product_categories`
- Долги в аналитике — по журналу `customer_ledger`, как в CRM

Фото CRM маркет отдаёт по `/api/crm-photos/:branch/:file`: с диска, если у филиала задан `crmUploadDir`
(тот же, что у C++ бэкенда), иначе редиректом на `crmApiOrigin` филиала (по умолчанию `CRM_API_ORIGIN` или `http://localhost:8080`).

## Юридические документы

На сайте: `/legal/terms`, `/legal/privacy`, `/legal/offer`, `/legal/cookies`,
`/legal/consent`, `/legal/returns`. Ссылки в футере; согласия — в форме регистрации;
cookie-баннер при первом визите.

Перед продакшеном заполните реквизиты в `client/src/legal/company.ts`
(юрлицо, ИНН, адрес, телефоны, e-mail) и отдайте тексты на проверку юристу.

## Структура

```
client/                 React SPA
client/src/legal/       тексты юр. документов и реквизиты
server/src/             Express API
server/db/
  database_schema_v1.sql   схема CRM (копия из пакета)
  market_schema.sql        web_* расширения
  seed.ts                  демо-аккаунты и WEB-* товары
docker-compose.yml      MariaDB на :3307
```
