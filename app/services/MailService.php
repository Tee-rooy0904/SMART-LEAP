<?php

declare(strict_types=1);

namespace App\Services;

class MailService
{
    public function send(string $to, string $subject, string $html, ?int $userId = null): bool
    {
        $config = config('mail');
        $logLine = sprintf("[%s] TO:%s SUBJECT:%s\n", date('c'), $to, $subject);
        file_put_contents(storage_path('logs/mail.log'), $logLine, FILE_APPEND);

        if (!class_exists(\PHPMailer\PHPMailer\PHPMailer::class) || $config['driver'] === 'log') {
            $this->storeEmailLog($userId, $to, $subject, 'logged', null, null, true);
            return true;
        }

        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mailer->isSMTP();
            $mailer->Host = $config['host'];
            $mailer->Port = $config['port'];
            $mailer->SMTPAuth = $config['username'] !== '';
            $mailer->Username = $config['username'];
            $mailer->Password = $config['password'];
            if ($config['encryption']) {
                $mailer->SMTPSecure = $config['encryption'];
            }
            $mailer->setFrom($config['from_address'], $config['from_name']);
            $mailer->addAddress($to);
            $mailer->Subject = $subject;
            $mailer->isHTML(true);
            $mailer->Body = $html;
            $sent = $mailer->send();
            $this->storeEmailLog($userId, $to, $subject, $sent ? 'sent' : 'failed', $mailer->getLastMessageID() ?: null, null, $sent);
            return $sent;
        } catch (\Throwable $exception) {
            $this->storeEmailLog($userId, $to, $subject, 'failed', null, $exception->getMessage(), false);
            log_database_query_failure('mail.send', $exception, ['recipient_email' => $to, 'subject' => $subject]);
            return false;
        }
    }

    public function sendTrainingNotice(array $user, array $program, array $invitee): bool
    {
        $subject = 'SMART LEAP Training Notice: ' . ($program['programName'] ?? $program['title'] ?? 'Training Session');
        $formattedDate = $this->formatTrainingDate((string) ($program['date'] ?? ''));
        $formattedTimeRange = $this->formatTrainingTimeRange(
            (string) ($program['startTime'] ?? ''),
            (string) ($program['endTime'] ?? '')
        );
        $body = sprintf(
            '<p>Hello %s,</p><p>You have been scheduled for <strong>%s</strong>.</p><p>Venue: %s<br>Date: %s<br>Time: %s</p><p>What to bring: %s</p><p>Instructions: %s</p>',
            htmlspecialchars((string) ($user['name'] ?? 'Applicant'), ENT_QUOTES),
            htmlspecialchars((string) ($program['programName'] ?? $program['title'] ?? 'Training Session'), ENT_QUOTES),
            htmlspecialchars((string) ($program['venue'] ?? 'To be announced'), ENT_QUOTES),
            htmlspecialchars($formattedDate, ENT_QUOTES),
            htmlspecialchars($formattedTimeRange, ENT_QUOTES),
            htmlspecialchars((string) ($program['whatToBring'] ?? 'Bring valid ID and training materials.'), ENT_QUOTES),
            htmlspecialchars((string) ($program['instructions'] ?? ($invitee['remarks'] ?? 'Please arrive 15 minutes early.')), ENT_QUOTES)
        );

        return $this->send((string) ($user['email'] ?? ''), $subject, $body, (int) ($user['id'] ?? 0));
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

    private function storeEmailLog(?int $userId, string $recipientEmail, string $subject, string $status, ?string $providerMessageId, ?string $errorMessage, bool $sent): void
    {
        try {
            $statement = db()->prepare(
                'INSERT INTO email_logs (user_id, recipient_email, subject, status, provider_message_id, error_message, sent_at)
                 VALUES (:user_id, :recipient_email, :subject, :status, :provider_message_id, :error_message, :sent_at)'
            );
            $statement->execute([
                'user_id' => $userId,
                'recipient_email' => $recipientEmail,
                'subject' => $subject,
                'status' => $status,
                'provider_message_id' => $providerMessageId,
                'error_message' => $errorMessage,
                'sent_at' => $sent ? date('Y-m-d H:i:s') : null,
            ]);
        } catch (\Throwable $exception) {
            write_app_log('mail', 'Failed to store email log.', [
                'recipient_email' => $recipientEmail,
                'subject' => $subject,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
