# HR & Legal Services — три отдельных документа

Упрощённая система: **каждый тип документа — своя страница админки и своя страница для клиента**. Нет общей формы, библиотеки шаблонов и лишних полей.

## Типы документов

| Документ | Админка | Страница клиента | Подпись |
|----------|---------|------------------|---------|
| Отчёт регулятора | `admin/report.html` | `sign/report.html` | Нет, только просмотр |
| Исковое заявление | `admin/claim.html` | `sign/claim.html` | Биометрия 2.5 сек |
| Договор на услуги | `admin/contract.html` | `sign/contract.html` | Биометрия 2.5 сек |

Стартовая страница: **`index.html`** — выбор типа документа.

## Поля по документам

**Отчёт:** номер, дата, ФИО, суммы по трём счетам, заблокированные и активные средства.

**Иск:** ФИО, год рождения, суд, истец, адрес, телефон, ответчик, сумма иска.

**Договор:** номер, дата, ФИО, сумма ущерба.

## Структура

```
├── index.html
├── admin/
│   ├── report.html
│   ├── claim.html
│   └── contract.html
├── sign/
│   ├── report.html
│   ├── claim.html
│   └── contract.html
├── assets/
│   ├── styles.css
│   ├── templates.js
│   ├── app.js
│   ├── admin-page.js
│   └── sign-page.js
└── data/
    ├── signed_report.json
    ├── signed_claim.json
    └── signed_contract.json
```

## GitHub Pages

1. Загрузите репозиторий на GitHub.
2. Settings → Pages → branch `main`, folder `/ (root)`.
3. Откройте `https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПО/`.

В каждой админке один раз укажите **GitHub token**, owner, repo. Для каждого типа документа свой файл подписей в `data/`.

## Три отдельных репозитория (по желанию)

Если нужны **три проекта на GitHub**, скопируйте в каждый репозиторий только нужную пару:

- **contract-report:** `index.html` → редирект на `admin/report.html`, папки `admin/report.html`, `sign/report.html`, `assets/`, `data/signed_report.json`
- **contract-claim:** то же для claim
- **contract-legal:** то же для contract

Общие настройки GitHub (token) хранятся в localStorage браузера и работают на всех страницах одного домена.

## Использование

1. Откройте `index.html` → выберите тип документа.
2. Заполните **только** поля этого документа.
3. «Создать ссылку» → отправьте клиенту.
4. «Синхронизировать» — подтянуть подписи из GitHub.

© 2026 HR & Legal Services
