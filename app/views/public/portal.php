<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Beneficiary Portal</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=6">
</head>
<body>
    <div class="page-shell">
        <header class="site-header" id="top">
            <div class="container header-inner">
                <div class="header-top">
                    <div class="brand">
                        <div class="brand-text">
                            <div class="brand-name"><span class="brand-name-smart">SMART</span> <span class="brand-name-leap">LEAP</span></div>
                        </div>
                    </div>

                    <div class="header-actions">
                        <button id="menuBtn" class="menu-btn menu-toggle" aria-controls="mobileNav" aria-expanded="false">
                            <span class="menu-icon"></span>
                            <span class="menu-text">Menu</span>
                        </button>
                    </div>
                </div>

                <div class="header-bottom">
                    <nav class="primary-nav" aria-label="Primary navigation">
                        <div class="nav-links">
                            <a class="nav-link" href="#program">Program</a>
                            <a class="nav-link" href="#guide">Guide</a>
                            <a class="nav-link" href="#support">Support</a>
                        </div>
                    </nav>

                    <div class="nav-tools" aria-label="Header tools">
                        <a class="help-link" href="#support">Help</a>

                        <div class="search" role="search" aria-label="Search">
                            <input id="guideSearch" type="search" placeholder="Search guide..." aria-label="Search guide" aria-describedby="searchHint" />
                            <button type="button" aria-label="Search guide" data-action="search-guide">Search</button>
                        </div>
                        <span id="searchHint" class="sr-only">Type to filter the Program Guide items below.</span>
                    </div>
                </div>

                <div id="mobileNav" class="mobile-nav" hidden>
                    <a href="#program" class="mobile-link">Program</a>
                    <a href="#guide" class="mobile-link">Guide</a>
                    <a href="#support" class="mobile-link">Support</a>
                    <a href="#signin" class="btn btn-primary mobile-cta" data-action="open-auth">Sign in</a>
                </div>
            </div>
        </header>

        <main class="page" id="content">
            <section class="hero-shell" id="program">
                <div class="container">
                    <div class="hero-grid">
                        <div class="hero-card-wrap hero-left">
                            <h1 class="hero-title">Access SMART LEAP services in one secure portal.</h1>
                            <p class="hero-subtitle">
                                Apply, complete training, and track your status with official CSWDD support.
                            </p>

                            <div class="program-summary">
                                <h3>About SMART LEAP</h3>
                                <p>
                                    SMART LEAP is a livelihood assistance program of the City Social Welfare and Development Department of Butuan City that helps local entrepreneurs develop sustainable income opportunities.
                                </p>

                                <div class="program-steps-preview">
                                    <div class="step"><span class="step-number">1</span>Create Account</div>
                                    <div class="step"><span class="step-number">2</span>Submit Application</div>
                                    <div class="step"><span class="step-number">3</span>Attend Training</div>
                                    <div class="step"><span class="step-number">4</span>Become Beneficiary</div>
                                </div>
                            </div>

                            <div class="hero-actions">
                                <a class="btn btn-primary" href="<?= $baseUrl ?>/signup">Apply / Continue</a>
                                <button class="btn btn-secondary-ghost" type="button" data-action="focus-login">Already have an account? Sign in</button>
                            </div>
                        </div>

                        <div class="hero-right" id="signin">
                            <div class="auth-card" id="authShell" aria-label="Sign in">
                                <header>
                                    <h3>Sign in</h3>
                                    <p class="small-note">For applicants and beneficiaries only.</p>
                                </header>

                                <form id="authForm" novalidate>
                                    <input type="hidden" name="entryPoint" value="portal">
                                    <div class="auth-error" role="status" aria-live="polite" hidden></div>

                                    <div class="field">
                                        <label for="email">Email address</label>
                                        <input id="email" type="email" autocomplete="email" placeholder="you@example.com" required />
                                    </div>

                                    <div class="field">
                                        <label for="password">Password</label>
                                        <input id="password" type="password" autocomplete="current-password" placeholder="Enter your password" required minlength="8" />
                                    </div>

                                    <div class="row">
                                        <a class="text-link" href="#" data-action="forgot-password">Forgot password?</a>
                                        <button class="btn-secondary" type="button" data-action="toggle-password">Show</button>
                                    </div>

                                    <div class="row">
                                        <span class="small-note">Need verification?</span>
                                        <a class="text-link" href="#" data-action="resend-verification">Resend verification email</a>
                                    </div>

                                    <button class="auth-submit" id="signInBtn" type="submit">Sign in</button>

                                    <p class="small-note">By signing in, you agree to the SMART LEAP privacy policy.</p>
                                    <span class="small-note" id="capsHint" hidden>Caps Lock is on.</span>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="section program-process" aria-label="How the SMART LEAP Program Works">
                <div class="container section-card">
                    <h2 class="section-title">How the SMART LEAP Program Works</h2>
                    <p class="section-subtitle">Follow the standard SMART LEAP service flow from application to beneficiary release.</p>

                    <div class="service-progress">

    <div class="progress-step active">
        <div class="progress-circle">1</div>
        <div class="progress-text">
            <h3>Apply</h3>
            <p>Create an account and submit your livelihood application.</p>
        </div>
    </div>

    <div class="progress-line"></div>

    <div class="progress-step">
        <div class="progress-circle">2</div>
        <div class="progress-text">
            <h3>Application Review</h3>
            <p>CSWDD officers evaluate submitted applications.</p>
        </div>
    </div>

    <div class="progress-line"></div>

    <div class="progress-step">
        <div class="progress-circle">3</div>
        <div class="progress-text">
            <h3>Training</h3>
            <p>Approved applicants attend livelihood training sessions.</p>
        </div>
    </div>

    <div class="progress-line"></div>

    <div class="progress-step">
        <div class="progress-circle">4</div>
        <div class="progress-text">
            <h3>Beneficiary Approval</h3>
            <p>Qualified applicants officially become SMART LEAP beneficiaries.</p>
        </div>
    </div>

</div>
                </div>
            </section>

            <section class="section program-guide" id="guide" aria-label="Program guide">
                <div class="container section-card">
                    <h2 class="section-title">Program Guide</h2>
                    <p class="section-subtitle">Review the key guidance, requirements, and application details before you apply.</p>

                    <div class="guide-grid" id="guideAccordion">
                        <article class="guide-card module">
                            <div class="module-body">
                                <h3>Eligibility</h3>
                                <p>Check if you qualify for the SMART LEAP program.</p>
                            </div>
                        </article>

                        <article class="guide-card module">
                            <div class="module-body">
                                <h3>Requirements</h3>
                                <p>Prepare the documents needed for your application.</p>
                            </div>
                        </article>

                        <article class="guide-card module">
                            <div class="module-body">
                                <h3>Application Steps</h3>
                                <p>Understand the process from application to training.</p>
                            </div>
                        </article>

                        <article class="guide-card module">
                            <div class="module-body">
                                <h3>Program Support</h3>
                                <p>Learn how CSWDD will support your livelihood project.</p>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section id="requirements" class="section requirements-section" aria-label="Application requirements">
                <div class="container section-card">
                    <h2 class="section-title">Application Requirements</h2>
                    <p class="section-subtitle">Prepare these standard documents before starting your SMART LEAP application.</p>

                    <div class="requirements-grid">
                        <div class="req-card">Valid ID</div>
                        <div class="req-card">Cedula</div>
                        <div class="req-card">Health Certificate</div>
                        <div class="req-card">Business Plan</div>
                    </div>
                </div>
            </section>

            <section class="section" id="support" aria-label="Support">
                <div class="container section-card">
                    <h2 class="section-title">Support</h2>
                    <p class="section-subtitle">Assistance for sign-in, verification, and portal navigation.</p>

                    <div class="support-cards">
                        <div class="support-card">
                            <h4>SMART LEAP Desk</h4>
                            <p>smartleap@butuan.gov.ph</p>
                        </div>
                        <div class="support-card">
                            <h4>Assigned PDO</h4>
                            <p>socialworker@smartleap.gov.ph</p>
                        </div>
                    </div>

                    <p class="small-note">Monitor your email for verification and PDO review updates.</p>
                </div>
            </section>

            <footer class="site-footer" aria-label="Footer">
                <div class="container footer-inner">
                    <div class="footer-grid">
                        <div>
                            <div class="footer-title">SMART LEAP</div>
                            <div class="footer-muted">City Government of Butuan &bull; CSWDD</div>
                            <p class="footer-muted">Empowering local enterprises together. Data protected under RA 10173 (Data Privacy Act of 2012).</p>
                        </div>

                        <div class="footer-contact">
                            <div class="footer-title">Contact</div>
                            <div class="footer-muted">SMART LEAP Desk</div>
                            <a href="mailto:smartleap@butuan.gov.ph">smartleap@butuan.gov.ph</a>
                            <div class="footer-muted">Office hours: Mon-Fri, 8:00 AM-5:00 PM</div>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/portal.js?v=9" defer></script>
</body>
</html>
