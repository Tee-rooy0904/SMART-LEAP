<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Create Account</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/shared/styles.css">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/signup.css">
    <script defer src="<?= $baseUrl ?>/assets/js/public/signup.js"></script>
</head>
<body>
    <div class="auth-shell">
        <header class="auth-header" aria-label="SMART LEAP navigation">
            <div class="auth-brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="auth-brand__logo">
                <div class="auth-brand__copy">
                    <span class="auth-brand__eyebrow">City of Butuan â€¢ CSWDD</span>
                    <strong class="auth-brand__title">
                        <span class="brand-smart">SMART</span>
                        <span class="brand-leap">LEAP</span>
                    </strong>
                </div>
            </div>
        </header>

        <main class="auth-main">
            <section class="auth-card" aria-labelledby="signupHeading">
                <div class="auth-card__header">
                    <div class="auth-card__title">
                        <h2 id="signupHeading">Create an account</h2>
                        <a class="auth-link auth-signin-inline" href="<?= $baseUrl ?>/portal">Already have an account? Sign in</a>
                    </div>
                </div>
                <form id="signupForm" novalidate>
                    <div class="auth-grid">
                        <label class="auth-field">
                            <span>Full name</span>
                            <input type="text" id="signupFullName" name="fullName" autocomplete="name" required>
                            <small data-error-for="signupFullName"></small>
                        </label>
                        <label class="auth-field">
                            <span>Email address</span>
                            <input type="email" id="signupEmail" name="email" autocomplete="email" required>
                            <small data-error-for="signupEmail"></small>
                        </label>
                    </div>

                    <div class="auth-grid auth-grid--password">
                    <label class="auth-field auth-field--password">
                        <span>Password</span>
                        <div class="auth-field__secure">
                            <input type="password" id="signupPassword" name="password" autocomplete="new-password" required>
                            <button type="button" class="toggle-visibility" data-toggle="signupPassword" aria-label="Show password">
                                <span class="toggle-visibility__eye" aria-hidden="true"></span>
                            </button>
                        </div>
                        <small data-error-for="signupPassword"></small>
                        <small class="password-hint-short">Use 8+ characters with letters and numbers.</small>
                        <div class="password-hints" id="passwordHints" aria-live="polite">
                            <span data-hint="length">8+ characters</span>
                            <span data-hint="number">Includes a number</span>
                            <span data-hint="upper">Uppercase letter</span>
                            <span data-hint="lower">Lowercase letter</span>
                        </div>
                    </label>
                        <label class="auth-field auth-field--password">
                            <span>Confirm password</span>
                            <div class="auth-field__secure">
                                <input type="password" id="signupPasswordConfirm" name="confirmPassword" autocomplete="new-password" required>
                                <button type="button" class="toggle-visibility" data-toggle="signupPasswordConfirm" aria-label="Show password">
                                    <span class="toggle-visibility__eye" aria-hidden="true"></span>
                                </button>
                            </div>
                            <small data-error-for="signupPasswordConfirm"></small>
                        </label>
                    </div>

                    <div class="terms-block">
                        <label class="auth-checkbox">
                            <input type="checkbox" id="termsAgreement" required>
                            <span>I agree to the Data Privacy Notice.</span>
                        </label>
                        <small data-error-for="termsAgreement"></small>
                    </div>

                    <div class="auth-card__footer">
                        <button type="submit" class="btn-primary" id="signupSubmit">
                            Create account
                        </button>
                        <p class="auth-card__note">We will send a 6-digit verification code after signup.</p>
                    </div>

                    <p class="auth-feedback" id="signupFeedback" role="alert" hidden></p>
                </form>
            </section>
        </main>

        <footer class="auth-footer">
            <p>Â© SMART LEAP â€¢ City Government of Butuan â€¢ CSWDD</p>
        </footer>
    </div>
</body>
</html>


