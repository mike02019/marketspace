// Developer credentials moved out of main.js for easier maintenance
const DEVELOPER_CREDENTIALS = {
    username: 'michaelanang',
    password: 'sexy@1905'
};

// Exposed as a global so existing code in main.js continues to work
let developerAuthenticated = false;

// Optional helper to check credentials
function checkDeveloperCredentials(username, password) {
    return username === DEVELOPER_CREDENTIALS.username && password === DEVELOPER_CREDENTIALS.password;
}

// ============================================================================
// GLOBAL FUNCTION STUBS
// These are placeholders that get overridden by main.js
// This prevents ReferenceError when onclick handlers fire before main.js loads
// ============================================================================

// Stub for navigateTo - will be overridden by real implementation in main.js
if (typeof navigateTo === 'undefined') {
    window.navigateTo = function (page, param = null) {
        console.warn('navigateTo called before initialization. Waiting for main.js to load...');
        // Queue the navigation call to execute after main.js loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => navigateTo(page, param), 100);
            });
        } else {
            setTimeout(() => navigateTo(page, param), 100);
        }
    };
}

// Ensure other commonly-called functions exist as stubs
if (typeof showNotification === 'undefined') {
    window.showNotification = function (msg, type = 'success') {
        console.log(`[${type}] ${msg}`);
    };
}

if (typeof closeMobileDrawer === 'undefined') {
    window.closeMobileDrawer = function () {
        console.log('closeMobileDrawer called');
    };
}

