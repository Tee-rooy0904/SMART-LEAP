<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>How SMART LEAP Works</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=44">
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
                    <nav class="primary-nav" aria-label="Pangunang nabigasyon">
                        <a class="nav-link" href="<?= $baseUrl ?>/portal">Home</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/requirements">Mga Kinahanglanon</a>
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/help">Tabang</a>
                    </nav>
                    <div class="header-actions">
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <a class="header-action header-action--solid" href="<?= $baseUrl ?>/portal">Sign In</a>
                        <button id="menuBtn" class="menu-btn" aria-controls="mobileNav" aria-expanded="false" aria-label="Ablihi ang nabigasyon"><span class="menu-btn__line"></span><span class="menu-btn__line"></span><span class="menu-btn__line"></span></button>
                    </div>
                </div>
                <div id="mobileNav" class="mobile-nav" hidden>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal">Home</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/requirements">Mga Kinahanglanon</a>
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Tabang</a>
                </div>
            </div>
        </header>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">How it works</span>
                    <h1 class="section-title">Follow the SMART LEAP service flow from account creation to beneficiary continuation.</h1>
                    <p class="page-intro">Dinhi ibutang ang pasabot sa proseso, lahi sa home page nga naka-focus sa sign-in.</p>
                </div>
            </section>
            <section class="content-section">
                <div class="container timeline-list">
                    <article class="timeline-item is-active" tabindex="0" data-timeline-item data-detail-title="Create Account" data-detail-copy="Register using an active email address. Use the same account for applicant access and beneficiary continuation."><span class="timeline-item__number">1</span><div><h2>Create Account</h2><p>Register using an active email address.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Kompletoha ang Aplikasyon" data-detail-copy="Kompletoha una ang personal nga impormasyon, dayon i-upload ang required initial documents sulod sa applicant portal."><span class="timeline-item__number">2</span><div><h2>Kompletoha ang Aplikasyon</h2><p>Pun-i ang imong detalye ug i-upload ang required files.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Review sa Aplikasyon" data-detail-copy="Susihon sa CSWDD ang imong uploaded files ug submitted records. Kung kinahanglan ug corrections, makita sa portal ang sunod nga action."><span class="timeline-item__number">3</span><div><h2>Review sa Aplikasyon</h2><p>Susihon sa CSWDD ang imong submitted details ug uploads.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Pahibalo sa Training" data-detail-copy="Ang qualified applicants makadawat ug official training schedules, notices, ug instructions pinaagi sa ilang account ug registered email."><span class="timeline-item__number">4</span><div><h2>Pahibalo sa Training</h2><p>Ang qualified applicants makadawat ug official training instructions.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Post-Training Compliance" data-detail-copy="At this stage, the portal may unlock fill-up form requirements such as Availment Form, Validation Form, Mungkahing Proyekto, Business Plan, and Buhat sa Pagpanumpa."><span class="timeline-item__number">5</span><div><h2>Post-Training Compliance</h2><p>Kompletoha ang follow-up forms o required portal tasks.</p></div></article>
                    <article class="timeline-item" tabindex="0" data-timeline-item data-detail-title="Benepisyaryo Access" data-detail-copy="Once approved, the same portal continues to serve as the beneficiary entry point for training and post-approval tasks."><span class="timeline-item__number">6</span><div><h2>Benepisyaryo Access</h2><p>Continue inside the same portal as a beneficiary.</p></div></article>
                </div>
            </section>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=18" defer></script>
</body>
</html>
