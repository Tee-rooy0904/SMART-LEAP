<?php

declare(strict_types=1);

namespace App\Services;

class NotificationService
{
    public function listForUser(int $userId): array
    {
        try {
            $statement = db()->prepare(
                'SELECT id, channel, title, message, is_read, sent_at, created_at
                 FROM notifications
                 WHERE user_id = :user_id
                 ORDER BY created_at DESC, id DESC
                 LIMIT 50'
            );
            $statement->execute(['user_id' => $userId]);
            $rows = $statement->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('notifications.list', $exception, ['user_id' => $userId]);
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'channel' => $row['channel'],
                'title' => $row['title'],
                'message' => $row['message'],
                'isRead' => ((int) $row['is_read']) === 1,
                'sentAt' => $row['sent_at'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);
    }

    public function createInApp(int $userId, string $title, string $message, string $channel = 'in_app'): void
    {
        try {
            $statement = db()->prepare(
                'INSERT INTO notifications (user_id, channel, title, message, is_read, sent_at)
                 VALUES (:user_id, :channel, :title, :message, 0, :sent_at)'
            );
            $statement->execute([
                'user_id' => $userId,
                'channel' => $channel,
                'title' => $title,
                'message' => $message,
                'sent_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $exception) {
            log_database_query_failure('notifications.create', $exception, ['user_id' => $userId, 'channel' => $channel]);
        }
    }

    public function sendTrainingNotice(array $user, array $program, array $invitee): bool
    {
        $title = 'Training Notice';
        $formattedDate = $this->formatTrainingDate((string) ($program['date'] ?? ''));
        $formattedTime = $this->formatTrainingTimeRange(
            (string) ($program['startTime'] ?? ''),
            (string) ($program['endTime'] ?? '')
        );
        $message = sprintf(
            'You are scheduled for %s on %s at %s in %s.',
            $program['programName'] ?? $program['title'] ?? 'training',
            $formattedDate,
            $formattedTime,
            $program['venue'] ?? 'TBA'
        );

        $this->createInApp((int) $user['id'], $title, $message, 'training_notice');
        $actorUserId = (int) ($invitee['updatedByUserId'] ?? 0);
        if ($actorUserId > 0 && $actorUserId !== (int) $user['id']) {
            $this->createInApp(
                $actorUserId,
                'Training Notice Sent',
                sprintf('Training notice sent to %s for %s.', $user['name'] ?? 'participant', $program['programName'] ?? $program['title'] ?? 'training'),
                'training_activity'
            );
        }
        $sent = (new MailService())->sendTrainingNotice($user, $program, $invitee);

        (new AuditLogService())->record(
            $actorUserId,
            'training.notice_sent',
            'training_invitees',
            (int) ($invitee['id'] ?? 0),
            ['mail_sent' => $sent]
        );

        return $sent;
    }

    private function formatTrainingDate(string $date): string
    {
        $value = trim($date);
        if ($value === '') {
            return '--';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return date('F j, Y', $timestamp);
    }

    private function formatTrainingTimeRange(string $startTime, string $endTime): string
    {
        $start = $this->formatTrainingTime($startTime);
        $end = $this->formatTrainingTime($endTime);

        if ($start === '--' && $end === '--') {
            return '--';
        }

        if ($end === '--') {
            return $start;
        }

        if ($start === '--') {
            return $end;
        }

        return $start . ' - ' . $end;
    }

    private function formatTrainingTime(string $time): string
    {
        $value = trim($time);
        if ($value === '') {
            return '--';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return date('g:i A', $timestamp);
    }
}
