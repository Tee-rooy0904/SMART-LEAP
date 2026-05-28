<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>How to Apply | SMART LEAP</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=44">
</head>
<body class="portal-page portal-page--content">
    <div class="page-shell">
        <?php
        $activeNav = 'apply';
        $isHome = false;
        require __DIR__ . '/../layouts/public-header.php';
        ?>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">How to Apply</span>
                    <h1 class="section-title">Follow the two-stage SMART LEAP application process step by step.</h1>
                    <p class="page-intro">SMART LEAP starts with a public Stage 1 registration, then moves qualified applicants into a private Stage 2 portal for the full program application.</p>
                </div>
            </section>

            <section class="content-section">
                <div class="container timeline-list portal-process-grid">
                    <article class="timeline-item is-active" tabindex="0" data-timeline-item data-detail-title="Stage 1 Public Registration" data-detail-copy="Click Apply Now and complete the public Stage 1 registration form with your name, address, contact details, valid ID, and proof or photo of your existing microbusiness.">
                        <span class="timeline-item__number">1</span>
                        <div><h2>Stage 1 Public Registration</h2><p>Submit your basic registration details, valid ID, and proof of your existing microbusiness.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Admin Batch Validation" data-detail-copy="Admin reviews all Stage 1 registrants and decides who will be included in the current yearly batch and who will be saved for the next batch.">
                        <span class="timeline-item__number">2</span>
                        <div><h2>Admin Batch Validation</h2><p>CSWDD Admin validates Stage 1 registrations and checks available batch slots.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Current Batch or Next Batch" data-detail-copy="Only 255 applicants can be saved in the active yearly batch. If the current batch is already full, other qualified Stage 1 registrants can be saved for the next SMART LEAP batch.">
                        <span class="timeline-item__number">3</span>
                        <div><h2>Current Batch or Next Batch</h2><p>Selected applicants proceed to the current batch, while others may be deferred to the next batch.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Email Invitation" data-detail-copy="Applicants selected for the current batch receive an email notice with the link they need to continue to Stage 2.">
                        <span class="timeline-item__number">4</span>
                        <div><h2>Email Invitation</h2><p>Selected applicants are notified through their Gmail account with the next-step portal link.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Stage 2 Private Applicant Portal" data-detail-copy="Selected applicants create their account and sign in to the private applicant portal. Stage 2 is the full SMART LEAP application and is not open to the general public.">
                        <span class="timeline-item__number">5</span>
                        <div><h2>Stage 2 Private Applicant Portal</h2><p>Create your account and access the private SMART LEAP applicant portal.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Complete the Full Application" data-detail-copy="Inside the private applicant portal, complete your profile, upload the required documents, monitor your application status, and check training schedules and official notices.">
                        <span class="timeline-item__number">6</span>
                        <div><h2>Complete the Full Application</h2><p>Upload requirements, monitor your status, and check your training schedules inside the applicant portal.</p></div>
                    </article>
                </div>
            </section>
        </main>

        <?php require __DIR__ . '/../layouts/public-footer.php'; ?>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=18" defer></script>
</body>
</html>
