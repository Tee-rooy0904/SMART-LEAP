<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>How SMART LEAP Works</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=12">
</head>
<body class="portal-page">
    <div class="page-shell">
        <header class="site-header">
            <div class="container header-shell">
                <div class="header-main">
                    <a class="brand" href="<?= $baseUrl ?>/portal">
                        <div class="brand-logo" aria-hidden="true"><img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt=""></div>
                        <div class="brand-copy"><strong class="brand-wordmark">SMART LEAP</strong></div>
                    </a>
                    <nav class="primary-nav" aria-label="Primary navigation">
                        <a class="nav-link" href="<?= $baseUrl ?>/portal">Home</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                    </nav>
                    <div class="header-actions">
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <a class="header-action header-action--solid" href="<?= $baseUrl ?>/portal">Sign In</a>
                        <button id="menuBtn" class="menu-btn" aria-controls="mobileNav" aria-expanded="false" aria-label="Open navigation"><span class="menu-btn__line"></span><span class="menu-btn__line"></span><span class="menu-btn__line"></span></button>
                    </div>
                </div>
                <div id="mobileNav" class="mobile-nav" hidden>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal">Home</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                </div>
            </div>
        </header>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">How it works</span>
                    <h1 class="section-title">Follow the SMART LEAP service flow from account creation to beneficiary continuation.</h1>
                    <p class="page-intro">This is where the process explanation belongs, separate from the sign-in-focused home page.</p>
                </div>
            </section>
            <section class="content-section">
                <div class="container timeline-list">
                    <article class="timeline-item is-active" tabindex="0" data-timeline-item data-detail-title="Create Account" data-detail-copy="Register your account using an active email address. Use the same account later for applicant access and beneficiary continuation."><span class="timeline-item__number">1</span><div><h2>Create Account</h2><p>Register your account using an active email address.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Complete Application" data-detail-copy="Complete your personal information first, then upload the required initial documents inside the applicant portal."><span class="timeline-item__number">2</span><div><h2>Complete Application</h2><p>Fill in your details and upload the required files.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Application Review" data-detail-copy="CSWDD reviews your uploaded files and submitted records. If corrections are needed, your next action will be shown in the portal."><span class="timeline-item__number">3</span><div><h2>Application Review</h2><p>CSWDD reviews your submitted details and uploads.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Training Notice" data-detail-copy="Qualified applicants may receive official training schedules, notices, and instructions through their account and registered email."><span class="timeline-item__number">4</span><div><h2>Training Notice</h2><p>Qualified applicants may receive official training instructions.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Post-Training Compliance" data-detail-copy="At this stage, the portal may unlock fill-up form requirements such as Availment Form, Validation Form, Mungkahing Proyekto, Business Plan, and Buhat sa Pagpanumpa."><span class="timeline-item__number">5</span><div><h2>Post-Training Compliance</h2><p>Complete any follow-up forms or required portal tasks.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Beneficiary Access" data-detail-copy="Once approved, the same portal continues to serve as the beneficiary entry point for training and post-approval tasks."><span class="timeline-item__number">6</span><div><h2>Beneficiary Access</h2><p>Continue inside the same portal as a beneficiary.</p></div></article>
                </div>
            </section>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12" defer></script>
</body>
</html>
