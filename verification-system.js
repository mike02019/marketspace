// ==================== STORE VERIFICATION SYSTEM ====================
// This system allows vendors to request verification badges
// Developers can approve/reject and manage verification status

// --- REQUEST VERIFICATION (Vendor Dashboard) ---
async function requestStoreVerification() {
    // FIX: Changed .id to .docId to match main.js
    if (!currentStoreData || !currentUser) {
        showNotification('Store data not available.');
        return;
    }

    // Check if already verified or has pending request
    if (currentStoreData.isVerified) {
        showNotification('Your store is already verified! ✅');
        return;
    }

    if (currentStoreData.verificationStatus === 'pending') {
        showNotification('Your verification request is already pending. Please wait for developer approval.');
        return;
    }

    // Show confirmation dialog
    if (!confirm('Request verification badge for your store? A developer will review your request.')) {
        return;
    }

    try {
        // FIX: Changed .id to .docId
        const storeRef = db.collection('stores').doc(currentStoreData.docId);

        // Create verification request
        await storeRef.update({
            verificationStatus: 'pending',
            verificationRequestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verificationRequestedBy: currentUser.uid
        });

        // Log the request in a separate collection for tracking
        await db.collection('verificationRequests').add({
            storeId: currentStoreData.docId, // FIX: Changed .id to .docId
            storeName: currentStoreData.name,
            vendorId: currentUser.uid,
            vendorEmail: currentUser.email,
            requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            approvedAt: null,
            approvedBy: null,
            rejectionReason: null
        });

        // Send notification email to developer
        await sendVerificationRequestEmail(
            currentStoreData.name,
            currentUser.displayName || 'Vendor',
            currentUser.email,
            currentStoreData.docId // FIX: Changed .id to .docId
        );

        showNotification('✅ Verification request submitted! A developer will review it shortly.');

        // Refresh dashboard
        setTimeout(() => {
            loadVendorDashboard();
        }, 1500);

    } catch (error) {
        console.error('Error requesting verification:', error);
        showNotification('❌ Error submitting verification request: ' + error.message);
    }
}

// --- SEND VERIFICATION REQUEST EMAIL ---
async function sendVerificationRequestEmail(storeName, vendorName, vendorEmail, storeId) {
    try {
        await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_key: WEB3FORMS_API_KEY,
                from_name: 'MarketSpace Verification',
                from_email: 'verify@marketspace.com',
                subject: `🔵 New Store Verification Request: ${storeName}`,
                to_email: DEVELOPER_EMAIL,
                message: `
                    A vendor has requested store verification.
                    
                    Store Name: ${storeName}
                    Store ID: ${storeId}
                    Vendor Name: ${vendorName}
                    Vendor Email: ${vendorEmail}
                    
                    Log in to your Developer Admin Panel to review and approve/reject this request.
                    
                    This is an automated notification from MarketSpace.
                `,
                html: true
            })
        });

        console.log('✅ Verification request email sent to developer');
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
}

// --- LOAD VERIFICATION REQUESTS (Developer Admin) ---
async function loadVerificationRequests() {
    if (userRole !== 'developer') {
        showNotification('Access denied. Developer only.');
        return;
    }

    const container = document.getElementById('verification-requests-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p>Loading verification requests...</p>
        </div>
    `;

    try {
        const requestsSnapshot = await db.collection('verificationRequests')
            .where('status', '==', 'pending')
            .orderBy('requestedAt', 'desc')
            .get();

        if (requestsSnapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; background: #f8fafc; border-radius: 12px;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 20px;"></i>
                    <h3 style="color: var(--dark);">No Pending Requests</h3>
                    <p style="color: var(--gray);">All verification requests have been processed.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="display: grid; gap: 20px;">
                <div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid var(--warning);">
                    <h3 style="margin: 0 0 10px 0; color: var(--dark);">
                        <i class="fas fa-hourglass-half"></i> Pending Verification Requests
                    </h3>
                    <p style="margin: 0; color: var(--gray);">Total: <strong>${requestsSnapshot.size}</strong></p>
                </div>
        `;

        requestsSnapshot.forEach(doc => {
            const request = doc.data();
            const requestDate = request.requestedAt?.toDate ? request.requestedAt.toDate() : new Date();

            html += `
                <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--dark); font-size: 1.1rem;">
                                <i class="fas fa-store"></i> ${request.storeName}
                            </h4>
                            <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">
                                Store ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${request.storeId}</code>
                            </p>
                        </div>
                        <span style="background: var(--warning); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                            <i class="fas fa-clock"></i> Pending
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Vendor Name</p>
                            <p style="margin: 0; color: var(--dark); font-weight: 600;">${request.vendorName || 'N/A'}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Vendor Email</p>
                            <p style="margin: 0; color: var(--dark); font-weight: 600;">${request.vendorEmail}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Requested Date</p>
                            <p style="margin: 0; color: var(--dark); font-weight: 600;">${requestDate.toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="approveVerification('${doc.id}', '${request.storeId}')" class="btn btn-success" style="flex: 1; min-width: 150px;">
                            <i class="fas fa-check-circle"></i> Approve
                        </button>
                        <button onclick="rejectVerification('${doc.id}', '${request.storeId}')" class="btn btn-danger" style="flex: 1; min-width: 150px;">
                            <i class="fas fa-times-circle"></i> Reject
                        </button>
                        <button onclick="viewStoreForVerification('${request.storeId}')" class="btn btn-outline" style="flex: 1; min-width: 150px;">
                            <i class="fas fa-eye"></i> View Store
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading verification requests:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fee; border-radius: 12px;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: var(--danger); margin-bottom: 10px;"></i>
                <p style="color: var(--danger);">Error loading requests: ${error.message}</p>
            </div>
        `;
    }
}

// --- APPROVE VERIFICATION ---
async function approveVerification(requestId, storeId) {
    if (!confirm('Approve verification for this store?')) {
        return;
    }

    try {
        const batch = db.batch();

        // Update verification request
        batch.update(db.collection('verificationRequests').doc(requestId), {
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: currentUser.uid
        });

        // Update store with verification badge
        batch.update(db.collection('stores').doc(storeId), {
            isVerified: true,
            verificationStatus: 'approved',
            verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verifiedBy: currentUser.uid
        });

        await batch.commit();

        showNotification('✅ Store verification approved!');

        // Reload verification requests
        setTimeout(() => {
            loadVerificationRequests();
        }, 1000);

    } catch (error) {
        console.error('Error approving verification:', error);
        showNotification('❌ Error approving verification: ' + error.message);
    }
}

// --- REJECT VERIFICATION ---
async function rejectVerification(requestId, storeId) {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
        const batch = db.batch();

        // Update verification request
        batch.update(db.collection('verificationRequests').doc(requestId), {
            status: 'rejected',
            rejectionReason: reason || 'No reason provided',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedBy: currentUser.uid
        });

        // Update store
        batch.update(db.collection('stores').doc(storeId), {
            verificationStatus: 'rejected',
            rejectionReason: reason || 'No reason provided'
        });

        await batch.commit();

        showNotification('✅ Verification request rejected.');

        // Reload verification requests
        setTimeout(() => {
            loadVerificationRequests();
        }, 1000);

    } catch (error) {
        console.error('Error rejecting verification:', error);
        showNotification('❌ Error rejecting verification: ' + error.message);
    }
}

// --- REMOVE VERIFICATION (Developer can remove anytime) ---
async function removeVerification(storeId) {
    if (!confirm('Remove verification badge from this store? This action cannot be undone.')) {
        return;
    }

    try {
        await db.collection('stores').doc(storeId).update({
            isVerified: false,
            verificationStatus: 'removed',
            verificationRemovedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verificationRemovedBy: currentUser.uid
        });

        showNotification('✅ Verification badge removed.');

        // Reload dashboard
        setTimeout(() => {
            if (userRole === 'developer') {
                loadDevStats();
            } else {
                loadVendorDashboard();
            }
        }, 1000);

    } catch (error) {
        console.error('Error removing verification:', error);
        showNotification('❌ Error removing verification: ' + error.message);
    }
}

// --- VIEW STORE FOR VERIFICATION ---
async function viewStoreForVerification(storeId) {
    try {
        const storeDoc = await db.collection('stores').doc(storeId).get();
        if (!storeDoc.exists) {
            showNotification('Store not found.');
            return;
        }

        const storeData = storeDoc.data();

        // Show store details in a modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                    <h2 style="margin: 0; color: var(--dark);">
                        <i class="fas fa-store"></i> ${storeData.name}
                    </h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="display: grid; gap: 15px;">
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: var(--dark);">Store Information</h4>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${storeData.category || 'N/A'}</p>
                            <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${storeData.location || 'N/A'}</p>
                            <p style="margin: 0 0 8px 0;"><strong>Created:</strong> ${storeData.createdAt?.toDate ? storeData.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                            <p style="margin: 0;"><strong>Status:</strong> ${storeData.status === 'approved' ? '✅ Approved' : '⏳ ' + storeData.status}</p>
                        </div>
                    </div>

                    <div>
                        <h4 style="margin: 0 0 8px 0; color: var(--dark);">Owner Information</h4>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <p style="margin: 0 0 8px 0;"><strong>Owner ID:</strong> <code>${storeData.ownerId}</code></p>
                            <p style="margin: 0;"><strong>Email:</strong> ${storeData.ownerEmail || 'N/A'}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-outline" style="flex: 1;">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

    } catch (error) {
        console.error('Error viewing store:', error);
        showNotification('Error loading store details.');
    }
}

// --- DISPLAY VERIFICATION BADGE ON STORE ---
function renderVerificationBadge(isVerified) {
    if (!isVerified) return '';

    // Returns just the Blue Tick icon, no text
    return `
        <span class="blue-tick-badge" title="Verified Store">
            <i class="fas fa-check"></i>
        </span>
    `;
}
// --- UPDATE VENDOR DASHBOARD WITH VERIFICATION STATUS ---
function updateVerificationUI() {
    // FIX: Ensure currentStoreData is loaded
    if (!currentStoreData) return;

    const verificationContainer = document.getElementById('store-verification-status');
    if (!verificationContainer) return;

    let html = '';

    if (currentStoreData.isVerified) {
        html = `
            <div style="background: linear-gradient(135deg, #e0f2fe 0%, #cffafe 100%); padding: 20px; border-radius: 12px; border-left: 4px solid var(--primary); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem; color: var(--primary);">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: var(--primary);">
                            <i class="fas fa-badge"></i> Store Verified
                        </h3>
                        <p style="margin: 0; color: #0369a1; font-size: 0.9rem;">
                            Your store has been verified by MarketSpace. Customers can trust your store!
                        </p>
                    </div>
                    <button onclick="removeVerification('${currentStoreData.docId}')" class="btn btn-outline" style="margin-left: auto; white-space: nowrap;">
                        <i class="fas fa-trash"></i> Remove Badge
                    </button>
                </div>
            </div>
        `;
    } else if (currentStoreData.verificationStatus === 'pending') {
        html = `
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border-left: 4px solid var(--warning); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem; color: var(--warning);">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: var(--warning);">
                            Verification Pending
                        </h3>
                        <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                            Your verification request is under review. A developer will approve or reject it soon.with payment options of ₵200
                        </p>
                    </div>
                </div>
            </div>
        `;
    } else if (currentStoreData.verificationStatus === 'rejected') {
        html = `
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 20px; border-radius: 12px; border-left: 4px solid var(--danger); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem; color: var(--danger);">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: var(--danger);">
                            Verification Rejected
                        </h3>
                        <p style="margin: 0; color: #7f1d1d; font-size: 0.9rem;">
                            ${currentStoreData.rejectionReason || 'Your verification request was rejected.'}
                        </p>
                    </div>
                    <button onclick="requestStoreVerification()" class="btn btn-outline" style="margin-left: auto; white-space: nowrap;">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            </div>
        `;
    } else {
        html = `
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 12px; border-left: 4px solid var(--success); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem; color: var(--success);">
                        <i class="fas fa-star"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: var(--success);">
                            Get Verified
                        </h3>
                        <p style="margin: 0; color: #166534; font-size: 0.9rem;">
                            Request a verification badge to build customer trust and stand out from other stores at only ₵50
                        </p>
                    </div>
                    <button onclick="requestStoreVerification()" class="btn btn-success" style="margin-left: auto; white-space: nowrap;">
                        <i class="fas fa-check-circle"></i> Request Verification
                    </button>
                </div>
            </div>
        `;
    }

    verificationContainer.innerHTML = html;
}