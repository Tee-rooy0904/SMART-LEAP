<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class BeneficiaryProfileService
{
    private const ELIGIBLE_APPLICATION_STATUSES = [
        APPLICATION_STATUS_APPROVED,
        APPLICATION_STATUS_APPROVED_FOR_TRAINING,
        APPLICATION_STATUS_TRAINING_ONGOING,
        APPLICATION_STATUS_COMPLETED,
    ];

    public function ensureForApplicantProfile(int $applicantProfileId, bool $activate = false): ?int
    {
        if ($applicantProfileId <= 0) {
            return null;
        }

        $source = $this->fetchApplicantSource($applicantProfileId);
        if ($source === null || !$this->applicantQualifiesForBeneficiary($applicantProfileId)) {
            return null;
        }

        $statement = db()->prepare(
            'SELECT beneficiary_profiles.id
             FROM beneficiary_profiles
             WHERE beneficiary_profiles.applicant_profile_id = :applicant_profile_id
             LIMIT 1'
        );
        $statement->execute(['applicant_profile_id' => $applicantProfileId]);
        $existingId = $statement->fetchColumn();
        if ($existingId !== false) {
            if ($activate) {
                $this->activateBeneficiaryProfile((int) $existingId, (int) $source['user_id']);
            }
            return (int) $existingId;
        }

        $insert = db()->prepare(
            'INSERT INTO beneficiary_profiles
             (user_id, applicant_profile_id, assigned_staff_profile_id, beneficiary_status, approval_date)
             VALUES (:user_id, :applicant_profile_id, :assigned_staff_profile_id, :beneficiary_status, :approval_date)'
        );
        $insert->execute([
            'user_id' => $source['user_id'],
            'applicant_profile_id' => $applicantProfileId,
            'assigned_staff_profile_id' => $source['assigned_staff_profile_id'],
            'beneficiary_status' => $activate ? 'active' : 'pending_fund_release',
            'approval_date' => $activate ? date('Y-m-d') : null,
        ]);

        $beneficiaryProfileId = (int) db()->lastInsertId();
        if ($activate) {
            $this->activateBeneficiaryProfile($beneficiaryProfileId, (int) $source['user_id']);
        }

        return $beneficiaryProfileId;
    }

    public function activateForApplicantProfile(int $applicantProfileId): ?int
    {
        return $this->ensureForApplicantProfile($applicantProfileId, true);
    }

    private function fetchApplicantSource(int $applicantProfileId): ?array
    {
        $statement = db()->prepare(
            'SELECT applicant_profiles.user_id, applications.assigned_staff_profile_id
             FROM applicant_profiles
             LEFT JOIN applications ON applications.applicant_profile_id = applicant_profiles.id
             WHERE applicant_profiles.id = :applicant_profile_id
             ORDER BY applications.id DESC
             LIMIT 1'
        );
        $statement->execute(['applicant_profile_id' => $applicantProfileId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            return null;
        }

        return [
            'user_id' => (int) $row['user_id'],
            'assigned_staff_profile_id' => $row['assigned_staff_profile_id'] !== null ? (int) $row['assigned_staff_profile_id'] : null,
        ];
    }

    private function applicantQualifiesForBeneficiary(int $applicantProfileId): bool
    {
        $statement = db()->prepare(
            'SELECT applications.status
             FROM applications
             WHERE applications.applicant_profile_id = :applicant_profile_id
             ORDER BY applications.id DESC
             LIMIT 1'
        );
        $statement->execute(['applicant_profile_id' => $applicantProfileId]);
        $status = $statement->fetchColumn();
        if (!is_string($status) || trim($status) === '') {
            return false;
        }

        return in_array($this->normalizeApplicationStatus($status), self::ELIGIBLE_APPLICATION_STATUSES, true);
    }

    private function normalizeApplicationStatus(string $status): string
    {
        return match (strtolower(trim($status))) {
            'approved' => APPLICATION_STATUS_APPROVED,
            'approved for training', 'approved_for_training', 'approvedfortraining' => APPLICATION_STATUS_APPROVED_FOR_TRAINING,
            'training ongoing', 'training_ongoing', 'trainingongoing' => APPLICATION_STATUS_TRAINING_ONGOING,
            'completed' => APPLICATION_STATUS_COMPLETED,
            default => trim($status),
        };
    }

    private function promoteUserToBeneficiary(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $roleId = $this->findRoleIdByName(ROLE_BENEFICIARY);
        if ($roleId === null) {
            return;
        }

        db()->prepare(
            'UPDATE users
             SET role_id = :role_id, updated_at = NOW()
             WHERE id = :user_id'
        )->execute([
            'role_id' => $roleId,
            'user_id' => $userId,
        ]);
    }

    private function activateBeneficiaryProfile(int $beneficiaryProfileId, int $userId): void
    {
        if ($beneficiaryProfileId > 0) {
            db()->prepare(
                'UPDATE beneficiary_profiles
                 SET beneficiary_status = :beneficiary_status,
                     approval_date = COALESCE(approval_date, :approval_date),
                     updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'beneficiary_status' => 'active',
                'approval_date' => date('Y-m-d'),
                'id' => $beneficiaryProfileId,
            ]);
        }

        $this->promoteUserToBeneficiary($userId);
    }

    private function findRoleIdByName(string $name): ?int
    {
        $statement = db()->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $name]);
        $roleId = $statement->fetchColumn();
        return $roleId !== false ? (int) $roleId : null;
    }
}
