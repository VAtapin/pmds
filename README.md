# Экзаменационные материалы

Статический сайт с отдельными справочниками по учебным предметам. В корне находится общая страница предметов, а каждый справочник размещается в собственном каталоге.

## Возможности

- 103 вопроса по догматическому богословию, отдельные 12 вопросов по нравственному богословию (темы 11–22) из нового DOCX, 13 вопросов по нехристианским религиям, 30 вопросов по Катехизису, 40 экзаменационных билетов по обзору Нового Завета и 94 вопроса по сравнительному богословию (48 за первый год / 3 курс и 46 за второй год / 4 курс);
- независимое включение и выключение материалов 2 и 3 курса;
- мгновенный поиск по вопросам, ответам, памяткам и тегам;
- единое облако точных фильтров, которое показывает темы только включённых курсов и группирует их по восьми главным разделам;
- компактные раскрывающиеся карточки с автоматическим закрытием предыдущего ответа;
- выделенный блок «Запомнить» в начале каждого ответа;
- адаптивная раскладка для телефона и компьютера.

## Структура

- `dist/index.html` — главная страница со списком предметов;
- `dist/dogmatika/` — справочник по догматическому богословию;
- `dist/nravstvennoe-bogoslovie/` — 12 вопросов по лекции (темы 11–22), все пункты памяток и ответы из нового DOCX без изменения текста;
- `dist/glg-citrix/` — подготовка к разговору GLG: 35 немецких вопросов из DOCX, 20 отметок ★ и повторение из 12 пунктов;
- `dist/filter-switches.css` — оформление только переключателей года/курса: зелёный вправо — включён, красный влево — выключен. Облако тем сохраняет обычные кнопки;
- `dist/religii/` — справочник по теории и истории нехристианских религий;
- `dist/katehizis/` — справочник по Катехизису Православной Церкви;
- `dist/novyi-zavet/` — справочник по обзору Нового Завета;
- `dist/sakralnoe-iskusstvo/` — подготовка к зачёту по церковному искусству: 10 вопросов, подробный конспект лекции и разбор Синайского Пантократора;
- `dist/sravnitelnoe-bogoslovie/` — справочник по сравнительному богословию;
- `content/questions.json` — извлечённые вопросы, ответы и результат сверки;
- `content/religions-questions.json` — материалы по нехристианским религиям;
- `content/catechism-questions.json` — материалы по Катехизису;
- `content/new-testament-questions.json` — материалы по обзору Нового Завета;
- `content/sacred-art-exam.json` — вопросы и конспект лекции по церковному искусству;
- `content/comparative-theology-questions.json` — материалы по сравнительному богословию;
- `scripts/extract-docx.ps1` — повторное извлечение материалов из DOCX;
- `scripts/extract-religions-docx.ps1` — повторное извлечение нового предмета из DOCX;
- `scripts/extract-catechism-docx.ps1` — повторное извлечение Катехизиса из DOCX;
- `scripts/extract-new-testament-tickets.ps1` — повторное извлечение 40 билетов по обзору Нового Завета из TXT;
- `scripts/extract-moral-docx.ps1` — повторное извлечение 12 карточек по лекции (темы 11–22) из нового DOCX;
- `scripts/extract-citrix-docx.ps1` — повторное извлечение материалов GLG; обновляет JSON и опубликованные questions.js;
- `scripts/extract-comparative-theology-docx.ps1` — повторное извлечение сравнительного богословия из DOCX;
- `scripts/build-static-site.ps1` — обновление `dist/dogmatika/questions.js` из данных;
- `scripts/build-religions-static-site.ps1` — обновление `dist/religii/questions.js` из данных;
- `scripts/build-catechism-static-site.ps1` — обновление `dist/katehizis/questions.js` из данных;
- `scripts/build-new-testament-static-site.ps1` — обновление `dist/novyi-zavet/questions.js` из данных;
- `scripts/build-sacred-art-exam.mjs` — сборка статических данных раздела церковного искусства;
- `scripts/build-comparative-theology-static-site.ps1` — обновление `dist/sravnitelnoe-bogoslovie/questions.js` из данных;
- `scripts/serve-static.mjs` — локальный просмотр сайта.

## Локальный просмотр

```powershell
node .\scripts\serve-static.mjs 8765
```

Главная страница: `http://127.0.0.1:8765/`.

Богословие: `http://127.0.0.1:8765/dogmatika/`.

Теория и история нехристианских религий: `http://127.0.0.1:8765/religii/`.

Катехизис Православной Церкви: `http://127.0.0.1:8765/katehizis/`.

Обзор Нового Завета: `http://127.0.0.1:8765/novyi-zavet/`.

Сравнительное богословие: `http://127.0.0.1:8765/sravnitelnoe-bogoslovie/`.

Повторный импорт сравнительного богословия (оба DOCX с ответами и программа для сверки):

```powershell
./scripts/extract-comparative-theology-docx.ps1 -FirstYearPath "C:/Users/atapi/Downloads/course1_comparative_theology.docx" -SecondYearPath "C:/Users/atapi/Downloads/course2.docx" -CurriculumPath "C:/Users/atapi/Downloads/Порівняльне богослов'я.docx"
./scripts/build-comparative-theology-static-site.ps1
```

Вопросы, памятки, ответы и повторение сохраняются дословно. Программа содержит темы 1–12 первого года и 13–19 второго. Сверка по темам и нераскрытые подпункты доступны на странице; присутствие темы не означает полное покрытие программы.

## Новые религиозные движения — подготовка к беседе

`dist/religioznye-dvizheniya/`: 55 основных вопросов нового документа и все 35 прежних вопросов как тематические дополнения и повторение. Тексты обоих конспектов сохранены без изменений. Хронология и примечания нового DOCX перенесены полностью. Ориентир на беседу и два учебника добавлены по уточнению преподавателя, переданному пользователем.

Предыдущая подборка хранится в `content/religious-movements-previous.json`; импорт нового DOCX автоматически связывает её с новыми темами.

```powershell
./scripts/extract-religious-movements-docx.ps1 -DocumentPath "C:/Users/atapi/Downloads/Novye_religioznye_dvizheniya_55_voprosov.docx"
./scripts/build-religious-movements-static-site.ps1
./scripts/extract-religious-movements-docx.ps1 -DocumentPath "C:/Users/atapi/Downloads/Novye_religioznye_dvizheniya_55_voprosov.docx" -VerifyOnly
node --test --test-isolation=none tests/religious-movements-content.test.mjs
```

Для ручной публикации заменить `dist/religioznye-dvizheniya/` и обновить `dist/index.html`. Серверный npm build не требуется.
