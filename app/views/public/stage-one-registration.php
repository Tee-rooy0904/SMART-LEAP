<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Stage 1 Registration</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/portal.css?v=<?= urlencode((string) (@filemtime(base_path('public/assets/css/public/portal.css')) ?: time())) ?>">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/signup.css?v=<?= urlencode((string) (@filemtime(base_path('public/assets/css/public/signup.css')) ?: time())) ?>">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/stage-one-registration.css?v=<?= urlencode((string) (@filemtime(base_path('public/assets/css/public/stage-one-registration.css')) ?: time())) ?>">
    <script defer src="<?= $baseUrl ?>/assets/js/public/portal.js?v=<?= urlencode((string) (@filemtime(base_path('public/assets/js/public/portal.js')) ?: time())) ?>"></script>
    <script defer src="<?= $baseUrl ?>/assets/js/public/stage-one-registration.js?v=<?= urlencode((string) (@filemtime(base_path('public/assets/js/public/stage-one-registration.js')) ?: time())) ?>"></script>
</head>
<body class="portal-page portal-page--signup portal-page--stage-one">
    <div class="page-shell">
        <?php require __DIR__ . '/../layouts/public-flow-header.php'; ?>

        <main class="page" id="content">
            <section class="signup-page stage-one-page">
                <div class="container signup-shell stage-one-shell">
                    <section class="auth-card signup-card stage-one-card" aria-labelledby="stageOneHeading">
                        <div class="auth-card__top">
                            <span class="portal-chip">Stage 1 Public Registration</span>
                            <h2 id="stageOneHeading">Register for SMART LEAP.</h2>
                        </div>

                        <form id="stageOneForm" novalidate enctype="multipart/form-data">
                            <div class="auth-grid">
                                <label class="field">
                                    <span>First name</span>
                                    <input type="text" id="stageOneFirstName" name="firstName" autocomplete="given-name" required>
                                    <small data-error-for="stageOneFirstName"></small>
                                </label>

                                <label class="field">
                                    <span>Middle name</span>
                                    <input type="text" id="stageOneMiddleName" name="middleName" autocomplete="additional-name">
                                    <small data-error-for="stageOneMiddleName"></small>
                                </label>

                                <label class="field">
                                    <span>Last name</span>
                                    <input type="text" id="stageOneLastName" name="lastName" autocomplete="family-name" required>
                                    <small data-error-for="stageOneLastName"></small>
                                </label>

                                <label class="field">
                                    <span>Email address</span>
                                    <input type="email" id="stageOneEmail" name="email" autocomplete="email" required>
                                    <small data-error-for="stageOneEmail"></small>
                                </label>
                            </div>

                            <div class="auth-grid">
                                <label class="field">
                                    <span>Contact number</span>
                                    <input type="text" id="stageOneContactNumber" name="contactNumber" inputmode="tel" autocomplete="tel" required>
                                    <small data-error-for="stageOneContactNumber"></small>
                                </label>

                                <label class="field field--wide">
                                    <span>Complete address</span>
                                    <textarea id="stageOneCompleteAddress" class="field-textarea field-textarea--address" name="completeAddress" rows="2" placeholder="House no., purok/sitio, barangay, city/municipality" required></textarea>
                                    <small class="field-helper">Include your house number, purok or sitio, barangay, and city or municipality.</small>
                                    <small data-error-for="stageOneCompleteAddress"></small>
                                </label>
                            </div>

                            <div class="auth-grid auth-grid--uploads">
                                <label class="field field--upload">
                                    <span>Photo of existing business</span>
                                    <input type="file" id="stageOneBusinessPhoto" name="businessPhoto" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" required>
                                    <small class="field-file-name" id="stageOneBusinessPhotoName">No file selected.</small>
                                    <small data-error-for="stageOneBusinessPhoto"></small>
                                </label>

                                <label class="field field--upload">
                                    <span>Photo of valid ID</span>
                                    <input type="file" id="stageOneValidIdPhoto" name="validIdPhoto" accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif" required>
                                    <small class="field-file-name" id="stageOneValidIdPhotoName">No file selected.</small>
                                    <small data-error-for="stageOneValidIdPhoto"></small>
                                </label>
                            </div>

                            <div class="stage-one-actions">
                                <button type="submit" class="auth-submit signup-submit" id="stageOneSubmit">Submit Registration</button>
                            </div>

                            <p class="auth-feedback" id="stageOneFeedback" role="alert" hidden></p>
                        </form>

                        <section class="stage-one-success" id="stageOneSuccess" hidden aria-live="polite" aria-labelledby="stageOneSuccessHeading">
                            <div class="stage-one-success__card">
                                <div class="stage-one-success__mark" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                                        <path d="M5 12.5 9.2 16.7 19 7.4" />
                                    </svg>
                                </div>
                                <div class="stage-one-success__content">
                                    <span class="stage-one-success__eyebrow">Registration submitted</span>
                                    <h3 id="stageOneSuccessHeading">Your SMART LEAP registration was received.</h3>
                                    <p id="stageOneSuccessMessage">Watch your email for the next steps if you are selected for the next application stage.</p>
                                </div>

                                <div class="stage-one-success__next" aria-label="What happens next">
                                    <div>
                                        <strong>1. Initial screening</strong>
                                        <span>CSWDD reviews your basic information and uploaded requirements.</span>
                                    </div>
                                    <div>
                                        <strong>2. Email notification</strong>
                                        <span>Selected registrants receive instructions for the next SMART LEAP step.</span>
                                    </div>
                                    <div>
                                        <strong>3. Keep your records ready</strong>
                                        <span>Use the same email and contact number for follow-up notices.</span>
                                    </div>
                                </div>

                                <a class="stage-one-success__action" href="<?= $baseUrl ?>/portal">Back to Main Page</a>
                            </div>
                        </section>
                    </section>
                </div>
            </section>
        </main>

        <?php
        $publicFooterVariant = 'flow';
        require __DIR__ . '/../layouts/public-footer.php';
        ?>
    </div>

    <div class="auth-loading-screen" id="authLoadingScreen" hidden aria-live="polite" aria-label="Loading">
        <div class="auth-loading-screen__orb" aria-hidden="true"></div>
        <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="" class="auth-loading-screen__logo">
        <strong class="auth-loading-screen__title">SMART LEAP</strong>
        <p class="auth-loading-screen__copy" id="authLoadingCopy">Submitting your Stage 1 registration...</p>
    </div>
</body>
</html>
