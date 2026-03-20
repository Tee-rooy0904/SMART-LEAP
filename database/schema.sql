CREATE DATABASE IF NOT EXISTS smartleap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartleap;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    verification_status VARCHAR(40) NOT NULL DEFAULT 'pending',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_disabled TINYINT(1) NOT NULL DEFAULT 0,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS barangays (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    district VARCHAR(120) NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    contact_number VARCHAR(40) NULL,
    position_title VARCHAR(120) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS staff_barangay_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    staff_profile_id BIGINT UNSIGNED NOT NULL,
    barangay_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_assignments_staff FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id),
    CONSTRAINT fk_assignments_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id)
);

CREATE TABLE IF NOT EXISTS applicant_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    barangay_id BIGINT UNSIGNED NULL,
    contact_number VARCHAR(40) NULL,
    business_name VARCHAR(160) NULL,
    address_line TEXT NULL,
    birthdate DATE NULL,
    age TINYINT UNSIGNED NULL,
    gender VARCHAR(40) NULL,
    is_4ps TINYINT(1) NOT NULL DEFAULT 0,
    household_size SMALLINT UNSIGNED NULL,
    sector VARCHAR(120) NULL,
    livelihood_type VARCHAR(160) NULL,
    profile_status VARCHAR(40) NOT NULL DEFAULT 'incomplete',
    completion_submitted_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_applicant_profiles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_applicant_profiles_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id)
);

CREATE TABLE IF NOT EXISTS beneficiary_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    applicant_profile_id BIGINT UNSIGNED NULL,
    assigned_staff_profile_id BIGINT UNSIGNED NULL,
    beneficiary_status VARCHAR(40) NOT NULL DEFAULT 'active',
    approval_date DATE NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_beneficiary_profiles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_beneficiary_profiles_applicant FOREIGN KEY (applicant_profile_id) REFERENCES applicant_profiles(id),
    CONSTRAINT fk_beneficiary_profiles_staff FOREIGN KEY (assigned_staff_profile_id) REFERENCES staff_profiles(id)
);

CREATE TABLE IF NOT EXISTS applications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    applicant_profile_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    submitted_at DATETIME NULL,
    reviewed_at DATETIME NULL,
    assigned_staff_profile_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_applications_applicant FOREIGN KEY (applicant_profile_id) REFERENCES applicant_profiles(id),
    CONSTRAINT fk_applications_staff FOREIGN KEY (assigned_staff_profile_id) REFERENCES staff_profiles(id)
);

CREATE TABLE IF NOT EXISTS application_comments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    comment_text TEXT NOT NULL,
    visibility VARCHAR(40) NOT NULL DEFAULT 'internal',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_application_comments_application FOREIGN KEY (application_id) REFERENCES applications(id),
    CONSTRAINT fk_application_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS application_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    changed_by_user_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(40) NULL,
    to_status VARCHAR(40) NOT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_application_status_history_application FOREIGN KEY (application_id) REFERENCES applications(id),
    CONSTRAINT fk_application_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS initial_requirement_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    label VARCHAR(140) NOT NULL,
    description TEXT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS initial_requirement_files (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    requirement_type_id BIGINT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NULL,
    file_size BIGINT UNSIGNED NULL,
    review_status VARCHAR(40) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_requirement_files_application FOREIGN KEY (application_id) REFERENCES applications(id),
    CONSTRAINT fk_requirement_files_type FOREIGN KEY (requirement_type_id) REFERENCES initial_requirement_types(id)
);

CREATE TABLE IF NOT EXISTS training_programs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    venue VARCHAR(180) NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    what_to_bring TEXT NULL,
    instructions TEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_training_programs_user FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS training_invitees (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    training_program_id BIGINT UNSIGNED NOT NULL,
    applicant_profile_id BIGINT UNSIGNED NOT NULL,
    beneficiary_profile_id BIGINT UNSIGNED NULL,
    invite_status VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
    remarks TEXT NULL,
    notified_at DATETIME NULL,
    last_notice_sent_at DATETIME NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    post_approval_unlocked_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_training_invitees_program FOREIGN KEY (training_program_id) REFERENCES training_programs(id),
    CONSTRAINT fk_training_invitees_applicant FOREIGN KEY (applicant_profile_id) REFERENCES applicant_profiles(id),
    CONSTRAINT fk_training_invitees_beneficiary FOREIGN KEY (beneficiary_profile_id) REFERENCES beneficiary_profiles(id),
    CONSTRAINT fk_training_invitees_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
    UNIQUE KEY uq_training_invitee_program_applicant (training_program_id, applicant_profile_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    training_invitee_id BIGINT UNSIGNED NOT NULL,
    training_program_id BIGINT UNSIGNED NOT NULL,
    applicant_profile_id BIGINT UNSIGNED NOT NULL,
    beneficiary_profile_id BIGINT UNSIGNED NULL,
    attendance_status VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
    remarks TEXT NULL,
    recorded_by_user_id BIGINT UNSIGNED NULL,
    checked_in_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_records_invitee FOREIGN KEY (training_invitee_id) REFERENCES training_invitees(id),
    CONSTRAINT fk_attendance_records_program FOREIGN KEY (training_program_id) REFERENCES training_programs(id),
    CONSTRAINT fk_attendance_records_applicant FOREIGN KEY (applicant_profile_id) REFERENCES applicant_profiles(id),
    CONSTRAINT fk_attendance_records_beneficiary FOREIGN KEY (beneficiary_profile_id) REFERENCES beneficiary_profiles(id),
    CONSTRAINT fk_attendance_records_user FOREIGN KEY (recorded_by_user_id) REFERENCES users(id),
    UNIQUE KEY uq_attendance_records_invitee (training_invitee_id)
);

CREATE TABLE IF NOT EXISTS post_approval_task_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    label VARCHAR(140) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_approval_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    beneficiary_profile_id BIGINT UNSIGNED NOT NULL,
    task_type_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Unlocked',
    form_payload JSON NULL,
    applicant_started_at DATETIME NULL,
    applicant_submitted_at DATETIME NULL,
    reviewed_by_user_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    reviewer_remarks TEXT NULL,
    assigned_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_approval_tasks_beneficiary FOREIGN KEY (beneficiary_profile_id) REFERENCES beneficiary_profiles(id),
    CONSTRAINT fk_post_approval_tasks_type FOREIGN KEY (task_type_id) REFERENCES post_approval_task_types(id),
    CONSTRAINT fk_post_approval_tasks_user FOREIGN KEY (assigned_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_post_approval_tasks_reviewed_by FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
    UNIQUE KEY uq_post_approval_tasks_beneficiary_task (beneficiary_profile_id, task_type_id)
);

CREATE TABLE IF NOT EXISTS post_approval_submissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_approval_task_id BIGINT UNSIGNED NOT NULL,
    submission_kind VARCHAR(40) NOT NULL DEFAULT 'form',
    file_path VARCHAR(255) NULL,
    original_name VARCHAR(255) NULL,
    payload_json JSON NULL,
    submitted_by_user_id BIGINT UNSIGNED NULL,
    review_status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
    reviewer_remarks TEXT NULL,
    reviewed_by_user_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_approval_submissions_task FOREIGN KEY (post_approval_task_id) REFERENCES post_approval_tasks(id),
    CONSTRAINT fk_post_approval_submissions_submitted_by FOREIGN KEY (submitted_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_post_approval_submissions_reviewed_by FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS repayments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    beneficiary_profile_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    official_receipt_number VARCHAR(120) NULL,
    proof_file_path VARCHAR(255) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_repayments_beneficiary FOREIGN KEY (beneficiary_profile_id) REFERENCES beneficiary_profiles(id)
);

CREATE TABLE IF NOT EXISTS repayment_coverage_months (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    repayment_id BIGINT UNSIGNED NOT NULL,
    coverage_month DATE NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_repayment_coverage_months_repayment FOREIGN KEY (repayment_id) REFERENCES repayments(id)
);

CREATE TABLE IF NOT EXISTS repayment_verifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    repayment_id BIGINT UNSIGNED NOT NULL,
    verified_by_user_id BIGINT UNSIGNED NULL,
    verification_status VARCHAR(40) NOT NULL DEFAULT 'pending',
    remarks TEXT NULL,
    verified_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_repayment_verifications_repayment FOREIGN KEY (repayment_id) REFERENCES repayments(id),
    CONSTRAINT fk_repayment_verifications_user FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS repayment_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    repayment_id BIGINT UNSIGNED NOT NULL,
    changed_by_user_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(40) NULL,
    to_status VARCHAR(40) NOT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_repayment_status_history_repayment FOREIGN KEY (repayment_id) REFERENCES repayments(id),
    CONSTRAINT fk_repayment_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(40) NOT NULL DEFAULT 'in_app',
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    recipient_email VARCHAR(160) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    provider_message_id VARCHAR(191) NULL,
    error_message TEXT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(120) NULL,
    entity_id BIGINT NULL,
    details JSON NULL,
    ip_address VARCHAR(64) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);
