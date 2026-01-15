// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBjjFmpfmJWRlmFG9ROkbwX1-d3JBKQwas",
    authDomain: "marketspace-c9668.firebaseapp.com",
    projectId: "marketspace-c9668",
    storageBucket: "marketspace-c9668.firebasestorage.app",
    messagingSenderId: "596375095742",
    appId: "1:596375095742:web:09259fbc791623279e91ef",
    measurementId: "G-T8MZ0M6M3Z"
};

// --- Currency Symbol Mapping ---
const CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'GHS': '₵',
    'NGN': '₦'
};

// --- Helper Function for Currency Display ---
function formatCurrency(price, currency) {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${parseFloat(price).toFixed(2)}`;
}


// --- Store URL Generation ---
function generateStoreUrl(storeSlug) {
    const baseUrl = window.location.origin; // Gets current website URL
    return `${baseUrl}/?store=${storeSlug}`;
}

// Copy store URL to clipboard
async function copyStoreUrl() {
    if (!currentStoreData || !currentStoreData.slug) {
        showNotification('Store URL not available.');
        return;
    }

    const storeUrl = generateStoreUrl(currentStoreData.slug);

    try {
        await navigator.clipboard.writeText(storeUrl);
        showNotification('✅ Store URL copied to clipboard!');

        // Show success animation
        const copyBtn = document.getElementById('copy-store-url-btn');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.style.background = 'var(--success)';

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }
    } catch (error) {
        console.error('Failed to copy:', error);
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = storeUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('✅ Store URL copied to clipboard!');
    }
}



const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Email Configuration ---
const WEB3FORMS_API_KEY = 'b5f2911c-bf9c-4319-bd26-dc8ad96fec49';
const DEVELOPER_EMAIL = 'michaelanang@email.com';
const EMAILJS_SERVICE_ID = "service_9wi3xm4";
const EMAILJS_VENDOR_TEMPLATE_ID = "template_hh5ov7c";
const EMAILJS_CUSTOMER_TEMPLATE_ID = "template_7wit8t6";

// --- Email Notification Functions ---
// Send order notification to vendor using EmailJS
async function sendOrderNotificationToVendor(vendorEmail, customerName, customerPhone, orderId, storeName, orderItems, orderTotal, currency) {
    try {
        console.log(`📧 Attempting to send email to vendor: ${vendorEmail}`);

        // 1. Build a clean list of items for the email body
        // We use simple line breaks so it displays well in standard text areas
        let itemsListText = '';
        orderItems.forEach((item) => {
            itemsListText += `${item.quantity}x ${item.name} - ${formatCurrency(item.price, currency)}\n`;
        });

        // 2. Prepare the parameters to match your EmailJS Template Variables
        const templateParams = {
            to_email: vendorEmail,          // The vendor's email address
            to_name: "Vendor",              // Greeting name
            store_name: storeName,          // Store Name
            order_id: orderId,              // Order ID
            order_date: new Date().toLocaleDateString(),
            customer_name: customerName,
            customer_phone: customerPhone,
            order_items: itemsListText,     // The list we built above
            order_total: formatCurrency(orderTotal, currency),
            reply_to: "orders@marketspace.com" // Or the customer's email if you prefer
        };

        // 3. Send using EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_VENDOR_TEMPLATE_ID,
            templateParams
        );

        if (response.status === 200) {
            console.log('✅ Order notification email sent to vendor successfully!');
            return true;
        } else {
            console.warn('⚠️ EmailJS returned non-200 status:', response);
            return false;
        }

    } catch (error) {
        console.error('❌ Error sending order email via EmailJS:', error);
        return false;
    }
}
// Send order confirmation to customer
async function sendOrderConfirmationToCustomer(customerEmail, customerName, orderId, storeName, orderItems, orderTotal, currency) {
    try {
        console.log(`📧 Attempting to send receipt to customer: ${customerEmail}`);

        // 1. Format the items list for the customer email
        let itemsListText = '';
        orderItems.forEach((item) => {
            // Check if item has price/quantity, handle missing data gracefully
            const price = item.price || 0;
            const qty = item.quantity || 1;
            itemsListText += `${qty}x ${item.name} - ${formatCurrency(price, currency)}\n`;
        });

        // 2. Prepare parameters for the Customer Template
        const templateParams = {
            to_email: customerEmail,        // The customer's email
            to_name: customerName,          // "John Doe"
            store_name: storeName,          // "My Store"
            order_id: orderId,              // Order ID
            order_date: new Date().toLocaleDateString(),
            order_items: itemsListText,     // Formatted list
            order_total: formatCurrency(orderTotal, currency),
            reply_to: "support@marketspace.com" // Where customer replies go
        };

        // 3. Send using EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,             // Use the same Service ID as before
            EMAILJS_CUSTOMER_TEMPLATE_ID,   // Use the NEW Customer Template ID
            templateParams
        );

        if (response.status === 200) {
            console.log('✅ Order confirmation email sent to customer successfully!');
            return true;
        } else {
            console.warn('⚠️ EmailJS returned non-200 status for customer email:', response);
            return false;
        }

    } catch (error) {
        console.error('❌ Error sending customer confirmation via EmailJS:', error);
        return false;
    }
}
// Send order status update email
async function sendOrderStatusUpdateEmail(customerEmail, customerName, orderId, newStatus, storeName) {
    try {
        const statusMessages = {
            'processing': 'is being prepared for shipment',
            'shipped': 'has been shipped and is on its way to you',
            'delivered': 'has been delivered successfully',
            'cancelled': 'has been cancelled'
        };

        const message = statusMessages[newStatus] || 'status has been updated';

        await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_key: WEB3FORMS_API_KEY,
                from_name: 'MarketSpace Order Update',
                subject: `📦 Order #${orderId.substring(0, 8)} Status Update`,
                to_email: customerEmail,
                message: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Order Status Updated</h2>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p>Hello ${customerName},</p>
                            <p>Your order from <strong>${storeName}</strong> ${message}.</p>
                            
                            <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2563eb;">
                                <p style="margin: 0 0 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
                                <p style="margin: 0 0 5px 0;"><strong>New Status:</strong> 
                                    <span style="background: #e0e7ff; color: #2563eb; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                        ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
                                    </span>
                                </p>
                                <p style="margin: 5px 0 0 0;"><strong>Update Time:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            
                            <p>You can track your order status in real-time by visiting your customer dashboard.</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                            <a href="#" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                                View Order Details
                            </a>
                        </div>
                    </div>
                `,
                html: true
            })
        });

        console.log('✅ Status update email sent to customer');
    } catch (error) {
        console.error('Error sending status email:', error);
    }
}

// --- 2. GLOBAL STATE ---
let currentUser = null;
let userRole = null;
let currentStoreData = null;
let selectedRegTheme = 'primary';
// Client-side cache for stores to enable instant searching/filtering
let storesCache = [];
// Products pagination state (client-side)
let productsListAll = []; // full list from Firestore
let productsList = []; // filtered list used for rendering
let currentProductsPage = 1;
let rowsPerPage = 4; // default: show 4 rows per page

// Filter initialization flag
let _productFiltersInitialized = false;

// --- CHAT SYSTEM VARIABLES ---
let activeChatId = null;
let chatUnsubscribe = null; // Listener for active conversation
let inboxUnsubscribe = null; // Listener for inbox list

// --- Shopping Cart State ---
let shoppingCart = {}; // Structure: { storeId: { productId: { productData, quantity } } }

// --- Wishlist State ---
let wishlist = {}; // Structure: { storeId: { productId: { productData } } }

// --- Shopping Cart Functions ---

// Initialize cart from localStorage for logged-in customers
function initializeCart() {
    if (currentUser && userRole === 'customer') {
        const savedCart = localStorage.getItem(`cart_${currentUser.uid}`);
        if (savedCart) {
            try {
                shoppingCart = JSON.parse(savedCart);
            } catch (e) {
                console.error('Error loading cart from localStorage:', e);
                shoppingCart = {};
            }
        }
        // NEW: Load Wishlist as well
        initializeWishlist();
    } else {
        shoppingCart = {};
        wishlist = {};
    }
    updateCartUI();
}

// Initialize wishlist from localStorage
function initializeWishlist() {
    if (currentUser && userRole === 'customer') {
        const savedList = localStorage.getItem(`wishlist_${currentUser.uid}`);
        if (savedList) {
            try {
                wishlist = JSON.parse(savedList);
            } catch (e) {
                console.error('Error loading wishlist:', e);
                wishlist = {};
            }
        }
    } else {
        wishlist = {};
    }
}

// Save wishlist to localStorage AND Firestore (for analytics)
function saveWishlist() {
    if (currentUser && userRole === 'customer') {
        // 1. Local Storage for fast UI
        localStorage.setItem(`wishlist_${currentUser.uid}`, JSON.stringify(wishlist));

        // 2. Sync to Firestore (Data Analysis)
        // This allows you to see what users want but haven't bought yet
        db.collection('users').doc(currentUser.uid).collection('analytics').doc('wishlist').set({
            items: wishlist,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}

// Move Item: Cart -> Wishlist
function moveToWishlist(productId, storeId) {
    if (!shoppingCart[storeId] || !shoppingCart[storeId][productId]) return;

    // Get item data
    const item = shoppingCart[storeId][productId];

    // Initialize store in wishlist if needed
    if (!wishlist[storeId]) wishlist[storeId] = {};

    // Add to wishlist
    wishlist[storeId][productId] = item;

    // Remove from Cart
    delete shoppingCart[storeId][productId];
    if (Object.keys(shoppingCart[storeId]).length === 0) {
        delete shoppingCart[storeId];
    }

    // Save States
    saveCart();
    saveWishlist();

    // Refresh UI
    renderCartPage();
    showNotification('Item saved for later');
}

// Move Item: Wishlist -> Cart
function moveToCart(productId, storeId) {
    if (!wishlist[storeId] || !wishlist[storeId][productId]) return;

    const item = wishlist[storeId][productId];

    // Add to Cart (using existing logic)
    // We set quantity to 1 when moving back to cart
    if (!shoppingCart[storeId]) shoppingCart[storeId] = {};

    if (shoppingCart[storeId][productId]) {
        shoppingCart[storeId][productId].quantity += 1;
    } else {
        shoppingCart[storeId][productId] = { ...item, quantity: 1 };
    }

    // Remove from Wishlist
    delete wishlist[storeId][productId];
    if (Object.keys(wishlist[storeId]).length === 0) {
        delete wishlist[storeId];
    }

    // Save States
    saveCart();
    saveWishlist();

    // Refresh UI
    renderCartPage();
    showNotification('Moved back to cart');
}

// Remove from Wishlist completely
function removeFromWishlist(productId, storeId) {
    if (wishlist[storeId] && wishlist[storeId][productId]) {
        delete wishlist[storeId][productId];
        if (Object.keys(wishlist[storeId]).length === 0) {
            delete wishlist[storeId];
        }
        saveWishlist();
        renderCartPage();
        showNotification('Removed from saved items');
    }
}

// Save cart to localStorage
function saveCart() {
    if (currentUser && userRole === 'customer') {
        localStorage.setItem(`cart_${currentUser.uid}`, JSON.stringify(shoppingCart));
    }
}

// Add product to cart
function addToCart(productId, storeId, productData) {
    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in as a customer to add items to cart.');
        return;
    }

    // Initialize store cart if it doesn't exist
    if (!shoppingCart[storeId]) {
        shoppingCart[storeId] = {};
    }

    // Add or update product in cart
    if (shoppingCart[storeId][productId]) {
        shoppingCart[storeId][productId].quantity += 1;
    } else {
        shoppingCart[storeId][productId] = {
            ...productData,
            quantity: 1
        };
    }

    saveCart();
    updateCartUI();
    showNotification(`Added ${productData.name} to cart!`);
}

// Remove product from cart
function removeFromCart(productId, storeId) {
    if (shoppingCart[storeId] && shoppingCart[storeId][productId]) {
        delete shoppingCart[storeId][productId];

        // Remove store cart if empty
        if (Object.keys(shoppingCart[storeId]).length === 0) {
            delete shoppingCart[storeId];
        }

        saveCart();
        updateCartUI();
        showNotification('Item removed from cart.');

        // Re-render cart page if currently viewing cart
        if (document.getElementById('cart-page') && document.getElementById('cart-page').classList.contains('active')) {
            renderCartPage();
        }
    }
}

// Update product quantity in cart
function updateCartQuantity(productId, storeId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(productId, storeId);
        return;
    }

    if (shoppingCart[storeId] && shoppingCart[storeId][productId]) {
        shoppingCart[storeId][productId].quantity = newQuantity;
        saveCart();
        updateCartUI();

        // ADD THIS: Refresh the UI if the user is on the cart page or sidebar
        if (document.getElementById('cart-page') && document.getElementById('cart-page').classList.contains('active')) {
            renderCartPage();
        }

        // Also refresh sidebar if it's currently open
        if (document.getElementById('cart-sidebar') && document.getElementById('cart-sidebar').classList.contains('open')) {
            renderCartSidebar();
        }
    }
}

// Clear cart for a specific store
function clearStoreCart(storeId) {
    if (shoppingCart[storeId]) {
        delete shoppingCart[storeId];
        saveCart();
        updateCartUI();
        showNotification('Cart cleared for this store.');
    }
}

// Get cart totals for a store
function getStoreCartTotal(storeId) {
    if (!shoppingCart[storeId]) return { subtotal: 0, itemCount: 0 };

    let subtotal = 0;
    let itemCount = 0;

    Object.values(shoppingCart[storeId]).forEach(item => {
        subtotal += item.price * item.quantity;
        itemCount += item.quantity;
    });

    return { subtotal, itemCount };
}

// Get total cart count across all stores
function getTotalCartCount() {
    let totalCount = 0;
    Object.values(shoppingCart).forEach(storeCart => {
        Object.values(storeCart).forEach(item => {
            totalCount += item.quantity;
        });
    });
    return totalCount;
}

// Render cart page with per-store carts and totals - Amazon-style redesign
async function renderCartPage() {
    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in as a customer to view cart.');
        navigateTo('login');
        return;
    }

    const container = document.getElementById('cart-page-content');
    if (!container) return;

    // Check if both are empty
    if (Object.keys(shoppingCart).length === 0 && Object.keys(wishlist).length === 0) {
        container.innerHTML = `
            <div class="cart-empty-state">
                <div class="cart-empty-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <h2>Your MarketSpace Cart is empty</h2>
                <p>Your shopping cart is waiting. Give it purpose – fill it with groceries, clothing, household supplies, electronics, and more.</p>
               <div class="cart-empty-actions">
                    <button onclick="navigateTo('customer-orders')" class="amazon-btn amazon-btn-primary">
                        <i class="fas fa-box"></i> View My Orders
                    </button>
                    <button onclick="navigateTo('products')" class="amazon-btn amazon-btn-outline">
                        <i class="fas fa-store"></i> Shop today's deals
                    </button>
                    <button onclick="navigateTo('market-stores')" class="amazon-btn amazon-btn-outline">
                        <i class="fas fa-store-alt"></i> Browse all stores
                    </button>
                <div>
            </div>
        `;
        updateCartUI();
        return;
    }

    let html = `
        <div class="cart-page-container">
            <div class="cart-header">
                <h1>Shopping Cart</h1>
                <div class="cart-header-price">Price</div>
            </div>
            
            <div class="cart-content-grid">
                <div class="cart-items-section">
    `;

    // Object to track totals per currency (e.g., { 'GHS': 500, 'USD': 20 })
    let currencyTotals = {};
    let totalItems = 0;

    // Process each store
    for (const storeId in shoppingCart) {
        const storeCart = shoppingCart[storeId];
        const storeTotal = getStoreCartTotal(storeId);

        // Determine store currency from the first item
        const firstItemKey = Object.keys(storeCart)[0];
        const storeCurrency = firstItemKey ? (storeCart[firstItemKey].currency || 'GHS') : 'GHS';

        // Add to global totals
        if (!currencyTotals[storeCurrency]) currencyTotals[storeCurrency] = 0;
        currencyTotals[storeCurrency] += storeTotal.subtotal;

        totalItems += storeTotal.itemCount;

        // Get store name
        let storeName = 'Unknown Store';
        try {
            const storeDoc = await db.collection('stores').doc(storeId).get();
            if (storeDoc.exists) {
                storeName = storeDoc.data().name;
            }
        } catch (e) {
            console.log('Error fetching store name:', e);
        }

        // Store header
        html += `
            <div class="store-cart-section">
                <div class="store-cart-header">
                    <i class="fas fa-store"></i>
                    <span class="store-name">Sold by: ${storeName}</span>
                </div>
        `;

        // Products in this store
        for (const productId in storeCart) {
            const item = storeCart[productId];
            const itemTotal = item.price * item.quantity;
            const itemCurrency = item.currency || 'GHS';

            html += `
                <div class="cart-item">
                    <div class="cart-item-image">
                        ${item.imageUrl ?
                    `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy">` :
                    `<div class="cart-item-image-placeholder">
                                <i class="fas fa-box"></i>
                            </div>`}
                    </div>
                    
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        
                        <div class="cart-item-shipping">
                            <span class="shipping-badge">
                                <i class="fas fa-shipping-fast"></i> FREE delivery
                            </span>
                            <span class="in-stock-badge">
                                <i class="fas fa-check-circle"></i> In Stock
                            </span>
                        </div>
                        
                        <div class="cart-item-actions">
                            <div class="quantity-selector">
                                <label class="quantity-label">Qty:</label>
                                <div class="quantity-controls">
                                    <button onclick="updateCartQuantity('${productId}', '${storeId}', ${item.quantity - 1})" 
                                            class="quantity-btn" ${item.quantity <= 1 ? 'disabled' : ''}>
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <div class="quantity-display">
                                        <select onchange="updateCartQuantity('${productId}', '${storeId}', parseInt(this.value))" 
                                                class="quantity-dropdown">
                                            ${Array.from({ length: Math.max(20, item.quantity) }, (_, i) => i + 1).map(num => `
                                                <option value="${num}" ${num === item.quantity ? 'selected' : ''}>${num}</option>
                                            `).join('')}
                                            ${item.quantity > 20 ? `<option value="${item.quantity}" selected>${item.quantity}</option>` : ''}
                                        </select>
                                    </div>
                                    <button onclick="updateCartQuantity('${productId}', '${storeId}', ${item.quantity + 1})" 
                                            class="quantity-btn">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="cart-item-action-buttons">
                                <button onclick="removeFromCart('${productId}', '${storeId}')" class="action-link delete-btn">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                                <button onclick="moveToWishlist('${productId}', '${storeId}')" class="action-link save-btn">
                                    <i class="fas fa-heart"></i> Save for later
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="cart-item-price">
                        <div class="price-amount">${formatCurrency(item.price, itemCurrency)}</div>
                        <div class="price-subtotal">
                            <span>Subtotal: </span>
                            <strong>${formatCurrency(itemTotal, itemCurrency)}</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        // Store footer with correct currency
        html += `
                <div class="store-cart-footer">
                    <div class="store-subtotal">
                        <span>Subtotal (${storeTotal.itemCount} item${storeTotal.itemCount !== 1 ? 's' : ''}):</span>
                        <strong>${formatCurrency(storeTotal.subtotal, storeCurrency)}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    // Generate Totals String (e.g., "Total: $50.00 + ₵200.00")
    let totalString = Object.entries(currencyTotals)
        .map(([curr, amount]) => formatCurrency(amount, curr))
        .join(' + ');

    // Continue HTML with sidebar
    html += `
                </div> <div class="cart-sidebar-section">
                    <div class="cart-sidebar-card">
                        <div class="sidebar-card-header">
                            <i class="fas fa-check-circle"></i>
                            <span>Your order qualifies for FREE Delivery</span>
                        </div>
                        
                        <div class="order-summary">
                            <div class="summary-line">
                                <span>Subtotal (${totalItems} items):</span>
                                <span>${totalString}</span>
                            </div>
                            <div class="summary-line">
                                <span>Shipping:</span>
                                <span class="free-shipping">FREE</span>
                            </div>
                            <div class="summary-line total-line">
                                <span><strong>Total:</strong></span>
                                <span class="total-amount">${totalString}</span>
                            </div>
                        </div>
                        
                        <button onclick="checkoutCart()" class="amazon-btn amazon-btn-primary checkout-btn">
                            Proceed to checkout (${totalItems} items)
                        </button>

                        <button onclick="navigateTo('customer-orders')" class="amazon-btn amazon-btn-outline" style="width: 100%; margin-bottom: 15px;">
                            <i class="fas fa-box"></i> View Past Orders
                        </button>
                        
                        <div class="payment-methods">
                            <div class="payment-method">
                                <i class="fab fa-cc-visa"></i>
                                <i class="fab fa-cc-mastercard"></i>
                                <i class="fab fa-cc-amex"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Wishlist Section (kept same as before, just ensuring currency passing)
    if (Object.keys(wishlist).length > 0) {
        html += `
            <div class="wishlist-section">
                <div class="wishlist-header">
                    <h2><i class="fas fa-heart"></i> Saved for later</h2>
                </div>
                <div class="wishlist-grid">
        `;
        for (const storeId in wishlist) {
            for (const productId in wishlist[storeId]) {
                const item = wishlist[storeId][productId];
                html += `
                    <div class="wishlist-item">
                        <div class="wishlist-item-image">
                            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : `<i class="fas fa-box"></i>`}
                        </div>
                        <div class="wishlist-item-details">
                            <h3 class="wishlist-item-title">${item.name}</h3>
                            <div class="wishlist-item-price">${formatCurrency(item.price, item.currency || 'GHS')}</div>
                        </div>
                        <div class="wishlist-item-actions">
                            <button onclick="moveToCart('${productId}', '${storeId}')" class="amazon-btn amazon-btn-primary">Add to Cart</button>
                            <button onclick="removeFromWishlist('${productId}', '${storeId}')" class="action-link delete-btn">Remove</button>
                        </div>
                    </div>
                `;
            }
        }
        html += `</div></div>`;
    }

    container.innerHTML = html;
    updateCartUI();
}

// [SEARCH FOR THIS FUNCTION AND REPLACE IT COMPLETELY]
// Process checkout and create orders

// Checkout function - shows checkout modal
async function checkoutCart() {
    if (Object.keys(shoppingCart).length === 0) {
        showNotification('Your cart is empty.');
        return;
    }

    // Show checkout modal
    showCheckoutModal();
}

// Show checkout modal with form
async function showCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const checkoutContent = document.getElementById('checkout-content');

    if (!checkoutContent) return;

    let summaryHtml = '';
    let totalString = '';
    let currencyTotals = {};

    // Calculate totals per currency
    for (const storeId in shoppingCart) {
        const storeCart = shoppingCart[storeId];
        const storeTotal = getStoreCartTotal(storeId);

        const firstItemKey = Object.keys(storeCart)[0];
        const storeCurrency = firstItemKey ? (storeCart[firstItemKey].currency || 'GHS') : 'GHS';

        if (!currencyTotals[storeCurrency]) currencyTotals[storeCurrency] = 0;
        currencyTotals[storeCurrency] += storeTotal.subtotal;

        let storeName = 'Unknown Store';
        const storeDoc = await db.collection('stores').doc(storeId).get();
        if (storeDoc.exists) {
            storeName = storeDoc.data().name;
        }

        summaryHtml += `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: 600;">${storeName}</span>
                    <span style="color: var(--primary); font-weight: 600;">${formatCurrency(storeTotal.subtotal, storeCurrency)}</span>
                </div>
                <div style="font-size: 0.9rem; color: var(--gray);">
                    ${Object.keys(storeCart).length} items
                </div>
            </div>
        `;
    }

    // Format total string
    totalString = Object.entries(currencyTotals)
        .map(([curr, amount]) => formatCurrency(amount, curr))
        .join(' + ');

    checkoutContent.innerHTML = `
        <div style="margin-bottom: 25px;">
            <h4 style="margin-bottom: 15px; color: var(--dark);">Order Summary</h4>
            ${summaryHtml}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 2px solid #e2e8f0;">
                <span style="font-size: 1.1rem; font-weight: 600;">Total Amount</span>
                <span style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${totalString}</span>
            </div>
        </div>
        
        <form id="checkout-form">
            <h4 style="margin-bottom: 15px; color: var(--dark);">Shipping Information</h4>
            
            <div class="form-group">
                <label>Full Name *</label>
                <input type="text" id="checkout-name" class="form-control" value="${currentUser?.displayName || ''}" required>
            </div>
            
            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" id="checkout-email" class="form-control" value="${currentUser?.email || ''}" required>
            </div>
            
            <div class="form-group">
                <label>Phone Number *</label>
                <div style="display: flex; gap: 10px;">
                    <select id="checkout-country-code" class="form-control" style="flex: 0 0 100px;">
                        <option value="+233">+233</option>
                        <option value="+1">+1 </option>
                        <option value="+44">+44</option>
                        <option value="+91">+91</option>
                        <option value="+234">+234</option>
                    </select>
                    <input type="tel" id="checkout-phone" class="form-control" placeholder="10-digit number" maxlength="10" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10)" required style="flex: 1;">
                </div>
            </div>
            
            <div class="form-group">
                <label>Shipping Address *</label>
                <textarea id="checkout-address" class="form-control" rows="3" required></textarea>
            </div>
            
            <div class="form-group">
                <label>Payment Method</label>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <input type="radio" name="payment-method" value="cod" checked style="margin: 0;">
                        <span>Cash on Delivery (COD)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <input type="radio" name="payment-method" value="card" style="margin: 0;">
                        <span>Mobile Money Transfer</span>
                    </label>
                </div>
            </div>
            
            <div style="display: flex; gap: 15px; margin-top: 30px;">
                <button type="button" onclick="closeCheckoutModal()" class="btn btn-outline" style="flex: 1;">Cancel</button>
                <button type="submit" class="btn btn-success" style="flex: 1;">Place Order</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';

    const form = document.getElementById('checkout-form');
    if (form) {
        form.removeEventListener('submit', processCheckout);
        form.addEventListener('submit', processCheckout);
    }
}


// Close checkout modal
function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'none';
}

// Process checkout and create orders
async function processCheckout(e) {
    e.preventDefault();

    const customerName = document.getElementById('checkout-name').value;
    const customerEmail = document.getElementById('checkout-email').value;
    const countryCode = document.getElementById('checkout-country-code').value;
    const phone = document.getElementById('checkout-phone').value;
    const customerPhone = countryCode + phone;
    const shippingAddress = document.getElementById('checkout-address').value;
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    // Validate phone number
    if (!phone || phone.length !== 10) {
        showNotification('Please enter a valid 10-digit phone number.');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;

    try {
        // Process each store separately
        const orderPromises = [];
        const orderIds = [];

        for (const storeId in shoppingCart) {
            const storeCart = shoppingCart[storeId];
            const storeTotal = getStoreCartTotal(storeId);

            // Get store details
            const storeDoc = await db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) continue;

            const storeData = storeDoc.data();
            const storeName = storeData.name;

            // Get vendor email
            const vendorDoc = await db.collection('users').doc(storeData.ownerId).get();
            const vendorEmail = vendorDoc.exists ? vendorDoc.data().email : null;

            // Prepare order items
            const orderItems = [];
            for (const productId in storeCart) {
                const item = storeCart[productId];
                orderItems.push({
                    productId: productId,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    currency: item.currency || 'GHS',
                    imageUrl: item.imageUrl || ''
                });
            }

            // Create order ID
            const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
            orderIds.push(orderId);

            // Create order document with initial status
            const orderData = {
                orderId: orderId,
                storeId: storeId,
                storeName: storeName,
                vendorId: storeData.ownerId,
                vendorEmail: vendorEmail,
                customerId: currentUser.uid,
                customerName: customerName,
                customerEmail: customerEmail,
                customerPhone: customerPhone,
                shippingAddress: shippingAddress,
                items: orderItems,
                subtotal: storeTotal.subtotal,
                shippingFee: 0,
                tax: 0,
                total: storeTotal.subtotal,
                currency: 'GHS',
                paymentMethod: paymentMethod,
                status: 'pending', // Initial status
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add order to Firestore
            const orderPromise = db.collection('orders').doc(orderId).set(orderData);
            orderPromises.push(orderPromise);

            // Update product quantities (simplified for rules compliance)
            for (const productId in storeCart) {
                const item = storeCart[productId];
                const productRef = db.collection('products').doc(productId);

                try {
                    // Use set with merge: true to only update quantity field
                    await productRef.set({
                        quantity: firebase.firestore.FieldValue.increment(-item.quantity)
                    }, { merge: true });
                } catch (error) {
                    console.error(`Failed to update product ${productId}:`, error);
                    // Continue with other products even if one fails
                }
            }

            // Send email to vendor if email exists
            if (vendorEmail) {
                setTimeout(() => {
                    sendOrderNotificationToVendor(
                        vendorEmail,
                        customerName,
                        customerPhone,
                        orderId,
                        storeName,
                        orderItems,
                        storeTotal.subtotal,
                        'GHS'
                    );
                }, 1000);
            }
        }

        // Wait for all orders to be created
        await Promise.all(orderPromises);

        // Send confirmation email to customer
        setTimeout(() => {
            sendOrderConfirmationToCustomer(
                customerEmail,
                customerName,
                orderIds[0], // Use first order ID for reference
                Object.keys(shoppingCart).length > 1 ? 'Multiple Stores' : Object.values(shoppingCart)[0]?.name || 'Store',
                [], // We'll send simplified email
                Object.values(shoppingCart).reduce((sum, storeCart) => sum + getStoreCartTotal(Object.keys(shoppingCart)[0]).subtotal, 0),
                'GHS'
            );
        }, 1500);

        // Clear cart
        shoppingCart = {};
        saveCart();
        updateCartUI();

        // Close modal
        closeCheckoutModal();

        // Show success message
        showNotification(`✅ Order placed successfully! Order IDs: ${orderIds.join(', ')}`);

        // Navigate to customer orders page
        setTimeout(() => {
            navigateTo('customer-orders');
        }, 2000);

    } catch (error) {
        console.error('Error processing checkout:', error);
        showNotification('❌ Error processing order: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Update cart UI elements
function updateCartUI() {
    const cartCount = getTotalCartCount();

    // Update cart icon in header if it exists
    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
        const badge = cartIcon.querySelector('#cart-count');
        if (cartCount > 0) {
            if (badge) {
                badge.textContent = cartCount;
                badge.style.display = 'flex';
            } else {
                cartIcon.insertAdjacentHTML('beforeend', `<span id="cart-count" style="position: absolute; top: -8px; right: -8px; background: var(--danger); color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; display: flex; align-items: center; justify-content: center;">${cartCount}</span>`);
            }
        } else {
            if (badge) badge.style.display = 'none';
        }
    }

    // Update cart badge in mobile drawer if it exists
    const mobileCartBadge = document.getElementById('mobile-cart-badge');
    if (mobileCartBadge) {
        mobileCartBadge.textContent = cartCount;
        mobileCartBadge.style.display = cartCount > 0 ? 'inline-flex' : 'none';
    }
}

// ==================== ORDER TRACKING SYSTEM ====================



// Global variable to store all orders for filtering
let allCustomerOrders = [];

// Load customer orders with search functionality
async function loadCustomerOrders() {
    if (!currentUser || userRole !== 'customer') {
        return;
    }

    const container = document.getElementById('customer-orders-content');
    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div class="spinner"></div>
            <p>Loading your orders...</p>
        </div>
    `;

    try {
        const ordersSnapshot = await db.collection('orders')
            .where('customerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        if (ordersSnapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h3>No Orders Yet</h3>
                    <p>When you place orders, they will appear here.</p>
                    <button onclick="navigateTo('products')" class="btn btn-primary" style="margin-top:15px;">Start Shopping</button>
                </div>
            `;
            return;
        }

        // Store all orders globally for filtering
        allCustomerOrders = [];
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            order.id = doc.id;
            allCustomerOrders.push(order);
        });

        // Build the page structure with search bar
        let html = `
            <div class="orders-page-header">
                <h2><i class="fas fa-shipping-fast" style="color:var(--primary);"></i> My Orders</h2>
                <div class="orders-stats">
                    Total Orders: <strong id="orders-count">${allCustomerOrders.length}</strong>
                </div>
            </div>

            <!-- Search Bar -->
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <!-- Search Input -->
                    <div style="flex: 1; min-width: 250px; position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--gray);"></i>
                        <input 
                            type="text" 
                            id="order-search-input" 
                            class="form-control" 
                            placeholder="Search by Order ID, Store, Product Name, or Status..."
                            style="padding-left: 40px; border: 2px solid #e2e8f0; border-radius: 8px;"
                            oninput="searchOrders()"
                        >
                    </div>
                    
                    <!-- Filter Buttons -->
                    <div class="orders-filters" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="filterOrdersByStatus('all', this)" class="filter-btn active" data-status="all">
                            All Orders
                        </button>
                        <button onclick="filterOrdersByStatus('pending', this)" class="filter-btn" data-status="pending">
                            <i class="fas fa-clock"></i> Pending
                        </button>
                        <button onclick="filterOrdersByStatus('shipped', this)" class="filter-btn" data-status="shipped">
                            <i class="fas fa-shipping-fast"></i> Shipped
                        </button>
                        <button onclick="filterOrdersByStatus('delivered', this)" class="filter-btn" data-status="delivered">
                            <i class="fas fa-check-circle"></i> Delivered
                        </button>
                    </div>

                    <!-- Clear Button -->
                    <button onclick="clearOrderSearch()" class="btn btn-outline" style="white-space: nowrap;">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>

            <!-- Orders List Container -->
            <div id="orders-list-container">
                ${renderOrdersList(allCustomerOrders)}
            </div>
        `;

        container.innerHTML = html;
        setupOrderStatusListeners(currentUser.uid);

    } catch (error) {
        console.error('Error loading customer orders:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Search orders by text input (UPDATED to include product names)
function searchOrders() {
    const searchInput = document.getElementById('order-search-input');
    if (!searchInput) return;

    const searchTerm = searchInput.value.trim().toLowerCase();

    if (!searchTerm) {
        // If search is empty, show all orders
        renderFilteredOrders(allCustomerOrders);
        return;
    }

    // Filter orders based on search term
    const filtered = allCustomerOrders.filter(order => {
        const orderId = (order.orderId || order.id || '').toLowerCase();
        const storeName = (order.storeName || '').toLowerCase();
        const status = (order.status || '').toLowerCase();
        const customerName = (order.customerName || '').toLowerCase();
        const total = order.total ? order.total.toString() : '';

        // NEW: Search through product names in the order
        const productNames = order.items ?
            order.items.map(item => (item.name || '').toLowerCase()).join(' ') : '';

        return orderId.includes(searchTerm) ||
            storeName.includes(searchTerm) ||
            status.includes(searchTerm) ||
            customerName.includes(searchTerm) ||
            total.includes(searchTerm) ||
            productNames.includes(searchTerm); // Search in product names
    });

    renderFilteredOrders(filtered);
}

// Filter orders by status (button click)
function filterOrdersByStatus(status, btnElement) {
    // Update active button
    if (btnElement) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // Also get search term if exists
    const searchInput = document.getElementById('order-search-input');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = allCustomerOrders;

    // Apply status filter
    if (status !== 'all') {
        filtered = filtered.filter(order => order.status === status);
    }

    // Apply search filter if exists
    if (searchTerm) {
        filtered = filtered.filter(order => {
            const orderId = (order.orderId || order.id || '').toLowerCase();
            const storeName = (order.storeName || '').toLowerCase();
            const orderStatus = (order.status || '').toLowerCase();
            const productNames = order.items ?
                order.items.map(item => (item.name || '').toLowerCase()).join(' ') : '';

            return orderId.includes(searchTerm) ||
                storeName.includes(searchTerm) ||
                orderStatus.includes(searchTerm) ||
                productNames.includes(searchTerm);
        });
    }

    renderFilteredOrders(filtered);
}

// Clear search and reset filters
function clearOrderSearch() {
    const searchInput = document.getElementById('order-search-input');
    if (searchInput) {
        searchInput.value = '';
    }

    // Reset filter buttons to "All"
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === 'all') {
            btn.classList.add('active');
        }
    });

    // Show all orders
    renderFilteredOrders(allCustomerOrders);
    showNotification('Search cleared');
}

// Render filtered orders with count update
function renderFilteredOrders(orders) {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    // Update count
    const countElement = document.getElementById('orders-count');
    if (countElement) {
        countElement.textContent = orders.length;
    }

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; background: #f8fafc; border-radius: 12px;">
                <i class="fas fa-search" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                <h3 style="color: var(--dark); margin-bottom: 10px;">No Orders Found</h3>
                <p style="color: var(--gray);">Try adjusting your search or filter criteria.</p>
                <button onclick="clearOrderSearch()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Reset Search
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = renderOrdersList(orders);
}

// Render orders list (keeping existing function structure)
function renderOrdersList(orders) {
    if (orders.length === 0) {
        return `
            <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; margin-top: 20px;">
                <i class="fas fa-search" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                <h4 style="color: var(--dark); margin-bottom: 10px;">No Orders Found</h4>
                <p style="color: var(--gray);">Try a different filter or place a new order.</p>
            </div>
        `;
    }

    let html = '<div class="orders-grid">';

    orders.forEach(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        const formattedDate = orderDate.toLocaleDateString();
        const formattedTime = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const statusConfig = getStatusConfig(order.status);
        const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

        html += `
            <div class="order-card" data-order-id="${order.orderId || order.id}" data-status="${order.status}" data-doc-id="${order.id}">
                <div class="order-header" style="background: ${statusConfig.color}10; border-left: 4px solid ${statusConfig.color};">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: var(--dark);">${order.storeName}</h4>
                        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                            <span style="font-size: 0.85rem; color: var(--gray);">
                                <i class="fas fa-calendar"></i> ${formattedDate}
                            </span>
                            <span style="font-size: 0.85rem; color: var(--gray);">
                                <i class="fas fa-clock"></i> ${formattedTime}
                            </span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-badge" style="background: ${statusConfig.color}; color: white;">
                            <i class="fas ${statusConfig.icon}"></i> ${statusConfig.text}
                        </span>
                    </div>
                </div>
                
                <div class="order-body">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Order ID</p>
                            <p style="margin: 0; font-family: monospace; font-weight: 600;">${order.orderId?.substring(0, 12) || order.id.substring(0, 12)}...</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Items</p>
                            <p style="margin: 0; font-weight: 600;">${totalItems} item${totalItems !== 1 ? 's' : ''}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--gray); font-size: 0.85rem;">Total Amount</p>
                            <p style="margin: 0; color: var(--success); font-weight: 600; font-size: 1.1rem;">
                                ${formatCurrency(order.total, order.currency || 'GHS')}
                            </p>
                        </div>
                    </div>
                    
                    ${renderOrderProgress(order.status)}
                    
                    <div style="margin-top: 20px;">
                        <p style="margin: 0 0 10px 0; color: var(--gray); font-size: 0.9rem;">Items Ordered:</p>
                        <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;">
                            ${order.items?.slice(0, 3).map(item => `
                                <div style="flex: 0 0 auto; min-width: 100px; background: #f8fafc; border-radius: 8px; padding: 8px; text-align: center;">
                                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--primary); margin-bottom: 4px;">${item.quantity}x</div>
                                    <div style="font-size: 0.7rem; color: var(--dark); font-weight: 500; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</div>
                                    <div style="font-size: 0.65rem; color: var(--gray);">${formatCurrency(item.price, item.currency || 'GHS')}</div>
                                </div>
                            `).join('')}
                            ${order.items && order.items.length > 3 ? `
                                <div style="flex: 0 0 auto; width: 80px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--gray); font-size: 0.8rem;">
                                    +${order.items.length - 3} more
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="order-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-top: 1px solid #e2e8f0;">
                    <div>
                        <span style="font-size: 0.85rem; color: var(--gray);">
                            <i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}
                        </span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="viewOrderDetailsCustomer('${order.orderId || order.id}')" class="btn btn-outline btn-sm">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        ${order.status === 'shipped' ? `
                            <button onclick="markAsDelivered('${order.orderId || order.id}')" class="btn btn-success btn-sm">
                                <i class="fas fa-check"></i> Received
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// Get status configuration
function getStatusConfig(status) {
    const configs = {
        'pending': {
            text: 'Pending',
            color: 'var(--warning)',
            icon: 'fa-clock',
            progress: 25
        },
        'processing': {
            text: 'Processing',
            color: 'var(--primary)',
            icon: 'fa-cog',
            progress: 50
        },
        'shipped': {
            text: 'Shipped',
            color: 'var(--info)',
            icon: 'fa-shipping-fast',
            progress: 75
        },
        'delivered': {
            text: 'Delivered',
            color: 'var(--success)',
            icon: 'fa-check-circle',
            progress: 100
        },
        'cancelled': {
            text: 'Cancelled',
            color: 'var(--danger)',
            icon: 'fa-times-circle',
            progress: 0
        }
    };

    return configs[status] || configs.pending;
}

// Render order progress tracker
function renderOrderProgress(status) {
    const steps = [
        { id: 'pending', label: 'Ordered', icon: 'fa-shopping-cart' },
        { id: 'processing', label: 'Processing', icon: 'fa-cog' },
        { id: 'shipped', label: 'Shipped', icon: 'fa-shipping-fast' },
        { id: 'delivered', label: 'Delivered', icon: 'fa-check-circle' }
    ];

    const currentIndex = steps.findIndex(step => step.id === status);

    let html = `
        <div style="margin: 20px 0;">
            <p style="margin: 0 0 15px 0; color: var(--gray); font-size: 0.9rem;">
                <i class="fas fa-map-marker-alt"></i> Order Status
            </p>
            <div class="order-progress-tracker">
    `;

    steps.forEach((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        html += `
            <div class="progress-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
                <div class="step-icon">
                    <i class="fas ${step.icon}"></i>
                </div>
                <div class="step-label">${step.label}</div>
            </div>
            ${index < steps.length - 1 ? '<div class="progress-line"></div>' : ''}
        `;
    });

    html += `
            </div>
            <div style="margin-top: 10px; font-size: 0.85rem; color: var(--gray); text-align: center;">
                ${getStatusMessage(status)}
            </div>
        </div>
    `;

    return html;
}

// Get status message
function getStatusMessage(status) {
    const messages = {
        'pending': 'Your order has been received and is awaiting processing.',
        'processing': 'The store is preparing your order for shipment.',
        'shipped': 'Your order is on the way! Track your package with the vendor.',
        'delivered': 'Your order has been delivered successfully.',
        'cancelled': 'This order has been cancelled.'
    };
    return messages[status] || messages.pending;
}

// Set up real-time listeners for order status updates
function setupOrderStatusListeners(customerId) {
    // Listen for order status changes
    db.collection('orders')
        .where('customerId', '==', customerId)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    // Update the specific order card
                    const orderData = change.doc.data();
                    updateOrderCardUI(change.doc.id, orderData);

                    // Show notification for status changes
                    if (orderData.status === 'shipped') {
                        showNotification(`🚚 Order ${orderData.orderId?.substring(0, 8) || ''} has been shipped!`);
                    } else if (orderData.status === 'delivered') {
                        showNotification(`✅ Order ${orderData.orderId?.substring(0, 8) || ''} has been delivered!`);
                    }
                }
            });
        });
}

// Update order card UI when status changes
function updateOrderCardUI(orderId, orderData) {
    const orderCards = document.querySelectorAll(`.order-card[data-order-id="${orderId}"]`);
    if (!orderCards || orderCards.length === 0) return;

    orderCards.forEach(orderCard => {
        const statusConfig = getStatusConfig(orderData.status);

        // Update status badge
        const statusBadge = orderCard.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.innerHTML = `<i class="fas ${statusConfig.icon}"></i> ${statusConfig.text}`;
            statusBadge.style.background = statusConfig.color;
        }

        // Update progress tracker
        const progressSection = orderCard.querySelector('.order-body');
        if (progressSection) {
            const oldProgress = progressSection.querySelector('.order-progress-tracker');
            if (oldProgress && oldProgress.parentNode) {
                const newProgress = renderOrderProgress(orderData.status);
                oldProgress.parentNode.innerHTML = newProgress;
            }
        }

        // Update actions
        const footer = orderCard.querySelector('.order-footer');
        if (footer) {
            const actionButtons = footer.querySelector('div:last-child');
            if (actionButtons) {
                let newButtons = `
                    <button onclick="viewOrderDetailsCustomer('${orderId}')" class="btn btn-outline btn-sm">
                        <i class="fas fa-eye"></i> Details
                    </button>
                `;

                if (orderData.status === 'shipped') {
                    newButtons += `
                        <button onclick="markAsDelivered('${orderId}')" class="btn btn-success btn-sm">
                            <i class="fas fa-check"></i> Received
                        </button>
                    `;
                }

                actionButtons.innerHTML = newButtons;
            }
        }
    });
}

// Filter orders by status
function filterOrders(status, btnElement) {
    // Visual toggle for buttons
    if (btnElement) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const cards = document.querySelectorAll('.clean-order-card');
    cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// View order details for customer
async function viewOrderDetailsCustomer(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            showNotification('Order not found.');
            return;
        }

        const orderData = orderDoc.data();
        showOrderDetailsModal(orderData);

    } catch (error) {
        console.error('Error fetching order details:', error);
        showNotification('Error loading order details.');
    }
}

// Show order details modal
function showOrderDetailsModal(orderData) {
    const modal = document.getElementById('order-details-modal');
    const content = document.getElementById('order-details-content');

    if (!modal || !content) return;

    const orderDate = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date();
    const statusConfig = getStatusConfig(orderData.status);

    // Build items table
    let itemsHtml = '';
    orderData.items?.forEach((item, index) => {
        itemsHtml += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price, item.currency || 'GHS')}</td>
                <td>${formatCurrency(item.price * item.quantity, item.currency || 'GHS')}</td>
            </tr>
        `;
    });

    content.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 25px; max-width: 800px; margin: 0 auto;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #f1f5f9;">
                <div>
                    <h2 style="margin: 0 0 5px 0; color: var(--dark);">Order Details</h2>
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">
                        <i class="fas fa-calendar"></i> ${orderDate.toLocaleDateString()} 
                        <i class="fas fa-clock" style="margin-left: 15px;"></i> ${orderDate.toLocaleTimeString()}
                    </p>
                </div>
                <span class="status-badge" style="background: ${statusConfig.color}; color: white; padding: 8px 16px; font-size: 0.9rem;">
                    <i class="fas ${statusConfig.icon}"></i> ${statusConfig.text}
                </span>
            </div>
            
            <!-- Order Info -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--dark); font-size: 1rem;">
                        <i class="fas fa-store"></i> Store Information
                    </h4>
                    <p style="margin: 0 0 5px 0; color: var(--dark); font-weight: 600;">${orderData.storeName}</p>
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Store ID: ${orderData.storeId}</p>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--dark); font-size: 1rem;">
                        <i class="fas fa-user"></i> Customer Information
                    </h4>
                    <p style="margin: 0 0 5px 0; color: var(--dark); font-weight: 600;">${orderData.customerName}</p>
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">
                        <i class="fas fa-phone"></i> ${orderData.customerPhone || 'N/A'}
                    </p>
                    <p style="margin: 5px 0 0 0; color: var(--gray); font-size: 0.9rem;">
                        <i class="fas fa-envelope"></i> ${orderData.customerEmail}
                    </p>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--dark); font-size: 1rem;">
                        <i class="fas fa-map-marker-alt"></i> Shipping Address
                    </h4>
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem; white-space: pre-line;">${orderData.shippingAddress}</p>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--dark); font-size: 1rem;">
                        <i class="fas fa-credit-card"></i> Payment Method
                    </h4>
                    <p style="margin: 0; color: var(--dark); font-weight: 600; text-transform: capitalize;">${orderData.paymentMethod === 'cod' ? 'Cash on Delivery' : orderData.paymentMethod || 'Not Specified'}</p>
                </div>
            </div>
            
            <!-- Order Progress -->
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 15px 0; color: var(--dark); font-size: 1rem;">
                    <i class="fas fa-shipping-fast"></i> Order Tracking
                </h4>
                ${renderOrderProgress(orderData.status)}
            </div>
            
            <!-- Order Items -->
            <div style="margin-bottom: 30px;">
                <h4 style="margin: 0 0 15px 0; color: var(--dark); font-size: 1rem;">
                    <i class="fas fa-box"></i> Order Items
                </h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 12px; text-align: left;">#</th>
                                <th style="padding: 12px; text-align: left;">Product</th>
                                <th style="padding: 12px; text-align: left;">Quantity</th>
                                <th style="padding: 12px; text-align: left;">Price</th>
                                <th style="padding: 12px; text-align: left;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #e2e8f0;">
                                <td colspan="4" style="padding: 12px; text-align: right;">Total:</td>
                                <td style="padding: 12px; color: var(--success);">${formatCurrency(orderData.total, orderData.currency || 'GHS')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 15px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <button onclick="closeOrderDetailsModal()" class="btn btn-outline">
                    Close
                </button>
                ${orderData.status === 'shipped' ? `
                    <button onclick="markAsDelivered('${orderData.orderId || orderData.id}')" class="btn btn-success">
                        <i class="fas fa-check"></i> Mark as Delivered
                    </button>
                ` : ''}
                ${''}
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('order-details-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function printOrderDetails() {
    const printContent = document.getElementById('order-details-content').innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;

    // Re-initialize the page
    location.reload();
}

// Mark order as delivered (customer confirms receipt)
async function markAsDelivered(orderId) {
    if (!confirm('Have you received this order? This will mark it as delivered.')) {
        return;
    }

    try {
        await db.collection('orders').doc(orderId).update({
            status: 'delivered',
            deliveredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('✅ Order marked as delivered! Thank you for confirming.');

    } catch (error) {
        console.error('Error marking order as delivered:', error);
        showNotification('Error updating order status.');
    }
}

// Review feature removed — function deleted

// Update order status (vendor function)
async function updateOrderStatus(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) return;

        const currentStatus = orderDoc.data().status;
        const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const currentIndex = statuses.indexOf(currentStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        if (confirm(`Change order status from "${currentStatus}" to "${nextStatus}"?`)) {
            const updateData = { status: nextStatus };

            // Add timestamp for status change
            if (nextStatus === 'shipped') {
                updateData.shippedAt = firebase.firestore.FieldValue.serverTimestamp();
            } else if (nextStatus === 'delivered') {
                updateData.deliveredAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await db.collection('orders').doc(orderId).update(updateData);
            showNotification(`✅ Order status updated to "${nextStatus}"`);

            // Send status update email to customer
            const orderData = orderDoc.data();
            if (orderData.customerEmail) {
                sendOrderStatusUpdateEmail(orderData.customerEmail, orderData.customerName,
                    orderData.orderId || orderId, nextStatus, orderData.storeName);
            }
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('❌ Error updating order status');
    }
}

// Toggle cart sidebar visibility
function toggleCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    const backdrop = document.getElementById('cart-sidebar-backdrop');

    if (!sidebar || !backdrop) return;

    const isOpen = sidebar.style.right === '0px';

    if (isOpen) {
        // Close sidebar
        sidebar.style.right = '-400px';
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    } else {
        // Open sidebar and populate content
        renderCartSidebar();
        sidebar.style.right = '0px';
        backdrop.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Render cart sidebar content
// Render cart sidebar content
function renderCartSidebar() {
    const container = document.getElementById('cart-sidebar-content');
    if (!container) return;

    if (Object.keys(shoppingCart).length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h4 style="margin-bottom: 15px; color: var(--dark);">Your cart is empty</h4>
                    <p style="color: var(--gray); margin-bottom: 30px;">Add some products to get started!</p>
                    <button onclick="toggleCartSidebar(); navigateTo('customer')" class="btn btn-primary">
                        <i class="fas fa-store"></i> Browse Products
                    </button>
                </div>
        `;
        return;
    }

    let html = '';
    let totalItems = 0;
    let grandTotal = 0;
    let globalCurrency = 'GHS'; // Default

    // Process each store
    for (const storeId in shoppingCart) {
        const storeCart = shoppingCart[storeId];
        const storeTotal = getStoreCartTotal(storeId);

        totalItems += storeTotal.itemCount;
        grandTotal += storeTotal.subtotal;

        // Detect currency from first item
        const firstItemKey = Object.keys(storeCart)[0];
        // CHANGED: Default fallback changed from 'USD' to 'GHS'
        const storeCurrency = firstItemKey ? (storeCart[firstItemKey].currency || 'GHS') : 'GHS';
        globalCurrency = storeCurrency;

        // Fetch store name placeholder or from cache if available
        let storeName = 'Store ' + storeId.substring(0, 3);
        // (Note: In sidebar we often skip async fetch for speed, or you can implement caching)

        html += `
            <div class="sidebar-store-section" style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 10px 0; color: var(--primary); font-size: 1rem;">
                    <i class="fas fa-store"></i> ${storeName}
                </h4>
        `;

        // Products in this store
        const productIds = Object.keys(storeCart);
        const displayProducts = productIds.slice(0, 3);

        displayProducts.forEach(productId => {
            const item = storeCart[productId];
            const itemTotal = item.price * item.quantity;
            const itemCurrency = item.currency || 'GHS';

            html += `
                <div class="sidebar-cart-item" style="display: flex; gap: 10px; margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 8px;">
                    <div style="width: 50px; height: 50px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` : `<i class="fas fa-box" style="font-size: 1.5rem; color: var(--gray);"></i>`}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h5 style="margin: 0 0 3px 0; font-size: 0.9rem; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--gray);">Qty: ${item.quantity}</p>
                        <p style="margin: 2px 0 0 0; font-weight: 600; color: var(--primary); font-size: 0.9rem;">${formatCurrency(itemTotal, itemCurrency)}</p>
                    </div>
                    <button onclick="removeFromCart('${productId}', '${storeId}'); renderCartSidebar();" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.2rem; flex-shrink: 0;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        if (productIds.length > 3) {
            html += `
                <p style="font-size: 0.8rem; color: var(--gray); margin: 10px 0;">And ${productIds.length - 3} more items...</p>
            `;
        }

        html += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                    <span style="font-weight: 600; color: var(--dark);">${storeTotal.itemCount} items</span>
                    <span style="font-weight: 600; color: var(--primary);">${formatCurrency(storeTotal.subtotal, storeCurrency)}</span>
                </div>
            </div>
        `;
    }

    // Footer with totals and actions
    html += `
        <div style="position: absolute; bottom: 20px; left: 20px; right: 20px;">
            <div style="background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span>Total Items:</span>
                    <span style="font-weight: 600;">${totalItems}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Grand Total:</span>
                    <span style="font-size: 1.2rem; font-weight: 700;">${formatCurrency(grandTotal, globalCurrency)}</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="toggleCartSidebar(); navigateTo('cart')" class="btn btn-outline" style="flex: 1;">
                    <i class="fas fa-eye"></i> View Full Cart
                </button>
                <button onclick="checkoutCart()" class="btn btn-primary" style="flex: 1;">
                    <i class="fas fa-credit-card"></i> Checkout
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

const DEVELOPER_CREDENTIALS = {
    username: 'michaelanang',
    password: 'sexy@1905'
};
let developerAuthenticated = false;





// --- Load Store URL Tab ---
async function loadStoreUrlTab() {
    if (!currentStoreData) return;

    const container = document.getElementById('admin-store-url-content');
    if (!container) return;

    const storeUrl = generateStoreUrl(currentStoreData.slug);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(storeUrl)}`;

    container.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 20px; color: var(--dark);">
                <i class="fas fa-link"></i> Your Store URL
            </h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <!-- Left Column: URL Info -->
                <div>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--dark);">Store Link</h4>
                        <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            <code style="font-family: monospace; font-size: 1rem; color: var(--primary); word-break: break-all;">${storeUrl}</code>
                        </div>
                        <p style="color: var(--gray); font-size: 0.9rem; margin: 0;">
                            Share this link with your customers. They can click it to visit your store directly.
                        </p>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--dark);">Quick Actions</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <button onclick="copyStoreUrl()" id="copy-store-url-btn" class="btn btn-primary" style="padding: 12px;">
                                <i class="fas fa-copy"></i> Copy URL
                            </button>
                            <button onclick="shareStoreUrl()" class="btn btn-outline" style="padding: 12px;">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 15px 0; color: var(--dark);">Sharing Tips</h4>
                        <ul style="color: var(--gray); padding-left: 20px; margin: 0;">
                            <li>Add to your social media profiles</li>
                            <li>Include in your email signature</li>
                            <li>Share with friends and family</li>
                            <li>Print QR code for physical stores</li>
                            <li>Add to business cards</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Right Column: QR Code -->
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="background: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; width: 100%;">
                        <h4 style="margin: 0 0 20px 0; color: var(--dark);">QR Code</h4>
                        <img src="${qrCodeUrl}" alt="Store QR Code" style="width: 200px; height: 200px; margin-bottom: 20px; border-radius: 8px; background: white; padding: 10px;">
                        <p style="color: var(--gray); font-size: 0.9rem; margin: 0;">
                            Scan this QR code to visit your store
                        </p>
                    </div>
                    
                    <div style="margin-top: 25px; width: 100%;">
                        <a href="${qrCodeUrl}" download="store-qr-code.png" class="btn btn-outline" style="width: 100%; padding: 12px;">
                            <i class="fas fa-download"></i> Download QR Code
                        </a>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 15px 0; color: var(--dark);">Track Your Store Visits</h4>
                <p style="color: var(--gray); margin: 0;">
                    Share your store URL and track visits in your dashboard. More analytics coming soon!
                </p>
            </div>
        </div>
    `;
}

// --- Handle store URL parameters ---
function checkUrlForStore() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeSlug = urlParams.get('store');

    if (storeSlug) {
        // Navigate to the specific store
        loadStoreDetail(storeSlug);
        navigateTo('store-detail', storeSlug);
        return true;
    }
    return false;
}

// --- 3. NAVIGATION SYSTEM ---
// --- 3. NAVIGATION SYSTEM ---
// --- 3. NAVIGATION SYSTEM ---
async function navigateTo(page, param = null) {
    // 1. SAVE LOCATION
    const url = new URL(window.location);
    url.searchParams.set('page', page);

    if (param) {
        url.searchParams.set('store', param);
    } else {
        url.searchParams.delete('store');
    }

    window.history.pushState({ page: page, param: param }, '', url);

    // --- NEW: UPDATE BROWSER TITLE ---
    const pageTitles = {
        'home': 'Home | MarketSpace',
        'stores': 'All Stores | MarketSpace',
        'products': 'All Products | MarketSpace',
        'deals': 'Hot Deals | MarketSpace',
        'cart': 'Shopping Cart | MarketSpace',
        'food': 'Food Court | MarketSpace',
        'login': 'Login / Sign Up | MarketSpace',
        'register-store': 'Open Your Store | MarketSpace',
        'store-admin': 'Vendor Dashboard | MarketSpace',
        'developer': 'Developer Admin | MarketSpace',
        'customer-orders': 'My Orders | MarketSpace',
        'customer': 'Customer Dashboard | MarketSpace',
        'market-stores': 'Browse Stores | MarketSpace',
        'store-detail': 'Store | MarketSpace', // Will be updated by loadStoreDetail
        'store-public': 'Store | MarketSpace'  // Will be updated by loadStorePublic
    };

    if (pageTitles[page]) {
        document.title = pageTitles[page];
    }
    // ---------------------------------

    // --- NEW: UPDATE ACTIVE NAV LINK ---
    updateActiveNav(page);
    // -----------------------------------

    // 2. CHECK PERMISSIONS
    if (page === 'store-admin' && userRole !== 'vendor') {
        showNotification('Access Denied: Vendors only.');
        return;
    }
    if (page === 'developer' && userRole !== 'developer') {
        showNotification('Access Denied: Developers only.');
        return;
    }
    if (page === 'developer' && userRole === 'developer' && !developerAuthenticated) {
        showDeveloperAuth();
        return;
    }
    if (page === 'customer' && userRole !== 'customer') {
        showNotification('Access Denied: Customers only.');
        return;
    }

    // 3. UPDATE UI
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(page + '-page');

    if (pageEl) {
        pageEl.classList.add('active');
        window.scrollTo(0, 0);

        if (page === 'store-detail' && param) loadStoreDetail(param);
        if (page === 'stores') loadStoresList();
        if (page === 'products') loadAmazonProducts();
        if (page === 'developer') loadDevStats();
        if (page === 'customer') loadCustomerDashboard();
        if (page === 'market-stores') loadMarketStores();
        if (page === 'cart') renderCartPage();
        if (page === 'customer-orders') loadCustomerOrders();
        if (page === 'food') loadFoodProducts();

        if (page === 'store-admin') {
            const headerInfo = document.getElementById('admin-header-info');
            if (currentUser && headerInfo) {
                headerInfo.innerHTML = `
                    <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                        <i class="fas fa-user"></i> ${currentUser.displayName || 'Store Owner'}
                    </span>
                `;
            }
            loadVendorDashboard();
        }
        if (page === 'store-public' && param) {
            loadStorePublic(param);
        }
    }
}

function updateActiveNav(currentPage) {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkPage = link.getAttribute('onclick')?.match(/navigateTo\('([^']+)'\)/)?.[1];
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

// --- 4. AUTHENTICATION LOGIC ---

auth.onAuthStateChanged(async (user) => {
    const authBtns = document.getElementById('auth-buttons');
    const heroSigninBtn = document.getElementById('hero-signin-btn'); // Get the hero button

    if (user) {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            userRole = userData.role;

            // Update hero button for logged-in users
            if (heroSigninBtn) {
                if (userRole === 'customer') {
                    heroSigninBtn.innerHTML = '<i class="fas fa-rocket"></i> Let\'s Go';
                    heroSigninBtn.onclick = function () { navigateTo('products'); };
                } else {
                    // For non-customers, show appropriate text
                    heroSigninBtn.innerHTML = '<i class="fas fa-store"></i> Go to Dashboard';
                    heroSigninBtn.onclick = function () {
                        if (userRole === 'vendor') navigateTo('store-admin');
                        else if (userRole === 'developer') navigateTo('developer');
                        else navigateTo('home');
                    };
                }
            }

            let dashboardLink = '';
            if (userRole === 'vendor') {
                dashboardLink = `<a onclick="navigateTo('store-admin')" class="btn btn-warning"><i class="fas fa-store"></i> Vendor Panel</a>`;
            } else if (userRole === 'developer') {
                dashboardLink = `<a onclick="navigateTo('developer')" class="btn btn-warning"><i class="fas fa-code"></i> Admin Panel</a>`;
            } else if (userRole === 'customer') {
                dashboardLink = `<a onclick="navigateTo('products')" class="btn btn-warning"><i class="fas fa-shopping-bag"></i> Start Shopping Now</a>`;
            }

            if (authBtns) {
                authBtns.innerHTML = `
                        <span class="user-badge"><i class="fas fa-user"></i> ${userData.name || 'User'}</span>
                        ${dashboardLink}
                        <button onclick="logoutUser()" class="btn btn-outline" style="border:1px solid #ccc; color: #333;">Logout</button>
                    `;
            }

            if (userRole === 'vendor') {
                const storeQuery = await db.collection('stores').where('ownerId', '==', user.uid).get();
                if (!storeQuery.empty) {
                    currentStoreData = storeQuery.docs[0].data();
                    currentStoreData.docId = storeQuery.docs[0].id;
                }
            }
            const activePage = document.querySelector('.page.active');
            if (activePage && activePage.id === 'store-detail-page') {
                const urlParams = new URLSearchParams(window.location.search);
                const storeSlug = urlParams.get('store');
                if (storeSlug) {
                    console.log('User authenticated, reloading store detail...');
                    loadStoreDetail(storeSlug);
                }
            }

            // Initialize cart for logged-in customers
            initializeCart();

            // Update floating chat button
            updateFloatingChatButton();

            // --- RESTORE PAGE AFTER LOGIN ---
            const urlParams = new URLSearchParams(window.location.search);
            const pageParam = urlParams.get('page');
            const storeParam = urlParams.get('store');

            if (pageParam) {
                const activePage = document.querySelector('.page.active');

                // 1. If we aren't on the correct page yet, navigate to it
                if (!activePage || activePage.id !== pageParam + '-page') {
                    navigateTo(pageParam, storeParam);
                }
                // 2. IMPORTANT FIX: If we ARE on the page, but data is missing (because of refresh),
                // we must reload the specific page data now that we are logged in.
                else {
                    if (pageParam === 'customer-orders') loadCustomerOrders();
                    if (pageParam === 'cart') renderCartPage();
                    if (pageParam === 'store-admin') loadVendorDashboard();
                    if (pageParam === 'customer') loadCustomerDashboard();
                    if (pageParam === 'developer') loadDevStats();
                }
            }
        }
    } else {
        currentUser = null;
        userRole = null;
        currentStoreData = null;
        shoppingCart = {};
        updateCartUI();

        // Update floating chat button
        updateFloatingChatButton();

        // Reset hero button to original state when logged out
        if (heroSigninBtn) {
            heroSigninBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In Customer';
            heroSigninBtn.onclick = function () { navigateTo('login'); };
        }

        if (authBtns) {
            authBtns.innerHTML = `
            <a onclick="navigateTo('login')" class="btn btn-outline">
                <i class="fas fa-sign-in-alt"></i> Sign In
            </a>
            <a onclick="navigateTo('register-store')" class="btn btn-primary">
                <i class="fas fa-store-alt"></i> Open Store
            </a>
        `;
        }
    }
});

// --- 5. AUTHENTICATION FORMS ---

// Login Function
document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .then(async (cred) => {
            // Get user role from database before redirecting
            const userDoc = await db.collection('users').doc(cred.user.uid).get();
            const userData = userDoc.data();
            const userRoleAtLogin = userData ? userData.role : null;

            showNotification('Login Successful!');
            setTimeout(() => {
                if (userRoleAtLogin === 'vendor') navigateTo('store-admin');
                else if (userRoleAtLogin === 'developer') navigateTo('developer');
                else if (userRoleAtLogin === 'customer') navigateTo('products'); // Changed from 'customer-orders' to 'products'
                else navigateTo('home');
            }, 500);
        })
        .catch((error) => showNotification(error.message));
});
// Customer / Developer / Vendor Signup Function
document.getElementById('signup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    // --- NEW: Terms Validation ---
    const termsCheckbox = document.getElementById('reg-customer-terms');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showNotification('⚠️ You must agree to the Terms of Service to create an account.');
        return;
    }
    // -----------------------------

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
            // Create user account
            return db.collection('users').doc(cred.user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            showNotification('Account Created! Welcome.');

            // Set global variables immediately for the session
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
// Vendor (Store) Registration Function
document.getElementById('store-registration-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    // --- NEW: Terms Validation ---
    const termsCheckbox = document.getElementById('reg-store-terms');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showNotification('⚠️ You must agree to the Terms of Service to create a store.');
        return;
    }
    // -----------------------------

    const storeName = document.getElementById('reg-store-name').value;
    const slug = document.getElementById('reg-store-url').value;
    let categoryEl = document.getElementById('reg-store-category');
    let category = categoryEl.value;
    if (category === 'other') {
        const otherVal = document.getElementById('reg-store-category-other')?.value?.trim();
        if (otherVal) category = otherVal;
    }
    const email = document.getElementById('reg-store-email').value;
    const pass = document.getElementById('reg-store-password').value;
    // ADD LOCATION FIELD
    const storeLocation = document.getElementById('reg-store-location')?.value || '';

    // Basic validation
    if (pass.length < 6) {
        showNotification('Password must be at least 6 characters long.');
        return;
    }

    // Show loading state
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
            // Send Web3 email notification to developer
            const ownerName = storeName + " Owner";
            await sendApprovalNotification(storeName, ownerName, email, slug);

            showNotification('Store Created! Approval notification sent to admin. Awaiting Admin Approval.');
            setTimeout(() => {
                navigateTo('home');
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = 'An error occurred during store registration.';
            if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please use a different email.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection and try again.';
            }
            showNotification(errorMessage);
        })
        .finally(() => {
            // Reset button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
});

// Toggle display of 'Other' category input
function toggleCategoryOther(selectEl) {
    // Try both registration and settings forms
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

function logoutUser() {
    auth.signOut().then(() => {
        showNotification('Logged out successfully');
        navigateTo('home');
    });
}

// --- Mobile Drawer Controls ---// ... existing code ...
function updateMobileDrawer() {
    const mobileUserInfo = document.getElementById('mobile-user-info');
    const mobileUserActions = document.getElementById('mobile-user-actions');
    const authButtons = document.getElementById('auth-buttons');
    const mobileNavLinks = document.querySelector('#mobile-drawer .mobile-nav-links'); // Get nav container

    if (mobileUserInfo && mobileUserActions && authButtons) {
        mobileUserInfo.innerHTML = '';
        mobileUserActions.innerHTML = '';

        const userBadge = authButtons.querySelector('.user-badge');

        if (userBadge) {
            // User is Logged In: Clone badge to top container
            const badgeClone = userBadge.cloneNode(true);
            mobileUserInfo.appendChild(badgeClone);
        }
        const existingVendorLinks = mobileNavLinks.querySelectorAll('.vendor-drawer-link');
        existingVendorLinks.forEach(el => el.remove());

        if (userRole === 'vendor') {
            // Create Settings Link
            const settingsLink = document.createElement('a');
            settingsLink.className = 'vendor-drawer-link'; // Class for identification
            settingsLink.innerHTML = '<i class="fas fa-cog"></i> Store Settings';
            settingsLink.onclick = () => {
                closeMobileDrawer();
                navigateTo('store-admin');
                // Allow page switch time then switch tab
                setTimeout(() => showAdminTab('settings'), 50);
            };

            // Create Receipt Link
            const receiptLink = document.createElement('a');
            receiptLink.className = 'vendor-drawer-link';
            receiptLink.innerHTML = '<i class="fas fa-receipt"></i> Receipt Generator';
            receiptLink.onclick = () => {
                closeMobileDrawer();
                navigateTo('store-admin');
                setTimeout(() => showAdminTab('receipt'), 50);
            };

            // Append to the navigation list
            mobileNavLinks.appendChild(settingsLink);
            mobileNavLinks.appendChild(receiptLink);
        }
        // We select all links and buttons from auth-buttons
        const buttons = authButtons.querySelectorAll('a, button');

        buttons.forEach(btn => {
            const btnClone = btn.cloneNode(true);

            // Add close drawer logic to clicks
            const originalOnclick = btnClone.getAttribute('onclick');
            if (originalOnclick) {
                btnClone.setAttribute('onclick', `closeMobileDrawer(); ${originalOnclick}`);
            }

            mobileUserActions.appendChild(btnClone);
        });
    }
}
function openMobileDrawer() {
    updateMobileDrawer(); // Update content before opening
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (drawer && backdrop) {
        drawer.classList.add('open');
        backdrop.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.setAttribute('aria-hidden', 'false');
        // prevent body scroll while open
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (drawer && backdrop) {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

function toggleMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    if (!drawer) return;
    if (drawer.classList.contains('open')) closeMobileDrawer();
    else openMobileDrawer();
}

// Close mobile drawer on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileDrawer();
});

// --- 6. UI HELPER FUNCTIONS ---

// Switch between Login and Signup tabs
function switchAuthTab(tab) {
    const loginView = document.getElementById('auth-login-view');
    const signupView = document.getElementById('auth-signup-view');
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        loginView.style.display = 'block';
        signupView.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginView.style.display = 'none';
        signupView.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

// Developer Authentication Functions
function showDeveloperAuth() {
    const modal = document.getElementById('dev-auth-modal');
    modal.style.display = 'flex';
    document.getElementById('dev-username').focus();
}

function closeDeveloperAuth() {
    const modal = document.getElementById('dev-auth-modal');
    modal.style.display = 'none';
    document.getElementById('dev-auth-form').reset();
}

document.getElementById('dev-auth-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('dev-username').value;
    const password = document.getElementById('dev-password').value;

    if (username === DEVELOPER_CREDENTIALS.username && password === DEVELOPER_CREDENTIALS.password) {
        developerAuthenticated = true;
        closeDeveloperAuth();
        showNotification('Developer access granted!');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById('developer-page');
        if (pageEl) {
            pageEl.classList.add('active');
            window.scrollTo(0, 0);
            loadDevStats();
        }
    } else {
        showNotification('Invalid developer credentials!');
        document.getElementById('dev-password').value = '';
    }
});

// Theme Selector in Register Form
function selectTheme(color, el) {
    selectedRegTheme = color;
    document.querySelectorAll('.theme-color').forEach(c => c.classList.remove('active'));
    let target = el || (typeof event !== 'undefined' ? event.currentTarget : null) || document.querySelector(`.theme-color[data-theme="${color}"]`);
    if (target) target.classList.add('active');
}

// Notification System
function showNotification(message) {
    const n = document.getElementById('notification');
    document.getElementById('notification-text').textContent = message;
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', 3000);
}

// --- 7. CUSTOMER DASHBOARD ---

async function loadCustomerDashboard() {
    if (userRole !== 'customer') return;

    const container = document.getElementById('customer-products-list');
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading products...</p>';

    try {
        const snapshot = await db.collection('products').limit(8).get();
        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No products available yet.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="product-card">
                    <div class="product-img">
                        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.name}">` : `<i class="fas fa-box"></i>`}
                    </div>
                    <div class="product-content">
                        <div class="product-category">${data.category || 'Uncategorized'}</div>
                        <h3 class="product-name">${data.name}</h3>
                        <div class="product-price">${formatCurrency(data.price, data.currency || 'GHS')}</div>
                        <div class="product-quantity ${data.quantity < 10 ? 'low' : ''}">
                            ${data.quantity} in stock
                        </div>
                        <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="addToCart('${doc.id}', '${data.storeId}', ${JSON.stringify({
                name: data.name,
                price: data.price,
                currency: data.currency || 'GHS',
                category: data.category || 'Uncategorized',
                imageUrl: data.imageUrl || '',
                quantity: data.quantity || 0
            }).replace(/"/g, '&quot;')})">
                            <i class="fas fa-shopping-cart"></i> Add to Cart
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading products.</p>';
    }
}

// --- 8. MARKET STORES PAGE ---

async function loadMarketStores() {
    const container = document.getElementById('market-stores-list');
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading stores...</p>';

    try {
        const snapshot = await db.collection('stores').where('status', '==', 'approved').get();
        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No stores available yet.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const legacyMap = { blue: 'primary', purple: 'secondary', green: 'success' };
            const themeName = legacyMap[data.theme] || data.theme || 'primary';

            // Calculate product count for this store
            const productsCount = data.productCount || Math.floor(Math.random() * 50) + 5;

            html += `
                <div class="store-card">
                    <!-- Featured badge (optional) -->
                    ${data.featured ? `<div class="featured-badge">Featured</div>` : ''}
                    
                    <!-- Store status -->
                    <div class="store-status">
                        <i class="fas fa-store"></i> Open
                    </div>
                    
                    <!-- Store header with theme color or image -->
                    <div class="store-header" style="${data.backgroundImageUrl ?
                    `background: url('${data.backgroundImageUrl}') center/cover no-repeat;` :
                    `background: linear-gradient(135deg, var(--${themeName}), color-mix(in srgb, var(--${themeName}) 80%, black 20%))`}">
                        <div class="store-facade"></div>
                        <div class="store-logo">${data.name.substring(0, 2).toUpperCase()}</div>
                    </div>
                    
                    <!-- Store content -->
                    <div class="store-content">
                        <h3>${data.name}</h3>
                        
                        <div class="store-category">
                            <i class="fas fa-tag"></i> ${data.category}
                        </div>
                        
                        <!-- ADD LOCATION DISPLAY -->
                        ${data.storeLocation ? `
                        <div class="store-location" style="display: flex; align-items: center; gap: 5px; color: var(--gray); font-size: 0.9rem; margin: 5px 0;">
                            <i class="fas fa-map-marker-alt" style="font-size: 0.8rem;"></i>
                            ${data.storeLocation}
                        </div>
                        ` : ''}
                        
                        <div class="store-rating">
                            <div class="stars">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star-half-alt"></i>
                            </div>
                            <span class="count">${data.rating || '4.5'}/5 (${data.reviews || '12'} reviews)</span>
                        </div>
                        
                        <p style="color: var(--gray); font-size: 0.9rem; margin-bottom: 15px;">
                            ${data.description || 'Explore amazing products in this store.'}
                        </p>
                        
                        <div class="store-footer">
                            <div class="store-products">
                                <i class="fas fa-box"></i> ${productsCount} products
                            </div>
                            <a onclick="navigateTo('store-detail', '${doc.id}')" class="store-link">
                                <i class="fas fa-external-link-alt"></i> Visit Store
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading stores.</p>';
    }
}

// --- AMAZON-STYLE PRODUCTS PAGE ---

// --- AMAZON-STYLE PRODUCTS PAGE ---

async function loadAmazonProducts() {
    const container = document.getElementById('amazon-products-grid');
    if (!container) return;

    try {
        const snapshot = await db.collection('products').get();

        if (snapshot.empty) {
            productsListAll = [];
            productsList = [];
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px; color: var(--dark);">No products found</h3>
                    <p style="color: var(--gray);">Check back later for new products!</p>
                </div>
            `;
            const countElement = document.getElementById('products-count');
            if (countElement) countElement.textContent = `0 of 0 products`;
            return;
        }

        productsListAll = snapshot.docs
            .map(doc => ({ id: doc.id, data: doc.data() }))
            .filter(item => {
                const category = (item.data.category || '').toLowerCase();
                // Exclude categories related to food
                return category !== 'food' && category !== 'food & beverages' && category !== 'groceries';
            });

        // Check if list is empty after filtering
        if (productsListAll.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px; color: var(--dark);">No products found</h3>
                    <p style="color: var(--gray);">Check back later for new products!</p>
                </div>
            `;
            const countElement = document.getElementById('products-count');
            if (countElement) countElement.textContent = `0 of 0 products`;
            return;
        }

        // apply current filters and render
        currentProductsPage = 1;
        applyFiltersAndRender();

        // wire up filter input listeners once
        setupProductFilterListeners();
        // apply current filters and render
        currentProductsPage = 1;
        applyFiltersAndRender();

        // wire up filter input listeners once
        setupProductFilterListeners();

    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>Error Loading Products</h3>
                <p>There was a problem loading products. Please try again.</p>
                <button onclick="loadAmazonProducts()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

function buildProductCard(docId, data) {
    const storeId = data.storeId || 'unknown';
    const rating = data.rating || Math.random() * 2 + 3;
    const reviewCount = data.reviews || Math.floor(Math.random() * 1000);
    const originalPrice = (data.price || 0) * (1 + Math.random() * 0.3);
    const savings = originalPrice - (data.price || 0);
    const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

    // Check if item is already in wishlist
    const isInWishlist = wishlist[storeId] && wishlist[storeId][docId];

    // --- NEW: Check if item is in Compare List ---
    // (Ensure compareList is defined at the top of your file as: let compareList = [];)
    const isCompare = typeof compareList !== 'undefined' ? compareList.some(item => item.id === docId) : false;

    // --- NEW: Create Full JSON for Comparison ---
    const productJsonFull = JSON.stringify({
        id: docId,
        ...data
    }).replace(/"/g, '&quot;');

    // Helper to escape JSON for the Add to Cart onclick event
    const productJson = JSON.stringify({
        name: data.name,
        price: data.price,
        currency: data.currency || 'GHS',
        imageUrl: data.imageUrl || '',
        quantity: 1
    }).replace(/"/g, '&quot;');

    return `
        <div class="amazon-product-card">
            
            <label class="compare-checkbox-container" onclick="event.stopPropagation()">
                <input type="checkbox" ${isCompare ? 'checked' : ''} onchange="toggleCompare(this, ${productJsonFull})">
                <span>Compare</span>
            </label>

            ${savings > 0 ? `<div class="product-badge">Save ${savingsPercent}%</div>` : ''}
            
            <div class="wishlist-overlay-btn ${isInWishlist ? 'active' : ''}" 
                 onclick="toggleWishlist(event, '${docId}', '${storeId}', ${productJson})">
                <i class="${isInWishlist ? 'fas' : 'far'} fa-heart"></i>
            </div>

            <div class="amazon-product-img" onclick="navigateToStoreAndHighlight('${storeId}', '${docId}')" style="cursor: pointer;">
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.name}" loading="lazy">` : `<i class="fas fa-box" style="font-size: 3rem; color: var(--gray);"></i>`}
            </div>
            
            <div class="amazon-product-content">
                <h3 class="amazon-product-title" onclick="viewProduct('${docId}')" style="cursor: pointer;">${data.name}</h3>
                
                <div class="amazon-product-rating">
                    <div class="amazon-stars">${'★'.repeat(Math.floor(rating))}${rating % 1 >= 0.5 ? '½' : ''}${'☆'.repeat(5 - Math.ceil(rating))}</div>
                    <span class="amazon-rating-count">(${reviewCount})</span>
                </div>
                
                <div class="amazon-product-price">
                    <span class="amazon-current-price">${formatCurrency(data.price || 0, data.currency || 'GHS')}</span>
                    ${savings > 0 ? `<span class="amazon-original-price">${formatCurrency(originalPrice, data.currency || 'GHS')}</span>` : ''}
                </div>
                
                <div class="amazon-delivery-info">
                    <i class="fas fa-shipping-fast"></i> ${data.quantity > 0 ? 'Free delivery' : 'Out of stock'}
                </div>
                
                <div class="amazon-product-actions">
                    <button class="amazon-buy-now" onclick="navigateTo('store-detail', '${storeId}')">
                        View Store
                    </button>
                    
                    <button class="amazon-cart-icon-btn" title="Add to Cart" onclick="addToCart('${docId}', '${storeId}', ${productJson})">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}
function renderProductsPage(page) {
    const container = document.getElementById('amazon-products-grid');
    if (!container) return;

    // FIX: Use a fixed number of items instead of dynamic calculation
    // 12 is divisible by 2, 3, and 4, making it perfect for all screen sizes
    const itemsPerPage = 12;

    const totalItems = productsList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    // Clamp page to valid range
    page = Math.max(1, Math.min(page, totalPages));
    currentProductsPage = page;

    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalItems);
    const slice = productsList.slice(start, end);

    // Render Products
    if (slice.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No products found.</div>`;
    } else {
        container.innerHTML = slice.map(p => buildProductCard(p.id, p.data)).join('');
    }

    // Update "Showing X of Y products" text
    const countElement = document.getElementById('products-count');
    if (countElement) countElement.textContent = `${start + 1}-${end} of ${totalItems} products`;

    // Render Page Numbers (Max 5 buttons to prevent overcrowding)
    const pageNumbersEl = document.querySelector('.page-numbers');
    if (pageNumbersEl) {
        pageNumbersEl.innerHTML = '';

        // Simple logic to show a window of pages
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        // Adjust start if we are near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === page ? ' active' : '');
            span.textContent = i;
            span.style.cursor = 'pointer';
            span.onclick = () => {
                renderProductsPage(i);
                // Scroll back to top of products when changing page
                document.querySelector('.products-header').scrollIntoView({ behavior: 'smooth' });
            };
            pageNumbersEl.appendChild(span);
        }
    }

    // Update Prev/Next Button States
    const prevBtn = document.querySelector('.products-pagination .page-btn:first-of-type');
    const nextBtn = document.querySelector('.products-pagination .page-btn:last-of-type');

    if (prevBtn) {
        prevBtn.classList.toggle('disabled', page <= 1);
        prevBtn.onclick = page <= 1 ? null : () => prevPage();
    }

    if (nextBtn) {
        nextBtn.classList.toggle('disabled', page >= totalPages);
        nextBtn.onclick = page >= totalPages ? null : () => nextPage();
    }
}
// --- View Product Details (New Modal Implementation) ---
// --- View Product Details with Reviews ---
async function viewProduct(productId) {
    const modal = document.getElementById('product-detail-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset content to loading
    document.getElementById('pd-title').textContent = 'Loading...';
    document.getElementById('pd-description').textContent = '';
    document.getElementById('pd-image').src = '';
    document.getElementById('pd-price').textContent = '';
    document.getElementById('pd-actions').innerHTML = '';

    // Clear previous reviews section if it exists (dynamic injection)
    const existingReviews = document.getElementById('pd-reviews-container');
    if (existingReviews) existingReviews.remove();

    try {
        const doc = await db.collection('products').doc(productId).get();

        if (!doc.exists) {
            closeProductDetailModal();
            showNotification('Product not found');
            return;
        }

        const data = doc.data();
        const storeId = data.storeId;
        const currency = data.currency || 'GHS';

        // Populate Basic Info
        document.getElementById('pd-title').textContent = data.name;
        document.getElementById('pd-description').textContent = data.description || 'No description available.';
        document.getElementById('pd-category').textContent = data.category || 'General';
        document.getElementById('pd-price').textContent = formatCurrency(data.price, currency);

        const imgEl = document.getElementById('pd-image');
        if (data.imageUrl) {
            imgEl.src = data.imageUrl;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }

        // Stock Badge Logic
        const stockEl = document.getElementById('pd-stock-badge');
        if (data.quantity > 0) {
            stockEl.textContent = 'In Stock';
            stockEl.style.background = '#dcfce7';
            stockEl.style.color = '#166534';
        } else {
            stockEl.textContent = 'Out of Stock';
            stockEl.style.background = '#fee2e2';
            stockEl.style.color = '#991b1b';
        }

        // Generate Action Buttons
        const actionsContainer = document.getElementById('pd-actions');
        if (currentUser && userRole === 'customer') {
            actionsContainer.innerHTML = `
                <button onclick="addToCart('${productId}', '${storeId}', ${JSON.stringify({
                name: data.name, price: data.price, currency: currency, category: data.category,
                imageUrl: data.imageUrl || '', quantity: data.quantity
            }).replace(/"/g, '&quot;')}); closeProductDetailModal()" 
                class="btn btn-primary" style="flex: 1; padding: 12px;">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
                <button onclick="closeProductDetailModal(); startChatWithVendor('${data.vendorId}', 'Store', '${storeId}', '${productId}', '${data.name.replace(/'/g, "\\'")}')" 
                class="btn btn-outline" style="flex: 1; padding: 12px;">
                    <i class="fas fa-comments"></i> Negotiate
                </button>
            `;
        } else if (!currentUser) {
            actionsContainer.innerHTML = `<button onclick="closeProductDetailModal(); navigateTo('login')" class="btn btn-primary" style="width: 100%;">Log in to Buy</button>`;
        } else {
            actionsContainer.innerHTML = `<button onclick="closeProductDetailModal()" class="btn btn-outline" style="width: 100%;">Close Preview</button>`;
        }

        // --- INJECT REVIEW SECTION ---
        const infoSection = document.querySelector('.pd-info-section');

        const reviewsHTML = `
            <div id="pd-reviews-container" class="reviews-section">
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <div class="reviews-header">
                    <h3>Customer Reviews</h3>
                    <div class="average-rating">
                        <span class="stars" style="color:#ffa41c;">${'★'.repeat(Math.round(data.rating || 0))}${'☆'.repeat(5 - Math.round(data.rating || 0))}</span>
                        <span class="rating-text">${(data.rating || 0).toFixed(1)} out of 5</span>
                        <span class="review-count">(${data.reviews || 0} reviews)</span>
                    </div>
                </div>

                <div id="reviews-list" class="reviews-list">
                    <p class="loading-text">Loading reviews...</p>
                </div>

                ${currentUser && userRole === 'customer' ? `
                <div class="write-review-box">
                    <h4>Write a Review</h4>
                    <form id="review-form" onsubmit="submitProductReview(event, '${productId}', '${storeId}')">
                        <div class="star-rating-input">
                            <input type="radio" id="star5" name="rating" value="5" /><label for="star5" title="5 stars">★</label>
                            <input type="radio" id="star4" name="rating" value="4" /><label for="star4" title="4 stars">★</label>
                            <input type="radio" id="star3" name="rating" value="3" /><label for="star3" title="3 stars">★</label>
                            <input type="radio" id="star2" name="rating" value="2" /><label for="star2" title="2 stars">★</label>
                            <input type="radio" id="star1" name="rating" value="1" /><label for="star1" title="1 star">★</label>
                        </div>
                        <textarea id="review-comment" class="form-control" rows="3" placeholder="Share your thoughts about this product..." required></textarea>
                        <button type="submit" class="btn btn-primary btn-sm" style="margin-top:10px;">Submit Review</button>
                    </form>
                </div>
                ` : currentUser ? '' : '<div class="login-prompt"><a onclick="closeProductDetailModal(); navigateTo(\'login\')">Log in</a> to write a review.</div>'}
            </div>
        `;

        infoSection.insertAdjacentHTML('beforeend', reviewsHTML);

        // Load the actual reviews
        loadReviewsForProduct(productId);

    } catch (error) {
        console.error('Error viewing product:', error);
        closeProductDetailModal();
        showNotification('Error loading product details');
    }
}
function closeProductDetailModal() {
    const modal = document.getElementById('product-detail-modal');
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('product-detail-modal');
    if (e.target === modal) {
        closeProductDetailModal();
    }
});

// [UPDATED] Buy Now function - Adds to cart and opens checkout immediately
function buyNow(productId, storeId, productData) {
    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in as a customer to buy items.');
        navigateTo('login');
        return;
    }

    // 1. Add item to cart
    // We manually add it here to avoid the "Added to cart" notification from the standard function,
    // or we can just reuse addToCart. Let's reuse logic but skip the notification for smoother flow.

    if (!shoppingCart[storeId]) {
        shoppingCart[storeId] = {};
    }

    if (shoppingCart[storeId][productId]) {
        shoppingCart[storeId][productId].quantity += 1;
    } else {
        shoppingCart[storeId][productId] = {
            ...productData,
            quantity: 1
        };
    }

    saveCart();
    updateCartUI();

    // 2. Open Checkout Immediately
    checkoutCart();
}

function sortProducts(sortBy) {
    showNotification(`Sorting by: ${sortBy}`);
    // In a real implementation, this would sort the products
    loadAmazonProducts(); // Reload with sorting
}

function clearFilters() {
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('price-slider').value = 500;
    showNotification('Filters cleared');
    // Re-apply filters (will use full products list)
    applyFiltersAndRender();
}

// Search products by name
function searchProducts(searchTerm) {
    if (!productsListAll || productsListAll.length === 0) {
        loadAmazonProducts();
        return;
    }

    const searchValue = searchTerm.trim().toLowerCase();

    if (!searchValue) {
        // If search is empty, apply current filters
        applyFiltersAndRender();
        return;
    }

    // Filter products by name
    const filtered = productsListAll.filter(p => {
        const productName = (p.data?.name || '').toLowerCase();
        return productName.includes(searchValue);
    });

    productsList = filtered;
    currentProductsPage = 1;
    renderProductsPage(currentProductsPage);
}

// Clear search input and results
// Navigate to store and highlight a specific product
function navigateToStoreAndHighlight(storeId, productId) {
    // Store the product ID to highlight in session storage
    sessionStorage.setItem('highlightProductId', productId);
    // Navigate to the store detail page
    navigateTo('store-detail', storeId);
}

function clearSearch() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.value = '';
    }
    // Re-apply current filters
    applyFiltersAndRender();
    showNotification('Search cleared');
}

// Handle store product search
function handleStoreProductSearch(searchTerm, allProducts) {
    const searchValue = searchTerm.trim().toLowerCase();
    const resultsContainer = document.querySelector('.products-grid');

    if (!resultsContainer) return;

    if (!searchValue) {
        // Show all products
        const cards = resultsContainer.querySelectorAll('.product-card');
        cards.forEach(card => card.style.display = 'block');
        return;
    }

    // Filter and show matching products
    const cards = resultsContainer.querySelectorAll('.product-card');
    let visibleCount = 0;

    cards.forEach((card, index) => {
        const product = allProducts[index];
        if (product && product.name.toLowerCase().includes(searchValue)) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Show message if no results
    if (visibleCount === 0) {
        showNotification(`No products found matching "${searchTerm}"`);
    }
}

// Clear store product search
function clearStoreSearch() {
    const searchInput = document.getElementById('store-product-search');
    if (searchInput) {
        searchInput.value = '';
        handleStoreProductSearch('', []);
        showNotification('Search cleared');
    }
}

// Debounced mobile search helper and clearing function
let _mobileSearchTimeout = null;
function debouncedMobileSearch(value) {
    // Mirror value into desktop search input if present
    const desktop = document.getElementById('product-search');
    if (desktop) desktop.value = value;

    if (_mobileSearchTimeout) clearTimeout(_mobileSearchTimeout);
    _mobileSearchTimeout = setTimeout(() => {
        try {
            searchProducts(value);
        } catch (err) {
            console.error('Mobile search error', err);
        }
    }, 250);
}

function clearMobileSearch() {
    const mobile = document.getElementById('mobile-product-search');
    if (mobile) mobile.value = '';
    const desktop = document.getElementById('product-search');
    if (desktop) desktop.value = '';
    if (_mobileSearchTimeout) {
        clearTimeout(_mobileSearchTimeout);
        _mobileSearchTimeout = null;
    }
    applyFiltersAndRender();
    showNotification('Search cleared');
}

// Apply selected filters to the full products list and render
function applyFiltersAndRender() {
    if (!productsListAll || productsListAll.length === 0) {
        // If products not loaded yet, fetch them
        loadAmazonProducts();
        return;
    }

    // Category mapping (checkbox id -> keyword to match)
    const categoryMap = {
        'cat-electronics': 'electronics',
        'cat-fashion': 'fashion',
        'cat-home': 'home',
        'cat-books': 'books',
        'cat-sports': 'sports',
        'cat-beauty': 'beauty'
    };

    // Collect selected categories
    const selectedCats = Object.keys(categoryMap).filter(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    }).map(id => categoryMap[id]);

    // Price limit
    const priceSlider = document.getElementById('price-slider');
    const maxPrice = priceSlider ? parseFloat(priceSlider.value) : Infinity;

    // Ratings
    const ratingChecks = ['rating-4', 'rating-3', 'rating-2'].filter(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    }).map(id => parseInt(id.split('-')[1], 10));

    // Availability
    const inStockEl = document.getElementById('in-stock');
    const inStockOnly = inStockEl ? inStockEl.checked : false;
    const fastDeliveryEl = document.getElementById('fast-delivery');
    const fastOnly = fastDeliveryEl ? fastDeliveryEl.checked : false;

    // Filter logic
    const filtered = productsListAll.filter(p => {
        const data = p.data || {};

        // Category: if any category checked, product must match at least one
        if (selectedCats.length > 0) {
            const cat = (data.category || '').toString().toLowerCase();
            const matchesCat = selectedCats.some(sc => cat.includes(sc));
            if (!matchesCat) return false;
        }

        // Price
        const price = parseFloat(data.price) || 0;
        if (!isNaN(maxPrice) && price > maxPrice) return false;

        // Rating: if any rating boxes checked, product must meet at least one threshold
        if (ratingChecks.length > 0) {
            const rating = parseFloat(data.rating) || 0;
            const matchesRating = ratingChecks.some(th => rating >= th);
            if (!matchesRating) return false;
        }

        // In stock
        if (inStockOnly) {
            if (!(data.quantity > 0)) return false;
        }

        // Fast delivery
        if (fastOnly) {
            if (!data.fastDelivery) return false;
        }

        return true;
    });

    productsList = filtered;
    currentProductsPage = 1;
    renderProductsPage(currentProductsPage);
}

// Attach listeners to filter inputs (only once)
function setupProductFilterListeners() {
    if (_productFiltersInitialized) return;
    _productFiltersInitialized = true;

    // All checkboxes in sidebar
    document.querySelectorAll('.products-sidebar .filter-option input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => applyFiltersAndRender());
    });

    // Price slider
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) {
        priceSlider.addEventListener('input', () => applyFiltersAndRender());
    }
}

function prevPage() {
    if (currentProductsPage > 1) {
        renderProductsPage(currentProductsPage - 1);
        // Scroll to top of grid
        const header = document.querySelector('.products-header');
        if (header) header.scrollIntoView({ behavior: 'smooth' });
    }
}

function nextPage() {
    // Check if we can actually go forward before calling render
    const itemsPerPage = 12; // Must match the number in renderProductsPage
    const totalPages = Math.ceil(productsList.length / itemsPerPage);

    if (currentProductsPage < totalPages) {
        renderProductsPage(currentProductsPage + 1);
        // Scroll to top of grid
        const header = document.querySelector('.products-header');
        if (header) header.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- 9. VENDOR DASHBOARD ---

async function loadVendorDashboard() {
    if (userRole !== 'vendor' || !currentStoreData) return;

    showAdminTab('overview');
}

// [Find this function in main.js and replace/update it]
function showAdminTab(tab) {
    // Update active tab
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Hide all tabs
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');

    // Show selected tab
    const tabEl = document.getElementById('admin-' + tab);
    if (tabEl) {
        tabEl.style.display = 'block';

        if (tab === 'overview') loadVendorOverview();
        if (tab === 'products') loadVendorProducts();
        if (tab === 'settings') loadVendorSettings();
        if (tab === 'orders') loadVendorOrders();
        if (tab === 'store-url') loadStoreUrlTab();
        if (tab === 'messages') openChatModal();
        if (tab === 'receipt') initReceiptGenerator();

        // --- NEW: Update limit UI when opening Add Product tab ---
        if (tab === 'add-product') {
            updateProductLimitUI();
        }
    }
}

async function loadVendorOverview() {
    if (!currentStoreData) return;
    const container = document.getElementById('store-overview-text');

    try {
        const productsSnap = await db.collection('products').where('storeId', '==', currentStoreData.docId).get();
        const ordersSnap = await db.collection('orders').where('vendorId', '==', currentUser.uid).get();
        const totalProducts = productsSnap.size;
        const totalOrders = ordersSnap.size;
        let totalStock = 0;
        let totalValue = 0;

        productsSnap.forEach(doc => {
            const data = doc.data();
            totalStock += data.quantity || 0;
            totalValue += (data.price || 0) * (data.quantity || 0);
        });

        let totalRevenue = 0;
        ordersSnap.forEach(doc => {
            const data = doc.data();
            totalRevenue += data.total || 0;
        });

        const status = currentStoreData.status || 'pending';
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        const statusColor = status === 'approved' ? 'var(--success)' :
            status === 'pending' ? 'var(--warning)' : 'var(--danger)';

        const statusIcon = status === 'approved' ? 'fa-check-circle' :
            status === 'pending' ? 'fa-clock' : 'fa-times-circle';

        // Status check removed - terms and conditions feature removed
        container.innerHTML = `
            <div class="dashboard-stats-grid">
                <div class="stat-card stat-products">
                    <div class="stat-icon">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${totalProducts}</div>
                        <div class="stat-label">Total Products</div>
                        <div class="stat-description">Items in your catalog</div>
                    </div>
                </div>

                <div class="stat-card stat-stock">
                    <div class="stat-icon">
                        <i class="fas fa-warehouse"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${totalStock}</div>
                        <div class="stat-label">Total Stock</div>
                        <div class="stat-description">Units available for sale</div>
                    </div>
                </div>

                <div class="stat-card stat-orders">
                    <div class="stat-icon">
                        <i class="fas fa-shopping-bag"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${totalOrders}</div>
                        <div class="stat-label">Total Orders</div>
                        <div class="stat-description">Customer purchases</div>
                    </div>
                </div>

                <div class="stat-card stat-revenue">
                    <div class="stat-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${formatCurrency(totalRevenue, 'GHS')}</div>
                        <div class="stat-label">Total Revenue</div>
                        <div class="stat-description">From all orders</div>
                    </div>
                </div>

                <div class="stat-card stat-status">
                    <div class="stat-icon">
                        <i class="fas fa-store"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number" style="color: ${statusColor}; font-size: 1.3rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fas ${statusIcon}"></i> ${statusText}
                        </div>
                        <div class="stat-label">Store Status</div>
                        <div class="stat-description">${status === 'approved' ? 'Your store is live!' :
                status === 'pending' ? 'Awaiting admin approval' :
                    'Store is inactive'}</div>
                    </div>
                </div>
                
                <!-- ADD LOCATION CARD -->
                ${currentStoreData.storeLocation ? `
                <div class="stat-card stat-location">
                    <div class="stat-icon">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number" style="font-size: 1.1rem;">${currentStoreData.storeLocation}</div>
                        <div class="stat-label">Store Location</div>
                        <div class="stat-description">Visible to customers</div>
                    </div>
                </div>
                ` : ''}

                <!-- NEW: Store URL Card -->
                <div class="stat-card stat-url" style="grid-column: span 2;">
                    <div class="stat-icon">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Your Store URL</div>
                        <div class="store-url-display" style="margin: 10px 0; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <code style="font-family: monospace; font-size: 0.9rem; color: var(--primary); word-break: break-all;">${generateStoreUrl(currentStoreData.slug)}</code>
                        </div>
                        <div class="store-url-actions" style="display: flex; gap: 10px; margin-top: 15px;">
                            <button onclick="copyStoreUrl()" id="copy-store-url-btn" class="btn btn-primary" style="flex: 1;">
                                <i class="fas fa-copy"></i> Copy URL
                            </button>
                            <button onclick="shareStoreUrl()" class="btn btn-outline" style="flex: 1;">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                        <div class="stat-description" style="margin-top: 10px; font-size: 0.85rem; color: var(--gray);">
                            Share this link with your customers to bring them directly to your store
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-welcome">
                <h3>Welcome to Your Store Dashboard!</h3>
                <p>Manage your products, track inventory, and grow your business on MarketSpace. You currently have <strong>${totalProducts}</strong> products with <strong>${totalStock}</strong> units in stock. You've received <strong>${totalOrders}</strong> orders generating <strong>${formatCurrency(totalRevenue, 'GHS')}</strong> in revenue.</p>
                <div class="quick-actions">
                    <button onclick="showAdminTab('add-product')" class="btn btn-outline">
                        <i class="fas fa-plus"></i> Add New Product
                    </button>
                    <button onclick="showAdminTab('orders')" class="btn btn-outline">
                        <i class="fas fa-shopping-bag"></i> View Orders
                    </button>
                </div>
            </div>
            
            ${totalProducts === 0 ? `
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-top: 20px;">
                <h4 style="color: #92400e; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-lightbulb"></i> Get Started
                </h4>
                <p style="color: #92400e; margin-bottom: 15px;">
                    Your store has been created! Start by adding your first product to make your store active.
                </p>
                <button onclick="showAdminTab('add-product')" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Add Your First Product
                </button>
            </div>
            ` : ''}
        `;
        if (typeof updateVerificationUI === 'function') {
            updateVerificationUI();
        }
    } catch (e) {
        console.error('Error loading overview:', e);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--warning); margin-bottom: 20px;"></i>
                <h3>Unable to Load Dashboard</h3>
                <p>There was an error loading your store data. Please try again.</p>
                <button onclick="loadVendorOverview()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Store vendor products for filtering
let vendorProductsList = [];

async function loadVendorProducts() {
    if (!currentStoreData) return;
    const container = document.getElementById('vendor-products-list');

    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p>Loading products...</p>
        </div>
    `;

    try {
        const snapshot = await db.collection('products').where('storeId', '==', currentStoreData.docId).get();
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h4>No Products Yet</h4>
                    <p>You haven't added any products to your store yet.</p>
                    <button onclick="showAdminTab('add-product')" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Add Your First Product
                    </button>
                </div>
            `;
            return;
        }

        // Store products for filtering
        vendorProductsList = [];
        const productsMap = new Map();
        snapshot.forEach(doc => {
            const data = doc.data();
            vendorProductsList.push({ id: doc.id, ...data });
            productsMap.set(doc.id, { id: doc.id, ...data });
        });

        // Get unique categories
        const categories = [...new Set(vendorProductsList.map(p => p.category || 'Uncategorized'))];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <h4 style="margin: 0; color: var(--dark);">Total: <span id="vendor-products-count">${snapshot.size}</span> products</h4>
                <button onclick="showAdminTab('add-product')" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-plus"></i> Add Product
                </button>
            </div>

            <!-- Search and Filter Section -->
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: end;">
                    <!-- Search Input -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; color: var(--dark); font-weight: 600; font-size: 0.95rem;">
                            <i class="fas fa-search" style="margin-right: 5px;"></i> Search Products
                        </label>
                        <input 
                            type="text" 
                            id="vendor-product-search" 
                            class="form-control" 
                            placeholder="Search by product name..."
                            style="border: 2px solid #e2e8f0; padding: 10px 12px; border-radius: 6px; width: 100%;"
                            onkeyup="filterVendorProducts()"
                        >
                    </div>

                    <!-- Category Filter -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; color: var(--dark); font-weight: 600; font-size: 0.95rem;">
                            <i class="fas fa-filter" style="margin-right: 5px;"></i> Category
                        </label>
                        <select 
                            id="vendor-category-filter" 
                            class="form-control"
                            style="border: 2px solid #e2e8f0; padding: 10px 12px; border-radius: 6px; width: 100%;"
                            onchange="filterVendorProducts()"
                        >
                            <option value="">All Categories</option>
                            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Clear Filters Button -->
                <div style="margin-top: 12px;">
                    <button onclick="clearVendorFilters()" class="btn btn-outline" style="font-size: 0.9rem; padding: 8px 15px;">
                        <i class="fas fa-times"></i> Clear Filters
                    </button>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="stores-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Category</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="vendor-products-tbody">
        `;

        vendorProductsList.forEach(data => {
            html += renderVendorProductRow(data.id, data);
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // UPDATE PRODUCT LIMIT STATUS IN ADD-PRODUCT TAB
        setTimeout(async () => {
            const productCount = snapshot.size;
            const isUnlimited = await hasUnlimitedProducts();
            const countElement = document.getElementById('current-product-count');
            const limitBar = document.getElementById('product-limit-bar');
            const requestBtn = document.getElementById('request-btn');
            const requestForm = document.getElementById('unlimited-request-form');
            const limitSection = document.getElementById('unlimited-products-section');

            if (countElement) countElement.textContent = productCount;
            if (limitBar) limitBar.style.width = ((productCount / PRODUCT_LIMIT) * 100) + '%';

            if (isUnlimited) {
                // Hide the entire unlimited request section if already approved
                if (limitSection) {
                    limitSection.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <i class="fas fa-star" style="font-size: 2rem; color: #fbbf24; margin-bottom: 10px;"></i>
                            <h4 style="margin: 10px 0; color: white;">✅ Unlimited Products Activated</h4>
                            <p style="margin: 5px 0; font-size: 0.95rem;">You can now upload unlimited products to your store!</p>
                        </div>
                    `;
                }
            } else {
                // Show request button if not unlimited (always visible when not unlimited)
                if (requestBtn) {
                    requestBtn.style.display = 'block';
                }
                // Show form if already at limit
                if (productCount >= PRODUCT_LIMIT && requestForm) {
                    requestForm.style.display = 'block';
                    requestBtn.style.display = 'none';
                }
            }
        }, 100);

        // Attach event listeners after rendering
        const searchInput = document.getElementById('vendor-product-search');
        if (searchInput) {
            searchInput.addEventListener('input', filterVendorProducts);
        }
    } catch (e) {
        console.error('Error loading products:', e);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h4>Error Loading Products</h4>
                <p>There was a problem loading your products. Please try again.</p>
                <button onclick="loadVendorProducts()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Render a single product row
function renderVendorProductRow(productId, data) {
    return `
        <tr>
            <td style="font-weight: 600;">${data.name}</td>
            <td style="color: var(--primary); font-weight: 600;">${formatCurrency(data.price, data.currency || 'GHS')}</td>
            <td>
                <span class="${data.quantity < 10 ? 'status-pending' : 'status-approved'}" style="padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                    ${data.quantity} units
                </span>
            </td>
            <td>${data.category || 'Uncategorized'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editProduct('${productId}')" class="btn-edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteProduct('${productId}')" class="btn-delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Filter vendor products by search and category
function filterVendorProducts() {
    const searchInput = document.getElementById('vendor-product-search');
    const categoryFilter = document.getElementById('vendor-category-filter');
    const tbody = document.getElementById('vendor-products-tbody');

    if (!searchInput || !categoryFilter || !tbody) return;

    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;

    // Filter products
    const filtered = vendorProductsList.filter(product => {
        const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !selectedCategory || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Render filtered results
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--gray);">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                    No products found matching your search
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = filtered.map(product => renderVendorProductRow(product.id, product)).join('');
    }

    // Update count
    const countElement = document.getElementById('vendor-products-count');
    if (countElement) {
        countElement.textContent = filtered.length;
    }
}

// Clear all filters
function clearVendorFilters() {
    const searchInput = document.getElementById('vendor-product-search');
    const categoryFilter = document.getElementById('vendor-category-filter');
    const tbody = document.getElementById('vendor-products-tbody');

    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';

    // Show all products
    if (tbody) {
        tbody.innerHTML = vendorProductsList.map(product => renderVendorProductRow(product.id, product)).join('');
    }

    // Update count
    const countElement = document.getElementById('vendor-products-count');
    if (countElement) {
        countElement.textContent = vendorProductsList.length;
    }
}

async function loadVendorOrders() {
    if (!currentStoreData) return;
    const container = document.getElementById('vendor-orders-list');

    // 1. Setup Badge Elements (Create them if they don't exist)
    const updateBadgeUI = (count) => {
        const badgeHTML = count > 0 ? `<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:10px; font-size:0.7rem; margin-left:5px;">${count}</span>` : '';

        // Update Mobile Tab
        const mobileTab = document.querySelector('.tab-item[data-tab="orders"]');
        if (mobileTab) mobileTab.innerHTML = `<i class="fas fa-shopping-bag"></i> Orders ${badgeHTML}`;

        // Update Sidebar Link
        const sidebarLinks = document.querySelectorAll('.dashboard-sidebar a');
        sidebarLinks.forEach(link => {
            if (link.innerText.includes('Orders') || link.getAttribute('onclick')?.includes('orders')) {
                link.innerHTML = `Orders ${badgeHTML}`;
            }
        });
    };

    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p>Loading orders...</p>
        </div>
    `;

    try {
        const snapshot = await db.collection('orders')
            .where('vendorId', '==', currentUser.uid)
            .get();

        if (snapshot.empty) {
            updateBadgeUI(0);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h4>No Orders Yet</h4>
                    <p>Orders will appear here when customers make a purchase.</p>
                </div>`;
            return;
        }

        // 2. Process Orders & Count Pending
        const orders = [];
        let pendingCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'pending') pendingCount++;
            orders.push({ id: doc.id, data: data });
        });

        // Update the Badge Counter
        updateBadgeUI(pendingCount);

        // Sort by date (newest first)
        orders.sort((a, b) => {
            const dateA = a.data.createdAt?.toDate ? a.data.createdAt.toDate() : new Date(0);
            const dateB = b.data.createdAt?.toDate ? b.data.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        // 3. Render Table
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4 style="margin: 0; color: var(--dark);">All Orders (${orders.length})</h4>
                ${pendingCount > 0 ? `<span style="color:var(--danger); font-weight:bold;">${pendingCount} New Pending Orders</span>` : ''}
            </div>
            <div style="overflow-x: auto;">
                <table class="stores-table">
                    <thead>
                        <tr>
                            <th>Mark Done</th> <th>Items Summary</th> <th>Customer</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        orders.forEach(order => {
            const data = order.data;
            const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            const isDelivered = data.status === 'delivered';

            // Create a text summary of items (e.g., "Apple (x2), Bread (x1)")
            const itemsSummary = data.items.map(i => `<b>${i.quantity}x</b> ${i.name}`).join('<br>');

            html += `
                <tr style="background: ${data.status === 'pending' ? '#fffbeb' : 'white'};">
                    <td style="text-align: center;">
                        <input type="checkbox" 
                            style="width: 20px; height: 20px; cursor: pointer;"
                            ${isDelivered ? 'checked disabled' : ''} 
                            onchange="toggleOrderDelivered('${order.id}', this)"
                            title="Check to mark as Delivered">
                    </td>

                    <td style="font-size: 0.9rem; color: #333;">${itemsSummary}</td>

                    <td>
                        <div style="font-weight: 600;">${data.customerName}</div>
                        <div style="font-size: 0.8rem; color: var(--gray);">${data.customerPhone || ''}</div>
                    </td>

                    <td style="color: var(--success); font-weight: 600;">
                        ${formatCurrency(data.total, data.currency || 'GHS')}
                    </td>

                    <td>
                        <span id="status-${order.id}" style="
                            padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;
                            background: ${data.status === 'delivered' ? 'var(--success)' : data.status === 'pending' ? 'var(--warning)' : 'var(--primary)'};
                            color: white;">
                            ${data.status.toUpperCase()}
                        </span>
                    </td>
                    
                    <td style="font-size: 0.85rem;">${date}</td>
                    
                    <td>
                        <button onclick="viewOrderDetails('${order.id}')" class="btn-edit" style="border: 1px solid #ccc; background: white;" title="View Full Receipt">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error('Error loading orders:', e);
        container.innerHTML = `<p style="color:red;">Error loading orders.</p>`;
    }
}
// --- Function to handle the "Check Book" / Checkbox logic ---
async function toggleOrderDelivered(orderId, checkbox) {
    if (!checkbox.checked) return; // Prevent unchecking for safety (optional)

    if (confirm('Mark this order as Delivered/Done?')) {
        try {
            await db.collection('orders').doc(orderId).update({
                status: 'delivered',
                deliveredAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showNotification('✅ Order marked as Delivered!');

            // Update the status badge in the UI immediately
            const statusBadge = document.getElementById(`status-${orderId}`);
            if (statusBadge) {
                statusBadge.textContent = 'DELIVERED';
                statusBadge.style.background = 'var(--success)';
            }
            checkbox.disabled = true; // Disable after checking

            // Refresh dashboard numbers
            loadVendorOverview();
        } catch (error) {
            console.error(error);
            checkbox.checked = false; // Revert if error
            showNotification('❌ Error updating status');
        }
    } else {
        checkbox.checked = false; // Revert if cancelled
    }
}

// --- Function to View Full Details (Amount, Qty, Item Name) ---
async function viewOrderDetails(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (orderDoc.exists) {
            // We reuse the existing modal function but it works perfectly for vendors too
            showOrderDetailsModal(orderDoc.data());
        } else {
            showNotification('Order not found');
        }
    } catch (error) {
        console.error('Error fetching details:', error);
        showNotification('Error loading details');
    }
}

function viewOrderDetails(orderId) {
    showNotification('Viewing order details for: ' + orderId);
    // In a full implementation, you would show a modal with order details
}

// ========== UPDATED: Load Vendor Settings with image preview ==========
async function loadVendorSettings() {
    if (!currentStoreData) return;

    const settingsContainer = document.getElementById('admin-settings');
    const hasBackgroundImage = currentStoreData.backgroundImageUrl;

    // Fetch fresh store data
    const storeDoc = await db.collection('stores').doc(currentStoreData.docId).get();
    const storeData = storeDoc.exists ? storeDoc.data() : currentStoreData;

    const editableHtml = `
        <div style="background: white; padding: 25px; border-radius: 12px; margin-top: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h4 style="margin-bottom: 20px; color: var(--dark);">Store Information</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px;">
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Store Name</p>
                    <p style="margin: 5px 0 0; font-weight: 600; font-size: 1.1rem; color: var(--dark);">${storeData.name}</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Store URL</p>
                    <p style="margin: 5px 0 0; font-weight: 600; font-size: 1.1rem; color: var(--primary);">${storeData.slug}</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Category</p>
                    <p style="margin: 5px 0 0; font-weight: 600; font-size: 1.1rem; color: var(--dark);">${storeData.category}</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Status</p>
                    <p style="margin: 5px 0 0; font-weight: 600; font-size: 1.1rem; color: ${storeData.status === 'approved' ? 'var(--success)' : storeData.status === 'pending' ? 'var(--warning)' : 'var(--danger)'};">${storeData.status || 'pending'}</p>
                </div>
                ${storeData.storeLocation ? `
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: var(--gray); font-size: 0.9rem;">Location</p>
                    <p style="margin: 5px 0 0; font-weight: 600; font-size: 1.1rem; color: var(--dark);">${storeData.storeLocation}</p>
                </div>
                ` : ''}
            </div>
            
            <h4 style="margin-bottom: 20px; color: var(--dark);">Edit Store Settings</h4>
            <form id="store-settings-form">
                <div class="form-group">
                    <label>Store Name *</label>
                    <input type="text" id="settings-store-name" class="form-control" value="${storeData.name}" required>
                </div>

                <div class="form-group">
                    <label>Store Location</label>
                    <input type="text" id="settings-store-location" class="form-control" value="${storeData.storeLocation || ''}" placeholder="e.g., Accra, Ghana">
                    <small style="color: var(--gray); font-size: 0.85rem; display: block; margin-top: 5px;">This will be displayed on your store page for customers.</small>
                </div>

                <div class="form-group">
                    <label>Category</label>
                    <select id="settings-store-category" class="form-control" onchange="toggleCategoryOther(this)">
                        <option value="electronics" ${storeData.category === 'electronics' ? 'selected' : ''}>Electronics</option>
                        <option value="clothing" ${storeData.category === 'clothing' ? 'selected' : ''}>Clothing</option>
                        <option value="food" ${storeData.category === 'food' ? 'selected' : ''}>Food & Beverages</option>
                        <option value="books" ${storeData.category === 'books' ? 'selected' : ''}>Books</option>
                        <option value="home" ${storeData.category === 'home' ? 'selected' : ''}>Home & Garden</option>
                        <option value="sports" ${storeData.category === 'sports' ? 'selected' : ''}>Sports</option>
                        <option value="beauty" ${storeData.category === 'beauty' ? 'selected' : ''}>Beauty & Personal Care</option>
                        <option value="toys" ${storeData.category === 'toys' ? 'selected' : ''}>Toys & Games</option>
                        <option value="automotive" ${storeData.category === 'automotive' ? 'selected' : ''}>Automotive</option>
                        <option value="other" ${['electronics', 'clothing', 'food', 'books', 'home', 'sports', 'beauty', 'toys', 'automotive'].includes(storeData.category) ? '' : 'selected'}>Other</option>
                    </select>
                    <input type="text" id="settings-store-category-other" class="form-control" style="display: ${['electronics', 'clothing', 'food', 'books', 'home', 'sports', 'beauty', 'toys', 'automotive'].includes(storeData.category) ? 'none' : 'block'}; margin-top: 10px;" placeholder="Specify category" value="${['electronics', 'clothing', 'food', 'books', 'home', 'sports', 'beauty', 'toys', 'automotive'].includes(storeData.category) ? '' : storeData.category}">
                </div>

                <div class="form-group">
                    <label>Store Description</label>
                    <textarea id="settings-description" class="form-control" rows="4" placeholder="Describe your store...">${storeData.description || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Store Theme</label>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 10px;">
                            <input type="radio" name="theme-type" value="color" ${!hasBackgroundImage ? 'checked' : ''} onchange="toggleThemeType('color')"> Use Color Theme
                        </label>
                        <label style="display: block;">
                            <input type="radio" name="theme-type" value="image" ${hasBackgroundImage ? 'checked' : ''} onchange="toggleThemeType('image')"> Use Background Image
                        </label>
                    </div>

                    <div id="color-theme-controls" style="display: ${!hasBackgroundImage ? 'block' : 'none'};">
                        <div class="theme-controls">
                            <div class="theme-color ${storeData.theme === 'primary' ? 'active' : ''}" style="background-color: #2563eb;" onclick="selectStoreTheme('primary', this)" data-theme="primary" title="Blue"></div>
                            <div class="theme-color ${storeData.theme === 'secondary' ? 'active' : ''}" style="background-color: #7c3aed;" onclick="selectStoreTheme('secondary', this)" data-theme="secondary" title="Purple"></div>
                            <div class="theme-color ${storeData.theme === 'success' ? 'active' : ''}" style="background-color: #10b981;" onclick="selectStoreTheme('success', this)" data-theme="success" title="Green"></div>
                            <div class="theme-color ${storeData.theme === 'warning' ? 'active' : ''}" style="background-color: #f59e0b;" onclick="selectStoreTheme('warning', this)" data-theme="warning" title="Amber"></div>
                            <div class="theme-color ${storeData.theme === 'danger' ? 'active' : ''}" style="background-color: #ef4444;" onclick="selectStoreTheme('danger', this)" data-theme="danger" title="Red"></div>
                            <div class="theme-color ${storeData.theme === 'teal' ? 'active' : ''}" style="background-color: #06b6d4;" onclick="selectStoreTheme('teal', this)" data-theme="teal" title="Teal"></div>
                            <div class="theme-color ${storeData.theme === 'pink' ? 'active' : ''}" style="background-color: #ec4899;" onclick="selectStoreTheme('pink', this)" data-theme="pink" title="Pink"></div>
                            <div class="theme-color ${storeData.theme === 'orange' ? 'active' : ''}" style="background-color: #f97316;" onclick="selectStoreTheme('orange', this)" data-theme="orange" title="Orange"></div>
                        </div>
                    </div>

                    <div id="image-theme-controls" style="display: ${hasBackgroundImage ? 'block' : 'none'};">
                        <div class="form-group">
                            <label>Background Image</label>
                            <input type="file" id="settings-background-image" class="form-control" accept="image/*" onchange="previewBackgroundImage(this)">
                            
                            <!-- Image Preview -->
                            <div id="background-image-preview" style="margin-top: 10px; ${hasBackgroundImage ? '' : 'display: none;'}">
                                ${hasBackgroundImage ? `
                                <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
                                    <img src="${storeData.backgroundImageUrl}" alt="Current background" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px; border: 2px solid #e2e8f0;">
                                    <div>
                                        <p style="margin: 0 0 5px 0; font-size: 0.9rem; color: var(--dark);">Current Image</p>
                                        <button type="button" onclick="removeBackgroundImage()" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.8rem;">
                                            <i class="fas fa-trash"></i> Remove
                                        </button>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            
                            <!-- New Image Preview -->
                            <div id="new-background-image-preview" style="margin-top: 10px; display: none;">
                                <p style="margin: 0 0 5px 0; font-size: 0.9rem; color: var(--dark);">New Image Preview:</p>
                                <img id="new-image-preview" src="#" alt="New background preview" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px; border: 2px solid var(--primary);">
                            </div>
                            
                            <small style="color: var(--gray); font-size: 0.85rem; display: block; margin-top: 5px;">
                                Recommended: 1200×400 pixels, JPG or PNG format, max 1MB
                            </small>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 15px; margin-top: 25px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Save Changes</button>
                    <button type="button" onclick="showAdminTab('overview')" class="btn btn-outline" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>

        <div style="background: #fff5f5; border: 1px solid #fecaca; padding: 25px; border-radius: 12px; margin-top: 30px;">
            <h4 style="margin-bottom: 15px; color: #b91c1c;">Danger Zone</h4>
            <p style="color: #991b1b; margin-bottom: 20px;">
                Deleting your store is a permanent action and cannot be undone. This will delete all your products, orders, and store data.
            </p>
            <button onclick="deleteStoreVendor()" class="btn btn-danger" style="background-color: #dc2626; color: white; width: auto;">
                <i class="fas fa-trash-alt"></i> Delete Account
            </button>
        </div>
    `;

    settingsContainer.innerHTML = editableHtml;

    // Add form submit handler
    const form = document.getElementById('store-settings-form');
    if (form) {
        form.removeEventListener('submit', saveStoreSettings);
        form.addEventListener('submit', saveStoreSettings);
    }
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        try {
            await db.collection('products').doc(productId).delete();
            showNotification('Product deleted successfully!');
            loadVendorProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('Error deleting product: ' + error.message);
        }
    }
}

function editProduct(productId) {
    showNotification('Edit functionality coming soon! Product ID: ' + productId);
}

// Store Theme Selection for Settings
function selectStoreTheme(theme, el) {
    document.querySelectorAll('.theme-controls .theme-color').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
}

// ========== NEW: Function to preview background image ==========
function previewBackgroundImage(input) {
    const previewContainer = document.getElementById('new-background-image-preview');
    const previewImg = document.getElementById('new-image-preview');

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            previewImg.src = e.target.result;
            previewContainer.style.display = 'block';
        };

        reader.readAsDataURL(input.files[0]);
    } else {
        previewContainer.style.display = 'none';
    }
}

// ========== NEW: Function to remove background image ==========
function removeBackgroundImage() {
    if (confirm('Remove the current background image?')) {
        // Clear the image URL in the store data
        if (currentStoreData) {
            currentStoreData.backgroundImageUrl = '';
        }

        // Hide the current image preview
        const previewContainer = document.getElementById('background-image-preview');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }

        // Also hide the new image preview if visible
        const newPreviewContainer = document.getElementById('new-background-image-preview');
        if (newPreviewContainer) {
            newPreviewContainer.style.display = 'none';
        }

        // Clear the file input
        const fileInput = document.getElementById('settings-background-image');
        if (fileInput) {
            fileInput.value = '';
        }

        showNotification('Background image will be removed after saving.');
    }
}

// ========== UPDATED: Toggle between color and image theme types ==========
function toggleThemeType(type) {
    const colorControls = document.getElementById('color-theme-controls');
    const imageControls = document.getElementById('image-theme-controls');

    if (type === 'color') {
        colorControls.style.display = 'block';
        imageControls.style.display = 'none';

        // Clear any selected image
        const fileInput = document.getElementById('settings-background-image');
        if (fileInput) fileInput.value = '';

        const newPreview = document.getElementById('new-background-image-preview');
        if (newPreview) newPreview.style.display = 'none';
    } else {
        colorControls.style.display = 'none';
        imageControls.style.display = 'block';
    }
}

// ========== UPDATED: Save Store Settings with image handling ==========
async function saveStoreSettings(e) {
    e.preventDefault();

    if (!currentStoreData || !currentUser) {
        showNotification('Store data not available.');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    const name = document.getElementById('settings-store-name').value.trim();
    const storeLocation = document.getElementById('settings-store-location').value.trim();
    let categoryEl = document.getElementById('settings-store-category');
    let category = categoryEl.value;
    if (category === 'other') {
        const otherVal = document.getElementById('settings-store-category-other')?.value?.trim();
        if (otherVal) category = otherVal;
    }
    const description = document.getElementById('settings-description').value.trim();

    // Get theme type (color or image)
    const themeTypeRadios = document.querySelectorAll('input[name="theme-type"]');
    let themeType = 'color';
    for (let radio of themeTypeRadios) {
        if (radio.checked) {
            themeType = radio.value;
            break;
        }
    }

    const selectedTheme = themeType === 'color' ?
        (document.querySelector('.theme-controls .theme-color.active')?.getAttribute('data-theme') || currentStoreData.theme || 'primary') :
        null;

    const imageFile = document.getElementById('settings-background-image').files[0];

    let backgroundImageUrl = currentStoreData.backgroundImageUrl || '';

    // Handle image upload
    if (themeType === 'image') {
        if (imageFile) {
            try {
                // Check file size (max 1MB)
                if (imageFile.size > 1048576) {
                    showNotification('❌ Image must be less than 1MB.');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }

                // Check file type
                if (!imageFile.type.match('image/(jpeg|png|jpg|gif)')) {
                    showNotification('❌ Please upload a JPEG, PNG, or GIF image.');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }

                // Convert to Base64
                showNotification('📸 Compressing image...');
                backgroundImageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = reader.result;
                        // Check if base64 data is too large
                        if (base64.length > 900000) {
                            reject(new Error('Image too large after conversion. Please use a smaller image.'));
                        } else {
                            resolve(base64);
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });

            } catch (error) {
                console.error('Error processing background image:', error);
                showNotification('❌ Error processing image: ' + error.message);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
        } else if (!backgroundImageUrl) {
            // If no image and image theme is selected, default to color theme
            showNotification('⚠️ No image selected. Using color theme instead.');
            themeType = 'color';
        }
    } else if (themeType === 'color') {
        // If switching from image to color theme, clear the background image
        backgroundImageUrl = '';
    }

    try {
        const updateData = {
            name: name,
            category: category,
            description: description,
            storeLocation: storeLocation,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Handle theme based on type
        if (themeType === 'color') {
            updateData.theme = selectedTheme;
            updateData.backgroundImageUrl = ''; // Clear background image when using color
        } else if (themeType === 'image' && backgroundImageUrl) {
            updateData.theme = null; // Clear color theme when using image
            updateData.backgroundImageUrl = backgroundImageUrl;
        }

        // Update store document
        await db.collection('stores').doc(currentStoreData.docId).update(updateData);

        // Update local store data
        Object.assign(currentStoreData, updateData);

        showNotification('✅ Store settings updated successfully!');

        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            loadVendorSettings(); // Refresh the settings display
            loadVendorDashboard(); // Update dashboard with new settings
        }, 500);

        // Update the header info
        const headerInfo = document.getElementById('admin-header-info');
        if (headerInfo) {
            headerInfo.innerHTML = `
                <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                    <i class="fas fa-store"></i> ${currentStoreData.name}
                </span>
            `;
        }
    } catch (error) {
        console.error('Error updating store settings:', error);
        showNotification('❌ Error updating settings: ' + error.message);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Allow vendor to delete their own store (soft delete)
// In main.js

async function deleteStoreVendor() {
    try {
        if (!currentUser || userRole !== 'vendor' || !currentStoreData || !currentStoreData.docId) {
            showNotification('Unauthorized or no active store.');
            return;
        }

        // 1. Confirm Action
        const confirmDelete = confirm('⚠️ PERMANENT ACTION\n\nAre you sure you want to delete your store? This will:\n- Hide your store from customers\n- Hide all your products\n- Mark your store as deleted in the system');
        if (!confirmDelete) return;

        const storeId = currentStoreData.docId;
        const batch = db.batch();
        const storeRef = db.collection('stores').doc(storeId);

        // 2. Soft Delete the Store (Mark as deleted, don't remove from DB so Dev can see history)
        batch.update(storeRef, {
            status: 'deleted',
            deleted: true,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Hide all products associated with this store
        const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
        productsSnap.forEach(doc => {
            batch.update(doc.ref, {
                active: false,
                hidden: true,
                storeStatus: 'deleted' // Optional: helps with filtering later
            });
        });

        // 4. Commit Changes
        await batch.commit();

        showNotification('Store deleted successfully.');

        // 5. Clear local data and redirect
        currentStoreData = null;
        setTimeout(() => {
            window.location.reload(); // Reload to reset state
        }, 1500);

    } catch (e) {
        console.error('Error deleting store:', e);
        showNotification('Error deleting store: ' + e.message);
    }
}

// --- 10. DEVELOPER DASHBOARD ---

// In main.js

async function loadDevStats() {
    if (userRole !== 'developer') return;

    // Load verification requests if the system is available
    if (typeof loadVerificationRequests === 'function') {
        loadVerificationRequests();
    }

    // Load unlimited products requests
    loadUnlimitedRequests();

    try {
        // 1. Fetch all necessary collections
        const [
            usersSnap,
            allStoresSnap,
            approvedStoresSnap,
            pendingStoresSnap,
            deletedStoresSnap
        ] = await Promise.all([
            db.collection('users').get(),
            db.collection('stores').get(),
            db.collection('stores').where('status', '==', 'approved').get(),
            db.collection('stores').where('status', '==', 'pending').get(),
            db.collection('stores').where('status', '==', 'deleted').get()
        ]);

        // 2. Update Stat Cards
        document.getElementById('dev-total-users').textContent = usersSnap.size;
        document.getElementById('dev-total-stores').textContent = allStoresSnap.size;
        document.getElementById('dev-pending-approvals').textContent = pendingStoresSnap.size;

        // 3. Render "Pending Approvals" Table
        let pendingHtml = '';
        if (pendingStoresSnap.empty) {
            pendingHtml = '<p>No pending approvals.</p>';
        } else {
            pendingHtml = '<table class="stores-table"><thead><tr><th>Store Name</th><th>Owner</th><th>Category</th><th>Actions</th></tr></thead><tbody>';
            for (const storeDoc of pendingStoresSnap.docs) {
                const storeData = storeDoc.data();
                const ownerDoc = await db.collection('users').doc(storeData.ownerId).get();
                const ownerName = ownerDoc.data()?.name || 'Unknown';
                pendingHtml += `
                    <tr>
                        <td>${storeData.name}</td>
                        <td>${ownerName}</td>
                        <td>${storeData.category}</td>
                        <td>
                            <div class="action-buttons">
                                <button onclick="approveStore('${storeDoc.id}')" class="btn-approve">Approve</button>
                                <button onclick="rejectStore('${storeDoc.id}')" class="btn-reject">Reject</button>
                            </div>
                        </td>
                    </tr>`;
            }
            pendingHtml += '</tbody></table>';
        }
        document.getElementById('dev-pending-stores').innerHTML = pendingHtml;

        // 4. Render "All Stores" Table (UPDATED with Revoke Option)
        let allStoresHtml = '<table class="stores-table"><thead><tr><th>Store Name</th><th>Owner</th><th>Status</th><th>Category</th><th>Actions</th></tr></thead><tbody>';

        for (const storeDoc of allStoresSnap.docs) {
            const storeData = storeDoc.data();
            const ownerDoc = await db.collection('users').doc(storeData.ownerId).get();
            const ownerName = ownerDoc.data()?.name || 'Unknown';

            // Logic for status badge
            let statusClass = 'status-rejected';
            if (storeData.status === 'approved') statusClass = 'status-approved';
            else if (storeData.status === 'pending') statusClass = 'status-pending';
            else if (storeData.status === 'deleted') statusClass = 'status-deleted';

            // Check if store has unlimited products
            const isUnlimited = storeData.unlimitedProducts === true;

            allStoresHtml += `
                <tr>
                    <td>
                        <div style="font-weight:600;">${storeData.name}</div>
                        ${isUnlimited ? '<span style="font-size:0.75rem; background:#7c3aed; color:white; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:2px;"><i class="fas fa-infinity"></i> Unlimited</span>' : ''}
                    </td>
                    <td>${ownerName}</td>
                    <td>
                        <span class="store-status-badge ${statusClass}">
                            ${(storeData.status || 'pending').toUpperCase()}
                        </span>
                    </td>
                    <td>${storeData.category}</td>
                    <td>
                        <div class="action-buttons" style="display:flex; flex-direction:column; gap:5px;">
                            ${storeData.status === 'deleted'
                    ? '<span style="color:var(--gray); font-size:0.8rem;"><i>Archived</i></span>'
                    : `<button onclick="deleteStoreAdmin('${storeDoc.id}')" class="btn-remove" style="width:100%">Delete Store</button>`
                }
                            
                            ${isUnlimited && storeData.status !== 'deleted'
                    ? `<button onclick="revokeUnlimitedAccess('${storeDoc.id}', '${storeData.name.replace(/'/g, "\\'")}')" class="btn-reject" style="width:100%; font-size:0.75rem; padding:4px;">
                                     <i class="fas fa-ban"></i> Revoke Unlimited
                                   </button>`
                    : ''
                }
                        </div>
                    </td>
                </tr>
            `;
        }
        allStoresHtml += '</tbody></table>';
        document.getElementById('dev-all-stores').innerHTML = allStoresHtml;

        // 5. Render Users List
        let usersHtml = '<ul style="list-style:none; margin:0; padding:0;">';
        const recentUsers = await db.collection('users').orderBy('createdAt', 'desc').limit(10).get();

        recentUsers.forEach(doc => {
            const u = doc.data();
            const userId = doc.id;
            const isMe = currentUser && currentUser.uid === userId;
            const deleteButton = isMe
                ? `<span style="font-size:0.8rem; color:#ccc;">(You)</span>`
                : `<button onclick="deleteUserAdmin('${userId}')" class="btn-delete" style="padding: 6px 10px; font-size: 0.8rem;" title="Delete User"><i class="fas fa-trash"></i></button>`;

            usersHtml += `
            <li style="padding:12px; border-bottom:1px solid #eee; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div style="overflow: hidden;">
                    <strong style="display:block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</strong>
                    <span style="color:var(--gray); font-size:0.85rem; display:block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.email}</span>
                </div>
                <div style="display:flex; gap:10px; align-items:center; flex-shrink: 0;">
                    <span class="store-status-badge status-approved" style="background: #e0e7ff; color: var(--primary); font-size: 0.75rem;">${u.role}</span>
                    ${deleteButton}
                </div>
            </li>`;
        });
        usersHtml += '</ul>';
        document.getElementById('dev-user-list').innerHTML = usersHtml;

    } catch (e) {
        console.error('Error loading developer stats:', e);
        showNotification('Error loading developer stats.');
    }
}
// LOAD AND MANAGE UNLIMITED PRODUCTS REQUESTS
async function loadUnlimitedRequests() {
    const container = document.getElementById('unlimited-requests-container');

    if (!container) return;

    container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading requests...</p>';

    try {
        const snapshot = await db.collection('unlimited_product_requests')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--gray);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                    No requests yet
                </div>
            `;
            return;
        }

        let html = `
            <table class="stores-table">
                <thead>
                    <tr>
                        <th>Store Name</th>
                        <th>Vendor Email</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Requested</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const createdDate = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            const statusClass = data.status === 'approved' ? 'status-approved' :
                data.status === 'rejected' ? 'status-rejected' : 'status-pending';

            html += `
                <tr>
                    <td style="font-weight: 600;">${data.storeName}</td>
                    <td>${data.vendorEmail}</td>
                    <td>
                        <details style="cursor: pointer;">
                            <summary style="user-select: none;">View Reason</summary>
                            <p style="margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 4px; border-left: 3px solid var(--primary);">${data.reason}</p>
                        </details>
                    </td>
                    <td>
                        <span class="store-status-badge ${statusClass}">
                            ${(data.status || 'pending').toUpperCase()}
                        </span>
                    </td>
                    <td style="font-size: 0.9rem;">${createdDate}</td>
                    <td>
                        <div class="action-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${data.status === 'pending' ? `
                                <button onclick="approveUnlimitedRequest('${doc.id}', '${data.vendorEmail}', '${data.storeName}')" class="btn-approve" style="padding: 6px 12px; font-size: 0.85rem;">
                                    <i class="fas fa-check"></i> Approve
                                </button>
                                <button onclick="rejectUnlimitedRequest('${doc.id}', '${data.vendorEmail}', '${data.storeName}')" class="btn-reject" style="padding: 6px 12px; font-size: 0.85rem;">
                                    <i class="fas fa-times"></i> Reject
                                </button>
                            ` : `
                                <span style="font-size: 0.85rem; color: var(--gray);">
                                    ${data.reviewedBy ? '✓ Reviewed' : ''}
                                </span>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading unlimited requests:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger);">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                <p>Error loading requests: ${error.message}</p>
            </div>
        `;
    }
}

// APPROVE UNLIMITED PRODUCTS REQUEST
async function approveUnlimitedRequest(requestId, vendorEmail, storeName) {
    if (!confirm(`Approve unlimited products for ${storeName}?`)) return;

    try {
        const batch = db.batch();

        // Update the request
        batch.update(db.collection('unlimited_product_requests').doc(requestId), {
            status: 'approved',
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser.uid
        });

        // Mark the store with unlimited_products flag
        const requestSnap = await db.collection('unlimited_product_requests').doc(requestId).get();
        if (requestSnap.exists) {
            const storeId = requestSnap.data().storeId;
            batch.update(db.collection('stores').doc(storeId), {
                unlimitedProducts: true
            });
        }

        await batch.commit();

        // Send approval email to vendor
        sendUnlimitedApprovalEmail(vendorEmail, storeName, true);

        showNotification('✅ Request approved! Vendor notified.');
        loadUnlimitedRequests();

    } catch (error) {
        console.error('Error approving request:', error);
        showNotification('❌ Error: ' + error.message);
    }
}

// REJECT UNLIMITED PRODUCTS REQUEST
async function rejectUnlimitedRequest(requestId, vendorEmail, storeName) {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    try {
        await db.collection('unlimited_product_requests').doc(requestId).update({
            status: 'rejected',
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser.uid,
            approvalNotes: reason
        });

        // Send rejection email to vendor
        sendUnlimitedApprovalEmail(vendorEmail, storeName, false, reason);

        showNotification('✅ Request rejected. Vendor notified.');
        loadUnlimitedRequests();

    } catch (error) {
        console.error('Error rejecting request:', error);
        showNotification('❌ Error: ' + error.message);
    }
}

// SEND APPROVAL/REJECTION EMAIL TO VENDOR
async function sendUnlimitedApprovalEmail(vendorEmail, storeName, approved, reason = '') {
    try {
        const subject = approved
            ? `🎉 Your Unlimited Products Request Approved - ${storeName}`
            : `📋 Your Unlimited Products Request Reviewed - ${storeName}`;

        const message = approved
            ? `Great news! Your request for unlimited products has been approved. You can now upload as many products as you need to your store. Log in to your vendor dashboard to continue.`
            : `Your request for unlimited products has been reviewed and rejected. Reason: ${reason}\n\nYou can still add up to 30 products. Please contact us if you have any questions.`;

        emailjs.send('service_byu91od', 'template_mgtx04w', {
            from_name: 'MarketSpace Admin',
            subject: subject,
            to_email: vendorEmail,
            message: message
        });

        console.log('✅ Email sent to vendor');
    } catch (error) {
        console.warn('⚠️ Failed to send email:', error);
    }
}

async function approveStore(storeId) {
    if (confirm('Approve this store?')) {
        try {
            await db.collection('stores').doc(storeId).update({ status: 'approved' });
            showNotification('Store approved!');
            loadDevStats();
        } catch (error) {
            showNotification('Error: ' + error.message);
        }
    }
}

async function rejectStore(storeId) {
    if (confirm('Reject this store?')) {
        try {
            await db.collection('stores').doc(storeId).update({ status: 'rejected' });
            showNotification('Store rejected!');
            loadDevStats();
        } catch (error) {
            showNotification('Error: ' + error.message);
        }
    }
}

async function deleteStoreAdmin(storeId) {
    if (confirm('Permanently delete this store?')) {
        try {
            // Delete all products from this store
            const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
            // Delete all orders from this store
            const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get();

            const batch = db.batch();
            productsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            ordersSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.delete(db.collection('stores').doc(storeId));
            await batch.commit();

            showNotification('Store deleted successfully!');
            loadDevStats();
        } catch (error) {
            showNotification('Error: ' + error.message);
        }
    }
}

// Delete a user (developer action) - cascades to their stores and products in Firestore
async function deleteUserAdmin(userId) {
    // 1. Safety check
    if (currentUser.uid === userId) {
        showNotification("You cannot delete your own developer account.");
        return;
    }

    if (!confirm('⚠️ DANGER: Permanently delete this user?\n\nThis will also delete:\n- Their Store\n- All Products\n- All Orders\n\nThis cannot be undone.')) return;

    try {
        const batch = db.batch();

        // 1) Find stores owned by this user
        const storesSnap = await db.collection('stores').where('ownerId', '==', userId).get();

        // 2) For each store, delete its products, orders, and the store doc
        for (const storeDoc of storesSnap.docs) {
            const storeId = storeDoc.id;

            // Delete products
            const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
            productsSnap.docs.forEach(p => batch.delete(p.ref));

            // Delete orders associated with this store
            const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get();
            ordersSnap.docs.forEach(o => batch.delete(o.ref));

            // Delete the store document
            batch.delete(db.collection('stores').doc(storeId));
        }

        // 3) Delete orders where this user was the CUSTOMER
        const customerOrdersSnap = await db.collection('orders').where('customerId', '==', userId).get();
        customerOrdersSnap.docs.forEach(o => batch.delete(o.ref));

        // 4) Delete the user document
        batch.delete(db.collection('users').doc(userId));

        // Commit batch
        await batch.commit();

        showNotification('✅ User and all associated data deleted.');
        loadDevStats(); // Refresh the list
    } catch (error) {
        console.error(error);
        showNotification('❌ Error deleting user: ' + error.message);
    }
}

// --- 11. LEGACY STORES PAGE ---

async function loadStoresList() {
    const container = document.getElementById('stores-list-container');
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading stores...</p>';

    try {
        const snapshot = await db.collection('stores').where('status', '==', 'approved').get();
        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No stores available yet.</p>';
            storesCache = [];
            return;
        }

        // Cache store documents for client-side searching/filtering
        storesCache = [];
        snapshot.forEach(doc => {
            storesCache.push({ id: doc.id, data: doc.data() });
        });

        // Render initial list
        renderStores(storesCache);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading stores.</p>';
    }
}

function renderStores(stores) {
    const container = document.getElementById('stores-list-container');
    if (!container) return;
    if (!stores || stores.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No stores match your search.</p>';
        return;
    }

    let html = '';
    stores.forEach(s => {
        const data = s.data;
        const docId = s.id;
        const legacyMap = { blue: 'primary', purple: 'secondary', green: 'success' };
        const themeName = legacyMap[data.theme] || data.theme || 'primary';

        html += `
                <div class="store-card">
                    <div class="store-status">
                        <i class="fas fa-store"></i> Open
                    </div>
                    <div class="store-header" style="${data.backgroundImageUrl ?
                `background: url('${data.backgroundImageUrl}') center/cover no-repeat;` :
                `background: linear-gradient(135deg, var(--${themeName}), color-mix(in srgb, var(--${themeName}) 80%, black 20%))`}">
                        <div class="store-facade"></div>
                        <div class="store-logo">${(data.name || '').substring(0, 2).toUpperCase()}</div>
                    </div>
                    <div class="store-content">
                        <h3 style="display: flex; align-items: center; gap: 3px;">
                            ${data.name}
                            ${data.isVerified ? '<span class="blue-tick-badge" title="Verified Store"><i class="fas fa-check"></i></span>' : ''}                        </h3>
                        <div class="store-category">
                            <i class="fas fa-tag"></i> ${data.category || ''}
                        </div>
                        <!-- ADD LOCATION DISPLAY -->
                        ${data.storeLocation ? `
                        <div class="store-location" style="display: flex; align-items: center; gap: 5px; color: var(--gray); font-size: 0.9rem; margin: 5px 0;">
                            <i class="fas fa-map-marker-alt" style="font-size: 0.8rem;"></i>
                            ${data.storeLocation}
                        </div>
                        ` : ''}
                        <div class="store-rating">
                            <div class="stars">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star-half-alt"></i>
                            </div>
                            <span class="count">${data.rating || '4.5'}/5</span>
                        </div>
                        <div style="margin: 15px 0;">
                            <a onclick="navigateTo('store-detail', '${docId}')" class="store-link">
                                <i class="fas fa-store"></i> Browse Store
                            </a>
                        </div>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
}

// Wire up the search input to filter the cached stores
document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('store-search-input');
    if (!search) return;

    search.addEventListener('input', (e) => {
        const q = (e.target.value || '').trim().toLowerCase();
        if (!q) {
            renderStores(storesCache);
            return;
        }

        const filtered = storesCache.filter(s => {
            const name = (s.data.name || '').toLowerCase();
            const cat = (s.data.category || '').toLowerCase();
            const location = (s.data.storeLocation || '').toLowerCase();
            return name.includes(q) || cat.includes(q) || location.includes(q);
        });

        renderStores(filtered);
    });
});

// Function to filter stores from mobile search
function filterStoresFromMobileSearch(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
        renderStores(storesCache);
        return;
    }

    const filtered = storesCache.filter(s => {
        const name = (s.data.name || '').toLowerCase();
        const cat = (s.data.category || '').toLowerCase();
        const location = (s.data.storeLocation || '').toLowerCase();
        return name.includes(q) || cat.includes(q) || location.includes(q);
    });

    renderStores(filtered);
}

// --- UPDATED STORE DETAIL FUNCTION ---
// --- UPDATED: loadStoreDetail (Amazon Style) ---
async function loadStoreDetail(slug) {
    const container = document.getElementById('store-detail-content');
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Loading store...</p></div>';

    // Get the product ID to highlight (if coming from products page)
    const highlightProductId = sessionStorage.getItem('highlightProductId');
    sessionStorage.removeItem('highlightProductId'); // Clear it after reading

    try {
        // Fetch store data
        const storeDoc = await db.collection('stores').doc(slug).get();
        if (!storeDoc.exists) {
            container.innerHTML = '<div class="store-empty-state"><i class="fas fa-store-slash"></i><h3>Store Not Found</h3><p>The store you are looking for does not exist.</p><button onclick="navigateTo(\'stores\')" class="btn btn-primary">Back to Stores</button></div>';
            return;
        }

        const storeData = storeDoc.data();

        document.title = `${storeData.name} | MarketSpace`;

        // Fetch products for this store
        const productsSnap = await db.collection('products').where('storeId', '==', slug).get();
        const products = [];

        productsSnap.forEach(doc => {
            const productData = doc.data();
            products.push({
                id: doc.id,
                name: productData.name,
                price: productData.price || 0,
                originalPrice: productData.originalPrice || null,
                image: productData.imageUrl || '',
                rating: productData.rating || 4.5,
                reviews: productData.reviews || Math.floor(Math.random() * 200), // Mock reviews if missing
                category: productData.category || 'General',
                quantity: productData.quantity || 0,
                discount: productData.discount || null,
                savings: productData.savings || null,
                fastShipping: productData.fastShipping || false
            });
        });

        // Theme mapping (background logic)
        const themeMap = {
            'primary': '#2563eb', 'secondary': '#7c3aed', 'success': '#10b981',
            'warning': '#f59e0b', 'danger': '#ef4444', 'teal': '#06b6d4',
            'pink': '#ec4899', 'orange': '#f97316'
        };
        const themeColor = storeData.backgroundImageUrl ? 'transparent' : (themeMap[storeData.theme] || themeMap['primary']);

        // Render HTML
        container.innerHTML = `
            <div class="store-info-section" style="${storeData.backgroundImageUrl ?
                `background: url('${storeData.backgroundImageUrl}') center/cover no-repeat; position: relative; color: white;` :
                `background: linear-gradient(135deg, ${themeColor}, ${themeColor}dd); color: white;`} padding: 30px; border-radius: 0 0 12px 12px; margin-bottom: 25px;">
                
                ${storeData.backgroundImageUrl ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); border-radius: 0 0 12px 12px; z-index: 0;"></div>` : ''}
                
                <div style="position: relative; z-index: 1; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div style="width: 100px; height: 100px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: bold; color: ${themeColor === 'transparent' ? '#333' : themeColor}; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        ${storeData.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div style="flex: 1; min-width: 250px;">
                        <h1 style="margin: 0; font-size: 2rem; color:white;">${storeData.name}</h1>
                        <p style="margin: 5px 0; opacity: 0.9; font-size: 1rem;"><i class="fas fa-map-marker-alt"></i> ${storeData.storeLocation || 'Online Store'}</p>
                        <div style="display: flex; gap: 10px; margin-top: 10px; font-size: 0.9rem;">
                            <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 4px;"><i class="fas fa-star"></i> ${storeData.rating || '4.8'} Positive</span>
                            <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 4px;"><i class="fas fa-box"></i> ${products.length} Items</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="navigateTo('stores')" class="btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid white;">
                            All Stores
                        </button>
                    </div>
                </div>
            </div>

            <div class="container" style="padding: 0 10px;">
                <h3 style="color: #333; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Products (${products.length})</h3>
                
                ${products.length > 0 ? `
                <div class="products-grid">
                    ${products.map(product => {
                    // Calculate display discount if needed
                    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                    const discountPct = hasDiscount ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

                    return `
                        <div class="product-card" id="product-${product.id}" style="${highlightProductId === product.id ? 'border: 3px solid #2563eb; background: #f0f7ff; box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);' : ''}">
                            ${discountPct > 0 ? `<span class="discount-badge">-${discountPct}%</span>` : ''}
                            ${product.fastShipping ? `<span class="prime-badge">Prime</span>` : ''}
                            ${highlightProductId === product.id ? `<div style="position: absolute; top: 10px; right: 10px; background: #2563eb; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; z-index: 10; display: flex; align-items: center; gap: 5px;"><i class="fas fa-check-circle"></i> From Search</div>` : ''}
                            
                            <div class="product-img" onclick="viewProduct('${product.id}')" style="cursor: pointer;">
                                ${product.image ?
                            `<img src="${product.image}" alt="${product.name}" loading="lazy">` :
                            `<i class="fas fa-box-open" style="font-size: 3rem; color: #e7e7e7;"></i>`}
                            </div>
                            
                            <div class="product-content">
                                <div class="product-category">${product.category}</div>
                                <h4 class="product-name" onclick="viewProduct('${product.id}')" title="${product.name}">${product.name}</h4>
                                
                                <div class="product-rating" style="display: flex; align-items: center; margin-bottom: 5px;">
                                    <span class="stars">
                                        ${'★'.repeat(Math.floor(product.rating))}
                                        ${product.rating % 1 >= 0.5 ? '½' : ''}
                                        ${'☆'.repeat(5 - Math.ceil(product.rating))}
                                    </span>
                                    <span class="rating-count">${product.reviews.toLocaleString()}</span>
                                </div>
                                    <div class="product-price">
                                        <span class="current-price">${formatCurrency(product.price, product.currency || 'GHS')}</span>
                                        
                                        ${hasDiscount ? `<span class="original-price">${formatCurrency(product.originalPrice, product.currency || 'GHS')}</span>` : ''}
                                    </div>

                                    <div class="product-quantity ${product.quantity < 5 ? 'low' : ''}">
                                        ${product.quantity < 5 && product.quantity > 0 ? `Only ${product.quantity} left in stock - order soon.` :
                            product.quantity > 0 ? 'In Stock' : 'Currently Unavailable'}
                                    </div>

                                    <div class="product-actions">
                                        ${currentUser && userRole === 'customer' ? `
                                        <button class="add-to-cart-btn" onclick="addToCart('${product.id}', '${slug}', ${JSON.stringify({
                                name: product.name,
                                price: product.price,
                                currency: product.currency || 'GHS',
                                category: product.category,
                                imageUrl: product.image,
                                quantity: product.quantity
                            }).replace(/"/g, '&quot;')})">
                                            Add to Cart
                                        </button>
                                    
                                    <button class="btn-buy" onclick="buyNow('${product.id}', '${slug}', ${JSON.stringify({
                                name: product.name,
                                price: product.price,
                                currency: product.currency || 'GHS',
                                category: product.category,
                                imageUrl: product.image,
                                quantity: product.quantity
                            }).replace(/"/g, '&quot;')})">
                                        Buy Now
                                    </button>
                                    ` : `
                                    <button onclick="showNotification('Please log in as a customer.')" class="btn-buy" style="background:#f0f0f0; border-color:#d5d9d9; color:#333;">
                                        Login to Buy
                                    </button>
                                    `}
                                    
                                    <button onclick="startChatWithVendor('${storeData.ownerId}', '${storeData.name}', '${slug}', '${product.id}', '${product.name.replace(/'/g, "\\'")}')" 
                                            class="btn btn-outline" style="width: 100%; text-align: center;justify-content: center; background: linear-gradient(135deg, rgba(255, 41, 255,1), rgba(84, 84, 255, 1)); color:white;">
                                        Negotiate
                                    </button>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
                ` : `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-search" style="font-size: 3rem; color: #ddd; margin-bottom: 20px;"></i>
                    <h3 style="color: #333;">No products found in this store</h3>
                    <p style="color: #666;">Check back later or browse other stores.</p>
                </div>
                `}
            </div>
        `;

        // Scroll to highlighted product if it was clicked from search
        if (highlightProductId) {
            // Use setTimeout to ensure the DOM is updated before scrolling
            setTimeout(() => {
                const highlightedElement = document.getElementById(`product-${highlightProductId}`);
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add a pulse animation
                    highlightedElement.style.animation = 'pulse-highlight 2s ease-in-out infinite';
                }
            }, 100);
        }

    } catch (error) {
        console.error('Error loading store detail:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 100px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 20px;"></i>
                <h3>Something went wrong</h3>
                <p>We couldn't load this store. Please try again later.</p>
                <button onclick="loadStoreDetail('${slug}')" class="btn btn-primary" style="margin-top: 15px;">Retry</button>
            </div>
        `;
    }
}

// --- Load Store Public Page ---
async function loadStorePublic(storeSlug) {
    const container = document.getElementById('store-public-content');

    try {
        // Fetch store data
        const storeDoc = await db.collection('stores').doc(storeSlug).get();

        if (!storeDoc.exists) {
            container.innerHTML = `
                <div style="text-align: center; padding: 100px 20px;">
                    <i class="fas fa-store-slash" style="font-size: 4rem; color: var(--gray); margin-bottom: 20px;"></i>
                    <h2 style="color: var(--dark); margin-bottom: 15px;">Store Not Found</h2>
                    <p style="color: var(--gray); margin-bottom: 25px;">The store you're looking for doesn't exist or has been removed.</p>
                    <button onclick="navigateTo('home')" class="btn btn-primary">
                        <i class="fas fa-home"></i> Go to Homepage
                    </button>
                </div>
            `;
            return;
        }

        const storeData = storeDoc.data();

        document.title = `${storeData.name} | MarketSpace`;

        // Check if store is approved
        if (storeData.status !== 'approved') {
            container.innerHTML = `
                <div style="text-align: center; padding: 100px 20px;">
                    <i class="fas fa-clock" style="font-size: 4rem; color: var(--warning); margin-bottom: 20px;"></i>
                    <h2 style="color: var(--dark); margin-bottom: 15px;">Store Not Available</h2>
                    <p style="color: var(--gray); margin-bottom: 25px;">This store is currently ${storeData.status}. Please check back later.</p>
                    <button onclick="navigateTo('stores')" class="btn btn-primary">
                        <i class="fas fa-store"></i> Browse Other Stores
                    </button>
                </div>
            `;
            return;
        }

        // Fetch store products
        const productsSnap = await db.collection('products')
            .where('storeId', '==', storeSlug)
            .where('quantity', '>', 0)
            .get();

        const products = [];
        productsSnap.forEach(doc => {
            const data = doc.data();
            products.push({
                id: doc.id,
                ...data
            });
        });

        // Theme mapping
        const themeMap = {
            'primary': '#2563eb',
            'secondary': '#7c3aed',
            'success': '#10b981',
            'warning': '#f59e0b',
            'danger': '#ef4444',
            'teal': '#06b6d4',
            'pink': '#ec4899',
            'orange': '#f97316'
        };

        const themeColor = storeData.backgroundImageUrl ? 'transparent' : (themeMap[storeData.theme] || themeMap['primary']);

        // Render store page
        container.innerHTML = `
            <!-- Store Header -->
            <div class="store-public-header" style="${storeData.backgroundImageUrl ?
                `background: url('${storeData.backgroundImageUrl}') center/cover no-repeat;` :
                `background: linear-gradient(135deg, ${themeColor}, ${themeColor}80);`} color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; position: relative;">
                <div style="display: flex; align-items: center; gap: 30px;">
                    <div style="width: 120px; height: 120px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; color: ${themeColor};">
                        ${storeData.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <h1 style="margin: 0 0 10px 0; color: white; font-size: 2.5rem;">${storeData.name}</h1>
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                                <i class="fas fa-tag"></i> ${storeData.category}
                            </span>
                            <!-- ADD LOCATION BADGE -->
                            ${storeData.storeLocation ? `
                            <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                                <i class="fas fa-map-marker-alt"></i> ${storeData.storeLocation}
                            </span>
                            ` : ''}
                            <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                                <i class="fas fa-box"></i> ${products.length} products
                            </span>
                        </div>
                        <p style="margin: 0; opacity: 0.9; font-size: 1.1rem; max-width: 600px;">${storeData.description || 'Welcome to our store!'}</p>
                    </div>
                </div>
                
                <!-- Store Actions -->
                <div style="display: flex; gap: 15px; margin-top: 30px;">
                    <button onclick="navigateTo('customer')" class="btn" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
                        <i class="fas fa-shopping-bag"></i> Browse All Stores
                    </button>
                </div>
            </div>
            
            <!-- Store Products -->
            <div style="margin-top: 40px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="color: var(--dark); margin: 0;">Store Products</h2>
                    <span style="color: var(--gray);">${products.length} items</span>
                </div>
                
                <!-- Search Bar -->
                <div style="margin-bottom: 25px;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div style="flex: 1; position: relative;">
                            <input type="text" 
                                   id="store-product-search" 
                                   placeholder="Search products in this store..." 
                                   class="form-control" 
                                   style="padding: 12px 16px 12px 40px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 1rem;"
                                   onkeyup="handleStoreProductSearch(this.value, ${JSON.stringify(products)})">
                            <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--gray);"></i>
                        </div>
                        <button onclick="clearStoreSearch()" class="btn btn-outline" style="white-space: nowrap;">
                            <i class="fas fa-times"></i> Clear
                        </button>
                    </div>
                </div>
                
                ${products.length > 0 ? `
                <div class="products-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px;">
                    ${products.map(product => {
                    const chatButton = `
                            <button onclick="startChatWithVendor('${storeData.ownerId}', '${storeData.name}', '${storeSlug}', '${product.id}', '${product.name.replace(/'/g, "\\'")}')" 
                                    class="btn btn-outline" style="width: 100%; margin-top: 5px; border-color: var(--secondary); color: var(--secondary);">
                                <i class="fas fa-comments"></i> Negotiate / Chat
                            </button>
                        `;

                    return `
                        <div class="product-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: transform 0.3s;">
                            <div class="product-img" style="height: 200px; overflow: hidden; position: relative;">
                                ${product.imageUrl ?
                            `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            `<div style="width: 100%; height: 100%; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-box" style="font-size: 3rem; color: var(--gray);"></i>
                                    </div>`}
 
                           </div>
                            <div class="product-content" style="padding: 20px;">
                                <h3 style="margin: 0 0 10px 0; color: var(--dark); font-size: 1.1rem;">${product.name}</h3>
                                <p style="color: var(--gray); font-size: 0.9rem; margin-bottom: 10px;">${product.category || 'Uncategorized'}</p>
                                <div style="color: var(--primary); font-weight: 600; font-size: 1.2rem; margin-bottom: 10px;">
                                    ${formatCurrency(product.price, product.currency || 'GHS')}
                                </div>
                                <div style="margin-bottom: 15px;">
                                    <span class="${product.quantity < 10 ? 'low-stock' : 'in-stock'}" style="font-size: 0.85rem; padding: 4px 8px; border-radius: 4px; background: ${product.quantity < 10 ? '#fef3c7' : '#f0fdf4'}; color: ${product.quantity < 10 ? '#92400e' : '#166534'};">
                                        ${product.quantity < 10 ? `Only ${product.quantity} left` : `${product.quantity} in stock`}
                                    </span>
                                </div>
                                ${currentUser && userRole === 'customer' ? `
                                <button onclick="addToCart('${product.id}', '${storeSlug}', ${JSON.stringify({
                                name: product.name,
                                price: product.price,
                                currency: product.currency || 'GHS',
                                category: product.category,
                                imageUrl: product.imageUrl || '',
                                quantity: product.quantity
                            }).replace(/"/g, '&quot;')})" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-cart-plus"></i> Add to Cart
                                </button>
                                ` : `
                                <button onclick="showNotification('Please log in as a customer to add items to cart.')" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-cart-plus"></i> Add to Cart
                                </button>
                                `}
                                ${chatButton}
                            </div>
                        </div>
                    `}).join('')}
                </div>
                ` : `
                <div style="text-align: center; padding: 60px 20px; background: #f8fafc; border-radius: 12px;">
                    <i class="fas fa-box-open" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="color: var(--dark); margin-bottom: 10px;">No Products Available</h3>
                    <p style="color: var(--gray);">This store hasn't added any products yet.</p>
                </div>
                `}
            </div>
            
            <!-- Back Button -->
            <div style="text-align: center; margin-top: 40px;">
                <button onclick="navigateTo('stores')" class="btn btn-outline" style="padding: 12px 30px;">
                    <i class="fas fa-arrow-left"></i> Back to All Stores
                </button>
            </div>
        `;
    } catch (error) {
        console.error('Error loading public store:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 100px 20px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; margin-bottom: 20px;"></i>
                <h2>Error Loading Store</h2>
                <p style="margin-bottom: 25px;">There was a problem loading this store. Please try again.</p>
                <button onclick="loadStorePublic('${storeSlug}')" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// --- 12. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page') || 'home';
    const storeParam = urlParams.get('store');

    if (!checkUrlForStore()) {
        navigateTo(pageParam, storeParam);
    }

    updateActiveNav(pageParam);

    setInterval(() => {
        const now = new Date();
        const countdownEl = document.getElementById('countdown');
        // Only try to set innerText if the element actually exists on the current page
        if (countdownEl) {
            countdownEl.innerText = now.toLocaleTimeString();
        }
    }, 1000);

    // Add image preview for product image upload
    const prodImageInput = document.getElementById('prod-image');
    if (prodImageInput) {
        prodImageInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const preview = document.getElementById('image-preview');
                    const previewImg = document.getElementById('preview-img');
                    if (preview && previewImg) {
                        previewImg.src = e.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Terms of Service Functions
function openTosModal() {
    const modal = document.getElementById('tos-modal');
    const content = document.getElementById('tos-content');

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Load TOS content
    loadTosContent();
}

function closeTosModal() {
    document.getElementById('tos-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function loadTosContent() {
    const content = document.getElementById('tos-content');

    // You can hardcode the content or load from an external source
    const tosContent = `
        <h3>MarketSpace Terms of Service</h3>
        <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
        
        <h4>1. Acceptance of Terms</h4>
        <p>By accessing and using MarketSpace, you accept and agree to be bound by the terms and provision of this agreement.</p>
        
        <h4>2. Description of Service</h4>
        <p>MarketSpace is a platform connecting vendors with customers. And not accountable for any loss or damages or mishabs </p>
        <p>THANK YOU FOR CHOOSING MARKETSPACE..</p>
        
    `;

    content.innerHTML = tosContent;
}

// Privacy Policy Functions
function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    const content = document.getElementById('privacy-content');

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Load privacy content
    loadPrivacyContent();
}

function closePrivacyModal() {
    document.getElementById('privacy-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function loadPrivacyContent() {
    const content = document.getElementById('privacy-content');

    const privacyContent = `
        <h3>MarketSpace Privacy Policy</h3>
        <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
        
        <h4>1. Information We Collect</h4>
        <p>We collect information you provide directly to us, such as when you create an account, update your profile, make a purchase, or contact customer support.</p>
        
        <h4>2. How We Use Your Information</h4>
        <p>We use the information we collect to:
        <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send administrative messages and respond to inquiries</li>
            <li>Personalize user experience</li>
            <li>Monitor and analyze usage patterns</li>
        </ul>
        </p>
        
        <h4>3. Information Sharing</h4>
        <p>We do not sell, trade, or rent users' personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information.</p>
        
        <h4>4. Data Security</h4>
        <p>We implement appropriate data collection, storage and processing practices and security measures to protect against unauthorized access, alteration, disclosure or destruction of your personal information.</p>
        
        <h4>5. Your Rights</h4>
        <p>You have the right to access, correct, or delete your personal information. Contact us at privacy@marketspace.com to exercise these rights.</p>
        
        <h4>6. Cookies</h4>
        <p>Our site may use "cookies" to enhance user experience. Users can choose to set their web browser to refuse cookies, or to alert you when cookies are being sent.</p>
        
        <h4>7. Changes to This Policy</h4>
        <p>We may update this privacy policy at any time. We encourage users to frequently check this page for any changes.</p>
        
        <p><em>If you have any questions about this Privacy Policy, please contact us at privacy@marketspace.com</em></p>
    `;

    content.innerHTML = privacyContent;
}

// Close modals when clicking outside
document.addEventListener('DOMContentLoaded', function () {
    // TOS modal
    document.getElementById('tos-modal').addEventListener('click', function (e) {
        if (e.target === this) {
            closeTosModal();
        }
    });

    // Privacy modal
    document.getElementById('privacy-modal').addEventListener('click', function (e) {
        if (e.target === this) {
            closePrivacyModal();
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeTosModal();
            closePrivacyModal();
        }
    });
});
// --- Help Center Modal Functions ---

function openHelpCenterModal() {
    const modal = document.getElementById('help-center-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Pre-fill if user is logged in
    if (currentUser) {
        document.getElementById('help-name').value = currentUser.displayName || '';
        document.getElementById('help-email').value = currentUser.email || '';
        if (userRole) {
            document.getElementById('help-user-type').value = userRole;
        }
    }
}

function closeHelpCenterModal() {
    const modal = document.getElementById('help-center-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('help-center-form').reset();
    }
}

async function submitHelpRequest(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('help-submit-btn');
    const originalBtnText = submitBtn.innerHTML;

    // Get form data
    const name = document.getElementById('help-name').value;
    const email = document.getElementById('help-email').value;
    const phone = document.getElementById('help-phone').value;
    const userType = document.getElementById('help-user-type').value;
    const message = document.getElementById('help-message').value;

    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;

        // 1. Save to Firestore (Visible in your Developer/Firebase Dashboard)
        await db.collection('helpRequests').add({
            name,
            email,
            phone,
            userType,
            message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            userId: currentUser ? currentUser.uid : 'guest'
        });

        // 2. Send Email Notification to Developer (using existing config)
        await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_key: WEB3FORMS_API_KEY,
                from_name: 'MarketSpace Help Center',
                subject: `🆘 New Help Request from ${name} (${userType})`,
                to_email: DEVELOPER_EMAIL,
                message: `
                    New Support Request/Complaint received:
                    
                    Name: ${name}
                    Email: ${email}
                    Phone: ${phone}
                    User Type: ${userType}
                    
                    Message:
                    ${message}
                    
                    Date: ${new Date().toLocaleString()}
                `
            })
        });

        showNotification('✅ Your request has been sent! We will contact you soon.');
        closeHelpCenterModal();
    } catch (error) {
        console.error('Error submitting help request:', error);
        showNotification('❌ Error sending request. Please try again.');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

// Add click-outside listener to close modal
document.addEventListener('DOMContentLoaded', function () {
    const helpModal = document.getElementById('help-center-modal');
    if (helpModal) {
        helpModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeHelpCenterModal();
            }
        });
    }
});

// ==================== CHAT SYSTEM FUNCTIONS ====================

// --- 1. CORE CHAT FUNCTIONS ---

// Chat System Functions
// Chat System Functions
async function startChatWithVendor(vendorId, storeName, storeSlug, productId, productName) {
    // UPDATED CHECK: If not logged in, just show notification and STOP. Do not redirect.
    if (!currentUser) {
        showNotification('Log in as a customer to enjoy this feature');
        return;
    }

    if (userRole !== 'customer') {
        showNotification('Only customers can start chats with vendors.');
        return;
    }

    try {
        // STEP 1: Verify both users exist in Firestore
        console.log('🔍 Verifying users...');

        const customerDoc = await db.collection('users').doc(currentUser.uid).get();
        const vendorDoc = await db.collection('users').doc(vendorId).get();

        if (!customerDoc.exists) {
            console.error('❌ Customer document not found:', currentUser.uid);
            showNotification('Your user profile is incomplete. Please log out and log in again.');
            return;
        }

        if (!vendorDoc.exists) {
            console.error('❌ Vendor document not found:', vendorId);
            showNotification('Vendor profile not found. Please try again later.');
            return;
        }

        console.log('✅ Both users verified');
        console.log('Customer role:', customerDoc.data().role);
        console.log('Vendor role:', vendorDoc.data().role);

        // STEP 2: Create or find chat
        const chatId = [currentUser.uid, vendorId].sort().join('_');
        const chatRef = db.collection('chats').doc(chatId);

        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            console.log('📝 Creating new chat:', chatId);

            const chatData = {
                participants: [currentUser.uid, vendorId],
                customerId: currentUser.uid,
                vendorId: vendorId,
                storeName: storeName,
                customerName: currentUser.displayName || customerDoc.data().name || 'Customer',
                storeId: storeSlug,
                productId: productId || null,
                productName: productName || 'products',
                lastMessage: `Started chat about ${productName || 'products'}`,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                unreadCountCustomer: 0,
                unreadCountVendor: 0
            };

            await chatRef.set(chatData);
            console.log('✅ Chat created successfully');
        } else {
            console.log('✅ Chat already exists');
        }

        // STEP 3: Open chat modal
        openChatModal();
        loadConversation(chatId, storeName, vendorId);

    } catch (error) {
        console.error('❌ Error starting chat:', error);
        console.error('Full error:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });

        // User-friendly error messages
        if (error.code === 'permission-denied') {
            showNotification('⚠️ Unable to start chat. Please ensure you are logged in as a customer.');
        } else {
            showNotification('Error starting chat: ' + error.message);
        }
    }
}

/**
 * Loads the specific conversation messages
 */
function loadConversation(chatId, recipientName, recipientId) {
    activeChatId = chatId;

    // UI Updates
    document.getElementById('chat-list-view').style.display = 'none';
    document.getElementById('chat-conversation-view').style.display = 'flex';
    document.getElementById('chat-back-btn').style.display = 'block';
    document.getElementById('chat-recipient-name').textContent = recipientName;
    document.getElementById('chat-status').textContent = 'Online'; // Placeholder logic

    const messagesArea = document.getElementById('chat-messages-area');
    messagesArea.innerHTML = ''; // Clear previous

    // Detach previous listener if exists
    if (chatUnsubscribe) chatUnsubscribe();

    // Listen for messages in real-time
    chatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    appendMessageBubble(msg, messagesArea);
                }
            });
            // Auto scroll to bottom
            messagesArea.scrollTop = messagesArea.scrollHeight;

            // Mark as read (reset unread count for current user)
            resetUnreadCount(chatId);
        });
}

function appendMessageBubble(msg, container) {
    const isMe = msg.senderId === currentUser.uid;
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;
    bubble.innerHTML = `
        ${msg.text}
        <span class="chat-time">${time}</span>
    `;
    container.appendChild(bubble);
}

/**
 * Sends a message
 */
document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text || !activeChatId) return;

    input.value = ''; // Clear immediately for UX

    try {
        // 1. Add message to subcollection
        await db.collection('chats').doc(activeChatId).collection('messages').add({
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Update parent chat document (for Inbox view preview)
        // Determine who the "other" person is to increment their unread count
        // Note: In a real app, we'd fetch the doc to see who is vendor/customer, 
        // but for simplicity assuming if I am customer, increment vendor count.

        const isCustomer = userRole === 'customer';
        const updateData = {
            lastMessage: text,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Atomic increment for unread count
        if (isCustomer) {
            updateData.unreadCountVendor = firebase.firestore.FieldValue.increment(1);
        } else {
            updateData.unreadCountCustomer = firebase.firestore.FieldValue.increment(1);
        }

        await db.collection('chats').doc(activeChatId).update(updateData);

    } catch (error) {
        console.error("Error sending message:", error);
        showNotification("Failed to send message");
    }
});

// --- 2. INBOX LOGIC ---

/**
 * Loads the list of all conversations for the current user
 */
function loadChatInbox() {
    if (!currentUser) return;

    // Reset UI
    document.getElementById('chat-list-view').style.display = 'block';
    document.getElementById('chat-conversation-view').style.display = 'none';
    document.getElementById('chat-back-btn').style.display = 'none';
    document.getElementById('chat-recipient-name').textContent = 'Messages';
    document.getElementById('chat-status').textContent = '';

    const container = document.getElementById('chat-inbox-container');

    // Determine query based on role
    // If vendor, finding chats where I am the vendor. If customer, where I am customer.
    // Ideally, just query "participants array-contains myUID"

    if (inboxUnsubscribe) inboxUnsubscribe();

    inboxUnsubscribe = db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('lastUpdated', 'desc')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px; color: #e2e8f0;"></i>
                        <p>No messages yet.</p>
                        ${userRole === 'customer' ? '<button onclick="closeChatModal(); navigateTo(\'stores\')" class="btn btn-primary btn-sm">Start Negotiating</button>' : ''}
                    </div>`;
                return;
            }

            container.innerHTML = '';

            snapshot.forEach(doc => {
                const chat = doc.data();
                const isCustomer = currentUser.uid === chat.customerId;

                // If I am customer, I chat with Store Name. If I am Vendor, I chat with Customer Name.
                const recipientName = isCustomer ? chat.storeName : chat.customerName;
                const recipientId = isCustomer ? chat.vendorId : chat.customerId;

                // Unread status
                const unreadCount = isCustomer ? chat.unreadCountCustomer : chat.unreadCountVendor;
                const isUnread = unreadCount > 0;

                const date = chat.lastUpdated ? new Date(chat.lastUpdated.toDate()).toLocaleDateString() : '';

                const div = document.createElement('div');
                div.className = `chat-inbox-item ${isUnread ? 'unread' : ''}`;
                div.onclick = () => {
                    // Update header specific logic for back button
                    loadConversation(doc.id, recipientName, recipientId);
                };

                div.innerHTML = `
                    <div class="chat-avatar">${recipientName.charAt(0).toUpperCase()}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${recipientName}</strong>
                            <span style="font-size: 0.75rem; color: var(--gray);">${date}</span>
                        </div>
                        <p style="margin: 0; color: var(--gray); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isUnread ? 'font-weight: 700; color: var(--dark);' : ''}">
                            ${chat.lastMessage}
                        </p>
                    </div>
                    ${isUnread ? `<div style="background: var(--danger); color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; display: flex; align-items: center; justify-content: center;">${unreadCount}</div>` : ''}
                `;
                container.appendChild(div);
            });
        });
}

function resetUnreadCount(chatId) {
    if (!currentUser) return;
    const isCustomer = userRole === 'customer';

    const updateData = {};
    if (isCustomer) updateData.unreadCountCustomer = 0;
    else updateData.unreadCountVendor = 0;

    db.collection('chats').doc(chatId).update(updateData).catch(err => console.log(err));
}

// --- 3. UI HANDLERS ---

function openChatModal() {
    document.getElementById('chat-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadChatInbox(); // Default to inbox view
}

function closeChatModal() {
    document.getElementById('chat-modal').style.display = 'none';
    document.body.style.overflow = '';
}

function backToChatList() {
    // Stop listening to active conversation
    if (chatUnsubscribe) chatUnsubscribe();
    loadChatInbox();
}

function showChatLoading() {
    // Helper to show spinner while transitioning
}

// --- 4. INTEGRATION INTO EXISTING UI ---

// Call this in your auth listener to show floating button
function updateFloatingChatButton() {
    const btn = document.getElementById('floating-chat-btn');
    if (currentUser) {
        btn.style.display = 'flex';
        // Listen for total unread
        // (Simplified: just check inbox listener)
    } else {
        btn.style.display = 'none';
    }
}
// Function to set user role as custom claim
async function setUserCustomClaims(userId, role) {
    console.log(`User ${userId} has role: ${role}`);
    // In production, implement with Firebase Cloud Functions
}
// Function to open tracking
async function trackOrder(orderId) {
    const modal = document.getElementById('order-tracking-modal');
    const content = document.getElementById('tracking-content');
    modal.style.display = 'flex';
    content.innerHTML = '<p>Loading tracking info...</p>';

    try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (!doc.exists) {
            content.innerHTML = '<p>Order not found.</p>';
            return;
        }

        const order = doc.data();
        const status = order.status || 'pending';

        // Map status to steps
        const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
        const currentStepIndex = steps.indexOf(status);

        content.innerHTML = `
            <div class="tracking-info">
                <p><strong>Order ID:</strong> #${doc.id.slice(0, 8)}</p>
                <p><strong>Status:</strong> <span class="badge ${status}">${status.toUpperCase()}</span></p>
            </div>
            <div class="tracking-visual">
                ${steps.map((step, index) => `
                    <div class="progress-step ${index <= currentStepIndex ? 'active' : ''}">
                        <div class="step-icon">${index + 1}</div>
                        <span class="step-label">${step.charAt(0).toUpperCase() + step.slice(1)}</span>
                    </div>
                    ${index < steps.length - 1 ? `<di
v class="progress-line ${index < currentStepIndex ? 'active' : ''}"></div>` : ''}
                `).join('')}
            </div>
            <div class="order-items-summary">
                <h4>Items</h4>
                ${order.items.map(item => `<p>${item.name} x ${item.quantity}</p>`).join('')}
            </div>
        `;
    } catch (error) {
        console.error("Error tracking order:", error);
        content.innerHTML = '<p>Error loading tracking information.</p>';
    }
}

function closeTrackingModal() {
    document.getElementById('order-tracking-modal').style.display = 'none';
}
// ==================== RECEIPT GENERATOR SYSTEM ====================

// ==================== RECEIPT GENERATOR SYSTEM ====================

// Initialize receipt tab
function initReceiptGenerator() {
    if (!currentStoreData) return;

    // Pre-fill Store Info in Preview
    document.getElementById('preview-store-name').textContent = currentStoreData.name;
    document.getElementById('preview-store-contact').textContent = currentStoreData.storeLocation || 'Online Store';

    // Set default date to today
    document.getElementById('rec-date').valueAsDate = new Date();
    updateReceiptPreview();

    // Add first empty row if none exist
    const container = document.getElementById('receipt-items-inputs');
    if (container.children.length === 0) {
        addReceiptItemRow();
    }
}

// Add a new input row for items
function addReceiptItemRow() {
    const container = document.getElementById('receipt-items-inputs');
    const rowId = 'row-' + Date.now();

    const div = document.createElement('div');
    div.className = 'rec-item-row';
    div.id = rowId;

    div.innerHTML = `
        <input type="text" class="form-control rec-input-name" placeholder="Item Name" oninput="updateReceiptPreview()">
        <input type="number" class="form-control rec-input-qty" placeholder="Qty" value="1" min="1" oninput="updateReceiptPreview()">
        <input type="number" class="form-control rec-input-price" placeholder="Price" min="0" oninput="updateReceiptPreview()">
        <button onclick="removeReceiptRow('${rowId}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(div);
}

// Remove an input row
function removeReceiptRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    updateReceiptPreview();
}

// Update the visual preview based on form inputs
function updateReceiptPreview() {
    // Customer Info
    const custName = document.getElementById('rec-cust-name').value;
    const dateVal = document.getElementById('rec-date').value;
    const payment = document.getElementById('rec-payment').value;

    document.getElementById('preview-cust-name').textContent = custName || 'Customer Name';
    document.getElementById('preview-date').textContent = dateVal || new Date().toLocaleDateString();
    document.getElementById('preview-payment-method').textContent = payment;

    // Generate Random Receipt ID based on date
    if (!document.getElementById('preview-rec-id').dataset.fixed) {
        document.getElementById('preview-rec-id').textContent = 'RCPT-' + Math.floor(Math.random() * 10000);
        document.getElementById('preview-rec-id').dataset.fixed = "true";
    }

    // Items Logic
    const rows = document.querySelectorAll('.rec-item-row');
    const previewBody = document.getElementById('preview-items-body');
    let total = 0;

    previewBody.innerHTML = ''; // Clear current preview rows

    rows.forEach(row => {
        const name = row.querySelector('.rec-input-name').value;
        const qty = parseFloat(row.querySelector('.rec-input-qty').value) || 0;
        const price = parseFloat(row.querySelector('.rec-input-price').value) || 0;

        if (name) {
            const lineTotal = qty * price;
            total += lineTotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${name}</td>
                <td>${qty}</td>
                <td style="text-align:right;">${formatCurrency(lineTotal, 'GHS')}</td>
            `;
            previewBody.appendChild(tr);
        }
    });

    // Update Total
    document.getElementById('preview-total-amount').textContent = formatCurrency(total, 'GHS');
}

// Trigger Print
function generateAndPrintReceipt() {
    // Validate
    const rows = document.querySelectorAll('.rec-item-row');
    let hasItems = false;
    rows.forEach(row => {
        if (row.querySelector('.rec-input-name').value) hasItems = true;
    });

    if (!hasItems) {
        showNotification('Please add at least one item.');
        return;
    }

    // Trigger browser print
    // The CSS @media print rule handles hiding the UI and showing only the receipt
    window.print();
}

// Hook into the showAdminTab function
const originalShowAdminTab = window.showAdminTab;
window.showAdminTab = function (tab) {
    // Call original function
    if (originalShowAdminTab) originalShowAdminTab(tab);

    // If opening receipt tab, initialize it
    if (tab === 'receipt') {
        initReceiptGenerator();
    }
};
// --- Function to Open Full Image Modal ---
function openImageModal(src, alt) {
    const modal = document.getElementById('image-view-modal');
    const modalImg = document.getElementById('full-product-image');
    const captionText = document.getElementById('image-caption');

    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerHTML = alt || "Product Image";

    // Prevent background scrolling
    document.body.style.overflow = "hidden";
}


// --- Close Modal Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.querySelector('.close-image-modal');
    if (closeBtn) {
        closeBtn.onclick = function () {
            const modal = document.getElementById('image-view-modal');
            if (modal) {
                modal.style.display = "none";
                document.body.style.overflow = "auto";
            }
        };
    }
});
// Close when clicking outside the image
window.onclick = function (event) {
    const modal = document.getElementById('image-view-modal');
    if (event.target == modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
}

// --- Global Event Listener for Product Images ---
// --- Global Event Listener for Product Images ---
document.addEventListener('click', function (e) {
    // Check if the clicked element is a product image
    if (e.target.classList.contains('product-card-image') ||
        (e.target.tagName === 'IMG' && e.target.closest('.product-card'))) {
        const card = e.target.closest('.product-card');

        // COMMENT OUT OR REMOVE THE LINES BELOW:
        /*
        const imgSrc = e.target.src;
        const imgAlt = e.target.alt;
        openImageModal(imgSrc, imgAlt);
        */
    }
});
// ==================== OFFLINE DETECTION SYSTEM ====================

// Function to update online status
function updateOnlineStatus() {
    const offlineOverlay = document.getElementById('offline-overlay');

    if (navigator.onLine) {
        // User is back online
        if (offlineOverlay.classList.contains('active')) {
            offlineOverlay.classList.remove('active');
            showNotification('Back online! Connection restored.');

            // Optional: Reload data if needed
            // const activePage = document.querySelector('.page.active');
            // if (activePage && activePage.id === 'products-page') loadAmazonProducts();
        }
    } else {
        // User is offline
        offlineOverlay.classList.add('active');
    }
}

// Add Event Listeners
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Check on initial load
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check the URL for "page" and "store" parameters
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const storeParam = urlParams.get('store');

    // 2. Decide where to go - ALWAYS respect URL parameters
    if (pageParam) {
        // Navigate to the page specified in URL (including protected pages)
        // The auth listener will handle redirects if user doesn't have permission
        navigateTo(pageParam, storeParam);
    } else if (storeParam) {
        // Support for old links (e.g. ?store=xyz)
        navigateTo('store-detail', storeParam);
    } else {
        // ONLY go to home if there are NO URL parameters at all
        navigateTo('home');
    }

    // Keep your clock interval
    setInterval(() => {
        const now = new Date();
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.innerText = now.toLocaleTimeString();
    }, 1000);
});
function switchAuthTab(tab) {
    const loginView = document.getElementById('auth-login-view');
    const signupView = document.getElementById('auth-signup-view');
    // const tabs = document.querySelectorAll('.tab'); <--- This line in your JS might throw a harmless error because we removed the old .tab elements, but the logic below works.

    // tabs.forEach(t => t.classList.remove('active')); <--- This part of your JS is no longer needed but won't break the app.

    if (tab === 'login') {
        loginView.style.display = 'block';
        signupView.style.display = 'none';
        // tabs[0].classList.add('active'); 
    } else {
        loginView.style.display = 'none';
        signupView.style.display = 'block';
        // tabs[1].classList.add('active');
    }
}
// Listen for the browser "Back" button
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') || 'home';
    const storeParam = urlParams.get('store');
    navigateTo(page, storeParam);
});
// --- Learn More Modal Functions ---

function openLearnMoreModal() {
    const modal = document.getElementById('learn-more-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function closeLearnMoreModal() {
    const modal = document.getElementById('learn-more-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Close modal when clicking outside content
document.addEventListener('DOMContentLoaded', function () {
    const learnModal = document.getElementById('learn-more-modal');
    if (learnModal) {
        learnModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeLearnMoreModal();
            }
        });
    }
});

// Add ESC key support
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const learnModal = document.getElementById('learn-more-modal');
        if (learnModal && learnModal.style.display === 'flex') {
            closeLearnMoreModal();
        }
    }
});
// ... [Previous code remains unchanged] ...

// --- Helper Function for Image Compression ---
function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions keeping aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with specified quality (0.0 to 1.0)
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// ========== UPDATED: Product Form Handler (Auto-Compression) ==========
// Constants for product limits
const PRODUCT_LIMIT = 30;

// Check product count against limit
async function checkProductLimit() {
    if (!currentStoreData) return 0;
    const snapshot = await db.collection('products').where('storeId', '==', currentStoreData.docId).get();
    return snapshot.size;
}

// Check if store has unlimited products permission
async function hasUnlimitedProducts() {
    if (!currentStoreData) return false;
    const storeDoc = await db.collection('stores').doc(currentStoreData.docId).get();
    return storeDoc.exists && storeDoc.data().unlimitedProducts === true;
}

// Submit request for unlimited products
async function submitUnlimitedProductsRequest() {
    if (!currentStoreData) {
        showNotification('Store not found.');
        return;
    }

    const reason = document.getElementById('unlimited-request-reason').value.trim();

    if (!reason) {
        showNotification('Please provide a reason for your request.');
        return;
    }

    const submitBtn = document.querySelector('[onclick="submitUnlimitedProductsRequest()"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    try {
        // Check if vendor already has a pending request
        const existingRequest = await db.collection('unlimited_product_requests')
            .where('vendorId', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get();

        if (!existingRequest.empty) {
            showNotification('⏳ You already have a pending request. Please wait for admin approval.');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        // Create request
        await db.collection('unlimited_product_requests').add({
            vendorId: currentUser.uid,
            storeId: currentStoreData.docId,
            storeName: currentStoreData.name,
            storeSlug: currentStoreData.slug,
            vendorEmail: currentUser.email,
            reason: reason,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedAt: null,
            reviewedBy: null,
            approvalNotes: ''
        });

        showNotification('✅ Request submitted! Admin will review your request soon.');
        document.getElementById('unlimited-request-reason').value = '';

        // Notify admin
        sendUnlimitedRequestNotification(currentStoreData.name, currentUser.email, reason);

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error submitting request: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Send notification email to admin about unlimited request
async function sendUnlimitedRequestNotification(storeName, vendorEmail, reason) {
    try {
        emailjs.send('service_byu91od', 'template_mgtx04w', {
            from_name: 'MarketSpace Admin',
            subject: `🚀 New Unlimited Products Request: ${storeName}`,
            to_email: DEVELOPER_EMAIL,
            message: `
                New Unlimited Products Request
                
                Store Name: ${storeName}
                Vendor Email: ${vendorEmail}
                
                Reason:
                ${reason}
                
                Please log in to your Developer Dashboard to review and approve/reject this request.
            `
        });
        console.log('✅ Admin notification sent');
    } catch (error) {
        console.warn('⚠️ Failed to send admin notification:', error);
    }
}

document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentStoreData) {
        showNotification('Store not found.');
        return;
    }

    const name = document.getElementById('prod-name').value;
    const description = document.getElementById('prod-description').value;
    const price = document.getElementById('prod-price').value;
    const currency = document.getElementById('prod-currency').value;
    const quantity = document.getElementById('prod-quantity').value;
    const category = document.getElementById('prod-category').value;
    const imageFile = document.getElementById('prod-image').files[0];

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;

    try {
        // CHECK PRODUCT LIMIT
        const productCount = await checkProductLimit();
        const isUnlimited = await hasUnlimitedProducts();

        if (!isUnlimited && productCount >= PRODUCT_LIMIT) {
            showNotification(`❌ You've reached the ${PRODUCT_LIMIT} product limit. Request unlimited products to add more.`);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            // Auto-scroll to request section
            const requestSection = document.getElementById('unlimited-products-section');
            if (requestSection) {
                requestSection.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

        let imageUrl = '';

        // Handle image with Auto-Compression
        if (imageFile) {
            try {
                // Compress image to max 800x800px and 70% quality
                // This drastically reduces file size while keeping it good for web
                showNotification('Optimizing image...');
                imageUrl = await compressImage(imageFile, 800, 800, 0.7);

                // Final safety check: Firestore document limit is 1MB (~1,048,576 bytes)
                // Base64 string length * 0.75 gives approximate byte size
                if (imageUrl.length > 1048576) {
                    // If still too big, try aggressive compression
                    console.warn("Image still too large, retrying with lower quality...");
                    imageUrl = await compressImage(imageFile, 600, 600, 0.5);
                }

                if (imageUrl.length > 1048576) {
                    throw new Error("Image is too complex to compress. Please choose a simpler or smaller image.");
                }

            } catch (imgError) {
                console.error("Compression failed:", imgError);
                showNotification("Failed to process image. " + imgError.message);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
        }

        // Add to Firestore
        await db.collection('products').add({
            name: name,
            description: description,
            price: parseFloat(price),
            currency: currency,
            quantity: parseInt(quantity),
            category: category,
            imageUrl: imageUrl,
            storeId: currentStoreData.docId,
            vendorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('✅ Product added successfully!');
        document.getElementById('add-product-form').reset();

        // Hide image preview if exists
        const preview = document.getElementById('image-preview');
        if (preview) preview.style.display = 'none';

        setTimeout(() => showAdminTab('products'), 1000);

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});
// --- Hero Section Image Slider ---
document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.querySelector('.hero');

    // Array of images to loop through
    // You can replace these URLs with your own image paths (e.g., 'cover2.jpg')
    const heroImages = [
        'cover1.jpg',
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1470&auto=format&fit=crop',
        'https://media.licdn.com/dms/image/v2/D4E05AQG_5KdAufMAXQ/feedshare-thumbnail_720_1280/feedshare-thumbnail_720_1280/0/1720806417985?e=2147483647&v=beta&t=lzuPm8uEzPFfu9wdHvLHQLsXvHBxSBrQg2Wnk0NqXBc',
        'https://www.knust.edu.gh/sites/default/files/2021-12/Fresh%20Foods%20Fair.jpg',
        'https://www.knust.edu.gh/sites/default/files/2018-04/KSB%20Students%20Reach%20Out%20to%20Traders.jpg',
        'https://media.evendo.com/locations-resized/ShoppingImages/360x263/d9ac0d69-4543-4150-ac55-d9eb30b63c0c',
        'https://businessnes.com/wp-content/uploads/2019/10/edgar-chaparro-AAHxr7ZvCLs-unsplash.jpg',
        'https://fourthwall.com/webflow-cdn/63ff7c6ecc83f9ec7ffe916b/689548323e6d743a377abd3f_15backtoschoo-ezgif.com-png-to-webp-converter.webp',
        'https://www.campusrepghana.com/assets/Background%20Transition3-DZu6pee2.jpg'
    ];

    let currentImageIndex = 0;

    // Preload images to prevent flickering/white flashes
    heroImages.forEach((src) => {
        const img = new Image();
        img.src = src;
    });

    // Function to change background
    function rotateHeroImage() {
        if (!heroSection) return;

        currentImageIndex = (currentImageIndex + 1) % heroImages.length;
        heroSection.style.backgroundImage = `url('${heroImages[currentImageIndex]}')`;
    }

    // Change image every 5 seconds (5000ms)
    setInterval(rotateHeroImage, 5000);
});
// --- Social Login Handler ---
async function handleSocialLogin(providerName) {
    let provider;

    try {
        if (providerName === 'google') {
            provider = new firebase.auth.GoogleAuthProvider();
        } else if (providerName === 'twitter') {
            provider = new firebase.auth.TwitterAuthProvider();
        } else if (providerName === 'instagram') {
            // Instagram auth is complex in Firebase (often requires custom OpenID).
            // Usually, developers use Facebook Auth to handle Instagram users.
            showNotification('Instagram login requires Facebook linking. Please try another method for now.');
            return;
        }

        // Trigger the popup
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;

        // Determine Role (Default to customer if new)
        let role = 'customer';

        // If it's a new user, save them to Firestore
        if (isNewUser) {
            // Check if user selected a role in the signup form, otherwise default
            const roleSelect = document.getElementById('signup-role');
            if (roleSelect && roleSelect.value) {
                role = roleSelect.value;
            }

            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                role: role,
                photoUrl: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                provider: providerName
            });

            showNotification(`Welcome, ${user.displayName}! Account created.`);
        } else {
            // Existing user - fetch their role
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                role = userDoc.data().role;
            }
            showNotification(`Welcome back, ${user.displayName || 'User'}!`);
        }

        // Navigate based on role
        setTimeout(() => {
            if (role === 'vendor') navigateTo('store-admin');
            else if (role === 'developer') navigateTo('developer');
            else if (role === 'customer') navigateTo('products'); // or customer-orders
            else navigateTo('home');
        }, 1000);

    } catch (error) {
        console.error('Social login error:', error);
        if (error.code === 'auth/account-exists-with-different-credential') {
            showNotification('An account already exists with the same email but different sign-in credentials.');
        } else {
            showNotification(error.message);
        }
    }
}
// --- Password Visibility Toggle ---
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (!input || !icon) return;

    if (input.type === "password") {
        // Switch to text (Show Password)
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        // Switch back to password (Hide Password)
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}// --- FOOD PAGE LOGIC ---

let foodListAll = [];
let foodListFiltered = [];
let currentFoodPage = 1;



// 3. Main Food Loading Function
async function loadFoodProducts() {
    const container = document.getElementById('food-products-grid');
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
            <div class="spinner"></div>
            <p>Cooking up the menu...</p>
        </div>
    `;

    try {
        // Query products where category is 'food' OR check for related keywords
        // Note: Ideally, query Firestore directly for efficiency. 
        // For simplicity with existing structure, we fetch all and filter or use compound queries.

        const snapshot = await db.collection('products')
            .where('category', '==', 'food')
            .get();

        if (snapshot.empty) {
            foodListAll = [];
            foodListFiltered = [];
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-utensils" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px;">No Food Items Found</h3>
                    <p>Check back later for delicious meals!</p>
                </div>
            `;
            document.getElementById('food-count').textContent = `0 items`;
            return;
        }

        // Store data
        foodListAll = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        foodListFiltered = foodListAll; // Initial view is all food

        // Render first page
        currentFoodPage = 1;
        renderFoodPage(currentFoodPage);

    } catch (error) {
        console.error('Error loading food:', error);
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center;">Error loading food items.</p>`;
    }
}

// 4. Render Function (Pagination)
function renderFoodPage(page) {
    const container = document.getElementById('food-products-grid');
    const itemsPerPage = 12;
    const totalItems = foodListFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    page = Math.max(1, Math.min(page, totalPages));
    currentFoodPage = page;

    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalItems);
    const slice = foodListFiltered.slice(start, end);

    if (slice.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center;">No matching food items found.</div>`;
    } else {
        // Reuse the existing buildProductCard function for consistency
        container.innerHTML = slice.map(p => buildProductCard(p.id, p.data)).join('');
    }

    // Update Counts
    document.getElementById('food-count').textContent = `${start + 1}-${end} of ${totalItems} items`;

    // Update Pagination UI
    const pageNumbersEl = document.getElementById('food-page-numbers');
    if (pageNumbersEl) {
        pageNumbersEl.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i > 5 && i < totalPages) continue; // Simple truncation logic

            const span = document.createElement('span');
            span.className = 'page-number' + (i === page ? ' active' : '');
            span.textContent = i;
            span.onclick = () => renderFoodPage(i);
            pageNumbersEl.appendChild(span);
        }
    }
}

// 5. Search Function
function searchFoodProducts(term) {
    const lowerTerm = term.toLowerCase().trim();

    if (!lowerTerm) {
        foodListFiltered = foodListAll;
    } else {
        foodListFiltered = foodListAll.filter(p => {
            const name = (p.data.name || '').toLowerCase();
            const desc = (p.data.description || '').toLowerCase();
            return name.includes(lowerTerm) || desc.includes(lowerTerm);
        });
    }

    currentFoodPage = 1;
    renderFoodPage(1);
}

// 6. Pagination Controls
function prevFoodPage() {
    if (currentFoodPage > 1) renderFoodPage(currentFoodPage - 1);
}

function nextFoodPage() {
    const itemsPerPage = 12;
    const totalPages = Math.ceil(foodListFiltered.length / itemsPerPage);
    if (currentFoodPage < totalPages) renderFoodPage(currentFoodPage + 1);
}

// 7. Apply Filters (Sidebar)
function applyFoodFilters() {
    const meals = document.getElementById('food-cat-meals')?.checked;
    const groceries = document.getElementById('food-cat-groceries')?.checked;
    const drinks = document.getElementById('food-cat-drinks')?.checked;
    const maxPrice = parseFloat(document.getElementById('food-price-slider')?.value) || 1000;

    foodListFiltered = foodListAll.filter(p => {
        const d = p.data;
        const price = parseFloat(d.price) || 0;

        // Price Filter
        if (price > maxPrice) return false;

        // Category Filter (Basic Text Matching within Description or Name if Vendor didn't sub-categorize)
        // Since we only have one 'category' field in DB set to 'food', we verify via description keywords
        // Or you can advise Vendors to put "Drink" in the title.
        let text = (d.name + ' ' + d.description).toLowerCase();

        let matchesType = true;
        if (meals || groceries || drinks) {
            matchesType = false;
            if (meals && (text.includes('meal') || text.includes('rice') || text.includes('fufu') || text.includes('banku'))) matchesType = true;
            if (groceries && (text.includes('vegetable') || text.includes('oil') || text.includes('tin'))) matchesType = true;
            if (drinks && (text.includes('drink') || text.includes('water') || text.includes('juice') || text.includes('soda'))) matchesType = true;
        }

        return matchesType;
    });

    currentFoodPage = 1;
    renderFoodPage(1);
}
// --- Toggle Wishlist directly from Product Card ---
function toggleWishlist(event, productId, storeId, productData) {
    // Prevent the click from triggering the product detail modal
    event.stopPropagation();

    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in as a customer to save items.');
        return;
    }

    // Initialize store in wishlist if needed
    if (!wishlist[storeId]) wishlist[storeId] = {};

    const btn = event.currentTarget;
    const icon = btn.querySelector('i');

    if (wishlist[storeId][productId]) {
        // Item exists, REMOVE it
        delete wishlist[storeId][productId];
        if (Object.keys(wishlist[storeId]).length === 0) {
            delete wishlist[storeId];
        }

        // Update UI Visuals
        btn.classList.remove('active');
        icon.classList.remove('fas');
        icon.classList.add('far'); // Outline heart

        showNotification('Removed from Saved Items');
    } else {
        // Item doesn't exist, ADD it
        wishlist[storeId][productId] = {
            ...productData,
            savedAt: new Date().toISOString()
        };

        // Update UI Visuals
        btn.classList.add('active');
        icon.classList.remove('far');
        icon.classList.add('fas'); // Solid heart

        showNotification('Added to Saved for Later');
    }

    // Save changes
    saveWishlist();

    // If we are currently on the Cart/Wishlist page, refresh it
    const cartPage = document.getElementById('cart-page');
    if (cartPage && cartPage.classList.contains('active')) {
        renderCartPage();
    }
}
// ==================== COMPARE PRODUCTS LOGIC ====================

// 1. Toggle Product in Compare List
function toggleCompare(checkbox, product) {
    // Ensure compareList is initialized
    if (typeof compareList === 'undefined') window.compareList = [];

    if (checkbox.checked) {
        // Check limit
        if (compareList.length >= MAX_COMPARE_ITEMS) {
            checkbox.checked = false;
            showNotification(`You can only compare up to ${MAX_COMPARE_ITEMS} items.`);
            return;
        }

        // Avoid duplicates
        if (!compareList.some(p => p.id === product.id)) {
            compareList.push(product);
            showNotification('Added to comparison');
        }
    } else {
        // Remove from list
        compareList = compareList.filter(p => p.id !== product.id);
    }

    updateCompareTrayUI();
}

// 2. Remove specific item (from Tray)
function removeFromCompare(productId) {
    compareList = compareList.filter(p => p.id !== productId);

    // Uncheck the box in the grid if visible
    const inputs = document.querySelectorAll(`input[onchange*="${productId}"]`);
    inputs.forEach(input => input.checked = false);

    updateCompareTrayUI();
}

// 3. Clear All
function clearCompareList() {
    compareList = [];
    document.querySelectorAll('.compare-checkbox-container input').forEach(i => i.checked = false);
    updateCompareTrayUI();
}

// 4. Update Tray UI
function updateCompareTrayUI() {
    const tray = document.getElementById('compare-tray');
    const container = document.getElementById('compare-thumbnails');
    const countEl = document.getElementById('compare-count');
    const btn = document.getElementById('btn-compare-now');

    // Safety check if elements exist
    if (!tray || !container) return;

    if (compareList.length > 0) {
        tray.style.display = 'block';
    } else {
        tray.style.display = 'none';
        return;
    }

    // Update Count
    if (countEl) countEl.textContent = compareList.length;
    if (btn) btn.disabled = compareList.length < 2;

    // Render Thumbnails
    container.innerHTML = compareList.map(p => `
        <div class="compare-thumb">
            <img src="${p.imageUrl || 'placeholder.png'}" alt="product">
            <div class="compare-thumb-remove" onclick="removeFromCompare('${p.id}')">
                <i class="fas fa-times"></i>
            </div>
        </div>
    `).join('');
}

// 5. Open Modal & Render Table
function openCompareModal() {
    if (compareList.length < 2) return;

    const modal = document.getElementById('compare-modal');
    const container = document.getElementById('compare-table-container');

    if (!modal || !container) return;

    let tableHtml = `<table class="compare-table"><tbody>`;

    // Define rows to compare
    const rows = [
        { label: 'Image', key: 'image' },
        { label: 'Name', key: 'name' },
        { label: 'Price', key: 'price' },
        { label: 'Rating', key: 'rating' },
        { label: 'Category', key: 'category' },
        { label: 'Availability', key: 'quantity' },
        { label: 'Description', key: 'description' },
        { label: '', key: 'action' }
    ];

    rows.forEach(row => {
        tableHtml += `<tr><td>${row.label}</td>`;

        compareList.forEach(product => {
            let content = '';

            if (row.key === 'image') {
                content = product.imageUrl
                    ? `<img src="${product.imageUrl}" class="compare-img-large">`
                    : `<div style="height:150px; background:#f0f0f0; display:flex; align-items:center; justify-content:center;"><i class="fas fa-box fa-2x"></i></div>`;
            } else if (row.key === 'name') {
                content = `<strong>${product.name}</strong>`;
            } else if (row.key === 'price') {
                // Ensure currency function exists, fallback if not
                const currency = product.currency || 'GHS';
                content = `<span class="compare-price">${typeof formatCurrency === 'function' ? formatCurrency(product.price, currency) : product.price}</span>`;
            } else if (row.key === 'rating') {
                content = `<span>${'★'.repeat(Math.floor(product.rating || 0))}<span style="color:#ddd">${'★'.repeat(5 - Math.floor(product.rating || 0))}</span></span>`;
            } else if (row.key === 'quantity') {
                content = product.quantity > 0
                    ? `<span style="color:var(--success); font-weight:600;">In Stock</span>`
                    : `<span style="color:var(--danger);">Out of Stock</span>`;
            } else if (row.key === 'description') {
                content = `<p style="font-size:0.9rem; max-height:100px; overflow-y:auto;">${product.description || 'No description.'}</p>`;
            } else if (row.key === 'action') {
                const pJson = JSON.stringify({
                    name: product.name, price: product.price, currency: product.currency,
                    imageUrl: product.imageUrl, quantity: 1
                }).replace(/"/g, '&quot;');

                content = `<button class="btn btn-primary btn-sm" style="width:100%" 
                    onclick="addToCart('${product.id}', '${product.storeId}', ${pJson}); closeCompareModal()">
                    Add to Cart
                </button>`;
            } else {
                content = product[row.key] || '-';
            }

            tableHtml += `<td class="compare-col">${content}</td>`;
        });

        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;

    container.innerHTML = tableHtml;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
    const modal = document.getElementById('compare-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}
// --- Forgot Password Logic ---

function openForgotPasswordModal() {
    // If the user typed an email in the login box, pre-fill it here
    const loginEmailVal = document.getElementById('login-email')?.value;
    if (loginEmailVal) {
        document.getElementById('reset-password-email').value = loginEmailVal;
    }

    const modal = document.getElementById('forgot-password-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Handle the form submission
document.getElementById('forgot-password-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('reset-password-email').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;

    // Call Firebase Auth
    auth.sendPasswordResetEmail(email)
        .then(() => {
            showNotification('✅ Password reset email sent! Check your inbox.');
            closeForgotPasswordModal();
            // Clear the input
            document.getElementById('reset-password-email').value = '';
        })
        .catch((error) => {
            let errorMessage = "Error sending email.";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "No account found with this email address.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Please enter a valid email address.";
            }
            showNotification('❌ ' + errorMessage);
            console.error("Reset password error:", error);
        })
        .finally(() => {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
});

// Close modal when clicking outside
document.getElementById('forgot-password-modal')?.addEventListener('click', function (e) {
    if (e.target === this) {
        closeForgotPasswordModal();
    }
});
// --- Load Reviews Logic ---
async function loadReviewsForProduct(productId) {
    const listContainer = document.getElementById('reviews-list');

    try {
        // Query the 'reviews' collection where productId matches
        const snapshot = await db.collection('reviews')
            .where('productId', '==', productId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            listContainer.innerHTML = `<p style="color:var(--gray); font-style:italic;">No reviews yet. Be the first to review!</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const r = doc.data();
            const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'Recently';

            html += `
                <div class="review-item">
                    <div class="review-user">
                        <div class="review-avatar">${r.userName.charAt(0).toUpperCase()}</div>
                        <span class="review-username">${r.userName}</span>
                    </div>
                    <div class="review-stars">
                        ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                        <span class="review-date">${date}</span>
                    </div>
                    <p class="review-text">${r.comment}</p>
                </div>
            `;
        });

        listContainer.innerHTML = html;

    } catch (e) {
        console.error("Error loading reviews:", e);
        // Note: If you haven't created the composite index in Firebase yet, this might fail on the orderBy.
        // Fallback for simple query if index is missing:
        if (e.code === 'failed-precondition') {
            console.log("Missing index, falling back to simple fetch");
            const simpleSnap = await db.collection('reviews').where('productId', '==', productId).get();
            // (Render logic similar to above but without sorting)
        }
    }
}

// --- Submit Review Logic ---
async function submitProductReview(e, productId, storeId) {
    e.preventDefault();

    if (!currentUser) return;

    const ratingEl = document.querySelector('input[name="rating"]:checked');
    const comment = document.getElementById('review-comment').value;

    if (!ratingEl) {
        showNotification('Please select a star rating.');
        return;
    }

    const rating = parseInt(ratingEl.value);
    const submitBtn = e.target.querySelector('button');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = 'Submitting...';
    submitBtn.disabled = true;

    try {
        // 1. Add Review to 'reviews' collection
        await db.collection('reviews').add({
            productId: productId,
            storeId: storeId,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Customer',
            rating: rating,
            comment: comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Update Product Aggregate Rating (Client-side calculation for simplicity)
        const productRef = db.collection('products').doc(productId);

        await db.runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists) throw "Product does not exist!";

            const data = productDoc.data();
            const currentReviews = data.reviews || 0;
            const currentRating = data.rating || 0;

            // Calculate new average
            const newTotalReviews = currentReviews + 1;
            const newAverageRating = ((currentRating * currentReviews) + rating) / newTotalReviews;

            transaction.update(productRef, {
                rating: newAverageRating,
                reviews: newTotalReviews
            });
        });

        showNotification('Review submitted successfully!');

        // Refresh the view to show new review and updated rating
        viewProduct(productId);

    } catch (error) {
        console.error("Error submitting review:", error);
        showNotification("Failed to submit review.");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}
// ==================== NEWS BANNER SYSTEM (WITH IMAGES) ====================

const BANNER_SHOW_DURATION = 20000; // Visible for 20 seconds
const BANNER_HIDE_DURATION = 30000; // Hidden for 30 seconds
let isBannerClosedManually = false;

document.addEventListener('DOMContentLoaded', () => {
    // Start the cycle 3 seconds after page load
    setTimeout(() => {
        initNewsBanner();
    }, 3000);
});

function initNewsBanner() {
    if (isBannerClosedManually) return;
    updateBannerContent();
    showNewsBanner();
}

function showNewsBanner() {
    const banner = document.getElementById('dynamic-news-banner');
    if (!banner || isBannerClosedManually) return;

    banner.classList.add('banner-active');

    // Auto-hide after duration
    setTimeout(() => {
        hideNewsBanner();
    }, BANNER_SHOW_DURATION);
}

function hideNewsBanner() {
    const banner = document.getElementById('dynamic-news-banner');
    if (!banner) return;

    banner.classList.remove('banner-active');

    // Auto-show again after duration (Loop)
    if (!isBannerClosedManually) {
        setTimeout(() => {
            updateBannerContent(); // Refresh deals with new random products
            showNewsBanner();
        }, BANNER_HIDE_DURATION);
    }
}

function closeNewsBanner() {
    const banner = document.getElementById('dynamic-news-banner');
    if (banner) {
        banner.classList.remove('banner-active');
        isBannerClosedManually = true; // Stop loop for this session
    }
}

function updateBannerContent() {
    const contentDiv = document.getElementById('news-ticker-content');
    if (!contentDiv) return;

    let itemsHtml = '';

    // 1. Add Default Text Messages (No images)
    const defaultMessages = [
        "🚚 <span>Free Delivery</span> on all orders over ₵1000",
        "🔥 <span>Flash Sale!</span> Get 50% off selected Electronics today",
        "💳 Pay securely with <span>Mobile Money</span> or Card"
    ];

    defaultMessages.forEach(msg => {
        itemsHtml += `<div class="ticker-item"><span>${msg}</span></div>`;
    });

    // 2. Add Dynamic Products with Images
    if (typeof productsListAll !== 'undefined' && productsListAll.length > 0) {
        // Pick 4 random products to feature
        const shuffled = [...productsListAll].sort(() => 0.5 - Math.random());
        const featured = shuffled.slice(0, 4);

        featured.forEach(p => {
            const data = p.data;
            const price = typeof formatCurrency === 'function'
                ? formatCurrency(data.price, data.currency || 'GHS')
                : `₵${data.price}`;

            // Build Image Tag (or fallback icon)
            let imgTag = '';
            if (data.imageUrl) {
                imgTag = `<img src="${data.imageUrl}" alt="${data.name}" onerror="this.style.display='none'">`;
            } else {
                imgTag = `<i class="fas fa-box" style="margin-right:8px; color:#cbd5e1;"></i>`;
            }

            // Create HTML item
            itemsHtml += `
                <div class="ticker-item">
                    ${imgTag}
                    <span>
                        <span class="news-item-highlight">Hot Deal:</span> 
                        ${data.name} - ${price}
                    </span>
                </div>
            `;
        });
    }

    // 3. Duplicate content to create a seamless infinite scroll effect
    // By repeating the content, the animation loops perfectly
    contentDiv.innerHTML = itemsHtml + itemsHtml;
}
// [Add this new function to main.js, preferably near the product logic]

async function updateProductLimitUI() {
    const limitSection = document.getElementById('unlimited-products-section');
    const countElement = document.getElementById('current-product-count');
    const limitBar = document.getElementById('product-limit-bar');

    if (!limitSection) return;

    try {
        // 1. Get current count and status
        const productCount = await checkProductLimit();
        const isUnlimited = await hasUnlimitedProducts();

        // 2. Update Progress Bar Stats
        if (countElement) countElement.textContent = productCount;
        if (limitBar) {
            const percentage = Math.min((productCount / PRODUCT_LIMIT) * 100, 100);
            limitBar.style.width = percentage + '%';

            // Visual warning if near limit
            if (percentage >= 90) limitBar.style.backgroundColor = 'var(--danger)';
            else limitBar.style.backgroundColor = '#fff';
        }

        // 3. Update the UI Banner based on Status
        if (isUnlimited) {
            // CASE: APPROVED - Show Success Banner
            limitSection.innerHTML = `
                <div style="text-align: center; padding: 20px; animation: fadeIn 0.5s;">
                    <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                        <i class="fas fa-check" style="font-size: 1.8rem; color: #4ade80;"></i>
                    </div>
                    <h3 style="margin: 0 0 10px 0; color: white;">Unlimited Access Active</h3>
                    <p style="margin: 0; font-size: 1rem; opacity: 0.9;">
                        Your store has been approved for unlimited uploads. 
                        You currently have <strong>${productCount}</strong> products.
                    </p>
                </div>
            `;
            // Change background to a success gradient
            limitSection.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        } else {
            // CASE: LIMITED - Show Request Form or Pending Status

            // Check if there is a pending request to show "Pending" state
            const existingRequest = await db.collection('unlimited_product_requests')
                .where('vendorId', '==', currentUser.uid)
                .where('status', '==', 'pending')
                .get();

            if (!existingRequest.empty) {
                limitSection.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fas fa-clock" style="font-size: 2rem; color: #fcd34d; margin-bottom: 10px;"></i>
                        <h4 style="margin: 10px 0; color: white;">Request Pending</h4>
                        <p style="margin: 5px 0; font-size: 0.95rem;">
                            Your request for unlimited products is being reviewed by the admin.
                        </p>
                    </div>
                `;
                limitSection.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
            } else {
                // Default: Show Request Button/Form (Reset to original HTML structure if needed)
                // We keep the logic simple: verify the DOM elements exist, if destroyed by previous innerHTML overwrite, recreate them
                if (!document.getElementById('unlimited-request-form')) {
                    limitSection.innerHTML = `
                        <h4 style="margin-top: 0; color: white;">
                            <i class="fas fa-star"></i> Need More Products?
                        </h4>
                        <p style="margin: 10px 0; font-size: 0.95rem;">You can add up to <strong>${PRODUCT_LIMIT} products</strong> per store. If you need to upload more, request unlimited access below.</p>
                        
                        <div id="product-limit-status" style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid white;">
                            <p style="margin: 0; font-weight: 600;">Products Used: <span id="current-product-count">${productCount}</span>/${PRODUCT_LIMIT}</p>
                            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.3); border-radius: 3px; margin-top: 8px; overflow: hidden;">
                                <div id="product-limit-bar" style="width: ${(productCount / PRODUCT_LIMIT) * 100}%; height: 100%; background: #fff; border-radius: 3px;"></div>
                            </div>
                        </div>
                        
                        <form style="display: none;" id="unlimited-request-form">
                            <div class="form-group" style="margin: 15px 0;">
                                <label style="color: white; font-weight: 600;">Why do you need unlimited products?</label>
                                <textarea id="unlimited-request-reason" class="form-control" style="min-height: 100px; padding: 12px;" placeholder="Tell us about your business..." required></textarea>
                            </div>
                            <button type="button" onclick="submitUnlimitedProductsRequest()" class="btn" style="background: white; color: #667eea; font-weight: 600; width: 100%; padding: 12px; border: none; border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-paper-plane"></i> Submit Request
                            </button>
                        </form>
                        
                        <button type="button" id="request-btn" style="background: white; color: #667eea; font-weight: 600; width: 100%; padding: 12px; border: none; border-radius: 6px; cursor: pointer;" onclick="document.getElementById('unlimited-request-form').style.display='block'; this.style.display='none';">
                            <i class="fas fa-arrow-up"></i> Request Unlimited Products
                        </button>
                    `;
                    limitSection.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                }
            }
        }
    } catch (e) {
        console.error("Error updating limit UI:", e);
    }
}
// --- NEW: Revoke Unlimited Access Function ---
async function revokeUnlimitedAccess(storeId, storeName) {
    if (!confirm(`Are you sure you want to REVOKE unlimited product uploads for "${storeName}"?\n\nThey will be restricted to the standard limit of 30 products.`)) return;

    try {
        // 1. Update the store document to remove the flag
        await db.collection('stores').doc(storeId).update({
            unlimitedProducts: false
        });

        // 2. Optional: Find and update the latest approved request to 'revoked' for history
        // This is strictly for record-keeping; the store update above does the actual work.
        const requestSnap = await db.collection('unlimited_product_requests')
            .where('storeId', '==', storeId)
            .where('status', '==', 'approved')
            .limit(1)
            .get();

        if (!requestSnap.empty) {
            await requestSnap.docs[0].ref.update({
                status: 'revoked',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revokedBy: currentUser.uid
            });
        }

        showNotification(`✅ Unlimited access revoked for ${storeName}.`);

        // 3. Refresh the developer dashboard
        loadDevStats();

    } catch (error) {
        console.error("Error revoking access:", error);
        showNotification('❌ Error: ' + error.message);
    }
}