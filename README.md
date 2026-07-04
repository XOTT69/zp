# Калькулятор ЗП 2/2

SPA-калькулятор зарплати для ролей:

- `/service` - ЗП оператора сервісу
- `/supervisor` - ЗП СВ
- `/level4` - ЗП 4 лвл
- `/xd` - ЗП ХД

## Безпека

Авторизація працює через Vercel serverless API та Routing Middleware:

- `/api/login` перевіряє код ролі на сервері;
- `/api/session` повертає тільки дозволені для ролі калькулятори та ставки;
- `/api/logout` очищає сесію;
- `/api/page` віддає `index.html` тільки після серверної перевірки маршруту;
- `middleware.js` не пускає на закриті маршрути без валідної cookie;
- у клієнтський JS не віддаються ставки чужих ролей.

Коди ролей потрібно задати у Vercel Environment Variables:

- `OPERATOR_ACCESS_CODE`
- `SUPERVISOR_ACCESS_CODE`
- `LEVEL4_ACCESS_CODE`
- `XD_ACCESS_CODE`
- `AUTH_SECRET`

`AUTH_SECRET` має бути довгим випадковим рядком. Після зміни env-змінних потрібно зробити redeploy.

## Перевірка формул

```bash
npm run verify
```

Скрипт перевіряє операторів, СВ, 4 лвл і ХД на контрольних прикладах.

## Локальний запуск

Для повної перевірки авторизації потрібен Vercel dev/runtime, бо сайт використовує `/api/*` та `middleware.js`.

Статичний сервер показує лише HTML/CSS/JS, але не виконує Vercel API:

```bash
npm run dev
```

## Деплой на GitHub + Vercel

1. Створіть репозиторій на GitHub і запуште файли проєкту.
2. У Vercel натисніть `Add New Project`.
3. Оберіть GitHub-репозиторій.
4. Framework Preset: `Other`.
5. Додайте env-змінні з розділу `Безпека`.
6. Build Command залиште порожнім.
7. Output Directory залиште порожнім або `.`.
8. Натисніть `Deploy`.
