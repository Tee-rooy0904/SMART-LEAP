<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class DashboardMetricsService
{
    public function adminOverview(): array
    {
        return [
            'applicationSummary' => $this->applicationSummary(),
            'recentApplications' => $this->recentApplications(),
            'trainingSummary' => $this->trainingSummary(),
            'staffSummary' => $this->staffSummary(),
            'assessmentQueue' => $this->assessmentQueue(),
            'beneficiarySummary' => $this->beneficiarySummary(),
            'repaymentSummary' => $this->repaymentSummary(),
            'recentActivity' => $this->recentActivity(),
        ];
    }

    public function socialWorkerOverview(): array
    {
        return [
            'applicationSummary' => $this->applicationSummary(),
            'assessmentQueue' => $this->assessmentQueue(12),
            'recentApplications' => $this->recentApplications(8),
            'trainingSummary' => $this->trainingSummary(),
        ];
    }

    private function applicationSummary(): array
    {
        $summary = [
            'total' => 0,
            'submitted' => 0,
            'underReview' => 0,
            'forAssessment' => 0,
            'approvedForTraining' => 0,
            'needsAttention' => 0,
        ];

        try {
            $rows = db()->query('SELECT status, COUNT(*) AS aggregate FROM applications GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.application_summary', $exception);
            return $summary;
        }

        foreach ($rows as $row) {
            $status = $this->normalizeApplicationStatus((string) ($row['status'] ?? ''));
            $count = (int) ($row['aggregate'] ?? 0);
            $summary['total'] += $count;

            if ($status === APPLICATION_STATUS_SUBMITTED) {
                $summary['submitted'] += $count;
            }
            if ($status === APPLICATION_STATUS_UNDER_REVIEW) {
                $summary['underReview'] += $count;
            }
            if (in_array($status, [APPLICATION_STATUS_REQUIREMENTS_VERIFIED, APPLICATION_STATUS_FOR_ASSESSMENT], true)) {
                $summary['forAssessment'] += $count;
            }
            if (in_array($status, [APPLICATION_STATUS_APPROVED, APPLICATION_STATUS_APPROVED_FOR_TRAINING], true)) {
                $summary['approvedForTraining'] += $count;
            }
            if (in_array($status, [APPLICATION_STATUS_FLAGGED, APPLICATION_STATUS_NEEDS_CORRECTION, APPLICATION_STATUS_REJECTED], true)) {
                $summary['needsAttention'] += $count;
            }
        }

        return $summary;
    }

    private function recentApplications(int $limit = 10): array
    {
        try {
            $statement = db()->prepare(
                'SELECT
                    applications.id,
                    applications.status,
                    applications.updated_at,
                    applicant_profiles.business_name,
                    barangays.name AS barangay_name,
                    applicant_users.full_name AS applicant_name,
                    assigned_users.full_name AS assigned_pdo_name
                 FROM applications
                 INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id
                 INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id
                 LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
                 LEFT JOIN staff_profiles ON staff_profiles.id = applications.assigned_staff_profile_id
                 LEFT JOIN users AS assigned_users ON assigned_users.id = staff_profiles.user_id
                 ORDER BY applications.updated_at DESC, applications.id DESC
                 LIMIT :limit'
            );
            $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.recent_applications', $exception, ['limit' => $limit]);
            return [];
        }

        return array_map(function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'applicantName' => $row['applicant_name'],
                'businessName' => $row['business_name'],
                'barangay' => $row['barangay_name'] ?: 'Not set',
                'status' => $this->normalizeApplicationStatus((string) ($row['status'] ?? '')),
                'assignedPdo' => $row['assigned_pdo_name'] ?: 'Unassigned',
                'updatedAt' => $row['updated_at'],
            ];
        }, $rows);
    }

    private function assessmentQueue(int $limit = 8): array
    {
        try {
            $statement = db()->prepare(
                'SELECT
                    applications.id,
                    applications.status,
                    applications.updated_at,
                    applicant_users.full_name AS applicant_name,
                    applicant_profiles.business_name,
                    barangays.name AS barangay_name
                 FROM applications
                 INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id
                 INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id
                 LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
                 WHERE LOWER(REPLACE(applications.status, "_", " ")) IN ("requirements verified", "for assessment", "checked by pdo")
                 ORDER BY applications.updated_at DESC, applications.id DESC
                 LIMIT :limit'
            );
            $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.assessment_queue', $exception, ['limit' => $limit]);
            return [];
        }

        return array_map(function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'applicantName' => $row['applicant_name'],
                'businessName' => $row['business_name'],
                'barangay' => $row['barangay_name'] ?: 'Not set',
                'status' => $this->normalizeApplicationStatus((string) ($row['status'] ?? '')),
                'updatedAt' => $row['updated_at'],
            ];
        }, $rows);
    }

    private function trainingSummary(): array
    {
        $summary = [
            'programs' => 0,
            'scheduled' => 0,
            'notified' => 0,
            'completed' => 0,
            'invitees' => 0,
            'excused' => 0,
        ];

        try {
            $summary['programs'] = (int) (db()->query('SELECT COUNT(*) FROM training_programs')->fetchColumn() ?: 0);
            $rows = db()->query(
                'SELECT invite_status, COUNT(*) AS aggregate
                 FROM training_invitees
                 GROUP BY invite_status'
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.training_summary', $exception);
            return $summary;
        }

        foreach ($rows as $row) {
            $status = strtolower((string) ($row['invite_status'] ?? ''));
            $count = (int) ($row['aggregate'] ?? 0);
            $summary['invitees'] += $count;

            if ($status === strtolower(TRAINING_STATUS_SCHEDULED)) {
                $summary['scheduled'] += $count;
            }
            if ($status === strtolower(TRAINING_STATUS_NOTIFIED)) {
                $summary['notified'] += $count;
            }
            if ($status === strtolower(TRAINING_STATUS_EXCUSED)) {
                $summary['excused'] += $count;
            }
            if (in_array($status, [strtolower(TRAINING_STATUS_ATTENDED), strtolower(TRAINING_STATUS_COMPLETED)], true)) {
                $summary['completed'] += $count;
            }
        }

        return $summary;
    }

    private function staffSummary(): array
    {
        $summary = [
            'admins' => 0,
            'pdo' => 0,
            'socialWorkers' => 0,
            'active' => 0,
        ];

        try {
            $rows = db()->query(
                'SELECT roles.name AS role_name, staff_profiles.status, COUNT(*) AS aggregate
                 FROM staff_profiles
                 INNER JOIN users ON users.id = staff_profiles.user_id
                 INNER JOIN roles ON roles.id = users.role_id
                 GROUP BY roles.name, staff_profiles.status'
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.staff_summary', $exception);
            return $summary;
        }

        foreach ($rows as $row) {
            $count = (int) ($row['aggregate'] ?? 0);
            $role = strtolower((string) ($row['role_name'] ?? ''));
            $status = strtolower((string) ($row['status'] ?? ''));
            if ($status === 'active') {
                $summary['active'] += $count;
            }

            if (str_contains($role, 'admin')) {
                $summary['admins'] += $count;
            } elseif (str_contains($role, 'project')) {
                $summary['pdo'] += $count;
            } elseif (str_contains($role, 'social')) {
                $summary['socialWorkers'] += $count;
            }
        }

        return $summary;
    }

    private function beneficiarySummary(): array
    {
        $summary = ['total' => 0, 'active' => 0];

        try {
            $summary['total'] = (int) (db()->query('SELECT COUNT(*) FROM beneficiary_profiles')->fetchColumn() ?: 0);
            $summary['active'] = (int) (db()->query(
                'SELECT COUNT(*) FROM beneficiary_profiles WHERE LOWER(beneficiary_status) = "active"'
            )->fetchColumn() ?: 0);
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.beneficiary_summary', $exception);
        }

        return $summary;
    }

    private function repaymentSummary(): array
    {
        $summary = [
            'isLive' => false,
            'pendingVerification' => null,
            'verifiedThisMonth' => null,
            'overdueAccounts' => null,
            'creditedCases' => null,
        ];

        try {
            $summary['pendingVerification'] = (int) (db()->query(
                'SELECT COUNT(*) FROM repayments WHERE LOWER(verification_status) IN ("pending", "submitted")'
            )->fetchColumn() ?: 0);
            $summary['verifiedThisMonth'] = (int) (db()->query(
                'SELECT COUNT(*) FROM repayments WHERE LOWER(verification_status) = "verified" AND DATE_FORMAT(updated_at, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")'
            )->fetchColumn() ?: 0);
            $summary['overdueAccounts'] = (int) (db()->query(
                'SELECT COUNT(*) FROM repayments WHERE LOWER(verification_status) IN ("rejected", "needs correction", "overdue")'
            )->fetchColumn() ?: 0);
            $summary['creditedCases'] = (int) (db()->query(
                'SELECT COUNT(*) FROM repayments WHERE LOWER(verification_status) = "credited"'
            )->fetchColumn() ?: 0);
            $summary['isLive'] = true;
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.repayment_summary', $exception);
        }

        return $summary;
    }

    private function recentActivity(int $limit = 8): array
    {
        try {
            $statement = db()->prepare(
                'SELECT audit_logs.id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id, audit_logs.metadata_json, audit_logs.created_at, users.full_name
                 FROM audit_logs
                 LEFT JOIN users ON users.id = audit_logs.user_id
                 ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
                 LIMIT :limit'
            );
            $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('dashboard_metrics.recent_activity', $exception);
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'actor' => $row['full_name'] ?: 'System',
                'action' => $row['action'],
                'target' => trim((string) ($row['entity_type'] ?? 'record') . ' #' . (string) ($row['entity_id'] ?? '')),
                'timestamp' => $row['created_at'],
            ];
        }, $rows);
    }

    private function normalizeApplicationStatus(string $status): string
    {
        return match (strtolower(trim($status))) {
            'draft' => APPLICATION_STATUS_DRAFT,
            'submitted' => APPLICATION_STATUS_SUBMITTED,
            'under review', 'under_review', 'underreview' => APPLICATION_STATUS_UNDER_REVIEW,
            'checked by pdo', 'checked_by_pdo', 'checkedbypdo' => APPLICATION_STATUS_CHECKED_BY_PDO,
            'requirements verified', 'requirements_verified', 'requirementsverified' => APPLICATION_STATUS_REQUIREMENTS_VERIFIED,
            'for assessment', 'for_assessment', 'forassessment' => APPLICATION_STATUS_FOR_ASSESSMENT,
            'approved' => APPLICATION_STATUS_APPROVED,
            'approved for training', 'approved_for_training', 'approvedfortraining' => APPLICATION_STATUS_APPROVED_FOR_TRAINING,
            'rejected' => APPLICATION_STATUS_REJECTED,
            'flagged' => APPLICATION_STATUS_FLAGGED,
            'needs correction', 'needs_correction', 'needscorrection' => APPLICATION_STATUS_NEEDS_CORRECTION,
            default => $status,
        };
    }
}
