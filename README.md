# ACRM Market — закрытый B2B-магазин

Version 2 облачной системы: закрытый оптовый каталог поверх **той же MariaDB `crm_v1`**,
что использует C++ CRM-бэкенд (`frontend_backend_package`). Товары, пачки, остатки,
заказы, клиенты и долги — общие.

## Архитектура данных

```
┌─────────────────────┐     ┌──────────────────────┐
│  CRM (C++ / Qt UI)  │────▶│  MariaDB crm_v1      │
└─────────────────────┘     │  products, packs,    │
                            │  orders, customers…  │
┌─────────────────────┐     │  + web_* расширения  │
│  Market (React API) │────▶│  web_accounts, …     │
└─────────────────────┘     └──────────────────────┘
```

Таблицы CRM не меняются. Маркет добавляет только:

| Таблица | Назначение |
|---|---|
| `web_accounts` | B2B-логины, привязка к `customers` |
| `web_price_groups` | ценовые множители (Стандарт / Опт+ / VIP) |
| `web_product_details` | карточка витрины + `is_visible` (какие модели показать) |
| `web_product_images` | фото маркета (файлы на диске, путь в БД) |
| `web_consignment_items` | позиции реализации |
| `web_settings` | настройки аналитики |

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
- **БД:** MariaDB 11 (`crm_v1`), порт хоста **3307**

## Запуск

### 1. База (один раз)

```bash
docker compose up -d

# если база пустая — загрузить дамп CRM:
docker exec -i acrm-mariadb mariadb -ucrm -pcrm_pass crm_v1 \
  < "/Users/molva/Downloads/frontend_backend_package (1)/crm_v1_frontend_dump.sql"

# web_* таблицы + демо-аккаунты маркета (не затирает данные CRM)
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
DB_HOST=127.0.0.1  DB_PORT=3307  DB_USER=crm  DB_PASSWORD=crm_pass  DB_NAME=crm_v1
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

- Закрытая регистрация → одобрение → карточка в `customers`
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

Фото CRM маркет отдаёт по `/api/crm-photos/:file`: с диска, если задан `CRM_UPLOAD_DIR`
(тот же, что у C++ бэкенда), иначе редиректом на `CRM_API_ORIGIN` (по умолчанию `http://localhost:8080`).

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
