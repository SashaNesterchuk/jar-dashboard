# Analytics Capture Events Documentation

**Last Updated**: 2025-01-XX  
**Version**: 1.0.0

## Overview

This document provides a comprehensive catalog of all analytics capture events used in the Mind Jar app. Each event is documented with:

- Human-readable description
- All properties (keys) used in the event
- Variable placeholders where applicable

**Note**: If a property's purpose is unknown, it is marked as `noop` to indicate it needs review.

---

## App Lifecycle

### `$pageview`

**Описание**: Автоматически отслеживается просмотр страницы (PostHog стандартное событие)

**Свойства**:

- `$current_url`: Название экрана/страницы
- `screen_name`: Название экрана

### `screen_viewed`

**Описание**: Пользователь просмотрел экран

**Свойства**:

- `screen_name`: Название экрана
- `timestamp`: Временная метка просмотра
- `entry_point`: Точка входа (например, "navigation")
- `tab`: Вкладка, с которой открыт экран

### `screen_load_time`

**Описание**: Время загрузки экрана

**Свойства**:

- `screen_name`: Название экрана
- `load_duration`: Длительность загрузки в миллисекундах
- `is_slow_load`: Флаг медленной загрузки (true если > 2000ms)
- `entry_point`: Точка входа

### `app_startup_time`

**Описание**: Время запуска приложения

**Свойства**:

- `startup_type`: Тип запуска ("cold" | "warm")
- `duration`: Длительность запуска в миллисекундах
- `is_slow_startup`: Флаг медленного запуска (true если > 3000ms)
- `timestamp`: Временная метка

---

## Onboarding

### `onboarding_step`

**Описание**: Действие пользователя в процессе онбординга

**Свойства**:

- `action`: Действие ("started" | "viewed" | "skipped" | "completed" | "abandoned")
- `page_number`: Номер страницы (начиная с 1, 0 для "started")
- `page_name`: Идентификатор страницы (например, "welcome", "permissions")
- `total_pages`: Общее количество страниц в онбординге
- `time_on_page_seconds`: Время на странице в секундах (для "viewed"/"skipped")
- `premium_active`: Статус премиум во время онбординга (true/false)
- `total_duration_seconds`: Общая длительность онбординга в секундах (для "completed")
- `last_page`: Последняя просмотренная страница (для "completed")
- `target_page`: Целевая страница при пропуске (для "skipped")

### `onboarding_paywall_action`

**Описание**: Действие пользователя на экране оплаты во время онбординга

**Свойства**:

- `action`: Действие ("viewed" | "period_selected" | "start_trial_pressed" | "restore_pressed" | "trial_started")
- `variant`: Вариант paywall ("price1" | "price2") - REQUIRED
- `selected_period`: Выбранный период оплаты ("monthly" | "annual")
- `currency_code`: Код валюты (например, "USD", "PLN")
- `source_practice_id`: ID практики, которая привела к paywall (для атрибуции покупки)
- `source_practice_name`: Название практики, которая привела к paywall (для атрибуции покупки)
- `practice_type`: Тип практики, которая привела к paywall (для атрибуции покупки)

### `onboarding_notification_time_changed`

**Описание**: Пользователь изменил время уведомлений во время онбординга

**Свойства**:

- `notification_type`: Тип уведомления
- `new_time`: Новое время уведомления

### `onboarding_package_save_failed`

**Описание**: Ошибка сохранения пакета подписки во время онбординга

**Свойства**:

- `error`: Сообщение об ошибке
- `package_identifier`: Идентификатор пакета

### `onboarding_package_saved`

**Описание**: Пакет подписки успешно сохранен во время онбординга

**Свойства**:

- `package_identifier`: Идентификатор пакета

---

## Practice Tracking

### `practice_started`

**Описание**: Пользователь начал практику (медитация, дневник, вопрос, дыхание)

**Свойства**:

- `event_id`: ID события практики (REQUIRED)
- `practice_type`: Тип практики ("journaling" | "meditation" | "question" | "breathing")
- `practice_name`: Название практики (REQUIRED)
- `plan_id`: ID элемента плана (если из плана)
- `slot`: Временной слот ("morning" | "day" | "evening") - опционально

### `practice_completed`

**Описание**: Пользователь успешно завершил практику

**Свойства**:

- `event_id`: ID события практики (должен совпадать с practice_started) (REQUIRED)
- `practice_type`: Тип практики
- `practice_name`: Название практики (REQUIRED)
- `completion_percentage`: Процент завершения (0-100, 100 = полное завершение)
- `duration_seconds`: Фактическая длительность в секундах
- `plan_id`: ID элемента плана

### `practice_abandoned`

**Описание**: Пользователь покинул практику до завершения

**Свойства**:

- `event_id`: ID события практики (должен совпадать с practice_started) (REQUIRED)
- `practice_type`: Тип практики
- `practice_name`: Название практики (REQUIRED)
- `completion_percentage`: Процент завершения (0-79% для покинутых)
- `duration_seconds`: Длительность в секундах
- `plan_id`: ID элемента плана

### `practice_type_selected`

**Описание**: Пользователь выбрал тип практики при добавлении

**Свойства**:

- `practice_type`: Выбранный тип ("breathing" | "meditation" | "question" | "journaling")

### `practice_template_selected`

**Описание**: Пользователь выбрал шаблон практики

**Свойства**:

- `practice_type`: Тип практики
- `template_id`: ID выбранного шаблона
- `template_title`: Название выбранного шаблона
- `slot`: Временной слот ("morning" | "day" | "evening")

---

## Meditation Specific Events

### `meditation_started`

**Описание**: Пользователь начал медитацию (специфичное событие для медитаций)

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события ("meditation")
- `event_time`: Выбранное время медитации

### `meditation_paused`

**Описание**: Пользователь поставил медитацию на паузу

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `event_time`: Выбранное время медитации
- `currentTime`: Текущее время воспроизведения в секундах

### `meditation_continued`

**Описание**: Пользователь возобновил медитацию после паузы

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `event_time`: Выбранное время медитации
- `currentTime`: Текущее время воспроизведения в секундах

### `meditation_slider_change`

**Описание**: Пользователь изменил позицию воспроизведения медитации (значимое изменение > 2 секунд)

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `from_time`: Время до изменения в секундах
- `to_time`: Время после изменения в секундах

### `meditation_finished`

**Описание**: Пользователь завершил медитацию

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `event_time`: Выбранное время медитации

### `meditation_rewind`

**Описание**: Пользователь перемотал медитацию вперед или назад

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `direction`: Направление перемотки ("backward" | "forward")
- `from_time`: Время до перемотки в секундах
- `to_time`: Время после перемотки в секундах

### `meditation_viewed`

**Описание**: Пользователь просмотрел завершенную медитацию

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

### `meditation_remove_pressed`

**Описание**: Пользователь нажал кнопку удаления медитации

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

### `meditation_removed`

**Описание**: Медитация была удалена

**Свойства**:

- `event_id`: ID события медитации
- `event_title`: Название медитации
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

### `ny_meditation_feedback_positive`

**Описание**: Пользователь дал положительный отзыв (лайк) на NY медитацию

**Свойства**:

- `event_id`: ID события медитации (должен совпадать с practice_started) (REQUIRED)
- `practice_type`: Тип практики (всегда "meditation")
- `practice_name`: Название NY медитации (REQUIRED)

### `ny_meditation_feedback_negative`

**Описание**: Пользователь дал отрицательный отзыв (дизлайк) на NY медитацию

**Свойства**:

- `event_id`: ID события медитации (должен совпадать с practice_started) (REQUIRED)
- `practice_type`: Тип практики (всегда "meditation")
- `practice_name`: Название NY медитации (REQUIRED)

---

## Breathing Events

### `breathe_event_finished`

**Описание**: Пользователь завершил дыхательное упражнение

**Свойства**:

- `event_id`: ID события дыхания
- `event_title`: Название дыхательного упражнения
- `event_time`: Выбранное время упражнения

### `breathe_event_paused`

**Описание**: Пользователь поставил дыхательное упражнение на паузу

**Свойства**:

- `event_id`: ID события дыхания
- `event_title`: Название дыхательного упражнения
- `event_time`: Выбранное время упражнения

### `breathe_event_continued`

**Описание**: Пользователь возобновил дыхательное упражнение после паузы

**Свойства**:

- `event_id`: ID события дыхания
- `event_title`: Название дыхательного упражнения
- `event_time`: Выбранное время упражнения

---

## Mood Check-in

### `mood_check_in_started`

**Описание**: Пользователь начал процесс проверки настроения

**Свойства**:

- `check_in_id`: Уникальный идентификатор проверки настроения (REQUIRED)
- `page_number`: Номер страницы (0 для старта)
- `page_name`: Название страницы ("mood_selection")
- `total_pages`: Общее количество страниц (обычно 5)

### `mood_page_viewed`

**Описание**: Пользователь просмотрел страницу в процессе проверки настроения

**Свойства**:

- `check_in_id`: ID проверки настроения (должен совпадать с mood_check_in_started) (REQUIRED)
- `page_number`: Номер страницы (0, 0.1, 1, 2, 3, 4, 5)
- `page_name`: Название страницы ("mood_selection" | "jar_animation" | "emotions" | "tags" | "chat" | "summary" | "ai_summary")
- `total_pages`: Общее количество страниц

### `mood_selected`

**Описание**: Пользователь выбрал настроение

**Свойства**:

- `check_in_id`: ID проверки настроения (REQUIRED)
- `page_number`: Номер страницы (обычно 0)
- `page_name`: Название страницы ("mood_selection")
- `selected_mood`: Выбранное значение настроения

### `emotions_selected`

**Описание**: Пользователь выбрал эмоции

**Свойства**:

- `check_in_id`: ID проверки настроения (REQUIRED)
- `page_number`: Номер страницы (обычно 1)
- `page_name`: Название страницы ("emotions")
- `selected_emotions`: Массив выбранных эмоций (массив строк с названиями)

### `tags_selected`

**Описание**: Пользователь выбрал теги

**Свойства**:

- `check_in_id`: ID проверки настроения (REQUIRED)
- `page_number`: Номер страницы (обычно 2)
- `page_name`: Название страницы ("tags")
- `selected_tags`: Массив выбранных тегов (массив строк с названиями)

### `mood_check_in_completed`

**Описание**: Пользователь завершил проверку настроения

**Свойства**:

- `check_in_id`: ID проверки настроения (REQUIRED)
- `page_number`: Номер последней страницы
- `page_name`: Название последней страницы ("summary" | "ai_summary")
- `selected_mood`: Финальное выбранное настроение
- `selected_emotions`: Финальные выбранные эмоции (массив строк)
- `selected_tags`: Финальные выбранные теги (массив строк)

### `mood_check_in_abandoned`

**Описание**: Пользователь покинул процесс проверки настроения до завершения

**Свойства**:

- `check_in_id`: ID проверки настроения (REQUIRED)
- `page_number`: Номер последней просмотренной страницы

---

## Price Screen / Paywall

### `price_screen_action`

**Описание**: Действие пользователя на экране оплаты (унифицированное событие)

**Свойства**:

- `action`: Действие ("viewed" | "period_selected" | "start_trial_pressed" | "purchase_started" | "purchase_success" | "purchase_error" | "restore_pressed" | "restore_started" | "restore_success" | "restore_error" | "package_not_available")
- `variant`: Вариант paywall ("price1" | "price2") - опционально
- `selected_period`: Выбранный период оплаты ("monthly" | "annual")
- `currency_code`: Код валюты
- `package_identifier`: Идентификатор пакета (для событий покупки)
- `product_identifier`: Идентификатор продукта (для событий покупки)
- `price_string`: Цена в виде строки (для событий покупки)
- `error_code`: Код ошибки (для событий ошибок)
- `error_message`: Сообщение об ошибке (для событий ошибок)
- `user_message`: Понятное пользователю сообщение об ошибке (для событий ошибок)
- `paywall_eligibility`: Доступность paywall для пользователя (true/false) - для фильтрации воронки
- `source_practice_id`: ID практики, которая привела к paywall (для атрибуции покупки)
- `source_practice_name`: Название практики, которая привела к paywall (для атрибуции покупки)
- `practice_type`: Тип практики, которая привела к paywall (для атрибуции покупки)
- `screen_name`: Название экрана ("PriceScreen")

---

## Subscription / Revenue

### `premium_access_checked`

**Описание**: Проверка статуса премиум доступа

**Свойства**:

- `result`: Результат проверки ("cache_hit" | "api_call")
- `is_premium`: Статус премиум (true/false)
- `cache_age_seconds`: Возраст кэша в секундах (для cache_hit)
- `context`: Контекст проверки (например, "purchase", "payment")
- `priority`: Приоритет проверки ("high" | "low" | "normal")
- `optimization_stats`: Статистика оптимизации (объект с cache_hits, api_calls, cache_hit_rate)
- `duration`: Длительность проверки в миллисекундах (для api_call)
- `is_debounced`: Флаг отложенной проверки (для api_call)
- `status_changed`: Изменился ли статус (для api_call)
- `active_entitlements`: Массив активных entitlements (для api_call)
- `entitlement_count`: Количество активных entitlements (для api_call)
- `is_dev_mode`: Режим разработки (true/false)
- `is_test_subscription`: Тестовая подписка (true/false)

### `premium_feature_blocked`

**Описание**: Пользователь попытался использовать премиум функцию без подписки

**Свойства**:

- `feature`: Название заблокированной функции (например, "event_start")
- `event_id`: ID события, которое требует премиум
- `event_type`: Тип события

### `premium_cache_invalidated`

**Описание**: Кэш премиум статуса был инвалидирован

**Свойства**:

- `reason`: Причина инвалидации (например, "purchase_success", "purchase_error")

### `failed_check_subscription`

**Описание**: Ошибка при проверке подписки

**Свойства**:

- `error`: Сообщение об ошибке
- `error_type`: Тип ошибки

### `revenue_cat_posthog_user_id_set`

**Описание**: PostHog user ID успешно установлен в RevenueCat

**Свойства**:

- `user_id`: ID пользователя PostHog

### `revenue_cat_posthog_user_id_error`

**Описание**: Ошибка при установке PostHog user ID в RevenueCat

**Свойства**:

- `error`: Сообщение об ошибке

### `revenue_cat_configure_started`

**Описание**: Начало конфигурации RevenueCat

**Свойства**:

- `platform`: Платформа ("ios" | "android")

### `revenue_cat_configure_success`

**Описание**: RevenueCat успешно сконфигурирован

**Свойства**:

- `platform`: Платформа

### `revenue_cat_configure_error`

**Описание**: Ошибка конфигурации RevenueCat

**Свойства**:

- `platform`: Платформа
- `error`: Сообщение об ошибке

### `load_offerings_started`

**Описание**: Начало загрузки предложений подписки

**Свойства**:

- `platform`: Платформа

### `load_offerings_success`

**Описание**: Предложения подписки успешно загружены

**Свойства**:

- `platform`: Платформа
- `monthly_available`: Доступен ли месячный план (true/false)
- `annual_available`: Доступен ли годовой план (true/false)
- `monthly_price`: Цена месячного плана (строка)
- `annual_price`: Цена годового плана (строка)

### `load_offerings_no_current`

**Описание**: Нет текущих предложений подписки

**Свойства**:

- `platform`: Платформа

### `load_offerings_error`

**Описание**: Ошибка загрузки предложений подписки

**Свойства**:

- `error`: Сообщение об ошибке
- `platform`: Платформа

### `purchase_package_started`

**Описание**: Начало процесса покупки пакета подписки

**Свойства**:

- `package`: Идентификатор пакета
- `productId`: Идентификатор продукта
- `priceString`: Цена в виде строки
- `context`: Контекст покупки
- `timestamp`: Временная метка

### `purchase_package_store_initiated`

**Описание**: Покупка инициирована в магазине (App Store / Play Store)

**Свойства**:

- `package`: Идентификатор пакета
- `productId`: Идентификатор продукта
- `context`: Контекст покупки

### `purchase_package`

**Описание**: Покупка пакета подписки завершена (успешно или в dev режиме)

**Свойства**:

- `productIdentifier`: Идентификатор продукта
- `package`: Идентификатор пакета
- `success`: Успешность покупки (true/false)
- `is_mock`: Является ли покупка моковой (для dev режима)
- `context`: Контекст покупки
- `duration`: Длительность процесса покупки в миллисекундах
- `transactionId`: ID транзакции
- `purchaseDate`: Дата покупки
- `priceString`: Цена в виде строки
- `entitlements`: Массив активных entitlements

### `purchase_package_error`

**Описание**: Ошибка при покупке пакета подписки

**Свойства**:

- `error`: Сообщение об ошибке
- `errorType`: Тип ошибки (например, "validation_error")
- `reason`: Причина ошибки (например, "undefined_package")
- `context`: Контекст покупки
- `duration`: Длительность до ошибки в миллисекундах

### `restore_purchases_started`

**Описание**: Начало процесса восстановления покупок

**Свойства**:

- `context`: Контекст восстановления
- `timestamp`: Временная метка

### `restore_purchases`

**Описание**: Восстановление покупок завершено (успешно или в dev режиме)

**Свойства**:

- `isSubscribed`: Есть ли активная подписка (true/false)
- `is_mock`: Является ли восстановление моковым (для dev режима)
- `context`: Контекст восстановления
- `duration`: Длительность процесса в миллисекундах
- `activeEntitlements`: Массив активных entitlements
- `entitlementCount`: Количество активных entitlements
- `allEntitlements`: Массив всех entitlements
- `requestDate`: Дата запроса
- `firstSeen`: Дата первого использования
- `originalAppUserId`: Оригинальный ID пользователя приложения

### `restore_purchases_error`

**Описание**: Ошибка при восстановлении покупок

**Свойства**:

- `error`: Сообщение об ошибке
- `errorCode`: Код ошибки
- `errorType`: Тип ошибки
- `isUserCancelled`: Отменил ли пользователь (true/false)
- `isNetworkError`: Сетевая ошибка (true/false)
- `isStoreError`: Ошибка магазина (true/false)
- `duration`: Длительность до ошибки в миллисекундах
- `context`: Контекст восстановления

### `test_subscription_toggled`

**Описание**: Переключение тестовой подписки (только в dev режиме)

**Свойства**:

- `previous_value`: Предыдущее значение (true/false)
- `new_value`: Новое значение (true/false)

### `premium_status_hook_initialized`

**Описание**: Хук статуса премиум инициализирован

**Свойства**:

- `result`: Результат инициализации ("cache_hit" | "api_call")
- `is_premium`: Статус премиум (true/false)
- `cache_age_seconds`: Возраст кэша в секундах (для cache_hit)
- `initialization_type`: Тип инициализации (например, "low_priority") - для api_call

### `premium_status_checked`

**Описание**: Статус премиум проверен

**Свойства**:

- `result`: Результат проверки ("cache_hit" | "api_call")
- `is_premium`: Статус премиум (true/false)
- `priority`: Приоритет проверки ("high" | "low" | "normal")
- `context`: Контекст проверки
- `force_refresh`: Принудительное обновление (true/false)
- `cache_age_seconds`: Возраст кэша в секундах

### `premium_status_check_error`

**Описание**: Ошибка при проверке статуса премиум

**Свойства**:

- `error`: Сообщение об ошибке
- `priority`: Приоритет проверки
- `context`: Контекст проверки
- `force_refresh`: Принудительное обновление (true/false)

### `purchase_funnel_started`

**Описание**: Начало воронки покупки

**Свойства**:

- `session_id`: ID сессии воронки
- `entry_point`: Точка входа в воронку
- `context`: Контекст воронки
- `timestamp`: Временная метка

### `purchase_funnel_step`

**Описание**: Шаг в воронке покупки

**Свойства**:

- `session_id`: ID сессии воронки
- `step_name`: Название шага
- `step_index`: Индекс шага
- `context`: Контекст шага
- `timestamp`: Временная метка
- `time_since_previous_step`: Время с предыдущего шага в миллисекундах
- `previous_step`: Предыдущий шаг
- `total_steps_so_far`: Общее количество шагов на данный момент

### `purchase_funnel_completed`

**Описание**: Воронка покупки завершена

**Свойства**:

- `session_id`: ID сессии воронки
- `result`: Результат ("converted" | "dropped_off" | "failed")
- `success`: Успешность (true/false)
- `total_duration`: Общая длительность воронки в миллисекундах
- `total_steps`: Общее количество шагов
- `steps_summary`: Сводка шагов (массив объектов с step, context, stepIndex)
- `start_timestamp`: Временная метка начала
- `end_timestamp`: Временная метка окончания
- `error_code`: Код ошибки (если есть)
- `error_type`: Тип ошибки (если есть)
- `error_message`: Сообщение об ошибке (если есть)
- `is_user_cancelled`: Отменил ли пользователь (если есть)
- `drop_off_point`: Точка выхода из воронки (если есть)
- `drop_off_reason`: Причина выхода (если есть)

### `purchase_funnel_metrics`

**Описание**: Метрики воронки покупки

**Свойства**:

- `session_id`: ID сессии воронки
- Метрики конверсии (детали зависят от реализации calculateConversionMetrics)

---

## Dashboard / Navigation

### `dashboard_jar_pressed`

**Описание**: Пользователь нажал на банку на главном экране

**Свойства**:

- `item_type`: Тип элемента ("jar")
- `jar_id`: ID банки
- `events_count`: Количество событий в банке

### `dashboard_event_pressed`

**Описание**: Пользователь нажал на событие на главном экране

**Свойства**:

- `event_id`: ID события
- `event_type`: Тип события
- `plan_id`: ID элемента плана
- `slot`: Временной слот ("morning" | "day" | "evening")
- `is_premium_required`: Требуется ли премиум (true/false)
- `is_done`: Выполнено ли событие (true/false)

### `dashboard_event_menu_pressed`

**Описание**: Пользователь нажал на действие в меню события на главном экране

**Свойства**:

- `action`: Действие ("remove" | "start" | "finish" | "edit")
- `event_id`: ID события
- `event_type`: Тип события
- `plan_id`: ID элемента плана

### `navigate_to_settings`

**Описание**: Пользователь перешел в настройки

**Свойства**: нет

---

## Content Interactions

### `card_event_pressed`

**Описание**: Пользователь нажал на карточку события

**Свойства**:

- `event_id`: ID события
- `event_premium`: Требуется ли премиум (true/false)
- `event_title`: Название события
- `event_type`: Тип события

### `card_event_pressed_premium`

**Описание**: Пользователь нажал на премиум карточку события (и был перенаправлен на paywall)

**Свойства**:

- `event_id`: ID события
- `event_title`: Название события
- `event_type`: Тип события

### `card_event_home_pressed`

**Описание**: Пользователь нажал на карточку завершенного события на главном экране

**Свойства**:

- `event_id`: ID сохраненного события
- `event_title`: Название события
- `event_type`: Тип события

### `card_event_friend_pressed`

**Описание**: Пользователь нажал на карточку события друга

**Свойства**:

- `event_id`: ID сохраненного события
- `event_title`: Название события
- `event_type`: Тип события

### `card_share_event_pressed`

**Описание**: Пользователь нажал на кнопку поделиться событием

**Свойства**: noop

### `affirmation_card_pressed`

**Описание**: Пользователь нажал на карточку аффирмации

**Свойства**:

- `has_affirmation`: Есть ли аффирмация (true/false)
- `date`: Дата целевой аффирмации

### `affirmation_start_journaling_pressed`

**Описание**: Пользователь нажал кнопку начать дневник из аффирмации

**Свойства**:

- `event_id`: ID события аффирмации
- `event_title`: Название события
- `event_type`: Тип события
- `is_premium`: Требуется ли премиум (true/false)
- `user_has_premium`: Есть ли у пользователя премиум (true/false)
- `active_index`: Активный индекс в списке аффирмаций
- `category_id`: ID категории

### `affirmation_premium_required`

**Описание**: Пользователь попытался использовать премиум аффирмацию без подписки

**Свойства**:

- `event_id`: ID события аффирмации
- `event_title`: Название события

### `review_create_card_pressed`

**Описание**: Пользователь нажал на карточку создания обзора

**Свойства**:

- `review_count`: Количество завершенных обзоров
- `is_premium`: Есть ли у пользователя премиум (true/false)

### `review_create_card_pressed_disabled`

**Описание**: Пользователь нажал на отключенную карточку создания обзора

**Свойства**: нет

### `review_create_card_premium_required`

**Описание**: Пользователь попытался создать обзор, но требуется премиум

**Свойства**:

- `review_count`: Количество завершенных обзоров
- `is_premium`: Есть ли у пользователя премиум (true/false)

### `event_selected`

**Описание**: Пользователь выбрал событие

**Свойства**:

- `event_id`: ID события

### `event_deselected`

**Описание**: Пользователь отменил выбор события

**Свойства**:

- `event_id`: ID события

### `event_finished`

**Описание**: Событие было завершено и добавлено в банку

**Свойства**:

- `saved_id`: ID сохраненного события
- `event`: Тип события
- `event_id`: ID события
- `event_title`: Название события

### `event_removed`

**Описание**: Событие было удалено

**Свойства**:

- `saved_id`: ID удаленного события

### `exercise_replay_pressed`

**Описание**: Пользователь нажал кнопку повтора упражнения

**Свойства**:

- `event_id`: ID события
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события
- `is_premium`: Требуется ли премиум (true/false)

### `exercise_replay_premium_required`

**Описание**: Пользователь попытался повторить премиум упражнение без подписки

**Свойства**:

- `event_id`: ID события
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

---

## Journaling

### `journaling_started`

**Описание**: Пользователь начал дневниковую практику

**Свойства**:

- `event_id`: ID события дневника
- `event_title`: Название события
- `event_type`: Тип события ("journaling")
- `is_premium`: Требуется ли премиум (true/false)
- `category_id`: ID категории

### `journaling_prompt_viewed`

**Описание**: Пользователь просмотрел промпт дневника

**Свойства**:

- `event_id`: ID события дневника
- `event_title`: Название события
- `event_type`: Тип события ("journaling")
- `prompt_index`: Индекс промпта (начиная с 1)
- `total_prompts`: Общее количество промптов
- `category_id`: ID категории

---

## Letter Writing

### `letter_preview_viewed`

**Описание**: Пользователь просмотрел превью письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `available_time_options`: Количество доступных временных опций
- `has_due_date`: Есть ли дата истечения (true/false)

### `letter_time_period_selected`

**Описание**: Пользователь выбрал период времени для письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `selected_period`: Выбранный период
- `selected_days`: Выбранное количество дней
- `time_index`: Индекс выбранного времени
- `time_label`: Метка выбранного времени

### `letter_preview_start_pressed`

**Описание**: Пользователь нажал кнопку начала письма из превью

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `selected_time_period`: Выбранный период времени
- `selected_days`: Выбранное количество дней

### `letter_session_entered`

**Описание**: Пользователь вошел в сессию написания письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события

### `letter_writing_started`

**Описание**: Пользователь начал писать письмо

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `page_index`: Индекс страницы

### `letter_finished`

**Описание**: Пользователь завершил письмо

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `blocked_by_days`: Количество дней до разблокировки
- `pages_completed`: Количество заполненных страниц
- `total_pages`: Общее количество страниц
- `has_name`: Есть ли имя получателя (true/false)

### `letter_session_closed`

**Описание**: Пользователь закрыл сессию написания письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `closed_at_position`: Позиция при закрытии
- `total_pages`: Общее количество страниц

### `letter_release_modal_continue`

**Описание**: Пользователь нажал кнопку продолжения в модальном окне освобождения письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события

### `letter_viewed`

**Описание**: Пользователь просмотрел завершенное письмо

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события
- `blocked_by_days`: Количество дней до разблокировки
- `can_show`: Можно ли показать письмо (true/false)
- `has_name`: Есть ли имя получателя (true/false)
- `has_review`: Есть ли обзор (true/false)

### `letter_opened_early`

**Описание**: Пользователь открыл письмо раньше времени разблокировки

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события
- `original_blocked_days`: Изначальное количество дней до разблокировки
- `days_until_unlock`: Количество дней до разблокировки на момент открытия

### `letter_remove_pressed`

**Описание**: Пользователь нажал кнопку удаления письма

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

### `letter_removed`

**Описание**: Письмо было удалено

**Свойства**:

- `event_id`: ID события письма
- `event_title`: Название события
- `event_type`: Тип события
- `saved_id`: ID сохраненного события

---

## Summary / AI

### `summary_item_favorite_toggled`

**Описание**: Пользователь переключил избранное для элемента сводки (insight, advice, affirmation)

**Свойства**:

- `finished_event_id`: ID завершенного события
- `item_key`: Ключ элемента ("insight" | "advice" | "affirmation")
- `is_favorite`: Статус избранного (true/false)

### `summary_complete_pressed`

**Описание**: Пользователь нажал кнопку завершения на странице сводки

**Свойства**:

- `finished_event_id`: ID завершенного события
- `has_chat`: Есть ли чат (true/false)
- `has_new_events`: Количество предложенных новых событий

---

## Add Practice Flow

### `add_practice_pressed`

**Описание**: Пользователь нажал кнопку добавления практики

**Свойства**:

- `slot`: Временной слот ("morning" | "day" | "evening")

### `add_practice_sheet_opened`

**Описание**: Пользователь открыл bottom sheet для добавления практики

**Свойства**: нет

---

## Achievements

### `achievement_unlocked`

**Описание**: Пользователь разблокировал достижение

**Свойства**:

- `achievement_id`: ID достижения (иконка)
- `achievement_name`: Название достижения
- `achievement_key`: Ключ достижения
- `unlock_date`: Дата разблокировки (ISO строка)

---

## App Review

### `app_review_requested`

**Описание**: Пользователю показан запрос на отзыв в App Store

**Свойства**:

- `source`: Источник запроса ("quiz_like" | "event_positive_feedback" | "event_completion")
- `days_since_install`: Количество дней с момента установки
- `event_type`: Тип события/практики (опционально)
- `practice_name`: Название практики (опционально)

### `app_review_completed`

**Описание**: Пользователь завершил отзыв (предполагается после 5 секунд задержки)

**Свойства**:

- `source`: Источник запроса
- `days_since_install`: Количество дней с момента установки
- `event_type`: Тип события/практики (опционально)
- `practice_name`: Название практики (опционально)

### `app_review_dismissed`

**Описание**: Пользователь отклонил запрос на отзыв или произошла ошибка

**Свойства**:

- `source`: Источник запроса
- `days_since_install`: Количество дней с момента установки
- `event_type`: Тип события/практики (опционально)
- `practice_name`: Название практики (опционально)
- `error_message`: Сообщение об ошибке (если есть)

---

## Performance / Technical

### `api_response_time`

**Описание**: Время ответа API

**Свойства**:

- `endpoint`: Конечная точка API
- `method`: HTTP метод ("GET" | "POST" и т.д.)
- `duration`: Длительность в миллисекундах
- `status_code`: HTTP статус код
- `is_slow_response`: Флаг медленного ответа (true если > 1000ms)
- `timestamp`: Временная метка

### `ai_generation_time`

**Описание**: Время генерации AI контента

**Свойства**:

- `request_type`: Тип запроса
- `duration`: Длительность в миллисекундах
- `input_length`: Длина входных данных
- `output_length`: Длина выходных данных
- `is_slow_generation`: Флаг медленной генерации (true если > 10000ms)
- `timestamp`: Временная метка

### `user_journey_step`

**Описание**: Шаг в путешествии пользователя по приложению

**Свойства**:

- `from_screen`: Экран отправления
- `to_screen`: Экран назначения
- `action`: Действие
- `timestamp`: Временная метка

### `app_error_occurred`

**Описание**: Произошла ошибка в приложении

**Свойства**:

- `error_type`: Тип ошибки
- `error_message`: Сообщение об ошибке
- `screen`: Экран, где произошла ошибка
- `action`: Действие, которое вызвало ошибку
- `timestamp`: Временная метка

### `network_error`

**Описание**: Произошла сетевая ошибка

**Свойства**:

- `endpoint`: Конечная точка API
- `status_code`: HTTP статус код
- `error_type`: Тип ошибки
- `retry_count`: Количество попыток повтора
- `timestamp`: Временная метка

---

## Other

### `empty_page`

**Описание**: Пользователь нажал кнопку "Пустая страница"

**Свойства**: нет

---

## Notes

- Все события автоматически получают стандартные свойства (timestamp, session_id, user_id, is_premium, app_version, platform, locale, country, consent_status, environment и т.д.) из хука useAnalytics
- Свойства помеченные как REQUIRED должны присутствовать в событии
- Свойства помеченные как "noop" требуют проверки и уточнения назначения
- Некоторые события могут иметь дополнительные свойства в зависимости от контекста использования
