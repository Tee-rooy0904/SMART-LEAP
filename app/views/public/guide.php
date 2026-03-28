<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Guide</title>
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
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
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
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                </div>
            </div>
        </header>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">Program guide</span>
                    <h1 class="section-title">Use this guide to understand the SMART LEAP portal process.</h1>
                    <p class="page-intro">Review the main public guidance before creating an account, submitting an application, or returning as a beneficiary.</p>
                </div>
            </section>

            <section class="content-section">
                <div class="container content-stack">
                    <button class="content-card interactive-card is-open" type="button" data-accordion-trigger aria-expanded="true">
                        <span class="interactive-card__header">
                            <span>
                                <h2>How the applicant portal works</h2>
                                <span class="interactive-card__summary">Open to view the basic applicant sequence.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel>
                            <span class="interactive-card__text">The applicant side of SMART LEAP is handled in two parts: first, complete your profile and upload the required files; second, open any fill-up form requirements that become available in your application stage.</span>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>Upload requirements</h2>
                                <span class="interactive-card__summary">Three upload files are currently required.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">The current applicant upload requirements are the same items shown in the profile completion and application pages.</span>
                            <ul class="content-list">
                                <li>Valid ID</li>
                                <li>Health Certificate</li>
                                <li>Cedula</li>
                            </ul>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>What you fill up in the portal</h2>
                                <span class="interactive-card__summary">Form requirements appear after your record reaches the right step.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">After your application reaches the proper stage, the portal can unlock fill-up form requirements. These are handled separately from the uploaded documents.</span>
                            <ul class="content-list">
                                <li>Availment Form</li>
                                <li>Validation Form</li>
                                <li>Mungkahing Proyekto</li>
                                <li>Business Plan</li>
                                <li>Buhat sa Pagpanumpa</li>
                            </ul>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>When fill-up forms appear</h2>
                                <span class="interactive-card__summary">They are unlocked in sequence, not all at once.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Fill-up form requirements do not all appear at once. The applicant dashboard shows them when they become available, and each form is opened only when your record reaches that step.</span>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>How review works</h2>
                                <span class="interactive-card__summary">Uploads and forms are reviewed separately.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">CSWDD reviews both uploaded requirements and submitted fill-up forms. A requirement or form may be missing, pending review, verified, or returned for correction depending on its current review result.</span>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>What to do before submitting</h2>
                                <span class="interactive-card__summary">Use this as your final applicant checklist.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Complete your personal information first, upload all required files clearly, and check the application area for any unlocked form requirements before expecting final approval.</span>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>Privacy and account security</h2>
                                <span class="interactive-card__summary">Protect the account you use for notices and updates.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Use your own active email address, keep your password private, and monitor official notices inside the portal for upload remarks, form instructions, and review updates.</span>
                        </span>
                    </button>
                </div>
            </section>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12" defer></script>
</body>
</html>
