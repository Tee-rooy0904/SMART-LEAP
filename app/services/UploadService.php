<?php

declare(strict_types=1);

namespace App\Services;

class UploadService
{
    private const MIME_ALIASES = [
        'image/jpg' => 'image/jpeg',
        'image/pjpeg' => 'image/jpeg',
        'image/x-png' => 'image/png',
        'application/x-pdf' => 'application/pdf',
    ];

    private const REQUIREMENT_PATHS = [
        'validId' => 'valid-id',
        'healthCertificate' => 'health-certificate',
        'cedula' => 'cedula',
    ];

    private const POST_APPROVAL_PATHS = [
        'applicant-signature' => 'signatures/applicant',
        'staff-signature' => 'signatures/staff',
        'supporting-upload' => 'supporting',
    ];

    public function normalizeDocumentFiles(array $fileBag): array
    {
        $normalized = [];
        if (!isset($fileBag['name']) || !is_array($fileBag['name'])) {
            return $normalized;
        }

        foreach ($fileBag['name'] as $key => $name) {
            if ($name === '' || !isset(self::REQUIREMENT_PATHS[$key])) {
                continue;
            }
            $normalized[$key] = [
                'name' => $name,
                'type' => $fileBag['type'][$key] ?? '',
                'tmp_name' => $fileBag['tmp_name'][$key] ?? '',
                'error' => $fileBag['error'][$key] ?? UPLOAD_ERR_NO_FILE,
                'size' => $fileBag['size'][$key] ?? 0,
            ];
        }

        return $normalized;
    }

    public function storeRequirementDocument(string $key, array $file): array
    {
        if (!isset(self::REQUIREMENT_PATHS[$key])) {
            throw new \RuntimeException('Unsupported requirement type.');
        }

        [$extension, $detectedMimeType] = $this->validateFile($file);

        $relativeDir = 'uploads/initial-requirements/' . self::REQUIREMENT_PATHS[$key];
        $absoluteDir = public_path($relativeDir);
        if (!is_dir($absoluteDir)) {
            mkdir($absoluteDir, 0775, true);
        }

        $targetName = $key . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $targetName;

        if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
            throw new \RuntimeException('Unable to move uploaded file.');
        }

        return [
            'file_path' => $relativeDir . '/' . $targetName,
            'original_name' => (string) $file['name'],
            'mime_type' => $detectedMimeType,
            'file_size' => (int) ($file['size'] ?? 0),
        ];
    }

    public function storePostApprovalAsset(string $category, array $file): array
    {
        if (!isset(self::POST_APPROVAL_PATHS[$category])) {
            throw new \RuntimeException('Unsupported post-approval upload type.');
        }

        [$extension, $detectedMimeType] = $this->validateFile($file);

        $baseDir = rtrim((string) config('upload.paths.post_approval'), DIRECTORY_SEPARATOR);
        $relativeDir = 'uploads/post-approval/' . self::POST_APPROVAL_PATHS[$category];
        $absoluteDir = $baseDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, self::POST_APPROVAL_PATHS[$category]);
        if (!is_dir($absoluteDir)) {
            mkdir($absoluteDir, 0775, true);
        }

        $targetName = $category . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $targetName;

        if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
            throw new \RuntimeException('Unable to move uploaded file.');
        }

        return [
            'file_path' => $relativeDir . '/' . $targetName,
            'original_name' => (string) $file['name'],
            'mime_type' => $detectedMimeType,
            'file_size' => (int) ($file['size'] ?? 0),
            'uploaded_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function validateFile(array $file): array
    {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw new \RuntimeException($this->messageForUploadError($errorCode));
        }

        $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $allowedExtensions = config('upload.allowed_extensions', []);
        if ($extension === '' || !in_array($extension, $allowedExtensions, true)) {
            throw new \RuntimeException('Unsupported file type.');
        }

        $maxBytes = (int) config('upload.max_bytes', 0);
        if ($maxBytes > 0 && (int) ($file['size'] ?? 0) > $maxBytes) {
            throw new \RuntimeException('File exceeds the upload limit.');
        }

        $detectedMimeType = '';
        if (is_string($file['tmp_name'] ?? null) && $file['tmp_name'] !== '' && file_exists((string) $file['tmp_name'])) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $detectedMimeType = $this->normalizeMimeType((string) ($finfo->file((string) $file['tmp_name']) ?: ''));
        }

        $clientMimeType = $this->normalizeMimeType((string) ($file['type'] ?? ''));
        $allowedMimeTypes = array_map([$this, 'normalizeMimeType'], config('upload.allowed_mime_types', []));
        $mimeCandidates = array_filter(array_unique([$detectedMimeType, $clientMimeType]));

        $isAllowed = false;
        foreach ($mimeCandidates as $candidate) {
            if (in_array($candidate, $allowedMimeTypes, true)) {
                $isAllowed = true;
                break;
            }
        }

        if (!$isAllowed
            && in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic', 'heif'], true)
            && in_array($clientMimeType, $allowedMimeTypes, true)
        ) {
            $isAllowed = true;
        }

        if (!$isAllowed) {
            throw new \RuntimeException('Unsupported file type.');
        }

        return [$extension, $detectedMimeType !== '' ? $detectedMimeType : $clientMimeType];
    }

    private function normalizeMimeType(string $mimeType): string
    {
        $mimeType = strtolower(trim($mimeType));
        if ($mimeType === '') {
            return '';
        }

        return self::MIME_ALIASES[$mimeType] ?? $mimeType;
    }

    private function messageForUploadError(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File exceeds the upload limit.',
            UPLOAD_ERR_PARTIAL => 'Upload was interrupted. Please try again.',
            UPLOAD_ERR_NO_FILE => 'Choose a file to upload.',
            default => 'Document upload failed.',
        };
    }
}
