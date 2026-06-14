// ============================================================================
// UI HELPERS MODULE
// Handles notifications, theme selection, modal management, and UI utilities
// ============================================================================

// Notification System
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');

    if (!notification || !notificationText) return;

    notificationText.textContent = message;
    notification.className = 'notification';
    notification.classList.add(`notification-${type}`);
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Theme Selector in Register Form
function selectTheme(color, el) {
    selectedRegTheme = color;
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
    if (el) el.classList.add('selected');
}

// Developer Authentication
function showDeveloperAuth() {
    document.getElementById('dev-auth-modal').style.display = 'flex';
}

function closeDeveloperAuth() {
    document.getElementById('dev-auth-modal').style.display = 'none';
}

// Developer auth form submission
document.getElementById('dev-auth-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('dev-username').value;
    const password = document.getElementById('dev-password').value;

    if (checkDeveloperCredentials(username, password)) {
        developerAuthenticated = true;
        showNotification('✅ Developer access granted!');
        closeDeveloperAuth();
        loadDevStats();
    } else {
        showNotification('❌ Invalid developer credentials', 'error');
    }
});

// Update Cart UI
function updateCartUI() {
    const cartBadge = document.getElementById('cart-badge');
    const cartCount = Object.keys(shoppingCart).reduce((total, storeId) => {
        return total + Object.keys(shoppingCart[storeId]).length;
    }, 0);

    if (cartBadge) {
        if (cartCount > 0) {
            cartBadge.textContent = cartCount;
            cartBadge.style.display = 'inline-block';
        } else {
            cartBadge.style.display = 'none';
        }
    }
}

// Toggle cart sidebar
function toggleCartSidebar() {
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar) {
        cartSidebar.classList.toggle('active');
    }
}

// Close cart sidebar
function closeCartSidebar() {
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
    }
}

// Close product filter sidebar on mobile
function closeProductSidebar() {
    const sidebar = document.querySelector('.products-sidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
}

// Toggle mobile drawer
function toggleMobileDrawer() {
    const mobileDrawer = document.getElementById('mobile-drawer');
    if (mobileDrawer) {
        mobileDrawer.classList.toggle('active');
    }
}

// Close mobile drawer
function closeMobileDrawer() {
    const mobileDrawer = document.getElementById('mobile-drawer');
    if (mobileDrawer) {
        mobileDrawer.classList.remove('active');
    }
}

// Update mobile drawer content
function updateMobileDrawer() {
    const mobileUserInfo = document.getElementById('mobile-user-info');
    const mobileUserActions = document.getElementById('mobile-user-actions');

    if (currentUser) {
        if (mobileUserInfo) {
            mobileUserInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: 15px;">
                    <i class="fas fa-user-circle" style="font-size: 2rem; color: var(--primary);"></i>
                    <div>
                        <p style="margin: 0; font-weight: 600;">${currentUser.email}</p>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--gray);">${userRole || 'user'}</p>
                    </div>
                </div>
            `;
        }

        let actions = '<div style="display: flex; flex-direction: column; gap: 10px; padding: 15px;">';
        if (userRole === 'customer') {
            actions += `
                <button onclick="navigateTo('products'); closeMobileDrawer()" class="btn btn-primary">
                    <i class="fas fa-shopping-bag"></i> Shop
                </button>
                <button onclick="navigateTo('customer'); closeMobileDrawer()" class="btn btn-outline">
                    <i class="fas fa-user"></i> My Profile
                </button>
                <button onclick="navigateTo('customer-orders'); closeMobileDrawer()" class="btn btn-outline">
                    <i class="fas fa-box"></i> My Orders
                </button>
            `;
        } else if (userRole === 'vendor') {
            actions += `
                <button onclick="navigateTo('store-admin'); closeMobileDrawer()" class="btn btn-primary">
                    <i class="fas fa-store"></i> My Store
                </button>
            `;
        } else if (userRole === 'developer') {
            actions += `
                <button onclick="navigateTo('developer'); closeMobileDrawer()" class="btn btn-primary">
                    <i class="fas fa-code"></i> Admin Panel
                </button>
            `;
        }

        actions += `
            <button onclick="logoutUser(); closeMobileDrawer()" class="btn btn-danger">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>`;

        if (mobileUserActions) {
            mobileUserActions.innerHTML = actions;
        }
    } else {
        if (mobileUserInfo) {
            mobileUserInfo.innerHTML = '<p style="padding: 15px; color: var(--gray);">Not logged in</p>';
        }

        if (mobileUserActions) {
            mobileUserActions.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px;">
                    <button onclick="navigateTo('login'); closeMobileDrawer()" class="btn btn-primary">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </button>
                    <button onclick="navigateTo('register-store'); closeMobileDrawer()" class="btn btn-outline">
                        <i class="fas fa-store-alt"></i> Open Store
                    </button>
                </div>
            `;
        }
    }
}

// Update floating chat button visibility
function updateFloatingChatButton() {
    const chatBtn = document.getElementById('floating-chat-btn');
    if (chatBtn) {
        if (currentUser) {
            chatBtn.style.display = 'flex';
        } else {
            chatBtn.style.display = 'none';
        }
    }
}

// Open help center modal
function openHelpCenterModal() {
    const modal = document.getElementById('help-center-modal');
    if (modal) modal.style.display = 'flex';
}

// Close help center modal
function closeHelpCenterModal() {
    const modal = document.getElementById('help-center-modal');
    if (modal) modal.style.display = 'none';
}

// Close terms modal
function closeTosModal() {
    const modal = document.getElementById('tos-modal');
    if (modal) modal.style.display = 'none';
}

// Close privacy modal
function closePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.style.display = 'none';
}

// Close learn more modal
function closeLearnMoreModal() {
    const modal = document.getElementById('learn-more-modal');
    if (modal) modal.style.display = 'none';
}

// Close forgot password modal
function closeForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) modal.style.display = 'none';
}

// Submit help request
async function submitHelpRequest(event) {
    event.preventDefault();

    const name = document.getElementById('help-name').value;
    const email = document.getElementById('help-email').value;
    const phone = document.getElementById('help-phone').value;
    const userType = document.getElementById('help-user-type').value;
    const message = document.getElementById('help-message').value;

    try {
        await db.collection('help-requests').add({
            name: name,
            email: email,
            phone: phone,
            userType: userType,
            message: message,
            userId: currentUser?.uid || 'anonymous',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('✅ Help request submitted! We\'ll get back to you soon.');
        event.target.reset();
        closeHelpCenterModal();
    } catch (error) {
        console.error('Error submitting help request:', error);
        showNotification('Error submitting request. Please try again.', 'error');
    }
}

// Close checkout modal
function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.style.display = 'none';
}

// Toggle expand/collapse sections
function toggleExpandSection(element) {
    element.classList.toggle('expanded');
}

// Format currency (uses existing function from main.js)
// Assumes this is already defined globally

// Loading spinner helper
function showLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    return spinner;
}
