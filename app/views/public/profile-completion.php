<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Profile Completion</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/public/profile-completion.css">
</head>
<body>
    <div class="profile-shell">
        <header class="profile-header">
            <div class="brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="brand-logo">
                <div>
                    <p class="brand-tag">City Government of Butuan | CSWDD</p>
                    <h1>Profile Completion</h1>
                    <p class="brand-subtitle">Complete your profile and upload required documents for verification.</p>
                </div>
            </div>
            <div class="user-chip">
                <span class="user-initial" id="profileInitial">A</span>
                <div>
                    <strong id="profileUserName">Applicant</strong>
                    <span id="profileUserEmail">--</span>
                </div>
                <button type="button" class="btn-outline" id="logoutButton">Log out</button>
            </div>
        </header>

        <main class="profile-main">
            <section class="status-bar" aria-live="polite">
                <div>
                    <span class="status-label">Status</span>
                    <strong id="statusValue">Draft</strong>
                    <span class="status-dot" aria-hidden="true"></span>
                    <span class="status-updated">Last update: <span id="statusUpdated">--</span></span>
                </div>
                <div class="status-remark" id="statusRemark" hidden></div>
            </section>

            <section class="stepper" aria-label="Profile completion steps">
                <div class="step is-active" data-step="1">
                    <span class="step-index">1</span>
                    <div>
                        <strong>Personal Info</strong>
                        <small>Required details</small>
                    </div>
                </div>
                <div class="step" data-step="2">
                    <span class="step-index">2</span>
                    <div>
                        <strong>Documents</strong>
                        <small>Upload files</small>
                    </div>
                </div>
                <div class="step" data-step="3">
                    <span class="step-index">3</span>
                    <div>
                        <strong>Review &amp; Submit</strong>
                        <small>Finalize</small>
                    </div>
                </div>
            </section>

            <form id="profileCompletionForm" class="profile-form" novalidate>
                <section class="panel" data-step-panel="1">
                    <div class="panel-header">
                        <h2>Personal information</h2>
                        <p class="panel-subtitle">Fields marked with * are required.</p>
                    </div>
                    <div class="form-grid">
                        <label class="form-field">
                            <span>Birthdate <em>*</em></span>
                            <input type="date" id="profileBirthdate" name="birthdate" required>
                            <small data-error-for="profileBirthdate"></small>
                        </label>
                        <label class="form-field">
                            <span>Age <em>Auto-filled</em></span>
                            <input type="number" id="profileAge" name="age" readonly>
                            <small class="field-helper">Auto-calculated from birthdate.</small>
                            <small data-error-for="profileAge"></small>
                        </label>
                        <label class="form-field">
                            <span>Gender <em>*</em></span>
                            <select id="profileGender" name="gender" required>
                                <option value="">Select gender</option>
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Non-binary">Non-binary</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                            <small data-error-for="profileGender"></small>
                        </label>
                        <label class="form-field">
                            <span>Contact number <em>*</em></span>
                            <input type="tel" id="profileContactNumber" name="contactNumber" placeholder="09xxxxxxxxx" required>
                            <small data-error-for="profileContactNumber"></small>
                        </label>
                        <label class="form-field">
                            <span>Complete address <em>*</em></span>
                            <input type="text" id="profileAddress" name="address" placeholder="House no., street, city" required>
                            <small data-error-for="profileAddress"></small>
                        </label>
                        <label class="form-field">
                            <span>Barangay <em>*</em></span>
                            <select id="profileBarangay" name="barangay" required>
                                <option value="">Select barangay</option>
                                <option>Ag-ao</option>
                                <option>Agusan Pequeño</option>
                                <option>Ambago</option>
                                <option>Ampayon</option>
                                <option>Anticala</option>
                                <option>Babag</option>
                                <option>Bad-as</option>
                                <option>Banza</option>
                                <option>Bayawan</option>
                                <option>Bitan-agan</option>
                                <option>Buhangin</option>
                                <option>Cabcabon</option>
                                <option>Doongan</option>
                                <option>Dulag</option>
                                <option>Florida</option>
                                <option>Fort Poyohon</option>
                                <option>Golden Ribbon</option>
                                <option>Holy Redeemer</option>
                                <option>Imadejas</option>
                                <option>J.P. Rizal</option>
                                <option>Kinamlutan</option>
                                <option>Lapu-Lapu</option>
                                <option>Libertad</option>
                                <option>Limaha</option>
                                <option>Los Angeles</option>
                                <option>Lumbocan</option>
                                <option>Masao</option>
                                <option>Maon</option>
                                <option>Maug</option>
                                <option>Nonong</option>
                                <option>Obrero</option>
                                <option>Ong Yiu</option>
                                <option>Pagatpatan</option>
                                <option>Pianing</option>
                                <option>San Mateo</option>
                                <option>San Vicente</option>
                                <option>Sto. Niño</option>
                                <option>Sumilihon</option>
                                <option>Tagabaca</option>
                                <option>Taguibo</option>
                                <option>Taligaman</option>
                                <option>Tiniwisan</option>
                                <option>Tungao</option>
                                <option>Villa Kananga</option>
                            </select>
                            <small data-error-for="profileBarangay"></small>
                        </label>
                        <label class="form-field">
                            <span>4Ps membership <em>*</em></span>
                            <select id="profile4ps" name="is4ps" required>
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                            <small data-error-for="profile4ps"></small>
                        </label>
                        <label class="form-field">
                            <span>Household size <em>*</em></span>
                            <input type="number" id="profileHouseholdSize" name="householdSize" min="1" required>
                            <small data-error-for="profileHouseholdSize"></small>
                        </label>
                        <label class="form-field">
                            <span>Sector <em>*</em></span>
                            <select id="profileSector" name="sector" required>
                                <option value="">Select sector</option>
                                <option value="Indigenous People">Indigenous People</option>
                                <option value="Senior Citizen">Senior Citizen</option>
                                <option value="Solo Parent">Solo Parent</option>
                                <option value="PWD">PWD</option>
                                <option value="None">None</option>
                            </select>
                            <small data-error-for="profileSector"></small>
                        </label>
                        <label class="form-field">
                            <span>Livelihood / Business type <em>*</em></span>
                            <input type="text" id="profileLivelihood" name="livelihood" placeholder="e.g., Sari-sari store" required>
                            <small data-error-for="profileLivelihood"></small>
                        </label>
                        <label class="form-field">
                            <span>Microbusiness name <em>*</em></span>
                            <input type="text" id="profileBusinessName" name="businessName" placeholder="e.g., Maria's Sari-sari Store" required>
                            <small data-error-for="profileBusinessName"></small>
                        </label>
                    </div>
                    <div class="panel-actions">
                        <button type="button" class="btn-primary" data-step-next="2" disabled>Next: Documents</button>
                    </div>
                </section>

                <section class="panel" data-step-panel="2" hidden>
                    <div class="panel-header">
                        <h2>Required documents</h2>
                        <p class="panel-subtitle">PDF, PNG, or JPG only. Max 5 MB per file.</p>
                        <p class="panel-meta">
                            <span>Required: <span id="docsTotalCountInline">3</span> documents (Valid ID, Health Certificate, Cedula)</span>
                            <span class="meta-sep">•</span>
                            <span class="meta-badge">Uploaded: <span id="docsUploadedCount">0</span>/<span id="docsTotalCountInline">3</span></span>
                        </p>
                    </div>
                    <div class="doc-grid" id="docGrid"></div>
                    <div class="panel-actions">
                        <button type="button" class="btn-outline" data-step-prev="1">Back</button>
                        <button type="button" class="btn-primary" data-step-next="3" disabled>Next: Review</button>
                    </div>
                </section>

                <section class="panel" data-step-panel="3" hidden>
                    <div class="panel-header">
                        <h2>Review &amp; submit</h2>
                        <p class="panel-subtitle">Review your details before submitting for verification.</p>
                    </div>
                    <div class="review-grid">
                        <div class="review-block">
                            <h3>Profile summary</h3>
                            <div class="review-list" id="reviewProfile"></div>
                        </div>
                        <div class="review-block">
                            <h3>Document checklist</h3>
                            <div class="review-list" id="reviewDocs"></div>
                        </div>
                    </div>
                </section>

                <div class="notice" id="formNotice" hidden></div>

                <div class="action-bar">
                    <button type="button" class="btn-outline" id="saveDraftButton">Save Draft</button>
                    <button type="submit" class="btn-primary" id="submitProfileButton">Submit for verification</button>
                </div>
            </form>
        </main>
    </div>

    <div class="modal" id="previewModal" hidden>
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="previewTitle">
            <div class="modal-header">
                <div>
                    <h3 id="previewTitle">Document preview</h3>
                    <div class="modal-status">
                        <span class="doc-status">Not uploaded</span>
                    </div>
                </div>
            </div>
            <div class="modal-body" id="previewBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn-outline" id="replacePreview">Replace</button>
                <button type="button" class="btn-primary" id="closePreviewFooter">Close</button>
            </div>
        </div>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/public/profile-completion.js" defer></script>
</body>
</html>
