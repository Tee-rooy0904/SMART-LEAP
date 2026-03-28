<?php /** @var string $baseUrl */ ?>
<?php /** @var array $requirements */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Requirements</title>
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
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
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
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                </div>
            </div>
        </header>

        <main class="page page--content">
            <section class="content-hero">
                <div class="container content-hero__inner">
                    <span class="section-kicker">Requirements</span>
                    <h1 class="section-title">Prepare your files properly before starting your SMART LEAP application.</h1>
                    <p class="page-intro">Use this checklist-style page to confirm what to prepare before uploading anything in the portal.</p>
                </div>
            </section>

            <section class="content-section">
                <div class="container content-grid">
                    <?php if ($requirements !== []): ?>
                        <?php foreach ($requirements as $requirement): ?>
                            <article class="content-card interactive-card interactive-card--selectable is-active" tabindex="0" data-select-card>
                                <h2><?= htmlspecialchars((string) ($requirement->attributes['label'] ?? 'Requirement')) ?></h2>
                                <ul class="content-list">
                                    <li><?= htmlspecialchars((string) ($requirement->attributes['description'] ?? 'Prepare this document before starting your application.')) ?></li>
                                </ul>
                            </article>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <article class="content-card interactive-card interactive-card--selectable is-active" tabindex="0" data-select-card>
                            <h2>Valid ID</h2>
                            <ul class="content-list">
                                <li>Prepare a clear government-issued identification document.</li>
                            </ul>
                        </article>
                        <article class="content-card interactive-card interactive-card--selectable" tabindex="0" data-select-card>
                            <h2>Health Certificate</h2>
                            <ul class="content-list">
                                <li>Prepare any health or sanitary clearance required for your application.</li>
                            </ul>
                        </article>
                        <article class="content-card interactive-card interactive-card--selectable" tabindex="0" data-select-card>
                            <h2>Cedula</h2>
                            <ul class="content-list">
                                <li>Prepare your current community tax certificate.</li>
                            </ul>
                        </article>
                    <?php endif; ?>

                    <article class="content-card interactive-card interactive-card--selectable" tabindex="0" data-select-card>
                        <h2>Before You Start</h2>
                        <ul class="content-list">
                            <li>Use clear scans or photos.</li>
                            <li>Make sure names match your profile details.</li>
                            <li>Check that pages are complete and not cropped.</li>
                            <li>Use an active email address for updates.</li>
                        </ul>
                    </article>
                </div>
            </section>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12" defer></script>
</body>
</html>
