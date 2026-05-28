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
    public const STATUS_ARCHIVED = 'archived';

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
        $this->syncLegacySelectedApplicants();
        $this->syncOverflowRegistrationsToSaved();

        $rows = db()->query(
            'SELECT
                stage_one_registrations.*,
                reviewers.full_name AS reviewed_by_name
             FROM stage_one_registrations
             LEFT JOIN users AS reviewers ON reviewers.id = stage_one_registrations.validated_by_user_id
             WHERE stage_one_registrations.validation_status <> "archived"
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
                'selectionEmailFailures' => count(array_filter($selected, static fn (array $row): bool => (bool) ($row['selectionEmailNeedsResend'] ?? false))),
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
            $this->persistSelectionEmailStatus($registrationId, (string) ($updatedRegistration['email'] ?? ''), $emailSent);
            $updatedRegistration = $this->getRegistrationDetail($registrationId);
        }

        return [
            'ok' => true,
            'message' => $targetStatus === self::STATUS_SELECTED
                ? ($emailSent
                    ? 'Stage 1 applicant selected for the current batch. Email notice sent.'
                    : 'Stage 1 applicant selected for the current batch, but the email notice could not be sent. Please resend the Stage 2 signup email before telling the applicant to proceed.')
                : 'Stage 1 applicant saved for the next SMART LEAP batch.',
            'registration' => $updatedRegistration,
            'state' => $this->validationState(),
            'emailSent' => $emailSent,
            'requiresEmailResend' => $targetStatus === self::STATUS_SELECTED && !$emailSent,
        ];
    }

    public function resendSelectionEmail(int $registrationId, array $actor = []): array
    {
        $this->ensureSchema();

        $registration = $this->getRegistrationDetail($registrationId);
        if ($registration === null) {
            return ['ok' => false, 'message' => 'Stage 1 registration not found.'];
        }

        if (($registration['statusKey'] ?? '') !== self::STATUS_SELECTED) {
            return ['ok' => false, 'message' => 'Only selected registrants can receive the Stage 2 signup email.'];
        }

        $emailSent = $this->sendSelectionEmail($registration);
        $this->persistSelectionEmailStatus($registrationId, (string) ($registration['email'] ?? ''), $emailSent);
        $updatedRegistration = $this->getRegistrationDetail($registrationId);

        return [
            'ok' => $emailSent,
            'message' => $emailSent
                ? 'Stage 2 signup email resent successfully.'
                : 'Unable to resend the Stage 2 signup email right now. Please review the mail configuration or try again.',
            'registration' => $updatedRegistration,
            'state' => $this->validationState(),
            'emailSent' => $emailSent,
            'requiresEmailResend' => !$emailSent,
            'actorId' => (int) ($actor['id'] ?? 0),
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
                'selectionEmailFailures' => 0,
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
            'selectionEmailSentAt' => (string) ($row['selection_email_sent_at'] ?? ''),
            'selectionEmailFailedAt' => (string) ($row['selection_email_failed_at'] ?? ''),
            'selectionEmailError' => (string) ($row['selection_email_error'] ?? ''),
            'selectionEmailReady' => $statusKey === self::STATUS_SELECTED && (string) ($row['selection_email_sent_at'] ?? '') !== '',
            'selectionEmailNeedsResend' => $statusKey === self::STATUS_SELECTED && (string) ($row['selection_email_sent_at'] ?? '') === '',
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
            self::STATUS_ARCHIVED, 'archived' => self::STATUS_ARCHIVED,
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

    private function syncLegacySelectedApplicants(): void
    {
        static $synced = false;
        if ($synced) {
            return;
        }

        $pdo = db();

        try {
            $rows = $pdo->query(
                'SELECT
                    applicant_profiles.id AS applicant_profile_id,
                    users.full_name,
                    users.email,
                    applicant_profiles.contact_number,
                    applicant_profiles.address_line,
                    latest_applications.created_at AS application_created_at,
                    applicant_profiles.updated_at AS profile_updated_at
                 FROM applicant_profiles
                 INNER JOIN users ON users.id = applicant_profiles.user_id
                 INNER JOIN (
                    SELECT applications.*
                    FROM applications
                    INNER JOIN (
                        SELECT applicant_profile_id, MAX(id) AS latest_id
                        FROM applications
                        GROUP BY applicant_profile_id
                    ) latest_application ON latest_application.latest_id = applications.id
                 ) AS latest_applications ON latest_applications.applicant_profile_id = applicant_profiles.id
                 LEFT JOIN stage_one_registrations AS stage_one
                    ON LOWER(stage_one.email) COLLATE utf8mb4_unicode_ci
                     = LOWER(users.email) COLLATE utf8mb4_unicode_ci
                 LEFT JOIN beneficiary_profiles
                    ON beneficiary_profiles.applicant_profile_id = applicant_profiles.id
                   AND beneficiary_profiles.replacement_for_beneficiary_profile_id IS NULL
                 WHERE stage_one.id IS NULL
                   AND (
                        beneficiary_profiles.id IS NULL
                        OR (
                            COALESCE(beneficiary_profiles.approved_at, beneficiary_profiles.approval_date) IS NULL
                            AND LOWER(COALESCE(beneficiary_profiles.beneficiary_status, "")) NOT IN ("active", "inactive", "deceased")
                        )
                   )
                 ORDER BY latest_applications.created_at ASC, applicant_profiles.id ASC'
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $exception) {
            log_database_query_failure('stage_one_registration.sync_legacy_selected.fetch', $exception);
            return;
        }

        if ($rows === []) {
            $synced = true;
            return;
        }

        $pdo->beginTransaction();

        try {
            $statement = $pdo->prepare(
                'INSERT INTO stage_one_registrations
                 (reference_code, first_name, middle_name, last_name, full_name, email, contact_number, complete_address,
                  business_photo_path, business_photo_original_name, business_photo_mime_type, business_photo_file_size,
                  valid_id_path, valid_id_original_name, valid_id_mime_type, valid_id_file_size,
                  validation_status, validated_by_user_id, validated_at, selection_email_sent_at, created_at, updated_at)
                 VALUES
                 (:reference_code, :first_name, :middle_name, :last_name, :full_name, :email, :contact_number, :complete_address,
                  :business_photo_path, :business_photo_original_name, :business_photo_mime_type, :business_photo_file_size,
                  :valid_id_path, :valid_id_original_name, :valid_id_mime_type, :valid_id_file_size,
                  :validation_status, NULL, :validated_at, :selection_email_sent_at, :created_at, :updated_at)'
            );

            foreach ($rows as $row) {
                $nameParts = $this->splitNameParts((string) ($row['full_name'] ?? ''));
                $createdAt = (string) ($row['application_created_at'] ?? '') !== ''
                    ? (string) $row['application_created_at']
                    : date('Y-m-d H:i:s');
                $updatedAt = (string) ($row['profile_updated_at'] ?? '') !== ''
                    ? (string) $row['profile_updated_at']
                    : $createdAt;

                $statement->execute([
                    'reference_code' => $this->generateReferenceCode($pdo),
                    'first_name' => $nameParts['firstName'],
                    'middle_name' => $nameParts['middleName'] !== '' ? $nameParts['middleName'] : null,
                    'last_name' => $nameParts['lastName'],
                    'full_name' => (string) ($row['full_name'] ?? ''),
                    'email' => strtolower(trim((string) ($row['email'] ?? ''))),
                    'contact_number' => (string) ($row['contact_number'] ?? ''),
                    'complete_address' => (string) ($row['address_line'] ?? ''),
                    'business_photo_path' => '',
                    'business_photo_original_name' => '',
                    'business_photo_mime_type' => null,
                    'business_photo_file_size' => null,
                    'valid_id_path' => '',
                    'valid_id_original_name' => '',
                    'valid_id_mime_type' => null,
                    'valid_id_file_size' => null,
                    'validation_status' => self::STATUS_SELECTED,
                    'validated_at' => $createdAt,
                    'selection_email_sent_at' => $createdAt,
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);
            }

            $pdo->commit();
            $synced = true;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('stage_one_registration.sync_legacy_selected.insert', $exception);
        }
    }

    private function splitNameParts(string $fullName): array
    {
        $parts = array_values(array_filter(preg_split('/\s+/', trim($fullName)) ?: [], static fn (string $value): bool => $value !== ''));
        $firstName = $parts[0] ?? 'Legacy';
        $lastName = count($parts) > 1 ? (string) array_pop($parts) : 'Applicant';
        $middleName = count($parts) > 1 ? trim(implode(' ', array_slice($parts, 1))) : '';

        return [
            'firstName' => $firstName,
            'middleName' => $middleName,
            'lastName' => $lastName,
        ];
    }

    private function sendSelectionEmail(array $registration): bool
    {
        $recipient = trim((string) ($registration['email'] ?? ''));
        if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        $name = htmlspecialchars((string) ($registration['fullName'] ?? 'Applicant'), ENT_QUOTES);
        $signupUrl = htmlspecialchars(app_url('signup'), ENT_QUOTES);
        $portalLoginUrl = htmlspecialchars(app_url('portal-login'), ENT_QUOTES);
        $subject = 'SMART LEAP Registration Approved';
        $body = sprintf(
            '<p>Hello %s,</p>'
            . '<p>Your SMART LEAP registration has been selected for the current batch.</p>'
            . '<p>You may now create your SMART LEAP portal account using this link:</p>'
            . '<p><a href="%s">%s</a></p>'
            . '<p>After creating your account, sign in through the applicant portal to continue your application.</p>'
            . '<p>Applicant Portal Login: <a href="%s">%s</a></p>',
            $name,
            $signupUrl,
            $signupUrl,
            $portalLoginUrl,
            $portalLoginUrl
        );

        return (new MailService())->send($recipient, $subject, $body, null);
    }

    private function persistSelectionEmailStatus(int $registrationId, string $recipientEmail, bool $emailSent): void
    {
        if ($registrationId <= 0) {
            return;
        }

        $errorMessage = null;
        if (!$emailSent) {
            $statement = db()->prepare(
                'SELECT error_message
                 FROM email_logs
                 WHERE recipient_email = :recipient_email
                   AND subject = :subject
                 ORDER BY id DESC
                 LIMIT 1'
            );
            $statement->execute([
                'recipient_email' => $recipientEmail,
                'subject' => 'SMART LEAP Registration Approved',
            ]);
            $errorMessage = $statement->fetchColumn();
            $errorMessage = is_string($errorMessage) ? trim($errorMessage) : null;
        }

        db()->prepare(
            'UPDATE stage_one_registrations
             SET selection_email_sent_at = :selection_email_sent_at,
                 selection_email_failed_at = :selection_email_failed_at,
                 selection_email_error = :selection_email_error,
                 updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'selection_email_sent_at' => $emailSent ? date('Y-m-d H:i:s') : null,
            'selection_email_failed_at' => $emailSent ? null : date('Y-m-d H:i:s'),
            'selection_email_error' => $emailSent ? null : ($errorMessage !== '' ? $errorMessage : 'Email delivery failed.'),
            'id' => $registrationId,
        ]);
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
                selection_email_sent_at DATETIME NULL,
                selection_email_failed_at DATETIME NULL,
                selection_email_error TEXT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_stage_one_registrations_reviewer FOREIGN KEY (validated_by_user_id) REFERENCES users(id),
                INDEX idx_stage_one_registrations_status (validation_status),
                INDEX idx_stage_one_registrations_email (email),
                INDEX idx_stage_one_registrations_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $this->ensureNullableDateColumn('stage_one_registrations', 'selection_email_sent_at', 'validated_at');
        $this->ensureNullableDateColumn('stage_one_registrations', 'selection_email_failed_at', 'selection_email_sent_at');
        $this->ensureNullableTextColumn('stage_one_registrations', 'selection_email_error', 'selection_email_failed_at');

        $ready = true;
    }

    private function ensureNullableDateColumn(string $table, string $column, string $afterColumn): void
    {
        $statement = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = :table_name
               AND column_name = :column_name'
        );
        $statement->execute([
            'table_name' => $table,
            'column_name' => $column,
        ]);

        if ((int) $statement->fetchColumn() > 0) {
            return;
        }

        db()->exec(sprintf(
            'ALTER TABLE %s ADD COLUMN %s DATETIME NULL AFTER %s',
            $table,
            $column,
            $afterColumn
        ));
    }

    private function ensureNullableTextColumn(string $table, string $column, string $afterColumn): void
    {
        $statement = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = :table_name
               AND column_name = :column_name'
        );
        $statement->execute([
            'table_name' => $table,
            'column_name' => $column,
        ]);

        if ((int) $statement->fetchColumn() > 0) {
            return;
        }

        db()->exec(sprintf(
            'ALTER TABLE %s ADD COLUMN %s TEXT NULL AFTER %s',
            $table,
            $column,
            $afterColumn
        ));
    }
}
