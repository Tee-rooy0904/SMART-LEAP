<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class ReportService
{
    private const REPAYMENT_PLAN_MONTHS = 24;
    private const MONTHLY_REPAYMENT_AMOUNT = 625.00;

    public function build(array $filters = []): array
    {
        (new BeneficiaryProfileService())->synchronizeSystemInactivityStatuses();
        $normalizedFilters = $this->normalizeFilters($filters);
        $records = $this->fetchRecords();
        $filteredRecords = $this->applyFilters($records, $normalizedFilters);
        $repaymentAnalytics = $this->buildRepaymentAnalytics($filteredRecords, $normalizedFilters);

        return [
            'generatedAt' => date(DATE_ATOM),
            'filters' => $normalizedFilters,
            'options' => $this->buildOptions($records),
            'records' => $filteredRecords,
            'summary' => $this->buildSummary($filteredRecords, $repaymentAnalytics['summary'] ?? null),
            'repaymentAnalytics' => $repaymentAnalytics,
        ];
    }

    public function buildForBeneficiaryIds(array $beneficiaryIds, array $filters = []): array
    {
        (new BeneficiaryProfileService())->synchronizeSystemInactivityStatuses();
        $normalizedFilters = $this->normalizeFilters($filters);
        $scopedIds = array_values(array_unique(array_filter(array_map('intval', $beneficiaryIds))));
        $records = $this->fetchRecords($scopedIds);
        $filteredRecords = $this->applyFilters($records, $normalizedFilters);
        $repaymentAnalytics = $this->buildRepaymentAnalytics($filteredRecords, $normalizedFilters);

        return [
            'generatedAt' => date(DATE_ATOM),
            'filters' => $normalizedFilters,
            'options' => $this->buildOptions($records),
            'records' => $filteredRecords,
            'summary' => $this->buildSummary($filteredRecords, $repaymentAnalytics['summary'] ?? null),
            'repaymentAnalytics' => $repaymentAnalytics,
        ];
    }

    private function fetchRecords(?array $beneficiaryIds = null): array
    {
        if (is_array($beneficiaryIds) && $beneficiaryIds === []) {
            return [];
        }

        try {
            $params = [];
            $scopeCondition = '';
            if (is_array($beneficiaryIds)) {
                $placeholders = implode(',', array_fill(0, count($beneficiaryIds), '?'));
                $scopeCondition = ' AND beneficiary_profiles.id IN (' . $placeholders . ')';
                $params = $beneficiaryIds;
            }

            $statement = db()->prepare(
                'SELECT
                    beneficiary_profiles.id,
                    beneficiary_profiles.beneficiary_status,
                    beneficiary_profiles.replacement_for_beneficiary_profile_id,
                    beneficiary_profiles.approval_date,
                    beneficiary_profiles.updated_at,
                    beneficiary_users.full_name AS beneficiary_name,
                    beneficiary_users.email AS beneficiary_email,
                    applicant_profiles.business_name,
                    applicant_profiles.contact_number,
                    applicant_profiles.birthdate,
                    applicant_profiles.age,
                    applicant_profiles.livelihood_type,
                    applicant_profiles.sector,
                    applicant_profiles.gender,
                    barangays.name AS barangay_name,
                    assigned_users.full_name AS assigned_pdo_name
                 FROM beneficiary_profiles
                 INNER JOIN users AS beneficiary_users ON beneficiary_users.id = beneficiary_profiles.user_id
                 LEFT JOIN applicant_profiles ON applicant_profiles.id = beneficiary_profiles.applicant_profile_id
                 LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
                 LEFT JOIN staff_profiles AS assigned_staff ON assigned_staff.id = beneficiary_profiles.assigned_staff_profile_id
                 LEFT JOIN users AS assigned_users ON assigned_users.id = assigned_staff.user_id
                 WHERE beneficiary_profiles.replacement_for_beneficiary_profile_id IS NULL
                   AND beneficiary_profiles.approval_date IS NOT NULL
                   ' . $scopeCondition . '
                 ORDER BY beneficiary_profiles.updated_at DESC, beneficiary_profiles.id DESC'
            );
            $statement->execute($params);
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('reports.fetch_records', $exception);
            return [];
        }

        if ($rows === []) {
            return [];
        }

        $beneficiaryIds = array_values(array_filter(array_map(
            static fn(array $row): int => (int) ($row['id'] ?? 0),
            $rows
        )));
        $repaymentMap = $this->beneficiaryRepaymentSummaries($beneficiaryIds);

        return array_map(function (array $row) use ($repaymentMap): array {
            $beneficiaryId = (int) ($row['id'] ?? 0);
            $repayment = $this->appendLifecycleMetrics(
                $repaymentMap[$beneficiaryId] ?? $this->emptyRepaymentSummary(),
                (string) ($row['approval_date'] ?? '')
            );
            $serviceTypeSource = (string) ($row['livelihood_type'] ?: ($row['sector'] ?: ''));
            $age = $this->resolveAge($row);

            return [
                'id' => $beneficiaryId,
                'name' => (string) ($row['beneficiary_name'] ?: 'Unnamed beneficiary'),
                'email' => (string) ($row['beneficiary_email'] ?: ''),
                'contactNumber' => (string) ($row['contact_number'] ?: ''),
                'businessName' => (string) ($row['business_name'] ?: 'No business name'),
                'age' => $age,
                'ageGroup' => $this->resolveAgeGroupFromAge($age),
                'gender' => $this->normalizeGenderLabel((string) ($row['gender'] ?? '')),
                'barangay' => (string) ($row['barangay_name'] ?: 'Unassigned'),
                'assignedPdo' => (string) ($row['assigned_pdo_name'] ?: 'Unassigned'),
                'serviceType' => $this->normalizeServiceType($serviceTypeSource),
                'businessType' => $serviceTypeSource !== '' ? $serviceTypeSource : 'Not set',
                'sector' => $this->labelizeStatus((string) ($row['sector'] ?: 'Not Set')),
                'programStatus' => $this->labelizeStatus((string) ($row['beneficiary_status'] ?? 'active')),
                'approvalDate' => (string) ($row['approval_date'] ?? ''),
                'lastActivity' => max(
                    (string) ($row['updated_at'] ?? ''),
                    (string) ($repayment['latestActivity'] ?? '')
                ),
                'repayment' => $repayment,
            ];
        }, $rows);
    }

    private function normalizeFilters(array $filters): array
    {
        $now = new \DateTimeImmutable('today');
        $currentMonth = $now->format('Y-m');
        $currentYear = (int) $now->format('Y');
        $currentQuarter = 1;
        $period = strtolower(trim((string) ($filters['period'] ?? 'monthly')));
        if (!in_array($period, ['monthly', 'quarterly', 'yearly', 'custom'], true)) {
            $period = 'monthly';
        }

        $month = trim((string) ($filters['month'] ?? $currentMonth));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            $month = $currentMonth;
        }

        $quarter = (int) ($filters['quarter'] ?? $currentQuarter);
        if ($quarter < 1 || $quarter > 4) {
            $quarter = $currentQuarter;
        }

        $year = (int) ($filters['year'] ?? $currentYear);
        if ($year < 2000 || $year > ($currentYear + 10)) {
            $year = $currentYear;
        }

        [$effectiveFrom, $effectiveTo, $periodLabel] = $this->resolvePeriodRange(
            $period,
            $month,
            $quarter,
            $year,
            trim((string) ($filters['from'] ?? '')),
            trim((string) ($filters['to'] ?? ''))
        );

        return [
            'from' => trim((string) ($filters['from'] ?? '')),
            'to' => trim((string) ($filters['to'] ?? '')),
            'effectiveFrom' => $effectiveFrom,
            'effectiveTo' => $effectiveTo,
            'barangay' => $this->normalizeValue($filters['barangay'] ?? ''),
            'serviceType' => $this->normalizeValue($filters['serviceType'] ?? ($filters['businessType'] ?? '')),
            'businessType' => $this->normalizeValue($filters['businessType'] ?? ($filters['serviceType'] ?? '')),
            'sector' => $this->normalizeValue($filters['sector'] ?? ''),
            'gender' => $this->normalizeValue($filters['gender'] ?? ''),
            'ageGroup' => $this->normalizeValue($filters['ageGroup'] ?? ''),
            'pdo' => $this->normalizeValue($filters['pdo'] ?? ''),
            'repayment' => $this->normalizeValue($filters['repayment'] ?? ''),
            'period' => $period,
            'periodLabel' => $periodLabel,
            'month' => $month,
            'quarter' => $quarter,
            'year' => $year,
        ];
    }

    private function applyFilters(array $records, array $filters): array
    {
        return array_values(array_filter($records, function (array $record) use ($filters): bool {
            return ($filters['barangay'] === '' || $this->normalizeValue($record['barangay'] ?? 'Unassigned') === $filters['barangay'])
                && ($filters['serviceType'] === '' || $this->normalizeValue($record['serviceType'] ?? '') === $filters['serviceType'])
                && ($filters['sector'] === '' || $this->normalizeValue($record['sector'] ?? 'Not Set') === $filters['sector'])
                && ($filters['gender'] === '' || $this->normalizeValue($record['gender'] ?? 'Not Set') === $filters['gender'])
                && ($filters['ageGroup'] === '' || $this->normalizeValue($record['ageGroup'] ?? 'Not Set') === $filters['ageGroup'])
                && ($filters['pdo'] === '' || $this->normalizeValue($record['assignedPdo'] ?? 'Unassigned') === $filters['pdo'])
                && ($filters['repayment'] === '' || $this->normalizeValue($record['repayment']['key'] ?? 'no_upload') === $filters['repayment']);
        }));
    }

    private function buildOptions(array $records): array
    {
        $years = [];
        foreach ($records as $record) {
            $approvalDate = trim((string) ($record['approvalDate'] ?? ''));
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $approvalDate)) {
                $years[(int) substr($approvalDate, 0, 4)] = true;
            }
        }
        $currentYear = (int) date('Y');
        for ($year = $currentYear - 2; $year <= $currentYear + 1; $year++) {
            $years[$year] = true;
        }
        $yearValues = array_keys($years);
        rsort($yearValues, SORT_NUMERIC);

        return [
            'barangays' => $this->uniqueValues($records, 'barangay'),
            'serviceTypes' => $this->uniqueValues($records, 'serviceType'),
            'sectors' => $this->uniqueValues($records, 'sector'),
            'genders' => $this->uniqueValues($records, 'gender'),
            'ageGroups' => $this->uniqueValues($records, 'ageGroup'),
            'pdos' => $this->uniqueValues($records, 'assignedPdo'),
            'years' => array_values($yearValues),
            'repaymentStates' => [
                ['key' => 'no_upload', 'label' => 'No Upload Yet'],
                ['key' => 'under_review', 'label' => 'Under Review'],
                ['key' => 'needs_follow_up', 'label' => 'Needs Follow-up'],
                ['key' => 'partial_paid', 'label' => 'Partial Paid'],
                ['key' => 'fully_paid', 'label' => 'Fully Paid'],
            ],
        ];
    }

    private function buildSummary(array $records, ?array $repaymentRate = null): array
    {
        return [
            'totalBeneficiaries' => count($records),
            'serviceTypeDistribution' => $this->distribution($records, 'serviceType'),
            'sectorDistribution' => $this->distribution($records, 'sector'),
            'genderDistribution' => $this->distribution($records, 'gender'),
            'ageGroupDistribution' => $this->distribution($records, 'ageGroup'),
            'barangayDistribution' => $this->distribution($records, 'barangay'),
            'programStatusDistribution' => $this->distribution($records, 'programStatus'),
            'repaymentPerformance' => $repaymentRate ?? $this->repaymentRateStats($records),
            'repaymentRate' => $repaymentRate ?? $this->repaymentRateStats($records),
        ];
    }

    private function buildRepaymentAnalytics(array $records, array $filters): array
    {
        $beneficiaryIds = array_values(array_filter(array_map(
            static fn(array $record): int => (int) ($record['id'] ?? 0),
            $records
        )));

        $repaymentRows = $this->fetchRepaymentRows($beneficiaryIds);
        $obligations = $this->buildRepaymentObligations($records, $repaymentRows);
        $filteredObligations = $this->applyRepaymentFilters($obligations, $filters);

        return [
            'obligations' => $filteredObligations,
            'summary' => $this->summarizeRepaymentObligations($filteredObligations, $filters),
            'periodMetrics' => $this->summarizeRepaymentObligations($filteredObligations, $filters),
            'breakdown' => $this->buildRepaymentBreakdown($filteredObligations, $filters),
            'monthlyBreakdown' => $this->buildRepaymentMonthlyBreakdown($filteredObligations),
        ];
    }

    private function fetchRepaymentRows(array $beneficiaryIds): array
    {
        if ($beneficiaryIds === []) {
            return [];
        }

        try {
            $placeholders = implode(',', array_fill(0, count($beneficiaryIds), '?'));
            $statement = db()->prepare(
                'SELECT repayments.id,
                        repayments.beneficiary_profile_id,
                        repayments.status,
                        repayments.amount,
                        repayments.payment_date,
                        verification.verification_status,
                        repayment_coverage_months.coverage_month
                 FROM repayments
                 LEFT JOIN (
                    SELECT rv.repayment_id,
                           rv.verification_status
                    FROM repayment_verifications rv
                    INNER JOIN (
                        SELECT repayment_id, MAX(id) AS latest_id
                        FROM repayment_verifications
                        GROUP BY repayment_id
                    ) latest ON latest.latest_id = rv.id
                 ) verification ON verification.repayment_id = repayments.id
                 LEFT JOIN repayment_coverage_months ON repayment_coverage_months.repayment_id = repayments.id
                 WHERE repayments.beneficiary_profile_id IN (' . $placeholders . ')'
            );
            $statement->execute($beneficiaryIds);
            return $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('reports.repayment_rows', $exception);
            return [];
        }
    }

    private function buildRepaymentObligations(array $records, array $repaymentRows): array
    {
        $entriesByBeneficiaryMonth = [];

        foreach ($repaymentRows as $row) {
            $beneficiaryId = (int) ($row['beneficiary_profile_id'] ?? 0);
            $coverageMonth = substr((string) ($row['coverage_month'] ?? ''), 0, 7);
            if ($beneficiaryId <= 0 || !preg_match('/^\d{4}-\d{2}$/', $coverageMonth)) {
                continue;
            }

            $entriesByBeneficiaryMonth[$beneficiaryId][$coverageMonth][] = [
                'stage' => $this->normalizeRepaymentStage(
                    (string) ($row['status'] ?? ''),
                    (string) ($row['verification_status'] ?? '')
                ),
                'amount' => (float) ($row['amount'] ?? 0),
                'paymentDate' => (string) ($row['payment_date'] ?? ''),
            ];
        }

        $obligations = [];

        foreach ($records as $record) {
            $beneficiaryId = (int) ($record['id'] ?? 0);
            if ($beneficiaryId <= 0) {
                continue;
            }

            $knownMonths = array_keys($entriesByBeneficiaryMonth[$beneficiaryId] ?? []);
            $startMonth = $this->deriveRepaymentStartMonth($record, $knownMonths);
            if ($startMonth === null) {
                continue;
            }

            foreach ($this->enumerateRepaymentMonths($startMonth, self::REPAYMENT_PLAN_MONTHS) as $index => $dueMonth) {
                $dueDate = $this->dueDateForMonth($dueMonth);
                if ($dueDate === null) {
                    continue;
                }

                $installmentNumber = $index + 1;
                $entries = $entriesByBeneficiaryMonth[$beneficiaryId][$dueMonth] ?? [];
                $status = $this->resolveRepaymentObligationStatus($entries, $dueDate);
                $obligations[] = [
                    'beneficiaryId' => $beneficiaryId,
                    'dueMonth' => $dueMonth,
                    'dueYear' => substr($dueMonth, 0, 4),
                    'dueDate' => $dueDate,
                    'installmentNumber' => $installmentNumber,
                    'repaymentQuarter' => (int) ceil($installmentNumber / 3),
                    'repaymentYearNumber' => (int) ceil($installmentNumber / 12),
                    'expectedAmount' => self::MONTHLY_REPAYMENT_AMOUNT,
                    'barangay' => (string) ($record['barangay'] ?? 'Unassigned'),
                    'assignedPdo' => (string) ($record['assignedPdo'] ?? 'Unassigned'),
                    'serviceType' => (string) ($record['serviceType'] ?? 'Unclassified'),
                    'sector' => (string) ($record['sector'] ?? 'Not Set'),
                    'gender' => (string) ($record['gender'] ?? 'Not Set'),
                    'ageGroup' => (string) ($record['ageGroup'] ?? 'Not Set'),
                    'status' => $status['status'],
                    'statusLabel' => $status['label'],
                    'amountRepresented' => $status['amount'],
                ];
            }
        }

        usort($obligations, static fn(array $left, array $right): int => strcmp(
            (string) ($left['dueMonth'] ?? ''),
            (string) ($right['dueMonth'] ?? '')
        ));

        return $obligations;
    }

    private function applyRepaymentFilters(array $obligations, array $filters): array
    {
        $effectiveFrom = trim((string) ($filters['effectiveFrom'] ?? ($filters['from'] ?? '')));
        $effectiveTo = trim((string) ($filters['effectiveTo'] ?? ($filters['to'] ?? '')));
        return array_values(array_filter($obligations, function (array $obligation) use ($filters, $effectiveFrom, $effectiveTo): bool {
            $period = (string) ($filters['period'] ?? 'monthly');
            $periodMatches = match ($period) {
                'yearly' => (int) ($obligation['repaymentYearNumber'] ?? 0) === 1,
                'quarterly' => (int) ($obligation['repaymentYearNumber'] ?? 0) === 1
                    && (int) ($obligation['repaymentQuarter'] ?? 0) === (int) ($filters['quarter'] ?? 1),
                default => $this->inDateRange((string) ($obligation['dueDate'] ?? ''), $effectiveFrom, $effectiveTo),
            };

            return $periodMatches
                && ($filters['barangay'] === '' || $this->normalizeValue($obligation['barangay'] ?? 'Unassigned') === $filters['barangay'])
                && ($filters['serviceType'] === '' || $this->normalizeValue($obligation['serviceType'] ?? 'Unclassified') === $filters['serviceType'])
                && ($filters['sector'] === '' || $this->normalizeValue($obligation['sector'] ?? 'Not Set') === $filters['sector'])
                && ($filters['gender'] === '' || $this->normalizeValue($obligation['gender'] ?? 'Not Set') === $filters['gender'])
                && ($filters['ageGroup'] === '' || $this->normalizeValue($obligation['ageGroup'] ?? 'Not Set') === $filters['ageGroup'])
                && ($filters['pdo'] === '' || $this->normalizeValue($obligation['assignedPdo'] ?? 'Unassigned') === $filters['pdo']);
        }));
    }

    private function summarizeRepaymentObligations(array $obligations, array $filters = []): array
    {
        $targetAmount = 0.0;
        $actualCollectedAmount = 0.0;
        $statusCounts = [
            'paid_on_time' => 0,
            'partial_delayed' => 0,
            'pending_verification' => 0,
            'overdue_unpaid' => 0,
            'upcoming' => 0,
        ];
        $beneficiaryIds = [];

        foreach ($obligations as $obligation) {
            $targetAmount += (float) ($obligation['expectedAmount'] ?? self::MONTHLY_REPAYMENT_AMOUNT);
            $status = (string) ($obligation['status'] ?? 'overdue_unpaid');
            if (!isset($statusCounts[$status])) {
                $status = 'overdue_unpaid';
            }
            $statusCounts[$status]++;
            $beneficiaryIds[(int) ($obligation['beneficiaryId'] ?? 0)] = true;
            if (in_array($status, ['paid_on_time', 'partial_delayed'], true)) {
                $actualCollectedAmount += (float) ($obligation['amountRepresented'] ?? 0.0);
            }
        }

        $periodTargetMonths = $this->repaymentTargetMonthsForPeriod((string) ($filters['period'] ?? 'monthly'));
        if ($periodTargetMonths !== null) {
            $targetAmount = count(array_filter(array_keys($beneficiaryIds))) * $periodTargetMonths * self::MONTHLY_REPAYMENT_AMOUNT;
        }

        $gapAmount = $targetAmount - $actualCollectedAmount;
        $roiPercent = $targetAmount > 0 ? round(($actualCollectedAmount / $targetAmount) * 100, 2) : 0.0;

        return [
            'period' => (string) ($filters['period'] ?? 'monthly'),
            'label' => (string) ($filters['periodLabel'] ?? 'Selected period'),
            'from' => (string) ($filters['effectiveFrom'] ?? ''),
            'to' => (string) ($filters['effectiveTo'] ?? ''),
            'targetAmount' => round($targetAmount, 2),
            'actualCollectedAmount' => round($actualCollectedAmount, 2),
            'gapAmount' => round($gapAmount, 2),
            'varianceAmount' => round($gapAmount, 2),
            'roiPercent' => $roiPercent,
            'obligationCount' => $periodTargetMonths !== null
                ? count(array_filter(array_keys($beneficiaryIds))) * $periodTargetMonths
                : count($obligations),
            'scopedBeneficiaries' => count(array_filter(array_keys($beneficiaryIds))),
            'statusCounts' => $statusCounts,
        ];
    }

    private function repaymentTargetMonthsForPeriod(string $period): ?int
    {
        return match ($period) {
            'monthly' => 1,
            'quarterly' => 3,
            'yearly' => 12,
            default => null,
        };
    }

    private function buildRepaymentBreakdown(array $obligations, array $filters): array
    {
        $periods = [];
        $period = (string) ($filters['period'] ?? 'monthly');

        foreach ($obligations as $obligation) {
            $dueMonth = (string) ($obligation['dueMonth'] ?? '');
            $periodKey = $period === 'yearly'
                ? sprintf('repayment-Q%d', (int) ($obligation['repaymentQuarter'] ?? 0))
                : $dueMonth;

            if ($periodKey === '' || $periodKey === 'repayment-Q0') {
                continue;
            }

            if (!isset($periods[$periodKey])) {
                $periods[$periodKey] = [
                    'period' => $periodKey,
                    'label' => $period === 'yearly'
                        ? sprintf('Q%d', (int) ($obligation['repaymentQuarter'] ?? 0))
                        : $this->formatRepaymentPeriodLabel($periodKey, 'monthly'),
                    'targetAmount' => 0.0,
                    'actualCollectedAmount' => 0.0,
                    'gapAmount' => 0.0,
                    'roiPercent' => 0.0,
                ];
            }

            $status = (string) ($obligation['status'] ?? 'overdue_unpaid');
            $periods[$periodKey]['targetAmount'] += (float) ($obligation['expectedAmount'] ?? self::MONTHLY_REPAYMENT_AMOUNT);
            if (in_array($status, ['paid_on_time', 'partial_delayed'], true)) {
                $periods[$periodKey]['actualCollectedAmount'] += (float) ($obligation['amountRepresented'] ?? 0.0);
            }
        }

        ksort($periods, SORT_STRING);

        return array_map(static function (array $period): array {
            $period['targetAmount'] = round((float) ($period['targetAmount'] ?? 0.0), 2);
            $period['actualCollectedAmount'] = round((float) ($period['actualCollectedAmount'] ?? 0.0), 2);
            $period['gapAmount'] = round($period['targetAmount'] - $period['actualCollectedAmount'], 2);
            $period['roiPercent'] = $period['targetAmount'] > 0
                ? round(($period['actualCollectedAmount'] / $period['targetAmount']) * 100, 2)
                : 0.0;
            return $period;
        }, array_values($periods));
    }

    private function buildRepaymentMonthlyBreakdown(array $obligations): array
    {
        $periods = [];

        foreach ($obligations as $obligation) {
            $dueMonth = (string) ($obligation['dueMonth'] ?? '');
            if ($dueMonth === '') {
                continue;
            }

            if (!isset($periods[$dueMonth])) {
                $periods[$dueMonth] = [
                    'period' => $dueMonth,
                    'label' => $this->formatRepaymentPeriodLabel($dueMonth, 'monthly'),
                    'targetAmount' => 0.0,
                    'actualCollectedAmount' => 0.0,
                    'gapAmount' => 0.0,
                    'roiPercent' => 0.0,
                ];
            }

            $periods[$dueMonth]['targetAmount'] += (float) ($obligation['expectedAmount'] ?? self::MONTHLY_REPAYMENT_AMOUNT);
            if (in_array((string) ($obligation['status'] ?? 'overdue_unpaid'), ['paid_on_time', 'partial_delayed'], true)) {
                $periods[$dueMonth]['actualCollectedAmount'] += (float) ($obligation['amountRepresented'] ?? 0.0);
            }
        }

        ksort($periods, SORT_STRING);

        return array_map(static function (array $period): array {
            $period['targetAmount'] = round((float) ($period['targetAmount'] ?? 0.0), 2);
            $period['actualCollectedAmount'] = round((float) ($period['actualCollectedAmount'] ?? 0.0), 2);
            $period['gapAmount'] = round($period['targetAmount'] - $period['actualCollectedAmount'], 2);
            $period['roiPercent'] = $period['targetAmount'] > 0
                ? round(($period['actualCollectedAmount'] / $period['targetAmount']) * 100, 2)
                : 0.0;
            return $period;
        }, array_values($periods));
    }

    private function repaymentStackedStatuses(): array
    {
        return [
            'paid_on_time' => [
                'key' => 'paid_on_time',
                'label' => 'Paid / On-time',
                'count' => 0,
                'percent' => 0.0,
                'amount' => 0.0,
            ],
            'partial_delayed' => [
                'key' => 'partial_delayed',
                'label' => 'Partial / Delayed',
                'count' => 0,
                'percent' => 0.0,
                'amount' => 0.0,
            ],
            'pending_verification' => [
                'key' => 'pending_verification',
                'label' => 'Pending Verification',
                'count' => 0,
                'percent' => 0.0,
                'amount' => 0.0,
            ],
            'overdue_unpaid' => [
                'key' => 'overdue_unpaid',
                'label' => 'Overdue / Unpaid',
                'count' => 0,
                'percent' => 0.0,
                'amount' => 0.0,
            ],
        ];
    }

    private function formatRepaymentPeriodLabel(string $periodKey, string $period): string
    {
        if ($period === 'yearly') {
            return $periodKey;
        }
        if ($period === 'quarterly' && preg_match('/^(\d{4})-Q([1-4])$/', $periodKey, $matches)) {
            return sprintf('Q%s %s', $matches[2], $matches[1]);
        }

        try {
            return (new \DateTimeImmutable($periodKey . '-01'))->format('M Y');
        } catch (\Throwable $exception) {
            return $periodKey;
        }
    }

    private function deriveRepaymentStartMonth(array $record, array $knownMonths): ?string
    {
        $approvalDate = trim((string) ($record['approvalDate'] ?? ''));
        $firstDueMonth = $this->deriveFirstDueMonthFromApproval($approvalDate);
        if ($firstDueMonth !== null) {
            return $firstDueMonth;
        }

        if ($knownMonths === []) {
            return null;
        }

        sort($knownMonths, SORT_STRING);
        $firstMonth = (string) $knownMonths[0];
        return preg_match('/^\d{4}-\d{2}$/', $firstMonth) ? $firstMonth : null;
    }

    private function enumerateRepaymentMonths(string $startMonth, int $count): array
    {
        $months = [];

        for ($offset = 0; $offset < $count; $offset++) {
            $month = $this->shiftMonth($startMonth, $offset);
            if ($month !== null) {
                $months[] = $month;
            }
        }

        return $months;
    }

    private function shiftMonth(string $month, int $offset): ?string
    {
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            return null;
        }

        try {
            $date = new \DateTimeImmutable($month . '-01 00:00:00');
            if ($offset !== 0) {
                $date = $date->modify(($offset > 0 ? '+' : '') . $offset . ' month');
            }
        } catch (\Throwable $exception) {
            return null;
        }

        return $date->format('Y-m');
    }

    private function dueDateForMonth(string $month): ?string
    {
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            return null;
        }

        try {
            return (new \DateTimeImmutable($month . '-01 23:59:59'))
                ->modify('last day of this month')
                ->format('Y-m-d');
        } catch (\Throwable $exception) {
            return null;
        }
    }

    private function resolveRepaymentObligationStatus(array $entries, string $dueDate): array
    {
        $verifiedEntries = [];
        $pendingAmount = 0.0;
        $today = date('Y-m-d');

        foreach ($entries as $entry) {
            $stage = (string) ($entry['stage'] ?? '');
            $amount = (float) ($entry['amount'] ?? 0);

            if (in_array($stage, ['pending', 'uploaded'], true)) {
                $pendingAmount += $amount;
                continue;
            }

            $paymentDate = trim((string) ($entry['paymentDate'] ?? ''));
            if ($stage === 'partial_verified') {
                $verifiedEntries[] = [
                    'paymentDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $paymentDate) ? $paymentDate : '',
                    'amount' => $amount,
                    'partial' => true,
                ];
                continue;
            }

            if (!in_array($stage, ['verified', 'credited'], true)) {
                continue;
            }

            $verifiedEntries[] = [
                'paymentDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $paymentDate) ? $paymentDate : '',
                'amount' => $amount,
                'partial' => false,
            ];
        }

        if ($verifiedEntries !== []) {
            usort($verifiedEntries, static fn(array $left, array $right): int => strcmp(
                (string) ($left['paymentDate'] ?? ''),
                (string) ($right['paymentDate'] ?? '')
            ));

            $verifiedAmount = array_sum(array_map(static fn(array $entry): float => (float) ($entry['amount'] ?? 0), $verifiedEntries));
            $firstPaymentDate = (string) ($verifiedEntries[0]['paymentDate'] ?? '');
            $hasPartialVerification = in_array(true, array_map(static fn(array $entry): bool => (bool) ($entry['partial'] ?? false), $verifiedEntries), true);

            if (!$hasPartialVerification && $verifiedAmount >= self::MONTHLY_REPAYMENT_AMOUNT && $firstPaymentDate !== '' && $firstPaymentDate <= $dueDate) {
                return [
                    'status' => 'paid_on_time',
                    'label' => 'Paid / On-time',
                    'amount' => $verifiedAmount,
                ];
            }

            return [
                'status' => 'partial_delayed',
                'label' => 'Partial / Delayed',
                'amount' => $verifiedAmount,
            ];
        }

        if ($pendingAmount > 0) {
            return [
                'status' => 'pending_verification',
                'label' => 'Pending Verification',
                'amount' => $pendingAmount,
            ];
        }

        if ($dueDate > $today) {
            return [
                'status' => 'upcoming',
                'label' => 'Upcoming',
                'amount' => 0.0,
            ];
        }

        return [
            'status' => 'overdue_unpaid',
            'label' => 'Overdue / Unpaid',
            'amount' => self::MONTHLY_REPAYMENT_AMOUNT,
        ];
    }

    private function beneficiaryRepaymentSummaries(array $beneficiaryIds): array
    {
        if ($beneficiaryIds === []) {
            return [];
        }

        $map = [];
        foreach ($beneficiaryIds as $beneficiaryId) {
            $map[$beneficiaryId] = $this->emptyRepaymentSummary();
        }

        try {
            $placeholders = implode(',', array_fill(0, count($beneficiaryIds), '?'));
            $statement = db()->prepare(
                'SELECT repayments.beneficiary_profile_id,
                        repayments.status,
                        repayments.amount,
                        repayments.payment_date,
                        repayments.updated_at,
                        verification.verification_status,
                        repayment_coverage_months.coverage_month
                 FROM repayments
                 LEFT JOIN (
                    SELECT rv.repayment_id,
                           rv.verification_status
                    FROM repayment_verifications rv
                    INNER JOIN (
                        SELECT repayment_id, MAX(id) AS latest_id
                        FROM repayment_verifications
                        GROUP BY repayment_id
                    ) latest ON latest.latest_id = rv.id
                 ) verification ON verification.repayment_id = repayments.id
                 LEFT JOIN repayment_coverage_months ON repayment_coverage_months.repayment_id = repayments.id
                 WHERE repayments.beneficiary_profile_id IN (' . $placeholders . ')'
            );
            $statement->execute($beneficiaryIds);
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('reports.repayment_summaries', $exception);
            return $map;
        }

        foreach ($rows as $row) {
            $beneficiaryId = (int) ($row['beneficiary_profile_id'] ?? 0);
            if (!isset($map[$beneficiaryId])) {
                continue;
            }

            $stage = $this->normalizeRepaymentStage(
                (string) ($row['status'] ?? ''),
                (string) ($row['verification_status'] ?? '')
            );
            $coverageMonth = substr((string) ($row['coverage_month'] ?? ''), 0, 7);
            $paymentDate = (string) ($row['payment_date'] ?? '');

            $map[$beneficiaryId]['uploadedReceipts']++;
            $map[$beneficiaryId]['latestActivity'] = max(
                (string) ($map[$beneficiaryId]['latestActivity'] ?? ''),
                (string) ($row['updated_at'] ?? '')
            );

            if (in_array($stage, ['uploaded', 'pending'], true)) {
                $map[$beneficiaryId]['underReview']++;
                continue;
            }
            if (in_array($stage, ['needs_correction', 'rejected'], true)) {
                $map[$beneficiaryId]['needsFollowUp']++;
                continue;
            }
            if (in_array($stage, ['verified', 'credited', 'partial_verified'], true)) {
                if (in_array($stage, ['verified', 'partial_verified'], true)) {
                    $map[$beneficiaryId]['verified']++;
                } else {
                    $map[$beneficiaryId]['credited']++;
                }

                $map[$beneficiaryId]['verifiedInstallments']++;
                $map[$beneficiaryId]['paidAmount'] += (float) ($row['amount'] ?? 0);
                if (preg_match('/^\d{4}-\d{2}$/', $coverageMonth)) {
                    $map[$beneficiaryId]['verifiedMonths'][$coverageMonth] = true;
                    $map[$beneficiaryId]['verifiedAmountByMonth'][$coverageMonth] = ($map[$beneficiaryId]['verifiedAmountByMonth'][$coverageMonth] ?? 0.0)
                        + (float) ($row['amount'] ?? 0);
                }

                if ($this->isRepaymentOnTime($paymentDate, $coverageMonth)) {
                    $map[$beneficiaryId]['onTimeInstallments']++;
                } else {
                    $map[$beneficiaryId]['lateInstallments']++;
                }
            }
        }

        foreach ($map as $beneficiaryId => $summary) {
            $map[$beneficiaryId] = $this->resolveRepaymentSummary($summary);
        }

        return $map;
    }

    private function emptyRepaymentSummary(): array
    {
        return [
            'key' => 'no_upload',
            'label' => 'No Upload Yet',
            'uploadedReceipts' => 0,
            'underReview' => 0,
            'needsFollowUp' => 0,
            'verified' => 0,
            'credited' => 0,
            'verifiedInstallments' => 0,
            'onTimeInstallments' => 0,
            'lateInstallments' => 0,
            'paidAmount' => 0.0,
            'obligationAmount' => 15000.0,
            'totalDueInstallments' => self::REPAYMENT_PLAN_MONTHS,
            'verifiedMonths' => [],
            'verifiedAmountByMonth' => [],
            'repaymentRate' => 0.0,
            'latestActivity' => '',
        ];
    }

    private function resolveRepaymentSummary(array $summary): array
    {
        if ((int) ($summary['uploadedReceipts'] ?? 0) <= 0) {
            $summary['key'] = 'no_upload';
            $summary['label'] = 'No Upload Yet';
        } elseif ((int) ($summary['needsFollowUp'] ?? 0) > 0) {
            $summary['key'] = 'needs_follow_up';
            $summary['label'] = 'Needs Follow-up';
        } elseif ((int) ($summary['underReview'] ?? 0) > 0) {
            $summary['key'] = 'under_review';
            $summary['label'] = 'Under Review';
        } elseif ((float) ($summary['paidAmount'] ?? 0) >= (float) ($summary['obligationAmount'] ?? 15000.0)) {
            $summary['key'] = 'fully_paid';
            $summary['label'] = 'Fully Paid';
        } elseif ((float) ($summary['paidAmount'] ?? 0) > 0) {
            $summary['key'] = 'partial_paid';
            $summary['label'] = 'Partial Paid';
        } else {
            $summary['key'] = 'under_review';
            $summary['label'] = 'Under Review';
        }

        $summary['repaymentRate'] = 0.0;

        return $summary;
    }

    private function repaymentRateStats(array $records): array
    {
        $targetAmount = 0.0;
        $actualCollectedAmount = 0.0;

        foreach ($records as $record) {
            $repayment = $record['repayment'] ?? [];
            $targetAmount += (float) ($repayment['expectedToDateAmount'] ?? 0.0);
            $actualCollectedAmount += (float) ($repayment['paidAmountToDate'] ?? 0.0);
        }

        $gapAmount = $targetAmount - $actualCollectedAmount;

        return [
            'label' => 'Current to-date snapshot',
            'targetAmount' => round($targetAmount, 2),
            'actualCollectedAmount' => round($actualCollectedAmount, 2),
            'gapAmount' => round($gapAmount, 2),
            'varianceAmount' => round($gapAmount, 2),
            'roiPercent' => $targetAmount > 0 ? round(($actualCollectedAmount / $targetAmount) * 100, 2) : 0.0,
            'obligationCount' => array_sum(array_map(
                static fn(array $record): int => (int) (($record['repayment']['monthsPassed'] ?? 0)),
                $records
            )),
            'scopedBeneficiaries' => count($records),
        ];
    }

    private function resolvePeriodRange(string $period, string $month, int $quarter, int $year, string $from, string $to): array
    {
        if ($period === 'monthly') {
            $start = $month . '-01';
            $end = $this->monthEndDate($month);
            return [$start, $end, $this->formatRepaymentPeriodLabel($month, 'monthly')];
        }

        if ($period === 'quarterly') {
            $startMonthNumber = (($quarter - 1) * 3) + 1;
            $startMonth = sprintf('%04d-%02d', $year, $startMonthNumber);
            $endMonth = sprintf('%04d-%02d', $year, $startMonthNumber + 2);
            return [
                $startMonth . '-01',
                $this->monthEndDate($endMonth),
                sprintf('Q%d %d', $quarter, $year),
            ];
        }

        if ($period === 'yearly') {
            return [
                sprintf('%04d-01-01', $year),
                sprintf('%04d-12-31', $year),
                (string) $year,
            ];
        }

        $from = trim($from);
        $to = trim($to);
        if ($from === '' && $to === '') {
            $from = $month . '-01';
            $to = $this->monthEndDate($month);
        }
        if ($from !== '' && $to === '') {
            $to = $from;
        }
        if ($to !== '' && $from === '') {
            $from = $to;
        }

        return [$from, $to, 'Custom range'];
    }

    private function monthEndDate(string $month): string
    {
        try {
            return (new \DateTimeImmutable($month . '-01'))->modify('last day of this month')->format('Y-m-d');
        } catch (\Throwable $exception) {
            return $month . '-28';
        }
    }

    private function appendLifecycleMetrics(array $summary, string $approvalDate): array
    {
        $firstDueMonth = $this->deriveFirstDueMonthFromApproval($approvalDate);
        $currentMonth = date('Y-m');
        $lastPlanMonth = $firstDueMonth !== null
            ? $this->shiftMonth($firstDueMonth, self::REPAYMENT_PLAN_MONTHS - 1)
            : null;
        $effectiveEndMonth = $firstDueMonth !== null && $lastPlanMonth !== null
            ? $this->minMonth($currentMonth, $lastPlanMonth)
            : null;

        $monthsPassed = $firstDueMonth !== null && $effectiveEndMonth !== null && strcmp($effectiveEndMonth, $firstDueMonth) >= 0
            ? $this->countMonthsInclusive($firstDueMonth, $effectiveEndMonth)
            : 0;

        $paidAmountToDate = 0.0;
        $monthsPaid = 0;
        $verifiedMonths = array_keys(array_filter((array) ($summary['verifiedMonths'] ?? [])));
        sort($verifiedMonths, SORT_STRING);

        foreach ($verifiedMonths as $month) {
            if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
                continue;
            }
            if ($firstDueMonth !== null && strcmp($month, $firstDueMonth) < 0) {
                continue;
            }
            if ($lastPlanMonth !== null && strcmp($month, $lastPlanMonth) > 0) {
                continue;
            }
            if (strcmp($month, $currentMonth) > 0) {
                continue;
            }
            $monthsPaid++;
            $paidAmountToDate += (float) (($summary['verifiedAmountByMonth'][$month] ?? 0.0));
        }

        $remainingMonths = max(self::REPAYMENT_PLAN_MONTHS - $monthsPaid, 0);
        $expectedToDateAmount = round($monthsPassed * self::MONTHLY_REPAYMENT_AMOUNT, 2);
        $gapToDateAmount = round($expectedToDateAmount - $paidAmountToDate, 2);

        $summary['firstDueMonth'] = $firstDueMonth;
        $summary['monthsPassed'] = $monthsPassed;
        $summary['monthsPaid'] = $monthsPaid;
        $summary['remainingMonths'] = $remainingMonths;
        $summary['paidAmountToDate'] = round($paidAmountToDate, 2);
        $summary['expectedToDateAmount'] = $expectedToDateAmount;
        $summary['gapToDateAmount'] = $gapToDateAmount;
        $summary['progressLabel'] = sprintf('%d / %d months', $monthsPaid, $monthsPassed);
        $summary['repaymentRate'] = $monthsPassed > 0 ? round(($monthsPaid / $monthsPassed) * 100, 2) : 0.0;
        $summary['monthsPaidFraction'] = sprintf('%d/%d', $monthsPaid, $monthsPassed);
        $summary['outstandingBalance'] = round(max((float) ($summary['obligationAmount'] ?? 15000.0) - (float) ($summary['paidAmount'] ?? 0.0), 0.0), 2);

        return $summary;
    }

    private function deriveFirstDueMonthFromApproval(string $approvalDate): ?string
    {
        $approvalDate = trim($approvalDate);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $approvalDate)) {
            return null;
        }

        return $this->shiftMonth(substr($approvalDate, 0, 7), 1);
    }

    private function countMonthsInclusive(string $fromMonth, string $toMonth): int
    {
        try {
            $from = new \DateTimeImmutable($fromMonth . '-01');
            $to = new \DateTimeImmutable($toMonth . '-01');
        } catch (\Throwable $exception) {
            return 0;
        }

        $difference = ((int) $to->format('Y') - (int) $from->format('Y')) * 12;
        $difference += (int) $to->format('n') - (int) $from->format('n');

        return $difference >= 0 ? ($difference + 1) : 0;
    }

    private function minMonth(string $left, string $right): string
    {
        return strcmp($left, $right) <= 0 ? $left : $right;
    }

    private function quarterKeyForMonth(string $month): string
    {
        if (!preg_match('/^(\d{4})-(\d{2})$/', $month, $matches)) {
            return '';
        }

        $quarter = (int) ceil(((int) $matches[2]) / 3);
        return sprintf('%s-Q%d', $matches[1], $quarter);
    }

    private function distribution(array $records, string $field): array
    {
        $counts = [];
        foreach ($records as $record) {
            $label = trim((string) ($record[$field] ?? 'Not Set'));
            if ($label === '') {
                $label = 'Not Set';
            }
            $counts[$label] = ($counts[$label] ?? 0) + 1;
        }

        $items = [];
        foreach ($counts as $label => $count) {
            $items[] = ['label' => $label, 'count' => $count];
        }

        usort($items, static fn(array $left, array $right): int => ($right['count'] <=> $left['count']) ?: strcmp($left['label'], $right['label']));
        return $items;
    }

    private function uniqueValues(array $records, string $field): array
    {
        $values = [];
        foreach ($records as $record) {
            $value = trim((string) ($record[$field] ?? ''));
            if ($value !== '') {
                $values[$value] = true;
            }
        }

        $result = array_keys($values);
        sort($result, SORT_NATURAL | SORT_FLAG_CASE);
        return array_values($result);
    }

    private function normalizeValue(mixed $value): string
    {
        return strtolower(trim((string) $value));
    }

    private function inDateRange(string $value, string $from, string $to): bool
    {
        $date = $this->parseDate($value);
        if ($date === null) {
            return $from === '' && $to === '';
        }

        if ($from !== '') {
            $fromDate = $this->parseDate($from);
            if ($fromDate !== null && $date < $fromDate) {
                return false;
            }
        }

        if ($to !== '') {
            $toDate = $this->parseDate($to);
            if ($toDate !== null) {
                $toDate = $toDate->setTime(23, 59, 59);
                if ($date > $toDate) {
                    return false;
                }
            }
        }

        return true;
    }

    private function parseDate(string $value): ?\DateTimeImmutable
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        try {
            return new \DateTimeImmutable($value);
        } catch (\Throwable $exception) {
            return null;
        }
    }

    private function resolveAge(array $row): ?int
    {
        $age = (int) ($row['age'] ?? 0);
        if ($age > 0) {
            return $age;
        }

        $birthdate = trim((string) ($row['birthdate'] ?? ''));
        if ($birthdate === '') {
            return null;
        }

        try {
            $dob = new \DateTimeImmutable($birthdate);
            $today = new \DateTimeImmutable('today');
        } catch (\Throwable $exception) {
            return null;
        }

        return max(0, (int) $today->diff($dob)->y);
    }

    private function resolveAgeGroupFromAge(?int $age): string
    {
        if ($age === null) {
            return 'Not Set';
        }

        return match (true) {
            $age < 18 => 'Below 18',
            $age <= 24 => '18-24',
            $age <= 34 => '25-34',
            $age <= 44 => '35-44',
            $age <= 54 => '45-54',
            default => '55+',
        };
    }

    private function normalizeServiceType(string $value): string
    {
        $text = strtolower(trim($value));
        if ($text === '') {
            return 'Unclassified';
        }
        if (str_contains($text, 'buy') || str_contains($text, 'sell')) {
            return 'Buy and Sell';
        }
        if (str_contains($text, 'home')) {
            return 'Homemade';
        }
        if (str_contains($text, 'livestock') || str_contains($text, 'animal') || str_contains($text, 'poultry') || str_contains($text, 'hog')) {
            return 'Livestock';
        }
        if (str_contains($text, 'service')) {
            return 'Services';
        }
        if (str_contains($text, 'establishment') || str_contains($text, 'store') || str_contains($text, 'shop')) {
            return 'Establishment';
        }

        return ucwords($text);
    }

    private function normalizeGenderLabel(string $value): string
    {
        $raw = trim($value);
        if ($raw === '') {
            return 'Not Set';
        }

        $key = strtolower(str_replace(['-', '_'], ' ', $raw));
        $key = preg_replace('/\s+/', ' ', $key) ?: $key;

        return match ($key) {
            'male', 'lalaki', 'lalake' => 'Male',
            'female', 'babaye', 'babae' => 'Female',
            'non binary', 'nonbinary' => 'Non-binary',
            'prefer not to say', 'dili gustong mosulti' => 'Prefer not to say',
            'not set', 'unknown', 'n/a', 'na' => 'Not Set',
            default => $this->labelizeStatus($raw),
        };
    }

    private function labelizeStatus(string $status): string
    {
        $status = trim(str_replace('_', ' ', $status));
        return $status !== '' ? ucwords(strtolower($status)) : 'Not Set';
    }

    private function normalizeRepaymentStage(string $status, string $verificationStatus): string
    {
        $value = strtolower(trim($verificationStatus !== '' ? $verificationStatus : $status));
        $value = str_replace('-', '_', $value);
        return match ($value) {
            'verified', 'fully_verified', 'fully verified', 'full_verified', 'full verified' => 'verified',
            'credited' => 'credited',
            'partially_verified', 'partially verified', 'partial_verified', 'partial verified' => 'partial_verified',
            'pending', 'submitted', 'uploaded' => 'pending',
            'needs_correction', 'needs correction', 'overdue' => 'needs_correction',
            'rejected', 'flagged' => 'rejected',
            default => 'uploaded',
        };
    }

    private function isRepaymentOnTime(string $paymentDate, string $coverageMonth): bool
    {
        if ($paymentDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $paymentDate)) {
            return false;
        }

        if ($coverageMonth === '' || !preg_match('/^\d{4}-\d{2}$/', $coverageMonth)) {
            return false;
        }

        try {
            $paidAt = new \DateTimeImmutable($paymentDate . ' 23:59:59');
            $dueAt = (new \DateTimeImmutable($coverageMonth . '-01 23:59:59'))->modify('last day of this month');
        } catch (\Throwable $exception) {
            return false;
        }

        return $paidAt <= $dueAt;
    }
}
