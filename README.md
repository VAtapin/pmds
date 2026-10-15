# Экзаменационные материалы

Статический сайт с отдельными справочниками по учебным предметам. В корне находится общая страница предметов, а каждый справочник размещается в собственном каталоге.

## Возможности

- отдельные страницы: 103 вопроса по догматическому и 96 пунктов программы по нравственному богословию;
- независимое включение и выключение материалов 2 и 3 курса;
- мгновенный поиск по вопросам, ответам, памяткам и тегам;
- единое облако точных фильтров, которое показывает темы только включённых курсов и группирует их по восьми главным разделам;
- компактные раскрывающиеся карточки с автоматическим закрытием предыдущего ответа;
- выделенный блок «Запомнить» в начале каждого ответа;
- адаптивная раскладка для телефона и компьютера.

## Структура

- `dist/index.html` — главная страница со списком предметов;
- `dist/dogmatika/` — справочник по догматическому богословию;
- `dist/nravstvennoe-bogoslovie/` — нравственное богословие: оба года обучения, 32 темы и 96 пунктов исходной программы;
- `content/moral-theology-questions.json` — точные формулировки пунктов, краткие памятки, авторские пересказы ответов и ссылки на рекомендованную литературу;
- `scripts/build-moral-static-site.mjs` — сборка данных нравственного богословия;
- `scripts/extract-word-doc.py` — извлечение текста из нешифрованного Word 97–2003 DOC;
- `content/questions.json` — извлечённые вопросы, ответы и результат сверки;
- `scripts/extract-docx.ps1` — повторное извлечение материалов из DOCX;
- `scripts/build-static-site.ps1` — обновление `dist/dogmatika/questions.js` из данных;
- `scripts/serve-static.mjs` — локальный просмотр сайта.

## Локальный просмотр

```powershell
node .\scripts\serve-static.mjs 8765
```

Главная страница: `http://127.0.0.1:8765/`.

Догматическое богословие: `http://127.0.0.1:8765/dogmatika/`.

Нравственное богословие: `http://127.0.0.1:8765/nravstvennoe-bogoslovie/`.

В программе нравственного богословия «1 год обучения» соответствует 2 курсу (темы 1–10), а «2 год обучения» — 4 курсу (темы 11–32). Оба блока включены по умолчанию; их можно независимо отключать. Вопросы сохранены как пункты программы, включая её написание и пунктуацию. Это тематическая программа, а не список экзаменационных билетов. Ответы составлены как краткие пересказы указанных в программе книг; источники показаны под ответами. Историческая периодизация и девятичинная схема обозначены как учебные схемы программы.

Для обновления данных и проверки:

```powershell
node scripts/build-moral-static-site.mjs
node tests/moral-content.test.mjs
node --check dist/dogmatika/app.js
node --check dist/nravstvennoe-bogoslovie/questions.js
```

## Публикация

Скопируйте содержимое `dist` в каталог сайта на сервере. Новая страница использует общие `dogmatika/app.js` и `dogmatika/styles.css`, поэтому обновлять нужно также эти файлы и главную страницу с `hub.css`. Node.js используется только для локальной сборки данных и просмотра; серверный npm build и установка зависимостей не нужны. Настроенного Git remote в локальном проекте нет; пользователь публикует файлы вручную.

## Сравнительное богословие

94 вопроса двух годов обучения (3 и 4 курс) размещены в dist/sravnitelnoe-bogoslovie/. Материалы: content/comparative-theology-questions.json. Проверки: node --test --test-isolation=none tests/comparative-theology-content.test.mjs.

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
