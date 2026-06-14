// ============================================================================
// SHOPPING CART MODULE
// Handles shopping cart, wishlist, and checkout functionality
// ============================================================================

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

// Save wishlist to localStorage AND Firestore
function saveWishlist() {
    if (currentUser && userRole === 'customer') {
        localStorage.setItem(`wishlist_${currentUser.uid}`, JSON.stringify(wishlist));
        db.collection('users').doc(currentUser.uid).collection('analytics').doc('wishlist').set({
            items: wishlist,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}

// Move Item: Cart -> Wishlist
function moveToWishlist(productId, storeId) {
    if (!shoppingCart[storeId] || !shoppingCart[storeId][productId]) return;

    const item = shoppingCart[storeId][productId];

    if (!wishlist[storeId]) wishlist[storeId] = {};

    wishlist[storeId][productId] = item;

    delete shoppingCart[storeId][productId];
    if (Object.keys(shoppingCart[storeId]).length === 0) {
        delete shoppingCart[storeId];
    }

    saveCart();
    saveWishlist();
    renderCartPage();
    showNotification('Item saved for later');
}

// Move Item: Wishlist -> Cart
function moveToCart(productId, storeId) {
    if (!wishlist[storeId] || !wishlist[storeId][productId]) return;

    const item = wishlist[storeId][productId];

    if (!shoppingCart[storeId]) shoppingCart[storeId] = {};

    if (shoppingCart[storeId][productId]) {
        shoppingCart[storeId][productId].quantity += 1;
    } else {
        shoppingCart[storeId][productId] = { ...item, quantity: 1 };
    }

    delete wishlist[storeId][productId];
    if (Object.keys(wishlist[storeId]).length === 0) {
        delete wishlist[storeId];
    }

    saveCart();
    saveWishlist();
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
    showNotification(`Added ${productData.name} to cart!`);
}

// Remove product from cart
function removeFromCart(productId, storeId) {
    if (shoppingCart[storeId] && shoppingCart[storeId][productId]) {
        delete shoppingCart[storeId][productId];

        if (Object.keys(shoppingCart[storeId]).length === 0) {
            delete shoppingCart[storeId];
        }

        saveCart();
        updateCartUI();
        showNotification('Item removed from cart.');

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
    }
}

// Toggle wishlist (add/remove)
function toggleWishlist(event, productId, storeId, productData) {
    event.stopPropagation();

    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in to save items.');
        return;
    }

    if (!wishlist[storeId]) {
        wishlist[storeId] = {};
    }

    const btn = event.currentTarget;

    if (wishlist[storeId][productId]) {
        delete wishlist[storeId][productId];
        if (Object.keys(wishlist[storeId]).length === 0) {
            delete wishlist[storeId];
        }
        btn.classList.remove('active');
        showNotification('Removed from saved items');
    } else {
        wishlist[storeId][productId] = productData;
        btn.classList.add('active');
        showNotification('Added to saved items!');
    }

    saveWishlist();
}

// Compare list functions
let compareList = [];

function toggleCompare(checkbox, productData) {
    if (checkbox.checked) {
        if (compareList.length >= 4) {
            checkbox.checked = false;
            showNotification('You can compare up to 4 products');
            return;
        }
        if (!compareList.some(item => item.id === productData.id)) {
            compareList.push(productData);
            showNotification('Added to compare list');
        }
    } else {
        compareList = compareList.filter(item => item.id !== productData.id);
        showNotification('Removed from compare list');
    }
    updateCompareButton();
}

function updateCompareButton() {
    const btn = document.getElementById('compare-btn');
    if (btn) {
        if (compareList.length > 0) {
            btn.style.display = 'inline-block';
            btn.innerHTML = `<i class="fas fa-balance-scale"></i> Compare (${compareList.length})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

function compareProducts() {
    if (compareList.length === 0) {
        showNotification('Please select products to compare');
        return;
    }

    const modal = document.getElementById('compare-modal') || createCompareModal();
    modal.style.display = 'flex';

    const container = document.getElementById('compare-content');
    container.innerHTML = generateComparisonTable();
}

function createCompareModal() {
    const modal = document.createElement('div');
    modal.id = 'compare-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2><i class="fas fa-balance-scale"></i> Product Comparison</h2>
                <button onclick="this.closest('.modal-overlay').style.display='none'" class="modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="compare-content"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function generateComparisonTable() {
    if (compareList.length === 0) return '<p>No products selected</p>';

    const specs = ['price', 'quantity', 'rating', 'category'];
    let html = '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse;">';

    // Header
    html += '<tr style="background: #f8fafc;">';
    html += '<th style="padding: 10px; border: 1px solid #e2e8f0;">Feature</th>';
    compareList.forEach(product => {
        html += `<th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-weight: 600; margin-bottom: 5px;">${product.name}</div>
            <div style="font-size: 0.85rem; color: var(--gray);">${formatCurrency(product.price, product.currency || 'GHS')}</div>
        </th>`;
    });
    html += '</tr>';

    // Specs rows
    specs.forEach(spec => {
        html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">${spec.toUpperCase()}</td>`;
        compareList.forEach(product => {
            let value = product[spec] || '-';
            if (spec === 'price') value = formatCurrency(product.price, product.currency || 'GHS');
            html += `<td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${value}</td>`;
        });
        html += '</tr>';
    });

    html += '</table></div>';
    return html;
}

// Clear compare list
function clearCompareList() {
    compareList = [];
    document.querySelectorAll('.compare-checkbox-container input').forEach(cb => cb.checked = false);
    updateCompareButton();
    showNotification('Compare list cleared');
}

// Calculate total items in shopping cart
function getTotalCartCount() {
    let totalCount = 0;
    Object.values(shoppingCart).forEach(storeCart => {
        Object.values(storeCart).forEach(item => {
            totalCount += item.quantity;
        });
    });
    return totalCount;
}
