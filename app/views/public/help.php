<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Help</title>
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
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal/help">Help</a>
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
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal/help">Help</a>
                </div>
            </div>
        </header>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">Help</span>
                    <h1 class="section-title">Get official help for account access, portal questions, and SMART LEAP guidance.</h1>
                    <p class="page-intro">Use the right support channel depending on whether your concern is about access, guidance, or official program follow-up.</p>
                </div>
            </section>
            <section class="content-section">
                <div class="container content-grid">
                    <button class="content-card interactive-card is-open" type="button" data-accordion-trigger aria-expanded="true">
                        <span class="interactive-card__header">
                            <span>
                                <h2>SMART LEAP Support Desk</h2>
                                <span class="interactive-card__summary">General public portal questions and service guidance.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel>
                            <span class="interactive-card__text">Use this contact for general public portal questions and service guidance.</span>
                            <a href="mailto:smartleap@butuan.gov.ph">smartleap@butuan.gov.ph</a>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>Assigned PDO Guidance</h2>
                                <span class="interactive-card__summary">Application progress clarification and next-step guidance.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Use this channel when you need clarification about application progress or official next-step guidance.</span>
                            <a href="mailto:socialworker@smartleap.gov.ph">socialworker@smartleap.gov.ph</a>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>Account Help</h2>
                                <span class="interactive-card__summary">Sign-in problems, verification issues, and email concerns.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Use your registered email when asking for help with sign-in problems, verification issues, and account access concerns.</span>
                        </span>
                    </button>
                    <button class="content-card interactive-card" type="button" data-accordion-trigger aria-expanded="false">
                        <span class="interactive-card__header">
                            <span>
                                <h2>Portal Questions</h2>
                                <span class="interactive-card__summary">What to prepare, where to click, and how to continue.</span>
                            </span>
                            <span class="interactive-card__icon" aria-hidden="true">+</span>
                        </span>
                        <span class="interactive-card__body" data-accordion-panel hidden>
                            <span class="interactive-card__text">Use this section when you need help understanding where to click, what to prepare, and how to continue in the portal. Monitor your email and portal notices for official updates.</span>
                        </span>
                    </button>
                </div>
            </section>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12" defer></script>
</body>
</html>
