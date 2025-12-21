# Revenue Errors API - Event Coverage

## Overview

API endpoint `/api/revenue-errors` отслеживает **только ошибки** RevenueCat для мониторинга проблем с оплатой.

---

## ✅ События, которые ОТОБРАЖАЮТСЯ в API

### Direct Error Events

1. `purchase_package_error` - Ошибка при покупке
2. `restore_purchases_error` - Ошибка восстановления покупок
3. `load_offerings_error` - Ошибка загрузки offerings
4. `failed_check_subscription` - Ошибка проверки подписки
5. `revenue_cat_configure_error` - Ошибка конфигурации RevenueCat
6. `revenue_cat_posthog_user_id_error` - Ошибка синхронизации PostHog User ID

### Price Screen Action Errors

7. `price_screen_action` с action:
   - `purchase_error` - Ошибка покупки на экране оплаты
   - `restore_error` - Ошибка восстановления на экране оплаты
   - `package_load_failed` - ⚠️ **НОВОЕ**: Ошибка загрузки packages при попытке покупки

---

## ❌ События, которые НЕ ОТОБРАЖАЮТСЯ (Success Events)

Эти события показывают успешные операции и не являются ошибками:

### Configuration Events

- `revenue_cat_configure_started` - Начало конфигурации
- `revenue_cat_configure_success` - Успешная конфигурация

### Offerings Events

- `load_offerings_started` - Начало загрузки offerings
- `load_offerings_success` - Успешная загрузка offerings
- `load_offerings_no_current` - Нет текущего offering (не ошибка)

### Purchase Events

- `purchase_package_started` - Начало покупки
- `purchase_package_store_initiated` - App Store показал окно оплаты
- `purchase_package` - Успешная покупка

### Restore Events

- `restore_purchases_started` - Начало восстановления
- `restore_purchases` - Успешное восстановление

### Other Events

- `revenue_cat_posthog_user_id_set` - PostHog User ID установлен
- `premium_cache_invalidated` - Кэш premium статуса сброшен
- `premium_access_checked` - Проверка premium доступа

---

## API Request Example

```bash
GET /api/revenue-errors?dateFrom=2025-12-01T00:00:00Z&dateTo=2025-12-21T23:59:59Z
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-12-20T13:53:52.281Z",
      "errorType": "failed_check_subscription",
      "errorMessage": "Error performing request because the internet connection appears to be offline.",
      "context": "legacy_check",
      "userId": "fab9ea14-8671-4ae2-a0b8-5a6174fdfd50",
      "country": "US",
      "platform": "ios",
      "errorCode": "35",
      "specificErrorType": "unknown_error",
      "reason": "",
      "duration": 194,
      "userMessage": "",
      "isUserCancelled": false,
      "isNetworkError": false,
      "isStoreError": false
    }
  ],
  "count": 1
}
```

---

## Error Properties Explained

| Property            | Type            | Description                                      |
| ------------------- | --------------- | ------------------------------------------------ |
| `timestamp`         | string          | Время возникновения ошибки (ISO 8601)            |
| `errorType`         | string          | Тип события (например, `purchase_package_error`) |
| `errorMessage`      | string          | Сообщение об ошибке                              |
| `context`           | string \| null  | Контекст вызова (например, `legacy_check`)       |
| `userId`            | string \| null  | ID пользователя                                  |
| `country`           | string \| null  | Код страны                                       |
| `platform`          | string \| null  | Платформа (`ios` или `android`)                  |
| `errorCode`         | string \| null  | Код ошибки RevenueCat                            |
| `specificErrorType` | string \| null  | Специфичный тип ошибки                           |
| `reason`            | string \| null  | Причина ошибки                                   |
| `duration`          | number \| null  | Длительность операции (мс)                       |
| `userMessage`       | string \| null  | Сообщение для пользователя                       |
| `isUserCancelled`   | boolean \| null | Пользователь отменил операцию                    |
| `isNetworkError`    | boolean \| null | Сетевая ошибка                                   |
| `isStoreError`      | boolean \| null | Ошибка App Store                                 |

---

## Error Code Reference

Полный список error codes из `usePackages.ts`:

| Code | Type               | Description                        |
| ---- | ------------------ | ---------------------------------- |
| 1    | `user_cancelled`   | Пользователь отменил покупку       |
| 2    | `store_problem`    | Проблема с App Store               |
| 9    | `network_error`    | Сетевая ошибка                     |
| 10   | `network_error`    | Сетевая ошибка / Invalid receipt   |
| 15   | `ineligible_error` | Операция уже выполняется           |
| 20   | `payment_pending`  | Платеж отложен                     |
| 35   | `network_offline`  | Устройство offline (кастомный код) |

---

## Future Enhancements

### Опциональный параметр `includeSuccess`

Для получения всех событий (включая success):

```bash
GET /api/revenue-errors?dateFrom=...&dateTo=...&includeSuccess=true
```

Это позволит анализировать полный цикл операций, а не только ошибки.

---

## Query Performance

- **Limit**: 1000 записей
- **Sorting**: По timestamp (DESC)
- **Index**: PostHog автоматически индексирует `timestamp` и `event`

Для больших диапазонов дат рекомендуется использовать пагинацию.

---

**Last Updated**: 21 декабря 2025
