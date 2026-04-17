# Mind Jar — карта екранів і бізнес-логіки

## 1. Призначення документа

Цей документ описує продуктову логіку екранів застосунку `jar` на основі поточної навігації та route-структури в:

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/ny/_layout.tsx`
- окремих route-файлах з папки `app/`

Документ потрібен, щоб:

- швидко зрозуміти, які екрани реально існують у продукті;
- зафіксувати, що саме робить кожен екран;
- описати, що може зробити користувач на кожному екрані;
- відокремити активні екрани від допоміжних, тимчасових і legacy-сценаріїв;
- залишити місце, куди можна вручну дописати, навіщо саме цей екран або flow був придуманий.

## 2. Як побудована навігація

### 2.1 Root Stack — `app/_layout.tsx`

Root stack формує головний контейнер застосунку і тримає:

- `onboarding` як стартовий обов'язковий flow;
- `/(tabs)` як основну післяонбордингову навігацію;
- standalone flow-екрани практик, summary, paywall, settings, history, achievements, seasonal `ny/*`;
- кілька modal/transparentModal route для допоміжних дій: `emotion-tag`, `journey/view-modal`, `achievements/achieve-modal`, `jar-animation`.

Окремо в root-рівні ще є технічна логіка:

- ініціалізація шрифтів;
- запуск провайдерів сесії, теми, analytics, toast, bottom sheet, portal;
- `fetchInitialData()` до рендеру основної навігації;
- глобальний PostHog;
- глобальний toast/portal/bottom-sheet шар.

### 2.2 Tabs — `app/(tabs)/_layout.tsx`

Tab layout має 3 основні вкладки:

- `index` — домашній дашборд / план на день;
- `events` — каталог практик;
- `progress` — прогрес, архів, джари, статистика, досягнення.

Критично важлива умова:

- якщо `onboardingStore.onboarding === false`, користувач редіректиться на `/onboarding`;
- тобто вкладки офіційно доступні лише після завершення онбордингу.

### 2.3 NY Stack — `app/ny/_layout.tsx`

Сезонний New Year flow має окремий stack:

- `/ny`
- `/ny/day`
- `/ny/mood`
- `/ny/summary`

Він також захищений онбордингом:

- якщо онбординг не завершений, користувач не потрапляє в `ny/*`.

## 3. Статуси екранів у цьому документі

- `Активний` — маршрут є частиною основного поточного продукту.
- `Допоміжний` — маршрут використовується як support/modal/detail screen.
- `Legacy / непрямий` — route існує в коді, але не має прямого активного входу з основної tab-навігації, settings menu або інших головних flow, описаних у layout/route файлах.
- `Системний` — технічний маршрут без окремої бізнес-цінності для кінцевого користувача.

## 4. Основні flow та екрани

### `/onboarding`

**Source:** `app/onboarding.tsx`, `components/common/v2/Onboarding/Onboarding.tsx`  
**Статус:** Активний

**Що це:** головний адаптивний онбординг, який у межах одного route показує багато різних кроків, вставляє paywall, AI summary, вибір reminder'ів і фінально виводить користувача на план дня.

**Що бачить користувач:**

- mascot / welcome card;
- ввід імені;
- вибір настрою;
- вибір емоцій;
- summary-conclusion з обраним mood/emotions;
- додавання activity tags;
- пропозицію піти в глибшу рефлексію;
- AI summary / paywall / jar animation;
- reminder settings;
- план на день з практиками.

**Активні кроки, які явно зашиті в `pagesSteps`:**

1. `hello` — welcome step з wave-button.
2. `name` — введення імені.
3. `1` — вибір mood.
4. `2` — вибір emotions.
5. `summaryConclusion` — короткий підсумок вибраного стану.
6. `summaryConclusionQuestion` — той самий recap, але з `Go deeper` питанням.
7. `summaryAI` — AI-підсумок по вибраному стану.
8. `ps2` — compact paywall.
9. `1.2` — jar animation.
10. `ps1` — full paywall.
11. `noPremium1` — вибір доступного часу.
12. `notification` — налаштування ранкового та вечірнього reminder.
13. `tasks` — план на день.
14. `ps2` — ще один compact paywall step у кінці масиву.

**Динамічні вставки в flow:**

- `reflection` вставляється після `summaryConclusionQuestion`, якщо юзер натискає `Go deeper`;
- `ps1` / `ps2` викидаються з flow, якщо premium вже активний;
- для reflection є окремий overlay-paywall `ps2`.

**Що може робити користувач:**

- перейти далі wave-кнопкою;
- ввести ім'я;
- вибрати настрій;
- відмітити кілька емоцій;
- додати activity tags;
- відкрити deep-dive reflection;
- регенерувати reflection question;
- написати відповіді в reflection chat;
- лайкати / дизлайкати AI-питання;
- увімкнути ранкові / вечірні notification;
- вибрати час для notification;
- купити premium на onboarding paywall;
- відкрити план дня і стартувати перші практики.

**Бізнес-логіка:**

- на старті онбордингу створюється тимчасовий mood finished event, щоб мати `eventId` для summary/chat;
- після вибору mood/emotions/tags event оновлюється;
- при `summaryAI` запускається AI summary generation;
- на кроці `tasks` онбординг вважається завершеним і користувач переводиться в основний продукт;
- при завершенні онбордингу зберігається mood+emotions+tags і створюється денний план через `createOnboardingDayPlan()`.

**Premium / обмеження:**

- paywall може з'являтися кілька разів;
- якщо premium куплений прямо всередині онбордингу, paywall-кроки прибираються з масиву сторінок;
- reflection AI має окреме premium-обмеження.

**Примітка по поточній реалізації:**

- у файлі є додаткові гілки `breathing`, `diary1`, `questions1`, `premium1`, `premium2`, `premium3`, `summary`, `noPremium2`, але вони не входять у базовий `pagesSteps`;
- ці гілки оголошені в компоненті, але не входять у поточний базовий масив `pagesSteps`.

**Поле для ручного доповнення:**

- Чому цей flow існує:
- Яку гіпотезу / бар'єр він має зняти:
- Чому саме такий порядок кроків:

### `/(tabs)/index` — Home / Plan

**Source:** `app/(tabs)/index.tsx`  
**Статус:** Активний

**Що це:** головний дашборд дня, де користувач бачить streak, швидкий вхід у check-in, свій план на сьогодні, premium banner, premium practices, custom actions і список уже завершених практик.

**Що бачить користувач:**

- блок streak / current scenario;
- card check-in для швидкого вибору настрою;
- секцію `Plan for today` з прогресом виконання;
- premium banner або сьогоднішню affirmation;
- premium practices;
- блок `Add action`;
- список completed practices за сьогодні.

**Що може робити користувач:**

- вибрати mood прямо з home card;
- відкрити конкретну practice card;
- перейти на compact paywall;
- закрити premium banner;
- додати власну дію в план;
- відкрити completed practice і подивитися її detail.

**Бізнес-логіка:**

- mood обирається ще на home і далі route веде у `/mood` уже з переданим `event`;
- денні планові item-и діляться на free і premium;
- completed status рахується по `finishedEventsToday`;
- completed events сортуються від найновішої до найстарішої;
- для premium-користувача замість banner показується остання affirmation дня.

**Premium / обмеження:**

- неактивний premium показує banner + CTA на `/price-small`;
- premium practices видно на dashboard, але при відкритті без premium route піде в paywall.

**Поле для ручного доповнення:**

- Чому home побудований саме як plan-driven дашборд:
- Чому mood check-in винесений у верхню частину:

### `/(tabs)/events` — Explore / каталог практик

**Source:** `app/(tabs)/events.tsx`  
**Статус:** Активний

**Що це:** каталог доступних типів практик.

**Що бачить користувач:**

- картки категорій практик;
- для non-premium — промо-блок на premium;
- список основних напрямків: journaling, question, breathing, meditation, echoes, reflections.

**Що може робити користувач:**

- перейти у journaling editor;
- відкрити список питань;
- відкрити список breathing sessions;
- відкрити список meditations;
- відкрити premium-only echoes;
- відкрити reflections flow;
- перейти на full paywall.

**Бізнес-логіка:**

- це не екран виконання практики, а routing-hub;
- кожен tile переводить або в конкретний list screen, або одразу в practice flow;
- navigation захищений від double tap через `navigateOnce`.

**Premium / обмеження:**

- `Echoes` маркується як premium;
- при натисканні на locked premium entry user ведеться на `/price`.

**Поле для ручного доповнення:**

- Чому explore побудований по типах практик, а не по цілях / настроях:

### `/(tabs)/progress` — Progress

**Source:** `app/(tabs)/progress.tsx`  
**Статус:** Активний

**Що це:** екран прогресу, який об'єднує історію, джари, орби, статистику check-in/journal/chat, streak metrics, календар активності й прев'ю achievements.

**Що бачить користувач:**

- jar visualization;
- quick stats: jars, orbs;
- counters: check-ins, AI chats, journal entries, total words;
- streak totals;
- календар з двома режимами `days` і `mood`;
- блок achievements з 4 badge preview;
- іконки переходу в history та settings.

**Що може робити користувач:**

- відкрити список jars;
- відкрити список balls;
- перейти в history;
- перейти в settings;
- перемкнути календар між days і mood;
- відкрити full achievements list;
- відкрити detail конкретного badge.

**Бізнес-логіка:**

- `days` mode показує факт активності;
- `mood` mode показує останній mood за день кольором/ball;
- статистика рахується по `finishedEvents`;
- achievements card дає швидкий доступ до прогресу по бейджах.

**Поле для ручного доповнення:**

- Чому прогрес зібраний в один screen, а не рознесений по окремих tabs:

## 5. Mood / Reflection / AI Summary

### `/mood`

**Source:** `app/mood.tsx`  
**Статус:** Активний

**Що це:** основний mood check-in flow. У `app/(tabs)/index.tsx` home-картка пушить користувача сюди вже з переданим `event`.

**Фактично активний flow у поточній реалізації:**

- старт не з mood picker, а з `emotions`;
- далі summary screen;
- optional chat / reflection;
- optional AI summary;
- фінальна анімація падіння ball у jar;
- сторінка `mood` існує як edit-state зі summary;
- стан `practice` оголошений у файлі, але явного `setPage("practice")` у поточному коді немає;
- для тегів є page-state `tags`, але в активному UI редагування тегів іде через `TagSelectionBottomSheet`.

**Що може робити користувач:**

- підтвердити або відредагувати mood;
- вибрати кілька емоцій;
- подивитися summary свого стану;
- запустити `Go deeper` reflection;
- регенерувати reflection question;
- ставити позитивний/негативний feedback на AI questions;
- завершити flow без AI;
- згенерувати AI smart summary;
- відредагувати mood/emotions/tags/reflection перед збереженням;
- відкрити compact paywall, якщо smart summary або premium reflection заблоковані.

**Бізнес-логіка:**

- при вході створюється тимчасовий finished event для mood;
- при збереженні тимчасовий event видаляється і створюється фінальний mood event;
- якщо user мав chat:
  - при кількох AI turns створюється окремий reflection event;
  - при одному AI question/answer зберігається journaling event;
- після фінального save оновлюється streak і check-in store;
- якщо user просто кидає flow, фіксується abandon без фіналізації.

**Premium / обмеження:**

- AI review відкриває `/price-small`, якщо premium неактивний;
- reflection chat має free message limit;
- після ліміту показується premium upsell.

**Примітка по поточній реалізації:**

- `page = "emotions"` є стартовим значенням, тому перший екран цього route зараз — `emotions`;
- у файлі є стани `mood`, `practice`, `tags`, але активні переходи ведуть переважно через `emotions`, `summary`, `chat`, `ai_summary`, `final_ball_animation`.

**Поле для ручного доповнення:**

- Чому mood flow стартує після вибору настрою на home:
- Чому summary йде перед AI summary:

### `components/mood/SummaryViewPage.tsx` — внутрішній summary screen mood flow

**Статус:** Активний внутрішній екран

**Що це:** review-екран перед фінальним save або AI smart summary.

**Що бачить користувач:**

- mood;
- emotions;
- tags;
- або single reflection, або список chat answers;
- `Go deeper` card, якщо chat ще не почався;
- affirmation / advice card;
- mood chart.

**Що може робити користувач:**

- edit mood;
- edit emotions;
- edit tags;
- edit reflection;
- переключити summary в edit mode, якщо вже є chat answers;
- регенерувати reflection prompt через `Go deeper`;
- зберегти flow;
- запустити smart summary.

**Бізнес-логіка:**

- якщо chat уже є, summary переходить у режим review/edit;
- якщо chat ще немає, summary виступає точкою входу в reflection;
- для non-premium показується проста affirmation card і blur/value-limited mood chart;
- save закриває check-in та переводить у final animation / tabs.

### `components/mood/ReflectionInputPage.tsx` — внутрішній reflection chat screen

**Статус:** Активний внутрішній екран

**Що це:** універсальний чат-екран для reflection у mood flow, reflections flow, onboarding та editor-based flows.

**Що може робити користувач:**

- читати initial question(s);
- писати власну відповідь;
- відправляти чергове повідомлення;
- завершити flow кнопкою `Finish`;
- повернутися назад;
- закрити flow;
- лайкати / дизлайкати конкретне AI question;
- регенерувати останнє питання;
- після вичерпання free limit перейти на premium.

**Бізнес-логіка:**

- якщо є незбережений текст і user тисне back, показується confirm modal;
- regenerate працює по-різному:
  - для першого питання може підставляти інше reflection prompt;
  - для наступних AI questions запускає прямий regeneration;
- finish віддає останню відповідь батьківському flow;
- показує premium upsell після вичерпання free messages.

### `components/mood/SummaryAIPage.tsx` — внутрішній AI summary screen

**Статус:** Активний внутрішній екран

**Що це:** універсальний AI-result screen для mood, reflections, quizzes, NY summary та editor-based practices.

**Що бачить користувач:**

- loading-state з mascot + notification;
- AI summary markdown або окремі блоки `affirmation`, `advice`, `insight`;
- додаткові recommended practices;
- suggested emotions / tags;
- mood chart;
- chat history;
- finish button.

**Що може робити користувач:**

- дочитати AI summary;
- додати summary item у favorites;
- подивитися `What is it`;
- завершити flow.

**Бізнес-логіка:**

- підтримує обидва формати summary: окремі поля `advice/insight/affirmation` і markdown `summary`;
- може запускатися з jar-animation loading state;
- у `finishedEvent` оновлюються favorite-флаги summary items.

## 6. Practice каталоги та виконання

### `/events/question`

**Source:** `app/events/question.tsx`  
**Статус:** Активний

**Що це:** список question/self-discovery практик.

**Що може робити користувач:**

- переглянути перелік тестів/питань;
- відкрити потрібний question flow;
- перейти на paywall, якщо prompt premium.

**Бізнес-логіка:**

- при виборі item route веде в `/editor` з переданими `pages` і `event`;
- у `app/events/question.tsx` вибір item веде в `/editor`, а не в `/question/event`.

### `/events/breathe`

**Source:** `app/events/breathe.tsx`  
**Статус:** Активний

**Що це:** список breathing practices з групуванням по часу дня.

**Що може робити користувач:**

- вибрати breathing session;
- побачити назву, опис, label;
- перейти на paywall для premium session.

**Бізнес-логіка:**

- список ділиться на `morning`, `duringTheDay`, `evening`;
- selected item відкриває `/breathe/event`.

### `/events/meditate`

**Source:** `app/events/meditate.tsx`  
**Статус:** Активний

**Що це:** список meditation practices з групуванням по тематичних групах.

**Що може робити користувач:**

- вибрати meditation session;
- бачити label/description;
- перейти на paywall для premium meditation.

**Бізнес-логіка:**

- групи: `calm`, `power`, `gratitude`;
- selected item відкриває `/meditate/event`.

### `/editor`

**Source:** `app/editor.tsx`, `components/editor/CPageCarousel.tsx`  
**Статус:** Активний

**Що це:** універсальний renderer для journaling / question / selector / slider / preview / markdown preview / final / AI summary.

**Що може робити користувач:**

- писати journal answers;
- проходити quizzes;
- змінювати mood/date в practice, де це підтримано;
- стартувати AI reflection chat із journal entry;
- запускати AI summary;
- очищати або видаляти draft journal;
- перезапустити quiz;
- закривати practice на різних етапах.

**Бізнес-логіка:**

- на старті створюється тимчасовий finished event;
- pages беруться з route params;
- якщо event type `question` і є `calculateResult`, після quiz результат рахується з ваг answer-ів;
- AI reflection chat вставляється в carousel динамічно;
- AI summary page також вставляється динамічно;
- completion фіналізує тимчасовий event та додає summary/chat/value.

**Premium / обмеження:**

- AI summary із editor flow блокується paywall'ом;
- reflection chat у generic editor теж має premium gate.

**Поле для ручного доповнення:**

- Чому editor зроблений як єдиний route-двигун для багатьох типів практик:

### `/question/event`

**Source:** `app/question/event.tsx`  
**Статус:** Legacy / непрямий

**Що це:** окремий standalone quiz flow з власною двоекранною логікою: питання + final screen.

**Що може робити користувач:**

- відповідати на quiz;
- дочекатися modal з результатом;
- перейти на final page.

**Бізнес-логіка:**

- answers зберігаються в `selected[]`;
- після завершення quiz показується congratulation modal;
- event одразу записується в finished events;
- це окремий локальний flow, який не використовується tab-каталогом `/(tabs)/events`, бо той веде в `/events/question`.

### `/breathe/event`

**Source:** `app/breathe/event.tsx`  
**Статус:** Активний

**Що це:** execution flow breathing session.

**Флоу всередині:**

1. begin session;
2. breathing practice view;
3. final event.

**Що може робити користувач:**

- вибрати або підтвердити duration;
- стартувати сесію;
- змінити post-session mood;
- finish early;
- start over;
- завершити practice.

**Бізнес-логіка:**

- completion додає finished event з `emptyFinished: true`;
- є аналітика для start, finish, finish early, start over, abandonment;
- back gesture блокується після старту практики.

### `/meditate/event`

**Source:** `app/meditate/event.tsx`  
**Статус:** Активний

**Що це:** execution flow meditation session.

**Що може робити користувач:**

- вибрати/підтвердити час;
- стартувати медитацію;
- змінити mood після неї;
- finish early;
- start over;
- завершити meditation.

**Бізнес-логіка:**

- структура така сама, як у breathing;
- для NY meditation може підмінятися фон;
- completion записує finished event та веде на final screen.

### `/reflections/event`

**Source:** `app/reflections/event.tsx`  
**Статус:** Активний

**Що це:** окрема reflection practice поза mood flow.

**Флоу всередині:**

1. reflection input / AI chat;
2. final event;
3. optional AI summary для premium.

**Що може робити користувач:**

- відповідати на стартове reflection question;
- продовжувати deep-dive chat;
- регенерувати prompt;
- ставити feedback на AI questions;
- закрити flow із модалкою save/delete;
- перейти в AI summary після final card.

**Бізнес-логіка:**

- тимчасовий reflection event створюється одразу;
- при finish event оновлюється chat-історією;
- для non-premium генерується лише affirmation на final card;
- premium-користувач може запустити AI summary з final screen.

### `/affirmation/index`

**Source:** `app/affirmation/index.tsx`  
**Статус:** Допоміжний / непрямий

**Що це:** swipeable carousel афірмацій.

**Що бачить користувач:**

- affirmation cards;
- category button;
- можливість гортати картки;
- у самій картці — favorite heart.

**Що може робити користувач:**

- свайпати affirmations;
- відкривати categories;
- додавати affirmation у favorites;
- перейти на paywall через premium icon на card.

**Примітка по поточній реалізації:**

- у файлі є `startJournaling()`, але видимого CTA для старту journaling із affirmation у поточному JSX немає;
- видимі дії поточного JSX: перегортання карток, відкриття категорій, повернення назад і дії всередині `AffirmationEdit`.

### `/affirmation/categories`

**Source:** `app/affirmation/categories.tsx`  
**Статус:** Допоміжний

**Що це:** список категорій affirmations.

**Що може робити користувач:**

- обрати категорію;
- побачити лічильники total/saved/finished;
- відкрити locked premium category через paywall;
- повернутись у affirmation carousel з новою active category.

### `/echoes`

**Source:** `app/echoes/index.tsx`, `components/EchoesEdit.tsx`  
**Статус:** Активний, premium-oriented

**Що це:** екран з вибраними користувачем favorite AI outputs: `insight`, `advice`, `affirmation`.

**Що бачить користувач:**

- swipeable cards saved echoes;
- category filter (`all`, `insight`, `advice`, `affirmation`);
- текст echo;
- дата створення.

**Що може робити користувач:**

- свайпати echoes;
- переключати категорію через float menu;
- переглядати count по кожному типу.

**Бізнес-логіка:**

- echoes збираються з finished events, де summary item marked as favorite;
- це не генерація нового контенту, а архів summary-елементів, які користувач уже позначив як favorite.

### `/journal-categories`

**Source:** `app/journal-categories.tsx`  
**Статус:** Допоміжний

**Що це:** browser категорій journaling prompts.

**Що може робити користувач:**

- переключати journaling category;
- читати description категорії;
- відкривати конкретний prompt;
- потрапити на paywall, якщо prompt premium.

**Бізнес-логіка:**

- prompts всередині категорії сортуються так, щоб free були перед premium;
- premium cards накриваються blur overlay;
- відкриття prompt веде в `/editor`.

### `/templates`

**Source:** `app/templates.tsx`  
**Статус:** Допоміжний

**Що це:** вибір journaling templates.

**Що може робити користувач:**

- відкрити template category;
- подивитися modal зі списком шаблонних питань;
- застосувати template;
- повернутись назад у editor.

**Бізнес-логіка:**

- templates фільтруються з `journalEventsDefault`, де page має `templates`;
- save із modal переводить у `/editor` із вибраним template event;
- back із цього screen повертає в empty journal editor.

### `/journey/journaling`

**Source:** `app/journey/journaling.tsx`  
**Статус:** Legacy / непрямий

**Що це:** окремий route перегляду journaling prompts у форматі vertical card carousel.

**Що може робити користувач:**

- переглядати prompt cards;
- додавати prompt у favorites;
- стартувати journaling.

**Примітка:**

- цей route має власний `FlatList`-browser prompt-карток;
- у `app/(tabs)/events.tsx` активна плитка `Journaling` веде в `/editor`, а не в цей route.

### `/letter/event`

**Source:** `app/letter/event.tsx`  
**Статус:** Legacy / непрямий

**Що це:** окремий flow відкладеного листа самому собі.

**Що може робити користувач:**

- пройти кілька editor/preview екранів;
- вказати ім'я;
- написати лист;
- вибрати період відкладення або використати `dueDate`, якщо він уже заданий в event config;
- дочекатися “release” modal;
- завершити flow.

**Бізнес-логіка:**

- при досягненні фінального екрана route створює `finished event`;
- preview-крок рахує або вибраний період (`31 / 183 / 365` днів), або fixed `dueDate` з event config;
- `components/pages/view/LetterScreen.tsx` очікує в `finishedEvent.value` поля `blockedByDays`, `name`, `values`, але в поточному `app/letter/event.tsx` при збереженні явно записується тільки `emptyFinished: true`.

## 7. History / Archive / Saved Content

### `/journey/list`

**Source:** `app/journey/list.tsx`  
**Статус:** Активний

**Що це:** історія збережених практик.

**Що може робити користувач:**

- дивитися список подій по датах;
- відкривати історію по jar або по конкретній даті;
- переходити в detail конкретного finished event.

**Бізнес-логіка:**

- events групуються по датах;
- сортуються від найновішої до найстарішої;
- джерело списку залежить від params:
- `journeyByDate` -> `getEventByDate(...)`;
- `journeysByJar` -> `getEventsByJar(...)`;
- без цих params -> весь `finishedEvents`.

### `/journey/view`

**Source:** `app/journey/view.tsx`, `components/pages/view/EventScreen.tsx`  
**Статус:** Активний

**Що це:** detail screen збереженої практики.

**Що бачить користувач:**

- Ball header;
- summary;
- mood chip, якщо це не mood event, але mood був пов'язаний;
- journal/chat/AI summary залежно від типу.

### `/journey/view-modal`

**Source:** `app/journey/view-modal.tsx`  
**Статус:** Допоміжний

**Що це:** modal-readonly preview для long rich-text content.

**Що може робити користувач:**

- прочитати повний текст;
- закрити modal.

### `/review/view`

**Source:** `app/review/view.tsx`  
**Статус:** Допоміжний

**Що це:** markdown/detail review screen.

**Що може робити користувач:**

- прочитати review content;
- повернутися назад;
- побачити секцію `What did you notice`.

### `/jars`

**Source:** `app/jars.tsx`, `components/common/JarFull.tsx`  
**Статус:** Активний

**Що це:** архів усіх jar'ів плюс поточна jar.

**Що бачить користувач:**

- swipeable список jar'ів;
- progress усередині кожної банки;
- CTA `Start` / `Explore`, якщо jar ще не заповнений.

**Що може робити користувач:**

- свайпати між банками;
- відкривати history конкретної jar;
- перейти у explore, щоб продовжити наповнювати jar.

### `/balls`

**Source:** `app/balls.tsx`  
**Статус:** Активний

**Що це:** колекція типів орбів і кількість кожного типу у finished events.

**Що може робити користувач:**

- переглядати лічильники mood balls;
- переглядати лічильники practice balls: breathing, meditation, questions, diary, reflection.

`/echoes` уже описаний вище, бо логічно це одночасно і архів, і premium-content library.

## 8. Achievements

### `/achievements/badges`

**Source:** `app/achievements/badges.tsx`  
**Статус:** Активний

**Що це:** сітка всіх achievements.

**Що може робити користувач:**

- бачити прогрес `done / total`;
- відкривати detail конкретного badge.

### `/achievements/badge-view`

**Source:** `app/achievements/badge-view.tsx`  
**Статус:** Активний

**Що це:** detail одного achievement.

**Що бачить користувач:**

- badge;
- title;
- logic text;
- progress bar.

### `/achievements/achieve-modal`

**Source:** `app/achievements/achieve-modal.tsx`  
**Статус:** Допоміжний

**Що це:** celebratory modal при новому achievement.

**Що може робити користувач:**

- закрити modal;
- перейти до повного списку achievements.

## 9. Settings / Support / Account

### `/settings`

**Source:** `app/settings.tsx`  
**Статус:** Активний

**Що це:** settings screen із preference, community, support, application actions.

**Що може робити користувач:**

- змінити app language;
- керувати subscription;
- відкрити Instagram;
- залишити review в store;
- поширити app;
- відкрити FAQ;
- відкрити site/contact;
- відкрити terms / privacy;
- видалити всі дані;
- перейти в paywall.

**Бізнес-логіка:**

- для premium user manage subscription відкриває native management URL;
- для non-premium та сама кнопка веде на `/price-small`;
- remove data викликає `removeAllData()` і редіректить у tabs.

### `/settings/user`

**Source:** `app/settings/user.tsx`  
**Статус:** Legacy / непрямий

**Що це:** екран редагування імені.

**Примітка:**

- route існує, але в main settings screen відкриття цього route зараз закоментоване.

### `/settings/contact`

**Source:** `app/settings/contact.tsx`  
**Статус:** Legacy / непрямий

**Що це:** локальна форма contact us.

**Примітка:**

- у поточному settings flow `Contact us` веде не сюди, а на зовнішній сайт `mind-jar.com`.

## 10. Monetization

### `/price`

**Source:** `app/price.tsx`  
**Статус:** Активний

**Що це:** full paywall screen.

**Що бачить користувач:**

- value proposition premium;
- restore purchase;
- pricing comparison;
- monthly / annual selection;
- legal links;
- privacy / medical disclaimer;
- CTA `Start free trial`.

**Що може робити користувач:**

- змінити billing period;
- почати trial;
- restore purchases;
- закрити screen.

**Бізнес-логіка:**

- selected period трекається окремо;
- purchase tap lock захищає від подвійного натискання;
- після успішного старту trial screen просто закривається.

### `/price-small`

**Source:** `app/price-small.tsx`  
**Статус:** Активний

**Що це:** компактний paywall для in-flow upsell.

**Де використовується:**

- mood summary / reflection;
- settings manage subscription;
- reflections;
- onboarding compact paywall сценарії.

**Що може робити користувач:**

- вибрати plan;
- restore purchase;
- подивитися terms;
- стартувати free trial;
- закрити paywall.

## 11. Planning / Custom actions

### `/action/add`

**Source:** `app/action/add.tsx`  
**Статус:** Активний

**Що це:** екран для створення і керування custom personal actions у плані.

**Що може робити користувач:**

- створити нову власну дію;
- скористатися suggestion;
- додати дію в сьогоднішній schedule;
- прибрати дію зі schedule;
- редагувати дію;
- видалити дію.

**Бізнес-логіка:**

- custom actions зберігаються як AI/todo events;
- кожну дію можна додати до поточного плану дня;
- route є продовженням `AddActionBlock` з dashboard.

## 12. Допоміжні екрани для custom emotion/tag

### `/emotion-tag`

**Source:** `app/emotion-tag.tsx`  
**Статус:** Допоміжний / непрямий

**Що це:** окремий manager для custom emotions або tags.

**Що може робити користувач:**

- бачити список своїх custom emotions;
- видаляти custom emotion;
- додавати нову custom emotion;
- бачити tag categories;
- додавати tag у конкретну категорію;
- видаляти tags.

**Примітка:**

- у поточному mood flow активніше використовується bottom-sheet додавання tag/emotion, але сам route лишився окремим helper screen.

## 13. New Year seasonal flow

### `/ny`

**Source:** `app/ny/index.tsx`  
**Статус:** Активний сезонний

**Що це:** точка входу в seasonal NY event.

**Стан 1 — NY onboarding:**

- welcome screen seasonal event;
- пояснення механіки;
- CTA старту події;
- встановлення `nyStartDate`.

**Стан 2 — NY main grid:**

- grid днів 1..N;
- locked / next day / open / finished / fully finished стани;
- summary CTA наприкінці або після завершення івенту.

**Що може робити користувач:**

- стартувати seasonal event;
- відкривати доступний день;
- бачити progress по днях;
- відкривати seasonal AI summary.

### `/ny/day`

**Source:** `app/ny/day.tsx`  
**Статус:** Активний сезонний

**Що це:** список практик всередині конкретного NY day.

**Що бачить користувач:**

- номер дня;
- назву й опис;
- progress `completed / total`;
- один main event + додаткові events.

**Що може робити користувач:**

- запускати journaling;
- запускати NY mood;
- запускати breathing / meditation;
- запускати question event;
- переходити на paywall для premium event;
- бачити completed state для finished items.

**Бізнес-логіка:**

- completed items сортуються після незавершених;
- головний event дня йде вище серед незавершених;
- після завершення summary або закінчення всього seasonal window interactions можуть блокуватися.

### `/ny/mood`

**Source:** `app/ny/mood.tsx`  
**Статус:** Активний сезонний

**Що це:** окремий mood flow для seasonal NY event.

**Флоу:**

1. mood selection;
2. emotions;
3. tags;
4. optional reflection;
5. summary;
6. optional AI summary.

**Що може робити користувач:**

- вибрати кастомні seasonal mood labels;
- відмітити emotions;
- відмітити tags;
- написати short reflection;
- піти в deep-dive chat;
- отримати AI summary;
- перейти на full paywall, якщо premium неактивний.

**Бізнес-логіка:**

- якщо в `event.pages` є `moodLabels`, `emotions`, `tags`, `tagCategories`, flow бере їх звідти; інакше використовує стандартні check-in дані;
- між reflection і summary є окрема jar animation page `0.1`;
- `finished event` лишається `tmp`, доки не відбулася хоча б одна з умов фіналізації: є chat, є `newSummary`, уже показано jar animation або page дійшов до `summary` / `ai_summary`.

### `/ny/summary`

**Source:** `app/ny/summary.tsx`  
**Статус:** Активний сезонний

**Що це:** AI summary поверх усіх завершених NY events.

**Що робить система:**

- створює summary event;
- збирає всі finished NY events;
- рахує completion stats;
- генерує один aggregate AI summary через `useNySummary()`;
- показує його через `SummaryAIPage`.

## 14. Transit / Modal / Utility screens

### `/jar-animation`

**Source:** `app/jar-animation.tsx`  
**Статус:** Допоміжний

**Що це:** коротка transparent modal-анімація падіння нового ball у jar.

**Що може робити користувач:**

- дочекатися автозакриття;
- або тапнути, щоб закрити раніше.

Інші utility/detail screens, які вже описані вище:

- `/review/view` — markdown/detail review screen.
- `/journey/view-modal` — readonly modal preview для rich-text content.

## 15. Системні й технічні route без окремої бізнес-логіки

### `+not-found`

**Source:** `app/+not-found.tsx`  
**Статус:** Системний

Показує стандартний `This screen doesn't exist` і дає повернення на home.

### `+html`

**Source:** `app/+html.tsx`  
**Статус:** Системний

Web-shell route для Expo Router. Бізнес-логіки як продуктового екрана не має.

## 16. Короткий список маршрутів, які в коді не мають прямого активного входу з основних flow

- `/question/event` — окремий quiz route; tab-каталог `/(tabs)/events` веде в `/events/question`, не сюди.
- `/journey/journaling` — окремий vertical prompt browser; tile `Journaling` у `/(tabs)/events` веде в `/editor`.
- `/letter/event` — route є в root stack, але tile переходу на нього в `app/(tabs)/events.tsx` закоментований.
- `/settings/user` — route є, але в settings menu перехід закоментований.
- `/settings/contact` — route є, але main settings відкриває сайт.
- `/emotion-tag` — helper screen; у `mood` та related flow активне редагування частіше йде через bottom sheet.

## 17. Що ще варто вручну дописати в цей документ

Для кожного ключового route рекомендується дописати вручну:

- чому ми взагалі створили цей екран;
- яку продуктову проблему він вирішує;
- яка ключова UX-гіпотеза закладена в flow;
- яка основна конверсійна або retention-метрика для нього важлива;
- які edge cases свідомо не покриті.

Особливо варто доповнити:

- `/onboarding`
- `/(tabs)/index`
- `/mood`
- `/editor`
- `/reflections/event`
- `/price`
- `/price-small`
- `/ny`
- `/ny/day`
- `/ny/mood`

## 18. Шаблон блоку для ручного доповнення

Цей блок можна копіювати під будь-який екран або flow:

```md
### Чому цей екран / flow існує

- Яку проблему користувача ми тут вирішуємо:
- Який бізнесовий ризик або бар'єр знімаємо:
- Чому обраний саме такий порядок кроків / CTA:
- Яку основну метрику має покращувати цей екран:
- Які альтернативи розглядалися, але не були вибрані:
```
