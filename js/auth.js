// ============================================================================
// AUTHENTICATION MODULE
// Handles user login, signup, logout, and auth state management
// ============================================================================

// Attach login form listener
document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    submitBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then(async (cred) => {
            const userDoc = await db.collection('users').doc(cred.user.uid).get();
            const userData = userDoc.data();
            const userRoleAtLogin = userData ? userData.role : null;

            showNotification('Login Successful!', 'success');

            setTimeout(() => {
                if (userRoleAtLogin === 'vendor') navigateTo('store-admin');
                else if (userRoleAtLogin === 'developer') navigateTo('developer');
                else if (userRoleAtLogin === 'customer') navigateTo('products');
                else navigateTo('home');
            }, 500);
        })
        .catch((error) => {
            console.error("Login Error:", error.code);

            let displayMessage = "An error occurred. Please try again.";

            if (error.code === 'auth/wrong-password' ||
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/invalid-credential' ||
                error.code === 'auth/invalid-login-credentials') {
                displayMessage = "Wrong credentials. Please try again.";
            } else if (error.code === 'auth/invalid-email') {
                displayMessage = "Invalid email address format.";
            } else if (error.code === 'auth/too-many-requests') {
                displayMessage = "Too many failed attempts. Please try again later.";
            }

            showNotification(displayMessage, 'error');
        })
        .finally(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
});

// Signup form listener
document.getElementById('signup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const termsCheckbox = document.getElementById('reg-customer-terms');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showNotification('⚠️ You must agree to the Terms of Service to create an account.');
        return;
    }

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;

    const signupBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = signupBtn.innerHTML;
    signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    signupBtn.disabled = true;

    auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
            return db.collection('users').doc(cred.user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            showNotification('Account Created! Welcome.');
            userRole = role;

            setTimeout(() => {
                if (role === 'customer') {
                    navigateTo('products');
                } else if (role === 'vendor') {
                    navigateTo('register-store');
                } else if (role === 'developer') {
                    navigateTo('developer');
                } else {
                    navigateTo('home');
                }
            }, 1000);
        })
        .catch((error) => {
            let errorMessage = 'An error occurred during signup.';
            if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please use a different email.';
            }
            showNotification(errorMessage);
        })
        .finally(() => {
            signupBtn.innerHTML = originalBtnText;
            signupBtn.disabled = false;
        });
});

// Store registration form listener
document.getElementById('store-registration-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const termsCheckbox = document.getElementById('reg-store-terms');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showNotification('⚠️ You must agree to the Terms of Service to create a store.');
        return;
    }

    const storeName = document.getElementById('reg-store-name').value;
    const slugInput = document.getElementById('reg-store-url');
    const slug = slugInput.value;

    const slugRegex = /^[a-zA-Z0-9]+$/;

    if (!slugRegex.test(slug)) {
        showNotification('⚠️ Invalid Store URL. Please use letters and numbers only (no spaces or symbols).');
        slugInput.focus();
        slugInput.style.border = "2px solid red";
        setTimeout(() => slugInput.style.border = "", 3000);
        return;
    }

    let categoryEl = document.getElementById('reg-store-category');
    let category = categoryEl.value;
    if (category === 'other') {
        const otherVal = document.getElementById('reg-store-category-other')?.value?.trim();
        if (otherVal) category = otherVal;
    }
    const email = document.getElementById('reg-store-email').value;
    const pass = document.getElementById('reg-store-password').value;
    const storeLocation = document.getElementById('reg-store-location')?.value || '';

    if (pass.length < 6) {
        showNotification('Password must be at least 6 characters long.');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
            const userPromise = db.collection('users').doc(cred.user.uid).set({
                name: storeName + " Owner",
                email: email,
                role: 'vendor',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const storePromise = db.collection('stores').doc(slug).set({
                name: storeName,
                slug: slug,
                category: category,
                ownerId: cred.user.uid,
                theme: selectedRegTheme,
                description: "New store on MarketSpace",
                status: 'pending',
                rating: 0,
                reviews: 0,
                storeLocation: storeLocation,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return Promise.all([userPromise, storePromise]);
        })
        .then(async () => {
            try {
                const ownerName = storeName + " Owner";
                if (typeof sendApprovalNotification === 'function') {
                    await sendApprovalNotification(storeName, ownerName, email, slug);
                }
            } catch (emailError) { console.error(emailError); }

            if (typeof scheduleAutoApproval === 'function') {
                scheduleAutoApproval(slug);
            }

            showNotification('Store Created! Awaiting Admin Approval.');
            setTimeout(() => {
                navigateTo('home');
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = 'An error occurred during store registration.';
            if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered.';
            }
            showNotification(errorMessage);
        })
        .finally(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
});

// Toggle display of 'Other' category input
function toggleCategoryOther(selectEl) {
    let otherInput = document.getElementById('reg-store-category-other');
    if (!otherInput) {
        otherInput = document.getElementById('settings-store-category-other');
    }

    if (!otherInput) return;

    if (selectEl.value === 'other') {
        otherInput.style.display = 'block';
        otherInput.focus();
        otherInput.required = true;
    } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// Logout user
function logoutUser() {
    auth.signOut().then(() => {
        showNotification('Logged out successfully');
        navigateTo('home');
    });
}

// Switch auth tabs (login/signup/forgot password)
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-password-form');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        if (forgotForm) forgotForm.style.display = 'none';
    } else if (tab === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        if (forgotForm) forgotForm.style.display = 'none';
    } else if (tab === 'forgot') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'none';
        if (forgotForm) forgotForm.style.display = 'block';
    }
}
