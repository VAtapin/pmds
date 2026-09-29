<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const ROOM_TTL = 43200;
const MAX_RESPONSES = 500;

function send_json(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_text(mixed $value, int $limit = 160): string
{
    $text = trim(strip_tags((string) ($value ?? '')));
    return function_exists('mb_substr') ? mb_substr($text, 0, $limit) : substr($text, 0, $limit);
}

function lower_text(mixed $value): string
{
    $text = (string) ($value ?? '');
    return function_exists('mb_strtolower') ? mb_strtolower($text) : strtolower($text);
}

function room_directory(): string
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'kto-moi-blizhnii-rooms';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        send_json(500, ['ok' => false, 'error' => 'Не удалось подготовить хранилище класса']);
    }
    return $directory;
}

function room_path(string $code): string
{
    return room_directory() . DIRECTORY_SEPARATOR . $code . '.json';
}

function make_code(int $length = 6): string
{
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $result = '';
    for ($index = 0; $index < $length; $index += 1) {
        $result .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $result;
}

function public_room(array $room, string $teacherKey = '', string $studentId = ''): array
{
    $now = (int) floor(microtime(true) * 1000);
    $students = array_values(array_filter(
        $room['students'] ?? [],
        static fn(array $student): bool => $now - (int) ($student['seenAt'] ?? 0) < 45000
    ));
    usort($students, static fn(array $left, array $right): int => strnatcasecmp($left['name'], $right['name']));

    $totals = [];
    foreach ($room['responses'] ?? [] as $item) {
        $key = ($item['scene'] ?? 0) . ':' . ($item['type'] ?? '') . ':' . (($item['value'] ?? '') ?: 'text');
        $totals[$key] = ($totals[$key] ?? 0) + 1;
    }

    $isTeacher = $teacherKey !== '' && hash_equals((string) $room['teacherKey'], $teacherKey);
    $state = $room['state'];
    if (!$isTeacher && is_array($state['studentPosts'] ?? null)) {
        $state['studentPosts'] = array_values(array_map(
            static fn(array $post): array => [
                'id' => $post['id'] ?? '',
                'scene' => (int) ($post['scene'] ?? 0),
                'type' => $post['type'] ?? '',
                'text' => $post['text'] ?? '',
                'status' => 'approved',
                'edited' => (bool) ($post['edited'] ?? false),
            ],
            array_filter(
                $state['studentPosts'],
                static fn(array $post): bool => ($post['status'] ?? '') === 'approved'
            )
        ));
    }

    $result = [
        'ok' => true,
        'room' => $room['code'],
        'revision' => $room['revision'],
        'updatedAt' => $room['updatedAt'],
        'state' => $state,
        'connectedCount' => count($students),
        'totals' => $totals,
    ];

    if ($isTeacher) {
        $result['students'] = $students;
        $result['responses'] = array_reverse(array_slice($room['responses'] ?? [], -120));
    }
    if (!$isTeacher && $studentId !== '' && is_array($room['studentMessages'][$studentId] ?? null)) {
        $result['studentMessages'] = array_slice($room['studentMessages'][$studentId], -20);
    }

    return $result;
}

function read_room(string $code): ?array
{
    $path = room_path($code);
    if (!is_file($path)) {
        return null;
    }
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        return null;
    }
    flock($handle, LOCK_SH);
    $room = json_decode(stream_get_contents($handle) ?: '{}', true);
    flock($handle, LOCK_UN);
    fclose($handle);
    return is_array($room) ? $room : null;
}

function mutate_room(string $code, callable $callback): ?array
{
    $path = room_path($code);
    if (!is_file($path)) {
        return null;
    }
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        return null;
    }
    flock($handle, LOCK_EX);
    $room = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($room) || !isset($room['code'])) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return null;
    }
    $room = $callback($room);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $room;
}

foreach (glob(room_directory() . DIRECTORY_SEPARATOR . '*.json') ?: [] as $candidate) {
    if (filemtime($candidate) < time() - ROOM_TTL) {
        @unlink($candidate);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $code = strtoupper(clean_text($_GET['room'] ?? '', 8));
    $room = read_room($code);
    if ($room === null) {
        send_json(404, ['ok' => false, 'error' => 'Класс не найден']);
    }
    send_json(200, public_room(
        $room,
        clean_text($_GET['teacherKey'] ?? '', 80),
        clean_text($_GET['studentId'] ?? '', 80)
    ));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(405, ['ok' => false, 'error' => 'Метод не поддерживается']);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 262144) {
    send_json(413, ['ok' => false, 'error' => 'Слишком большой запрос']);
}
$body = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($body)) {
    send_json(400, ['ok' => false, 'error' => 'Некорректные данные']);
}

if (($body['action'] ?? '') === 'create') {
    do {
        $code = make_code();
        $path = room_path($code);
    } while (is_file($path));

    $room = [
        'code' => $code,
        'teacherKey' => bin2hex(random_bytes(24)),
        'revision' => 1,
        'updatedAt' => (int) floor(microtime(true) * 1000),
        'state' => is_array($body['state'] ?? null) ? $body['state'] : [],
        'students' => [],
        'responses' => [],
        'studentMessages' => [],
    ];
    file_put_contents($path, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    send_json(201, [...public_room($room, $room['teacherKey']), 'teacherKey' => $room['teacherKey']]);
}

$code = strtoupper(clean_text($body['room'] ?? '', 8));
$room = read_room($code);
if ($room === null) {
    send_json(404, ['ok' => false, 'error' => 'Класс не найден']);
}

$action = clean_text($body['action'] ?? '', 32);
if ($action === 'update' || $action === 'clearResponses') {
    $teacherKey = clean_text($body['teacherKey'] ?? '', 80);
    if (!hash_equals((string) $room['teacherKey'], $teacherKey)) {
        send_json(403, ['ok' => false, 'error' => 'Нет доступа учителя']);
    }
    $updated = mutate_room($code, static function (array $current) use ($body, $action): array {
        if ($action === 'update' && is_array($body['state'] ?? null)) {
            $studentPosts = is_array($current['state']['studentPosts'] ?? null) ? $current['state']['studentPosts'] : [];
            $current['state'] = [...$body['state'], 'studentPosts' => $studentPosts];
        }
        if ($action === 'clearResponses') {
            $current['responses'] = [];
            $current['state']['studentPosts'] = [];
        }
        $current['revision'] += 1;
        $current['updatedAt'] = (int) floor(microtime(true) * 1000);
        return $current;
    });
    send_json(200, public_room($updated ?? $room, $teacherKey));
}

if ($action === 'moderatePost') {
    $teacherKey = clean_text($body['teacherKey'] ?? '', 80);
    if (!hash_equals((string) $room['teacherKey'], $teacherKey)) {
        send_json(403, ['ok' => false, 'error' => 'Нет доступа учителя']);
    }
    $postId = clean_text($body['postId'] ?? '', 80);
    $operation = clean_text($body['operation'] ?? '', 20);
    $updated = mutate_room($code, static function (array $current) use ($body, $postId, $operation): array {
        $posts = is_array($current['state']['studentPosts'] ?? null) ? $current['state']['studentPosts'] : [];
        if ($operation === 'delete') {
            $posts = array_values(array_filter($posts, static fn(array $post): bool => ($post['id'] ?? '') !== $postId));
        } else {
            foreach ($posts as &$post) {
                if (($post['id'] ?? '') !== $postId) {
                    continue;
                }
                if ($operation === 'approve') {
                    $post['status'] = 'approved';
                }
                if ($operation === 'edit') {
                    $post['text'] = clean_text($body['text'] ?? '', 180);
                    $post['edited'] = true;
                }
                if ($operation === 'reply') {
                    $message = clean_text($body['message'] ?? '', 180);
                    $studentId = clean_text($post['studentId'] ?? '', 80);
                    if ($message !== '' && $studentId !== '') {
                        if (!is_array($current['studentMessages'][$studentId] ?? null)) {
                            $current['studentMessages'][$studentId] = [];
                        }
                        $current['studentMessages'][$studentId][] = [
                            'id' => ((int) floor(microtime(true) * 1000)) . '-' . make_code(4),
                            'text' => $message,
                            'createdAt' => (int) floor(microtime(true) * 1000),
                        ];
                        $current['studentMessages'][$studentId] = array_slice($current['studentMessages'][$studentId], -20);
                    }
                }
            }
            unset($post);
        }
        $current['state']['studentPosts'] = $posts;
        $current['revision'] += 1;
        $current['updatedAt'] = (int) floor(microtime(true) * 1000);
        return $current;
    });
    send_json(200, public_room($updated ?? $room, $teacherKey));
}

if ($action === 'resolveQuestion') {
    $teacherKey = clean_text($body['teacherKey'] ?? '', 80);
    if (!hash_equals((string) $room['teacherKey'], $teacherKey)) {
        send_json(403, ['ok' => false, 'error' => 'Нет доступа учителя']);
    }
    $responseId = clean_text($body['responseId'] ?? '', 80);
    $resolution = clean_text($body['resolution'] ?? '', 20);
    $messages = [
        'closed' => 'Учитель ответил: вопрос закрыт. Теперь можно нажать «Готов».',
        'coming' => 'Учитель сейчас подойдёт. После разговора можно нажать «Готов».',
        'ok' => 'Учитель увидел ваш вопрос. Можно снова выбрать «Готов».',
    ];
    if (!isset($messages[$resolution])) {
        send_json(400, ['ok' => false, 'error' => 'Неизвестный ответ учителя']);
    }
    $questionResolved = false;
    $updated = mutate_room($code, static function (array $current) use ($responseId, $resolution, $messages, &$questionResolved): array {
        $questionIndex = null;
        $question = null;
        foreach ($current['responses'] ?? [] as $index => $response) {
            if (($response['id'] ?? '') === $responseId
                && ($response['type'] ?? '') === 'ready'
                && ($response['value'] ?? '') === 'question') {
                $questionIndex = $index;
                $question = $response;
                break;
            }
        }
        if ($questionIndex === null || !is_array($question)) {
            return $current;
        }
        $questionResolved = true;
        array_splice($current['responses'], $questionIndex, 1);
        $studentId = clean_text($question['studentId'] ?? '', 80);
        $scoreAdjustment = array_key_exists('awarded', $question) && $question['awarded'] === false ? 0 : -1;
        if ($studentId !== '' && isset($current['students'][$studentId]) && $scoreAdjustment !== 0) {
            $current['students'][$studentId]['score'] = max(0, (int) ($current['students'][$studentId]['score'] ?? 0) + $scoreAdjustment);
        }
        if (!is_array($current['studentMessages'][$studentId] ?? null)) {
            $current['studentMessages'][$studentId] = [];
        }
        $current['studentMessages'][$studentId][] = [
            'id' => ((int) floor(microtime(true) * 1000)) . '-' . make_code(4),
            'text' => $messages[$resolution],
            'kind' => 'question_resolved',
            'scene' => (int) ($question['scene'] ?? 0),
            'scoreAdjustment' => $scoreAdjustment,
            'createdAt' => (int) floor(microtime(true) * 1000),
        ];
        $current['studentMessages'][$studentId] = array_slice($current['studentMessages'][$studentId], -20);
        $current['revision'] += 1;
        $current['updatedAt'] = (int) floor(microtime(true) * 1000);
        return $current;
    });
    if (!$questionResolved) {
        send_json(404, ['ok' => false, 'error' => 'Вопрос уже закрыт или не найден']);
    }
    send_json(200, public_room($updated ?? $room, $teacherKey));
}

$studentId = clean_text($body['studentId'] ?? '', 80);
$studentName = clean_text($body['name'] ?? '', 32) ?: 'Ученик';
if ($studentId === '') {
    send_json(400, ['ok' => false, 'error' => 'Не указан ученик']);
}

$roleConflict = '';
$updated = mutate_room($code, static function (array $current) use ($body, $action, $studentId, $studentName, &$roleConflict): array {
    $score = max(0, min(99, (int) ($body['score'] ?? 0)));
    $current['students'][$studentId] = [
        'id' => $studentId,
        'name' => $studentName,
        'score' => $score,
        'seenAt' => (int) floor(microtime(true) * 1000),
    ];

    if ($action === 'respond') {
        $responseId = ((int) floor(microtime(true) * 1000)) . '-' . make_code(4);
        $responseItem = [
            'id' => $responseId,
            'studentId' => $studentId,
            'name' => $studentName,
            'scene' => max(0, min(12, (int) ($body['scene'] ?? 0))),
            'type' => clean_text($body['type'] ?? '', 32),
            'value' => clean_text($body['value'] ?? '', 80),
            'text' => clean_text($body['text'] ?? '', 180),
            'awarded' => (bool) ($body['awarded'] ?? false),
            'score' => $score,
            'createdAt' => (int) floor(microtime(true) * 1000),
        ];
        $singleChoiceTypes = ['ready', 'role', 'motive', 'barrier', 'neighbor', 'sequence_order'];
        if ($responseItem['type'] === 'role') {
            foreach ($current['responses'] ?? [] as $existing) {
                if ((int) ($existing['scene'] ?? -1) === $responseItem['scene']
                    && ($existing['type'] ?? '') === 'role'
                    && ($existing['value'] ?? '') === $responseItem['value']
                    && ($existing['studentId'] ?? '') !== $responseItem['studentId']) {
                    $roleConflict = clean_text($existing['name'] ?? 'другой ученик', 32);
                    return $current;
                }
            }
        }
        if (in_array($responseItem['type'], $singleChoiceTypes, true)) {
            foreach ($current['responses'] ?? [] as $index => $existing) {
                if (($existing['studentId'] ?? '') !== $responseItem['studentId']
                    || (int) ($existing['scene'] ?? -1) !== $responseItem['scene']
                    || ($existing['type'] ?? '') !== $responseItem['type']) {
                    continue;
                }
                $unchanged = lower_text($existing['value'] ?? '') === lower_text($responseItem['value'])
                    && lower_text($existing['text'] ?? '') === lower_text($responseItem['text']);
                if ($unchanged) {
                    return $current;
                }
                $responseItem['id'] = $existing['id'] ?? $responseItem['id'];
                $current['responses'][$index] = $responseItem;
                $current['revision'] += 1;
                $current['updatedAt'] = (int) floor(microtime(true) * 1000);
                return $current;
            }
        }
        $duplicate = false;
        foreach ($current['responses'] ?? [] as $existing) {
            if (($existing['studentId'] ?? '') === $responseItem['studentId']
                && (int) ($existing['scene'] ?? -1) === $responseItem['scene']
                && ($existing['type'] ?? '') === $responseItem['type']
                && lower_text($existing['value'] ?? '') === lower_text($responseItem['value'])
                && lower_text($existing['text'] ?? '') === lower_text($responseItem['text'])) {
                $duplicate = true;
                break;
            }
        }
        if ($duplicate) {
            return $current;
        }
        $current['responses'][] = $responseItem;
        if ($responseItem['text'] !== '' && in_array($responseItem['type'], ['excuse', 'school_help', 'promise', 'takeaway'], true)) {
            $posts = is_array($current['state']['studentPosts'] ?? null) ? $current['state']['studentPosts'] : [];
            $posts[] = [
                'id' => $responseId,
                'studentId' => $studentId,
                'name' => $studentName,
                'scene' => $responseItem['scene'],
                'type' => $responseItem['type'],
                'text' => $responseItem['text'],
                'status' => 'pending',
                'createdAt' => $responseItem['createdAt'],
            ];
            $current['state']['studentPosts'] = array_slice($posts, -160);
        }
        if (count($current['responses']) > MAX_RESPONSES) {
            $current['responses'] = array_slice($current['responses'], -350);
        }
        $current['revision'] += 1;
        $current['updatedAt'] = (int) floor(microtime(true) * 1000);
    }
    return $current;
});

if ($roleConflict !== '') {
    send_json(409, ['ok' => false, 'error' => 'Эту роль уже выбрал ' . $roleConflict . '. Выберите другую.']);
}

send_json(200, public_room($updated ?? $room));
