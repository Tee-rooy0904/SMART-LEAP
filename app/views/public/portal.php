<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Applicant and Beneficiary Portal</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=12">
</head>
<body class="portal-page portal-page--home">
    <div class="page-shell">
        <header class="site-header" id="top">
            <div class="container header-shell">
                <div class="header-main">
                    <a class="brand" href="<?= $baseUrl ?>/portal" aria-label="SMART LEAP home">
                        <div class="brand-logo" aria-hidden="true">
                            <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="">
                        </div>
                        <div class="brand-copy">
                            <strong class="brand-wordmark">SMART LEAP</strong>
                        </div>
                    </a>

                    <nav class="primary-nav" aria-label="Primary navigation">
                        <a class="nav-link is-active" href="<?= $baseUrl ?>/portal">Home</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                    </nav>

                    <div class="header-actions">
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <button type="button" class="header-action header-action--solid" data-action="open-auth">Sign In</button>
                        <button id="menuBtn" class="menu-btn" aria-controls="mobileNav" aria-expanded="false" aria-label="Open navigation">
                            <span class="menu-btn__line"></span>
                            <span class="menu-btn__line"></span>
                            <span class="menu-btn__line"></span>
                        </button>
                    </div>
                </div>

                <div id="mobileNav" class="mobile-nav" hidden>
                    <a class="mobile-link is-active" href="<?= $baseUrl ?>/portal">Home</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                    <div class="mobile-nav__actions">
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <button type="button" class="header-action header-action--solid mobile-cta" data-action="open-auth">Sign In</button>
                    </div>
                </div>
            </div>
        </header>

        <main class="page" id="content">
            <section class="home-hero" id="home">
                <div class="container home-hero__grid">
                    <div class="home-hero__copy">
                        <div class="home-hero__copy-inner">
                            <span class="section-kicker">Official CSWDD livelihood assistance portal</span>
                            <h1 class="home-hero__title">Sign in or create your SMART LEAP account.</h1>
                            <p class="home-hero__text">Applicants and beneficiaries use the same portal account to continue their record.</p>
                        </div>

                        <div class="home-hero__actions">
                            <a class="header-action header-action--solid" href="<?= $baseUrl ?>/signup">Create Account</a>
                            <button type="button" class="header-action header-action--ghost" data-action="open-auth">Sign In</button>
                        </div>
                    </div>

                    <aside class="auth-card" id="authShell" aria-label="Portal sign in">
                        <div class="auth-card__top">
                            <h2>Sign in</h2>
                            <p>Use your registered email and password.</p>
                        </div>

                        <form id="authForm" novalidate>
                            <input type="hidden" name="entryPoint" value="portal">
                            <div class="auth-error" role="status" aria-live="polite" hidden></div>

                            <label class="field">
                                <span>Email address</span>
                                <input id="email" type="email" autocomplete="email" placeholder="you@example.com" required>
                            </label>

                            <label class="field">
                                <span>Password</span>
                                <div class="field__secure">
                                    <input id="password" type="password" autocomplete="current-password" placeholder="Enter your password" required minlength="8">
                                    <button class="field-toggle" type="button" data-action="toggle-password">Show</button>
                                </div>
                            </label>

                            <div class="auth-inline-actions auth-inline-actions--end">
                                <a class="text-link" href="#" data-action="forgot-password">Forgot password?</a>
                            </div>

                            <button class="auth-submit" id="signInBtn" type="submit">Sign in</button>
                            <span class="small-note" id="capsHint" hidden>Caps Lock is on.</span>

                            <p class="auth-card__subaction">Do not have an account? <a class="text-link" href="<?= $baseUrl ?>/signup">Create account</a></p>
                        </form>
                    </aside>
                </div>
            </section>
        </main>

        <footer class="site-footer" aria-label="Footer">
            <div class="container footer-grid">
                <div class="footer-brand">
                    <strong>SMART LEAP</strong>
                    <p>Applicant and Beneficiary Portal</p>
                    <p>City Government of Butuan</p>
                    <p>City Social Welfare and Development Department (CSWDD)</p>
                </div>
                <div class="footer-column">
                    <strong>Quick Links</strong>
                    <a href="<?= $baseUrl ?>/portal">Home</a>
                    <a href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a href="<?= $baseUrl ?>/portal/help">Help</a>
                </div>
                <div class="footer-column">
                    <strong>Contact</strong>
                    <a href="mailto:smartleap@butuan.gov.ph">smartleap@butuan.gov.ph</a>
                    <span>Office hours: Mon-Fri, 8:00 AM-5:00 PM</span>
                </div>
                <div class="footer-column">
                    <strong>Privacy</strong>
                    <p>Portal records and personal information are handled under RA 10173, or the Data Privacy Act of 2012.</p>
                </div>
            </div>
        </footer>
    </div>

    <div class="auth-loading-screen" id="authLoadingScreen" hidden aria-live="polite" aria-label="Loading">
        <div class="auth-loading-screen__orb" aria-hidden="true"></div>
        <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="" class="auth-loading-screen__logo">
        <strong class="auth-loading-screen__title">SMART LEAP</strong>
        <p class="auth-loading-screen__copy" id="authLoadingCopy">Securing your SMART LEAP session...</p>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12" defer></script>
</body>
</html>
