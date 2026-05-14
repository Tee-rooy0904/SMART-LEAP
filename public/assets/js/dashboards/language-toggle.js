(function () {
    'use strict';

    const storageKey = 'smartleap.portalLanguage';
    const defaultLanguage = 'en';
    const labels = {
        overview: { en: 'Overview', ceb: 'Kinatibuk-an' },
        profile: { en: 'Profile', ceb: 'Profile' },
        changePassword: { en: 'Change Password', ceb: 'Usba ang Password' },
        signOut: { en: 'Sign Out', ceb: 'Mogawas' },
        application: { en: 'Application', ceb: 'Aplikasyon' },
        training: { en: 'Training', ceb: 'Pagbansay' },
        support: { en: 'Support', ceb: 'Suporta' },
        repayments: { en: 'Repayments', ceb: 'Mga Bayranan' },
        activity: { en: 'Activity', ceb: 'Aktibidad' },
    };
    const phrases = [
        ['Current step', 'Kasamtangang lakang'],
        ['Loading your applicant portal...', 'Nag-load ang imong applicant portal...'],
        ['Loading your beneficiary portal...', 'Nag-load ang imong beneficiary portal...'],
        ['Application status', 'Aplikasyon status'],
        ['Last updated:', 'Katapusang update:'],
        ['Personal Information', 'Personal nga Impormasyon'],
        ['This is the most important action right now.', 'Kini ang pinakaimportante nga buhaton karon.'],
        ['Loading current status', 'Nag-load current status'],
        ['Loading your next step', 'Nag-load your next step'],
        ['Please wait while the workspace checks your current workflow stage.', 'Palihug hulat samtang gisusi sa workspace ang imong kasamtangang workflow stage.'],
        ['Loading', 'Nag-load'],
        ['Current workflow status', 'Kasamtangang workflow status'],
        ['What happens next', 'Unsay sunod mahitabo'],
        ['Process progress', 'Pag-uswag sa proseso'],
        ['Applicant journey milestones', 'Milestones sa proseso sa aplikante'],
        ['Application review', 'Aplikasyon review'],
        ['Upload and verification progress.', 'Pag-uswag sa upload ug verification.'],
        ['Training', 'Pagbansay'],
        ['Sessions and attendance are grouped in Training.', 'Ang sessions ug attendance naa sa Training.'],
        ['Certificate', 'Sertipiko'],
        ['Important updates', 'Importante nga updates'],
        ['Current guidance', 'Kasamtangang giya'],
        ['Applicant guidance', 'Giya sa aplikante'],
        ['Live support', 'Live nga suporta'],
        ['Support recipient', 'Suporta recipient'],
        ['Message', 'Mensahe'],
        ['Type your message', 'I-type ang imong mensahe'],
        ['Guidance and contacts', 'Giya ug mga kontak'],
        ['Assigned project officer', 'Assigned nga project officer'],
        ['Not assigned yet', 'Wala pa na-assign'],
        ['Profile details', 'Detalye sa profile'],
        ['Personal details', 'Personal nga detalye'],
        ['Contact details', 'Kontak details'],
        ['Contact number *', 'Kontak number *'],
        ['Complete address *', 'Kompletong address *'],
        ['Birthdate *', 'Petsa sa pagkatawo *'],
        ['Age', 'Edad'],
        ['Select gender', 'Pili ug gender'],
        ['Female', 'Babaye'],
        ['Male', 'Lalaki'],
        ['Prefer not to say', 'Dili gustong mosulti'],
        ['Upload photo', 'I-upload ang litrato'],
        ['No photo', 'Walay litrato'],
        ['JPG or PNG, max 5MB.', 'JPG o PNG, kutob 5MB.'],
        ['Highest educational attainment *', 'Pinakataas nga nahuman sa eskwela *'],
        ['Select attainment', 'Pili ug nahuman sa eskwela'],
        ['SHS grad', 'SHS graduate'],
        ['Sector *', 'Sektor *'],
        ['Select sector', 'Pili ug sektor'],
        ['Livelihood / Business type *', 'Panginabuhian / Klase sa negosyo *'],
        ['Application status', 'Aplikasyon status'],
        ['Go to Application', 'Adto sa Aplikasyon'],
        ['Application summary', 'Summary sa aplikasyon'],
        ['Review updates', 'Review updates'],
        ['View full history', 'Tan-awa ang tibuok history'],
        ['Repayment summary', 'Summary sa repayment'],
        ['Current balance', 'Kasamtangang balanse'],
        ['Repayment progress', 'Pag-uswag sa repayment'],
        ['Repayment snapshot', 'Snapshot sa repayment'],
        ['Uploaded receipts', 'Na-upload nga resibo'],
        ['Actions needing follow-up', 'Kinahanglan follow-up'],
        ['Updates', 'Updates'],
        ['Support', 'Suporta'],
        ['Open Support', 'Ablihi ang Suporta'],
        ['Send feedback', 'Ipadala ang feedback'],
        ['Your message *', 'Imong mensahe *'],
        ['Share your suggestion or concern', 'Ipaambit ang imong sugyot o kabalaka'],
        ['No feedback submitted yet.', 'Wala pay feedback nga na-submit.'],
        ['Need help?', 'Nagkinahanglan ug tabang?'],
        ['Next repayment', 'Sunod nga repayment'],
        ['Account standing', 'Kahimtang sa account'],
        ['How to ask for help', 'Paagi sa pagpangayo ug tabang'],
        ['Before contacting support', 'Sa dili pa mokontak sa support'],
        ['Office hours: Monday-Friday, 8 AM - 5 PM', 'Oras sa opisina: Lunes-Biyernes, 8 AM - 5 PM'],
        ['Activity summary', 'Summary sa activity'],
        ['Uploaded actions', 'Na-upload nga aksyon'],
        ['Activity timeline', 'Timeline sa activity'],
        ['No activity yet.', 'Wala pay activity.'],
        ['No receipts yet. Log the first OR to begin.', 'Wala pay resibo. I-log ang unang OR para magsugod.'],
        ['No notifications yet.', 'Wala pay notifications.'],
        ['Not uploaded yet', 'Wala pa na-upload'],
        ['Missing', 'Kulang'],
        ['Submitted', 'Na-submit'],
        ['Reviewed', 'Nasusi'],
        ['Under review', 'Gina-review'],
        ['Needs changes', 'Kinahanglan ayuhon'],
        ['Submit receipt', 'Isumite ang resibo'],
        ['Add official receipt', 'Idugang ang official receipt'],
        ['Requirement uploads will appear once reviewed.', 'Requirement uploads makita kung mareview na.'],
        ['The messages from your support team will appear here.', 'Ang mga mensahe sa imong support team makita dinhi.'],
        ['This field is required.', 'Kinahanglan kini nga field.'],
        ['Save changes', 'I-save ang changes'],
        ['Submit receipt', 'Isumite ang resibo'],
        ['Keep row', 'Ibilin ang row'],
        ['Remove row', 'Tangtanga ang row'],
        ['Verified', 'Na-verify'],
        ['Pending review', 'Pending review'],
        ['Action needed', 'Kinahanglan ug aksyon'],
        ['Ready for approval', 'Andam para approval'],
        ['Pending verification', 'Pending verification'],
        ['Completed', 'Nahuman'],
        ['Complete', 'Kompleto'],
        ['Needs updates', 'Kinahanglan i-update'],
        ['No application yet', 'Wala pay aplikasyon'],
        ['No review yet', 'Wala pa mareview'],
        ['No message yet', 'Wala pay mensahe'],
        ['No status history yet.', 'Wala pay status history.'],
        ['No applicant-visible remarks yet.', 'Wala pay remarks nga makita sa aplikante.'],
        ['No requirement records yet.', 'Wala pay requirement records.'],
        ['No required fill-up forms are available right now.', 'Wala pay available nga fill-up form requirements karon.'],
        ['No training assignment recorded yet.', 'Wala pay training assignment nga narecord.'],
        ['No training schedule yet. Wait for notice updates from CSWDD.', 'Wala pay training schedule. Hulata ang notice updates sa CSWDD.'],
        ['No update yet.', 'Wala pay update.'],
        ['No reminder yet.', 'Wala pay pahinumdom.'],
        ['No account alert yet.', 'Wala pay account alert.'],
        ['No file uploaded yet', 'Wala pay na-upload nga file'],
        ['Not yet assigned', 'Wala pa na-assign'],
        ['Upload the required files', 'I-upload ang mga kinahanglanon'],
        ['Upload official receipt', 'I-upload ang opisyal nga resibo'],
        ['Upload receipt', 'I-upload ang resibo'],
        ['Add receipt', 'Idugang ang resibo'],
        ['Upload the OR within 3 days from payment.', 'I-upload ang OR sulod sa 3 ka adlaw gikan sa pagbayad.'],
        ['Official receipt', 'Opisyal nga resibo'],
        ['Uploaded', 'Na-upload'],
        ['Uploaded online', 'Na-upload online'],
        ['Uploaded action', 'Na-upload nga aksyon'],
        ['Uploaded receipt', 'Na-upload nga resibo'],
        ['Needs correction', 'Kinahanglan ayuhon'],
        ['Current status', 'Kasamtangang status'],
        ['Reviewed already', 'Nasusi na'],
        ['Waiting for required fill-up forms', 'Naghulat sa mga fill-up form nga kinahanglanon'],
        ['Applicant-visible review notes are summarized here.', 'Ang review notes nga makita sa aplikante i-summary dinhi.'],
        ['Complete the missing personal details here, then continue to Application.', 'Kompletoha dinhi ang kulang nga personal details, dayon padayon sa Aplikasyon.'],
        ['Assigned PDO details will appear once scoped.', 'Ang detalye sa assigned PDO makita kung ma-scope na.'],
        ['Please complete all required profile fields and uploads before submitting.', 'Palihug kompletoha ang tanang required profile fields ug uploads sa dili pa mosubmit.'],
        ['Unable to save your profile.', 'Dili ma-save ang imong profile.'],
        ['Unable to save your profile right now.', 'Dili ma-save ang imong profile karon.'],
        ['Application submitted for verification.', 'Aplikasyon submitted for verification.'],
        ['Profile updated.', 'Na-update ang profile.'],
        ['Application draft saved.', 'Aplikasyon draft saved.'],
        ['Unable to load your profile right now.', 'Dili ma-load ang imong profile karon.'],
        ['Unable to load the profile state.', 'Dili ma-load ang profile state.'],
        ['Only JPG or PNG files can be uploaded.', 'JPG o PNG file lang ang i-upload.'],
        ['Profile photo must be 5 MB or less.', 'Ang profile photo kinahanglan 5 MB o ubos.'],
        ['Profile photo updated.', 'Na-update ang profile photo.'],
        ['Unable to save the profile photo.', 'Dili ma-save ang profile photo.'],
        ['Saving...', 'Nag-save...'],
        ['Submitting...', 'Nag-submit...'],
        ['Save draft', 'I-save ang Draft'],
        ['Submit for verification', 'Isumite para sa verification'],
        ['Upload file', 'I-upload ang file'],
        ['Choose another file', 'Pili ug laing file'],
        ['Replace file', 'Ilisi file'],
        ['No file selected.', 'Walay napiling file.'],
        ['Waiting for replacement', 'Naghulat ug replacement'],
        ['Upload this requirement in the Application page.', 'I-upload kini nga requirement sa Aplikasyon page.'],
        ['This upload has been reviewed and approved. It can no longer be replaced.', 'Kini nga upload nasusi ug na-approve na. Dili na kini mailisan.'],
        ['This upload needs a new file before you submit again.', 'Kini nga upload kinahanglan ug bag-ong file sa dili pa mosubmit pag-usab.'],
    ];
    const phraseByKey = new Map();
    const phraseLookup = new Map();
    phrases.forEach(([en, ceb]) => {
        const key = en.toLowerCase();
        phraseByKey.set(key, { en, ceb });
        phraseLookup.set(en.toLowerCase(), key);
        phraseLookup.set(ceb.toLowerCase(), key);
    });
    const skipSelector = [
        'script',
        'style',
        'input',
        'textarea',
        '[contenteditable="true"]',
        '#notificationList',
        '.notification-list',
        '.mobile-account-menu'
    ].join(',');
    let observer;
    let isApplying = false;

    function normalizeLanguage(language) {
        return language === 'ceb' ? 'ceb' : defaultLanguage;
    }

    function readLanguage() {
        try {
            return normalizeLanguage(window.localStorage.getItem(storageKey));
        } catch (error) {
            return defaultLanguage;
        }
    }

    function writeLanguage(language) {
        try {
            window.localStorage.setItem(storageKey, language);
        } catch (error) {
            // Ignore storage errors; the active page can still switch language.
        }
    }

    function translate(key, language = readLanguage()) {
        return labels[key]?.[normalizeLanguage(language)] || labels[key]?.[defaultLanguage] || '';
    }

    function translatePhrase(value, language = readLanguage()) {
        const text = String(value || '').trim();
        if (!text) {
            return '';
        }
        const key = phraseLookup.get(text.toLowerCase());
        if (key) {
            return phraseByKey.get(key)?.[normalizeLanguage(language)] || text;
        }
        return translatePattern(text, normalizeLanguage(language));
    }

    function translatePattern(text, language) {
        const replacements = language === 'ceb'
            ? [
                [/^(\d+) requirements$/i, '$1 requirements'],
                [/^(\d+) receipts?$/i, '$1 resibo'],
                [/^(\d+) months verified$/i, '$1 ka bulan na-verify'],
                [/^(\d+) awaiting review$/i, '$1 naghulat ug review'],
                [/^(\d+)% complete$/i, '$1% kompleto'],
                [/^Completion (\d+)%$/i, 'Pagkompleto $1%'],
                [/^Uploaded for verification\.$/i, 'Na-upload para verification.'],
                [/^Awaiting PDO\/Admin verification$/i, 'Naghulat sa PDO/Admin verification'],
            ]
            : [
                [/^(\d+) resibo$/i, '$1 receipts'],
                [/^(\d+) ka bulan na-verify$/i, '$1 months verified'],
                [/^(\d+) naghulat ug review$/i, '$1 awaiting review'],
                [/^(\d+)% kompleto$/i, '$1% complete'],
                [/^Pagkompleto (\d+)%$/i, 'Completion $1%'],
                [/^Na-upload para verification\.$/i, 'Uploaded for verification.'],
                [/^Naghulat sa PDO\/Admin verification$/i, 'Awaiting PDO/Admin verification'],
            ];
        for (const [pattern, replacement] of replacements) {
            if (pattern.test(text)) {
                return text.replace(pattern, replacement);
            }
        }
        return text;
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        return !parent || Boolean(parent.closest(skipSelector));
    }

    function replaceTextNode(node, language) {
        if (shouldSkipNode(node)) {
            return;
        }
        const original = node.nodeValue || '';
        const trimmed = original.trim();
        if (!trimmed) {
            return;
        }
        const translated = translatePhrase(trimmed, language);
        if (!translated || translated === trimmed) {
            return;
        }
        node.nodeValue = original.replace(trimmed, translated);
    }

    function applyPhraseLanguage(language) {
        const roots = document.querySelectorAll('.dash-content, .portal-loader');
        roots.forEach((root) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) {
                nodes.push(walker.currentNode);
            }
            nodes.forEach((node) => replaceTextNode(node, language));
            root.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
                if (element.closest(skipSelector)) {
                    return;
                }
                ['placeholder', 'aria-label', 'title'].forEach((attribute) => {
                    const value = element.getAttribute(attribute);
                    const translated = translatePhrase(value, language);
                    if (translated && translated !== value) {
                        element.setAttribute(attribute, translated);
                    }
                });
            });
        });
    }

    function applyLanguage(language = readLanguage()) {
        const activeLanguage = normalizeLanguage(language);
        if (isApplying) {
            return;
        }
        isApplying = true;
        document.documentElement.dataset.portalLanguage = activeLanguage;
        window.SMARTLEAP_LANGUAGE_CURRENT = activeLanguage;

        document.querySelectorAll('[data-i18n-key]').forEach((element) => {
            const nextLabel = translate(element.dataset.i18nKey, activeLanguage);
            if (nextLabel) {
                element.textContent = nextLabel;
            }
        });

        document.querySelectorAll('[data-language-option]').forEach((button) => {
            const isActive = button.dataset.languageOption === activeLanguage;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        applyPhraseLanguage(activeLanguage);
        isApplying = false;

        window.dispatchEvent(new CustomEvent('smartleap:language-change', {
            detail: { language: activeLanguage },
        }));
    }

    function setLanguage(language) {
        const activeLanguage = normalizeLanguage(language);
        writeLanguage(activeLanguage);
        applyLanguage(activeLanguage);
    }

    function bindLanguageToggles() {
        document.querySelectorAll('[data-language-option]').forEach((button) => {
            button.addEventListener('click', () => setLanguage(button.dataset.languageOption));
        });
    }

    function observeLanguageMutations() {
        if (observer) {
            observer.disconnect();
        }
        const target = document.querySelector('.dash-content');
        if (!target) {
            return;
        }
        let timer = 0;
        observer = new MutationObserver(() => {
            if (isApplying) {
                return;
            }
            window.clearTimeout(timer);
            timer = window.setTimeout(() => applyLanguage(), 30);
        });
        observer.observe(target, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    window.SMARTLEAP_I18N = {
        applyLanguage,
        setLanguage,
        translate: (key) => translate(key, readLanguage()),
        translatePhrase: (value) => translatePhrase(value, readLanguage()),
    };

    document.addEventListener('DOMContentLoaded', () => {
        bindLanguageToggles();
        applyLanguage();
        observeLanguageMutations();
    });

    window.addEventListener('hashchange', () => {
        window.setTimeout(() => applyLanguage(), 0);
    });
    window.addEventListener('smartleap:language-refresh', () => applyLanguage());
}());
