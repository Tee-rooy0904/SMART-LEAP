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
                    <h1 class="section-title">Follow the SMART LEAP application process step by step.</h1>
                    <p class="page-intro">This page lays out the application flow so first-time users can clearly understand what to do next.</p>
                </div>
            </section>

            <section class="content-section">
                <div class="container timeline-list portal-process-grid">
                    <article class="timeline-item is-active" tabindex="0" data-timeline-item data-detail-title="Create Account" data-detail-copy="Register using an active email address so SMART LEAP can send notices and record updates.">
                        <span class="timeline-item__number">1</span>
                        <div><h2>Create Account</h2><p>Register using an active email address.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Complete Your Profile" data-detail-copy="Fill in your personal and household details accurately before continuing.">
                        <span class="timeline-item__number">2</span>
                        <div><h2>Complete Your Profile</h2><p>Enter your personal details and contact information.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Prepare Requirements" data-detail-copy="Gather the required documents and make sure they are readable before uploading them.">
                        <span class="timeline-item__number">3</span>
                        <div><h2>Prepare Requirements</h2><p>Gather the documents you need to upload.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Submit the Application" data-detail-copy="Upload the documents and submit the application when everything is ready.">
                        <span class="timeline-item__number">4</span>
                        <div><h2>Submit the Application</h2><p>Upload your files and submit the record.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Wait for Review" data-detail-copy="CSWDD will review the record and may return it for correction if needed.">
                        <span class="timeline-item__number">5</span>
                        <div><h2>Wait for Review</h2><p>CSWDD will review your files and record.</p></div>
                    </article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Receive the Decision" data-detail-copy="The portal records whether your application is approved, returned for correction, or rejected.">
                        <span class="timeline-item__number">6</span>
                        <div><h2>Receive the Decision</h2><p>Review the decision after the assessment is complete.</p></div>
                    </article>
                </div>
            </section>
        </main>

        <?php require __DIR__ . '/../layouts/public-footer.php'; ?>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=18" defer></script>
</body>
</html>
