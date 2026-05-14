<?php

declare(strict_types=1);

namespace App\Services;

use PDO;
use Throwable;

class StageOneRegistrationService
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_SELECTED = 'selected';
    public const STATUS_SAVED = 'saved_next_batch';

    public function submit(array $input, array $files): array
    {
        $this->ensureSchema();

        $clean = [
            'firstName' => trim((string) ($input['firstName'] ?? '')),
            'middleName' => trim((string) ($input['middleName'] ?? '')),
            'lastName' => trim((string) ($input['lastName'] ?? '')),
            'email' => strtolower(trim((string) ($input['email'] ?? ''))),
            'contactNumber' => trim((string) ($input['contactNumber'] ?? '')),
            'completeAddress' => trim((string) ($input['completeAddress'] ?? '')),
        ];
        $clean['fullName'] = trim(implode(' ', array_filter([
            $clean['firstName'],
            $clean['middleName'],
            $clean['lastName'],
        ], static fn (string $value): bool => $value !== '')));

        $errors = $this->validateSubmission($clean, $files);
        if ($errors !== []) {
            return [
                'ok' => false,
                'message' => 'Please complete the required Stage 1 registration fields.',
                'errors' => $errors,
            ];
        }

        if ($this->emailExistsInPortalUsers($clean['email'])) {
            return [
                'ok' => false,
                'message' => 'This email already has a SMART LEAP portal account.',
                'errors' => ['email' => 'This email already has a SMART LEAP portal account.'],
            ];
        }

        if ($this->emailExistsInStageOne($clean['email'])) {
            return [
                'ok' => false,
                'message' => 'This email already has a Stage 1 registration on file.',
                'errors' => ['email' => 'This email already has a Stage 1 registration on file.'],
            ];
        }

        $uploadService = new UploadService();
        $pdo = db();
        $pdo->beginTransaction();

        try {
            $businessPhoto = $uploadService->storeStageOneAsset('businessPhoto', $files['businessPhoto'] ?? null);
            $validIdPhoto = $uploadService->storeStageOneAsset('validIdPhoto', $files['validIdPhoto'] ?? null);
            $referenceCode = $this->generateReferenceCode($pdo);
            $initialStatus = $this->selectedCount() >= $this->currentBatchCapacity()
                ? self::STATUS_SAVED
                : self::STATUS_PENDING;

            $statement = $pdo->prepare(
                'INSERT INTO stage_one_registrations
                 (reference_code, first_name, middle_name, last_name, full_name, email, contact_number, complete_address,
                  business_photo_path, business_photo_original_name, business_photo_mime_type, business_photo_file_size,
                  valid_id_path, valid_id_original_name, valid_id_mime_type, valid_id_file_size, validation_status, created_at, updated_at)
                 VALUES
                 (:reference_code, :first_name, :middle_name, :last_name, :full_name, :email, :contact_number, :complete_address,
                  :business_photo_path, :business_photo_original_name, :business_photo_mime_type, :business_photo_file_size,
                  :valid_id_path, :valid_id_original_name, :valid_id_mime_type, :valid_id_file_size, :validation_status, NOW(), NOW())'
            );
            $statement->execute([
                'reference_code' => $referenceCode,
                'first_name' => $clean['firstName'],
                'middle_name' => $clean['middleName'] !== '' ? $clean['middleName'] : null,
                'last_name' => $clean['lastName'],
                'full_name' => $clean['fullName'],
                'email' => $clean['email'],
                'contact_number' => $clean['contactNumber'],
                'complete_address' => $clean['completeAddress'],
                'business_photo_path' => $businessPhoto['file_path'],
                'business_photo_original_name' => $businessPhoto['original_name'],
                'business_photo_mime_type' => $businessPhoto['mime_type'],
                'business_photo_file_size' => $businessPhoto['file_size'],
                'valid_id_path' => $validIdPhoto['file_path'],
                'valid_id_original_name' => $validIdPhoto['original_name'],
                'valid_id_mime_type' => $validIdPhoto['mime_type'],
                'valid_id_file_size' => $validIdPhoto['file_size'],
                'validation_status' => $initialStatus,
            ]);

            $registrationId = (int) $pdo->lastInsertId();
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('stage_one_registration.submit', $exception, ['email' => $clean['email']]);
            return [
                'ok' => false,
                'message' => 'Unable to submit the Stage 1 registration right now.',
            ];
        }

        return [
            'ok' => true,
            'message' => $initialStatus === self::STATUS_SAVED
                ? 'Registration submitted and saved for the next SMART LEAP batch.'
                : 'Registration submitted. Watch your email for the next steps if you are selected.',
            'referenceCode' => $referenceCode,
            'registration' => $this->getRegistrationDetail($registrationId),
        ];
    }

    public function validationState(): array
    {
        $this->ensureSchema();
        $this->syncOverflowRegistrationsToSaved();

        $rows = db()->query(
            'SELECT
                stage_one_registrations.*,
                reviewers.full_name AS reviewed_by_name
             FROM stage_one_registrations
             LEFT JOIN users AS reviewers ON reviewers.id = stage_one_registrations.validated_by_user_id
             ORDER BY stage_one_registrations.created_at DESC, stage_one_registrations.id DESC'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $items = array_map(fn (array $row): array => $this->formatRegistrationRow($row), $rows);
        $pending = array_values(array_filter($items, fn (array $row): bool => $row['statusKey'] === self::STATUS_PENDING));
        $selected = array_values(array_filter($items, fn (array $row): bool => $row['statusKey'] === self::STATUS_SELECTED));
        $saved = array_values(array_filter($items, fn (array $row): bool => $row['statusKey'] === self::STATUS_SAVED));

        return [
            'summary' => [
                'batchCapacity' => $this->currentBatchCapacity(),
                'pending' => count($pending),
                'selected' => count($selected),
                'saved' => count($saved),
                'remaining' => max(0, $this->currentBatchCapacity() - count($selected)),
            ],
            'pending' => $pending,
            'selected' => $selected,
            'saved' => $saved,
        ];
    }

    public function getRegistrationDetail(int $registrationId): ?array
    {
        $this->ensureSchema();
        if ($registrationId < 1) {
            return null;
        }

        $statement = db()->prepare(
            'SELECT
                stage_one_registrations.*,
                reviewers.full_name AS reviewed_by_name
             FROM stage_one_registrations
             LEFT JOIN users AS reviewers ON reviewers.id = stage_one_registrations.validated_by_user_id
             WHERE stage_one_registrations.id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $registrationId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $this->formatRegistrationRow($row) : null;
    }

    public function reviewRegistration(int $registrationId, string $action, array $actor): array
    {
        $this->ensureSchema();
        $registration = $this->getRegistrationDetail($registrationId);
        if ($registration === null) {
            return ['ok' => false, 'message' => 'Stage 1 registration not found.'];
        }

        $targetStatus = match (strtolower(trim($action))) {
            'approve', 'approved', 'select' => self::STATUS_SELECTED,
            'hold', 'save', 'saved', 'defer' => self::STATUS_SAVED,
            default => '',
        };
        if ($targetStatus === '') {
            return ['ok' => false, 'message' => 'Unsupported validation action.'];
        }

        if (
            $targetStatus === self::STATUS_SELECTED
            && $registration['statusKey'] !== self::STATUS_SELECTED
            && $this->selectedCount() >= $this->currentBatchCapacity()
        ) {
            return ['ok' => false, 'message' => sprintf('The current SMART LEAP batch is already full at %d selected registrants.', $this->currentBatchCapacity())];
        }

        $statement = db()->prepare(
            'UPDATE stage_one_registrations
             SET validation_status = :validation_status,
                 validated_by_user_id = :validated_by_user_id,
                 validated_at = NOW(),
                 updated_at = NOW()
             WHERE id = :id'
        );
        $statement->execute([
            'validation_status' => $targetStatus,
            'validated_by_user_id' => (int) ($actor['id'] ?? 0) > 0 ? (int) $actor['id'] : null,
            'id' => $registrationId,
        ]);

        if ($targetStatus === self::STATUS_SELECTED) {
            $this->syncOverflowRegistrationsToSaved();
        }

        $updatedRegistration = $this->getRegistrationDetail($registrationId);
        $emailSent = true;
        if ($targetStatus === self::STATUS_SELECTED && is_array($updatedRegistration)) {
            $emailSent = $this->sendSelectionEmail($updatedRegistration);
        }

        return [
            'ok' => true,
            'message' => $targetStatus === self::STATUS_SELECTED
                ? ($emailSent
                    ? 'Stage 1 applicant selected for the current batch. Email notice sent.'
                    : 'Stage 1 applicant selected for the current batch, but the email notice could not be sent.')
                : 'Stage 1 applicant saved for the next SMART LEAP batch.',
            'registration' => $updatedRegistration,
            'state' => $this->validationState(),
            'emailSent' => $emailSent,
        ];
    }

    public function validationSummary(): array
    {
        try {
            return $this->validationState()['summary'];
        } catch (Throwable $exception) {
            log_database_query_failure('stage_one_registration.summary', $exception);
            return [
                'batchCapacity' => $this->currentBatchCapacity(),
                'pending' => 0,
                'selected' => 0,
                'saved' => 0,
                'remaining' => $this->currentBatchCapacity(),
            ];
        }
    }

    private function validateSubmission(array $clean, array $files): array
    {
        $errors = [];

        if (mb_strlen($clean['firstName']) < 2) {
            $errors['firstName'] = 'Enter your first name.';
        }
        if (mb_strlen($clean['lastName']) < 2) {
            $errors['lastName'] = 'Enter your last name.';
        }
        if (mb_strlen($clean['fullName']) < 3) {
            $errors['general'] = 'Enter your complete name.';
        }
        if (!filter_var($clean['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email address.';
        }

        $digits = preg_replace('/\D+/', '', $clean['contactNumber']);
        if ($digits === null || strlen($digits) < 10) {
            $errors['contactNumber'] = 'Enter a valid contact number.';
        }

        if (mb_strlen($clean['completeAddress']) < 12) {
            $errors['completeAddress'] = 'Enter your complete address.';
        }

        if (!is_array($files['businessPhoto'] ?? null) || (int) (($files['businessPhoto']['error'] ?? UPLOAD_ERR_NO_FILE)) === UPLOAD_ERR_NO_FILE) {
            $errors['businessPhoto'] = 'Upload a photo of your existing business.';
        }

        if (!is_array($files['validIdPhoto'] ?? null) || (int) (($files['validIdPhoto']['error'] ?? UPLOAD_ERR_NO_FILE)) === UPLOAD_ERR_NO_FILE) {
            $errors['validIdPhoto'] = 'Upload a photo or copy of your valid ID.';
        }

        return $errors;
    }

    private function formatRegistrationRow(array $row): array
    {
        $statusKey = $this->normalizeStatusKey((string) ($row['validation_status'] ?? self::STATUS_PENDING));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'referenceCode' => (string) ($row['reference_code'] ?? ''),
            'firstName' => (string) ($row['first_name'] ?? ''),
            'middleName' => (string) ($row['middle_name'] ?? ''),
            'lastName' => (string) ($row['last_name'] ?? ''),
            'fullName' => (string) ($row['full_name'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'contactNumber' => (string) ($row['contact_number'] ?? ''),
            'completeAddress' => (string) ($row['complete_address'] ?? ''),
            'statusKey' => $statusKey,
            'statusLabel' => match ($statusKey) {
                self::STATUS_SELECTED => 'Selected for Current Batch',
                self::STATUS_SAVED => 'Saved for Next Batch',
                default => 'Pending Validation',
            },
            'submittedAt' => (string) ($row['created_at'] ?? ''),
            'validatedAt' => (string) ($row['validated_at'] ?? ''),
            'reviewedByName' => (string) ($row['reviewed_by_name'] ?? ''),
            'businessPhoto' => $this->formatUploadMeta(
                (string) ($row['business_photo_path'] ?? ''),
                (string) ($row['business_photo_original_name'] ?? ''),
                (string) ($row['business_photo_mime_type'] ?? ''),
                (int) ($row['business_photo_file_size'] ?? 0)
            ),
            'validIdPhoto' => $this->formatUploadMeta(
                (string) ($row['valid_id_path'] ?? ''),
                (string) ($row['valid_id_original_name'] ?? ''),
                (string) ($row['valid_id_mime_type'] ?? ''),
                (int) ($row['valid_id_file_size'] ?? 0)
            ),
        ];
    }

    private function formatUploadMeta(string $path, string $name, string $mimeType, int $fileSize): array
    {
        $mimeType = strtolower(trim($mimeType));
        return [
            'path' => $path,
            'name' => $name,
            'mimeType' => $mimeType,
            'fileSize' => $fileSize,
            'url' => $path !== '' ? app_url($path) : '',
            'isImage' => str_starts_with($mimeType, 'image/'),
        ];
    }

    private function normalizeStatusKey(string $status): string
    {
        return match (strtolower(trim($status))) {
            self::STATUS_SELECTED, 'approved', 'selected' => self::STATUS_SELECTED,
            self::STATUS_SAVED, 'saved', 'held', 'deferred' => self::STATUS_SAVED,
            default => self::STATUS_PENDING,
        };
    }

    private function selectedCount(): int
    {
        $statement = db()->prepare('SELECT COUNT(*) FROM stage_one_registrations WHERE validation_status = :validation_status');
        $statement->execute(['validation_status' => self::STATUS_SELECTED]);
        return (int) ($statement->fetchColumn() ?: 0);
    }

    private function syncOverflowRegistrationsToSaved(): void
    {
        if ($this->selectedCount() < $this->currentBatchCapacity()) {
            return;
        }

        db()->prepare(
            'UPDATE stage_one_registrations
             SET validation_status = :saved_status,
                 updated_at = NOW()
             WHERE validation_status = :pending_status'
        )->execute([
            'saved_status' => self::STATUS_SAVED,
            'pending_status' => self::STATUS_PENDING,
        ]);
    }

    private function currentBatchCapacity(): int
    {
        return (new BeneficiaryProfileService())->activeBatchCapacity();
    }

    private function sendSelectionEmail(array $registration): bool
    {
        $recipient = trim((string) ($registration['email'] ?? ''));
        if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        $name = htmlspecialchars((string) ($registration['fullName'] ?? 'Applicant'), ENT_QUOTES);
        $signupUrl = htmlspecialchars(app_url('signup'), ENT_QUOTES);
        $portalUrl = htmlspecialchars(app_url('portal'), ENT_QUOTES);
        $subject = 'SMART LEAP Registration Approved';
        $body = sprintf(
            '<p>Hello %s,</p>'
            . '<p>Your SMART LEAP registration has been selected for the current batch.</p>'
            . '<p>You may now create your SMART LEAP portal account using this link:</p>'
            . '<p><a href="%s">%s</a></p>'
            . '<p>After creating your account, continue your application in the portal.</p>'
            . '<p>Portal: <a href="%s">%s</a></p>',
            $name,
            $signupUrl,
            $signupUrl,
            $portalUrl,
            $portalUrl
        );

        return (new MailService())->send($recipient, $subject, $body, null);
    }

    private function emailExistsInPortalUsers(string $email): bool
    {
        $statement = db()->prepare('SELECT COUNT(*) FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);
        return (int) ($statement->fetchColumn() ?: 0) > 0;
    }

    private function emailExistsInStageOne(string $email): bool
    {
        $statement = db()->prepare('SELECT COUNT(*) FROM stage_one_registrations WHERE email = :email');
        $statement->execute(['email' => $email]);
        return (int) ($statement->fetchColumn() ?: 0) > 0;
    }

    private function generateReferenceCode(PDO $pdo): string
    {
        $year = date('Y');
        $statement = $pdo->prepare(
            'SELECT reference_code
             FROM stage_one_registrations
             WHERE reference_code LIKE :reference
             ORDER BY id DESC
             LIMIT 1'
        );
        $statement->execute(['reference' => 'SL1-' . $year . '-%']);
        $lastCode = (string) ($statement->fetchColumn() ?: '');
        $sequence = 1;

        if (preg_match('/^SL1-\d{4}-(\d{4})$/', $lastCode, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return sprintf('SL1-%s-%04d', $year, $sequence);
    }

    private function ensureSchema(): void
    {
        static $ready = false;
        if ($ready) {
            return;
        }

        db()->exec(
            'CREATE TABLE IF NOT EXISTS stage_one_registrations (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                reference_code VARCHAR(40) NOT NULL UNIQUE,
                first_name VARCHAR(80) NOT NULL,
                middle_name VARCHAR(80) NULL,
                last_name VARCHAR(80) NOT NULL,
                full_name VARCHAR(180) NOT NULL,
                email VARCHAR(160) NOT NULL,
                contact_number VARCHAR(40) NOT NULL,
                complete_address TEXT NOT NULL,
                business_photo_path VARCHAR(255) NOT NULL,
                business_photo_original_name VARCHAR(255) NOT NULL,
                business_photo_mime_type VARCHAR(120) NULL,
                business_photo_file_size BIGINT UNSIGNED NULL,
                valid_id_path VARCHAR(255) NOT NULL,
                valid_id_original_name VARCHAR(255) NOT NULL,
                valid_id_mime_type VARCHAR(120) NULL,
                valid_id_file_size BIGINT UNSIGNED NULL,
                validation_status VARCHAR(40) NOT NULL DEFAULT "pending",
                validated_by_user_id BIGINT UNSIGNED NULL,
                validated_at DATETIME NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_stage_one_registrations_reviewer FOREIGN KEY (validated_by_user_id) REFERENCES users(id),
                INDEX idx_stage_one_registrations_status (validation_status),
                INDEX idx_stage_one_registrations_email (email),
                INDEX idx_stage_one_registrations_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $ready = true;
    }
}
