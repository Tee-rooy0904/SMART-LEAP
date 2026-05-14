<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<?php /** @var array $report */ ?>
<?php /** @var array $filters */ ?>
<?php /** @var bool $autoPrint */ ?>
<?php
$summary = $report['summary']['repaymentPerformance'] ?? ($report['repaymentAnalytics']['periodMetrics'] ?? []);
$records = $report['records'] ?? [];
$generatedAt = (string) ($report['generatedAt'] ?? date(DATE_ATOM));
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Report Export</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #102347;
            background: #fff;
        }
        .report-shell {
            max-width: 1200px;
            margin: 0 auto;
        }
        .report-head {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .report-head h1 {
            margin: 0 0 6px;
            font-size: 26px;
        }
        .report-head p {
            margin: 0;
            color: #526b8f;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin: 20px 0;
        }
        .summary-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 14px 16px;
            background: #f8fbff;
        }
        .summary-card span {
            display: block;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #526b8f;
            margin-bottom: 8px;
        }
        .summary-card strong {
            font-size: 24px;
        }
        .formula {
            margin: 0 0 18px;
            color: #334b68;
        }
        .filters {
            margin: 0 0 18px;
            padding: 12px 16px;
            border: 1px solid #dbe7f5;
            border-radius: 12px;
            background: #fbfdff;
            color: #334b68;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
        }
        th {
            background: #eff6ff;
            font-weight: 700;
        }
        .muted {
            color: #64748b;
        }
        @media print {
            body {
                margin: 10mm;
            }
        }
    </style>
</head>
<body>
    <div class="report-shell">
        <header class="report-head">
            <div>
                <h1>SMART LEAP Report</h1>
                <p>Visualization and reporting export aligned to the digitalization plan while preserving the current system workflow.</p>
            </div>
            <div class="muted">
                <div>Generated: <?= htmlspecialchars(date('M j, Y g:i A', strtotime($generatedAt) ?: time()), ENT_QUOTES) ?></div>
                <div>Prepared by: <?= htmlspecialchars((string) (($authUser['name'] ?? 'SMART LEAP')), ENT_QUOTES) ?></div>
            </div>
        </header>

        <section class="summary-grid">
            <article class="summary-card">
                <span>Target Amount</span>
                <strong>PHP <?= htmlspecialchars(number_format((float) ($summary['targetAmount'] ?? 0), 2), ENT_QUOTES) ?></strong>
            </article>
            <article class="summary-card">
                <span>Actual Collected</span>
                <strong>PHP <?= htmlspecialchars(number_format((float) ($summary['actualCollectedAmount'] ?? 0), 2), ENT_QUOTES) ?></strong>
            </article>
            <article class="summary-card">
                <span>Gap</span>
                <strong>PHP <?= htmlspecialchars(number_format((float) ($summary['gapAmount'] ?? 0), 2), ENT_QUOTES) ?></strong>
            </article>
            <article class="summary-card">
                <span>ROI</span>
                <strong><?= htmlspecialchars(number_format((float) ($summary['roiPercent'] ?? 0), 2), ENT_QUOTES) ?>%</strong>
            </article>
        </section>

        <p class="formula">
            ROI = (<?= htmlspecialchars(number_format((float) ($summary['actualCollectedAmount'] ?? 0), 2), ENT_QUOTES) ?> / <?= htmlspecialchars(number_format((float) ($summary['targetAmount'] ?? 0), 2), ENT_QUOTES) ?>) x 100.
            Beneficiary repayment rate = Months Paid / Months Passed.
        </p>

        <div class="filters">
            Filters:
            Period <?= htmlspecialchars((string) (($report['filters']['periodLabel'] ?? $filters['period']) ?: 'Selected period'), ENT_QUOTES) ?>,
            From <?= htmlspecialchars((string) (($report['filters']['effectiveFrom'] ?? $filters['from']) ?: 'Any date'), ENT_QUOTES) ?>,
            To <?= htmlspecialchars((string) (($report['filters']['effectiveTo'] ?? $filters['to']) ?: 'Any date'), ENT_QUOTES) ?>,
            Barangay <?= htmlspecialchars((string) ($filters['barangay'] ?: 'All'), ENT_QUOTES) ?>,
            Service Type <?= htmlspecialchars((string) (($filters['serviceType'] ?: $filters['businessType']) ?: 'All'), ENT_QUOTES) ?>,
            Gender <?= htmlspecialchars((string) ($filters['gender'] ?: 'All'), ENT_QUOTES) ?>,
            Age Group <?= htmlspecialchars((string) ($filters['ageGroup'] ?: 'All'), ENT_QUOTES) ?>,
            PDO <?= htmlspecialchars((string) ($filters['pdo'] ?: 'All'), ENT_QUOTES) ?>,
            Repayment <?= htmlspecialchars((string) ($filters['repayment'] ?: 'All'), ENT_QUOTES) ?>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Beneficiary</th>
                    <th>Email</th>
                    <th>Barangay</th>
                    <th>Assigned PDO</th>
                    <th>Service Type</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Age Group</th>
                    <th>Program Status</th>
                    <th>Repayment</th>
                    <th>Verified Amount</th>
                    <th>Months Passed</th>
                    <th>Months Paid</th>
                    <th>Repayment Rate</th>
                    <th>Expected To Date</th>
                    <th>Gap To Date</th>
                </tr>
            </thead>
            <tbody>
                <?php if ($records !== []): ?>
                    <?php foreach ($records as $record): ?>
                        <?php $repayment = $record['repayment'] ?? []; ?>
                        <tr>
                            <td><?= htmlspecialchars((string) ($record['name'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['email'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['barangay'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['assignedPdo'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['serviceType'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['gender'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['age'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['ageGroup'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($record['programStatus'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($repayment['label'] ?? ''), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars(number_format((float) ($repayment['paidAmount'] ?? 0), 2), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($repayment['monthsPassed'] ?? 0), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ($repayment['monthsPaid'] ?? 0), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars((string) ((float) ($repayment['repaymentRate'] ?? 0)) . '%', ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars(number_format((float) ($repayment['expectedToDateAmount'] ?? 0), 2), ENT_QUOTES) ?></td>
                            <td><?= htmlspecialchars(number_format((float) ($repayment['gapToDateAmount'] ?? 0), 2), ENT_QUOTES) ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="16">No report records matched the selected filters.</td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php if (!empty($autoPrint)): ?>
        <script>window.addEventListener('load', () => window.print());</script>
    <?php endif; ?>
</body>
</html>
