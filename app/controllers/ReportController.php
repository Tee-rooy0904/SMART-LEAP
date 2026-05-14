<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ReportService;

class ReportController extends Controller
{
    public function data(): never
    {
        response_json([
            'ok' => true,
            'data' => (new ReportService())->build($this->filtersFromRequest()),
        ]);
    }

    public function exportCsv(): never
    {
        $report = (new ReportService())->build($this->filtersFromRequest());
        $filename = 'smart-leap-report-' . date('Ymd-His') . '.csv';

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $stream = fopen('php://output', 'wb');
        if ($stream === false) {
            exit;
        }

        fputcsv($stream, ['Beneficiary', 'Email', 'Barangay', 'Assigned PDO', 'Service Type', 'Gender', 'Age', 'Age Group', 'Program Status', 'Repayment Status', 'Verified Amount', 'Months Passed', 'Months Paid', 'Repayment Rate (%)', 'Expected To Date', 'Gap To Date']);

        foreach (($report['records'] ?? []) as $record) {
            $repayment = $record['repayment'] ?? [];
            fputcsv($stream, [
                (string) ($record['name'] ?? ''),
                (string) ($record['email'] ?? ''),
                (string) ($record['barangay'] ?? ''),
                (string) ($record['assignedPdo'] ?? ''),
                (string) ($record['serviceType'] ?? ''),
                (string) ($record['gender'] ?? ''),
                $record['age'] ?? '',
                (string) ($record['ageGroup'] ?? ''),
                (string) ($record['programStatus'] ?? ''),
                (string) ($repayment['label'] ?? ''),
                (float) ($repayment['paidAmount'] ?? 0),
                (int) ($repayment['monthsPassed'] ?? 0),
                (int) ($repayment['monthsPaid'] ?? 0),
                (float) ($repayment['repaymentRate'] ?? 0),
                (float) ($repayment['expectedToDateAmount'] ?? 0),
                (float) ($repayment['gapToDateAmount'] ?? 0),
            ]);
        }

        fclose($stream);
        exit;
    }

    public function exportExcel(): never
    {
        $report = (new ReportService())->build($this->filtersFromRequest());
        $filename = 'smart-leap-report-' . date('Ymd-His') . '.xls';

        header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        echo $this->buildExcelMarkup($report);
        exit;
    }

    public function exportPdf(): never
    {
        $this->view('reports/print', [
            'authUser' => auth_user(),
            'report' => (new ReportService())->build($this->filtersFromRequest()),
            'filters' => $this->filtersFromRequest(),
            'autoPrint' => isset($_GET['autoprint']) && $_GET['autoprint'] === '1',
        ]);
    }

    private function filtersFromRequest(): array
    {
        return [
            'from' => $_GET['from'] ?? '',
            'to' => $_GET['to'] ?? '',
            'barangay' => $_GET['barangay'] ?? '',
            'serviceType' => $_GET['serviceType'] ?? ($_GET['businessType'] ?? ''),
            'businessType' => $_GET['businessType'] ?? ($_GET['serviceType'] ?? ''),
            'sector' => $_GET['sector'] ?? '',
            'gender' => $_GET['gender'] ?? '',
            'ageGroup' => $_GET['ageGroup'] ?? '',
            'pdo' => $_GET['pdo'] ?? '',
            'repayment' => $_GET['repayment'] ?? '',
            'period' => $_GET['period'] ?? '',
            'month' => $_GET['month'] ?? '',
            'quarter' => $_GET['quarter'] ?? '',
            'year' => $_GET['year'] ?? '',
        ];
    }

    private function buildExcelMarkup(array $report): string
    {
        $summary = $report['summary']['repaymentPerformance'] ?? ($report['repaymentAnalytics']['periodMetrics'] ?? []);
        $records = $report['records'] ?? [];

        $rows = array_map(function (array $record): string {
            $repayment = $record['repayment'] ?? [];
            return '<tr>'
                . '<td>' . htmlspecialchars((string) ($record['name'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['email'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['barangay'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['assignedPdo'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['serviceType'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['gender'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['age'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['ageGroup'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($record['programStatus'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($repayment['label'] ?? ''), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars(number_format((float) ($repayment['paidAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($repayment['monthsPassed'] ?? 0), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($repayment['monthsPaid'] ?? 0), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars((string) ($repayment['repaymentRate'] ?? 0), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars(number_format((float) ($repayment['expectedToDateAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
                . '<td>' . htmlspecialchars(number_format((float) ($repayment['gapToDateAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
                . '</tr>';
        }, $records);

        return '<html><head><meta charset="UTF-8"><style>'
            . 'body{font-family:Arial,sans-serif;font-size:12px;color:#102347;}'
            . 'table{border-collapse:collapse;width:100%;}'
            . 'th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;}'
            . 'th{background:#eff6ff;text-align:left;}'
            . '.summary{margin-bottom:18px;}'
            . '.summary td{width:25%;font-weight:700;}'
            . '</style></head><body>'
            . '<h2>SMART LEAP Report Export</h2>'
            . '<p>Generated ' . htmlspecialchars(date('M j, Y g:i A'), ENT_QUOTES) . '</p>'
            . '<table class="summary"><tr>'
            . '<td>Target Amount: ' . htmlspecialchars(number_format((float) ($summary['targetAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
            . '<td>Actual Collected: ' . htmlspecialchars(number_format((float) ($summary['actualCollectedAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
            . '<td>Gap: ' . htmlspecialchars(number_format((float) ($summary['gapAmount'] ?? 0), 2), ENT_QUOTES) . '</td>'
            . '<td>ROI: ' . htmlspecialchars(number_format((float) ($summary['roiPercent'] ?? 0), 2), ENT_QUOTES) . '%</td>'
            . '</tr></table>'
            . '<table><thead><tr>'
            . '<th>Beneficiary</th><th>Email</th><th>Barangay</th><th>Assigned PDO</th><th>Service Type</th><th>Gender</th><th>Age</th><th>Age Group</th><th>Program Status</th><th>Repayment Status</th><th>Verified Amount</th><th>Months Passed</th><th>Months Paid</th><th>Repayment Rate (%)</th><th>Expected To Date</th><th>Gap To Date</th>'
            . '</tr></thead><tbody>'
            . implode('', $rows)
            . '</tbody></table>'
            . '</body></html>';
    }
}
