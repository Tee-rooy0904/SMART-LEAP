<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class BeneficiaryProfileService
{
    public function ensureForApplicantProfile(int $applicantProfileId): ?int
    {
        if ($applicantProfileId <= 0) {
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
            return (int) $existingId;
        }

        $source = $this->fetchApplicantSource($applicantProfileId);
        if ($source === null) {
            return null;
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
            'beneficiary_status' => 'active',
            'approval_date' => date('Y-m-d'),
        ]);

        return (int) db()->lastInsertId();
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
}
