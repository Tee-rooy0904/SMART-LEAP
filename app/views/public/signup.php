<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Create Account</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=12">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/signup.css?v=6">
    <script defer src="<?= $baseUrl ?>/assets/js/public/portal.js?v=12"></script>
    <script defer src="<?= $baseUrl ?>/assets/js/public/signup.js?v=2"></script>
</head>
<body class="portal-page portal-page--signup">
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
                        <a class="nav-link" href="<?= $baseUrl ?>/portal">Home</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                        <a class="nav-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                    </nav>

                    <div class="header-actions">
                        <a class="header-action header-action--solid" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/portal">Sign In</a>
                        <button id="menuBtn" class="menu-btn" aria-controls="mobileNav" aria-expanded="false" aria-label="Open navigation">
                            <span class="menu-btn__line"></span>
                            <span class="menu-btn__line"></span>
                            <span class="menu-btn__line"></span>
                        </button>
                    </div>
                </div>

                <div id="mobileNav" class="mobile-nav" hidden>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal">Home</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/guide">Guide</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/requirements">Requirements</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/how-it-works">How It Works</a>
                    <a class="mobile-link" href="<?= $baseUrl ?>/portal/help">Help</a>
                    <div class="mobile-nav__actions">
                        <a class="header-action header-action--solid" href="<?= $baseUrl ?>/signup">Create Account</a>
                        <a class="header-action header-action--ghost" href="<?= $baseUrl ?>/portal">Sign In</a>
                    </div>
                </div>
            </div>
        </header>

        <main class="page" id="content">
            <section class="signup-page">
                <div class="container signup-shell">
                    <section class="auth-card signup-card" aria-labelledby="signupHeading">
                        <div class="auth-card__top">
                            <h2 id="signupHeading">Create account</h2>
                            <p>Enter your details to open your SMART LEAP portal account.</p>
                        </div>

                        <form id="signupForm" novalidate>
                            <div class="auth-grid">
                                <label class="field">
                                    <span>Full name</span>
                                    <input type="text" id="signupFullName" name="fullName" autocomplete="name" required>
                                    <small data-error-for="signupFullName"></small>
                                </label>

                                <label class="field">
                                    <span>Email address</span>
                                    <input type="email" id="signupEmail" name="email" autocomplete="email" required>
                                    <small data-error-for="signupEmail"></small>
                                </label>
                            </div>

                            <div class="auth-grid auth-grid--password">
                                <label class="field">
                                    <span>Password</span>
                                    <div class="field__secure">
                                        <input type="password" id="signupPassword" name="password" autocomplete="new-password" required>
                                        <button type="button" class="field-toggle toggle-visibility" data-toggle="signupPassword" aria-label="Show password">Show</button>
                                    </div>
                                    <small data-error-for="signupPassword"></small>
                                    <small class="password-hint-short">Use 8+ characters with uppercase, lowercase, and a number.</small>
                                    <div class="password-hints" id="passwordHints" aria-live="polite">
                                        <span data-hint="length">8+ characters</span>
                                        <span data-hint="number">Includes a number</span>
                                        <span data-hint="upper">Uppercase letter</span>
                                        <span data-hint="lower">Lowercase letter</span>
                                    </div>
                                </label>

                                <label class="field">
                                    <span>Confirm password</span>
                                    <div class="field__secure">
                                        <input type="password" id="signupPasswordConfirm" name="confirmPassword" autocomplete="new-password" required>
                                        <button type="button" class="field-toggle toggle-visibility" data-toggle="signupPasswordConfirm" aria-label="Show password">Show</button>
                                    </div>
                                    <small data-error-for="signupPasswordConfirm"></small>
                                </label>
                            </div>

                            <button type="submit" class="auth-submit signup-submit" id="signupSubmit">Create account</button>
                            <p class="auth-card__subaction">Already have an account? <a class="text-link" href="<?= $baseUrl ?>/portal">Sign in</a></p>

                            <p class="auth-feedback" id="signupFeedback" role="alert" hidden></p>
                        </form>
                    </section>
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

        <div class="auth-loading-screen" id="authLoadingScreen" hidden aria-live="polite" aria-label="Loading">
            <div class="auth-loading-screen__orb" aria-hidden="true"></div>
            <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="" class="auth-loading-screen__logo">
            <strong class="auth-loading-screen__title">SMART LEAP</strong>
            <p class="auth-loading-screen__copy" id="authLoadingCopy">Creating your SMART LEAP account...</p>
        </div>
    </div>
</body>
</html>
