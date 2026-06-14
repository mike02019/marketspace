// ============================================================================
// PRODUCTS MODULE
// Handles all product listing, display, searching, filtering, and pagination
// ============================================================================

// Product listing variables
const PRODUCTS_BATCH_SIZE = 50;
let lastProductDoc = null;
let isLoadingMoreProducts = false;
let productsList = [];
let productsListAll = [];
let currentProductsPage = 1;
let _productFiltersInitialized = false;

// Load products from Firebase with pagination
async function loadAmazonProducts() {
    const container = document.getElementById('amazon-products-grid');
    if (!container) return;

    try {
        let query = db.collection('products');
        const snapshot = await query.limit(PRODUCTS_BATCH_SIZE).get();

        if (snapshot.empty) {
            productsListAll = [];
            productsList = [];
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px; color: var(--dark);">No products found</h3>
                    <p style="color: var(--gray);">Check your internet connection and try again!</p>
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
                return category !== 'food' && category !== 'food & beverages' && category !== 'groceries';
            });

        if (snapshot.docs.length > 0) {
            lastProductDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        if (productsListAll.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px; color: var(--dark);">No products found</h3>
                    <p style="color: var(--gray);">Check your internet connection and try again!</p>
                </div>
            `;
            const countElement = document.getElementById('products-count');
            if (countElement) countElement.textContent = `0 of 0 products`;
            return;
        }

        currentProductsPage = 1;
        applyFiltersAndRender();
        setupProductFilterListeners();
        setupInfiniteScrollForProducts();

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

// Build individual product card HTML
function buildProductCard(docId, data) {
    const storeId = data.storeId || 'unknown';
    const rating = data.rating || Math.random() * 2 + 3;
    const reviewCount = data.reviews || Math.floor(Math.random() * 1000);
    const originalPrice = (data.price || 0) * (1 + Math.random() * 0.3);
    const savings = originalPrice - (data.price || 0);
    const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

    const isInWishlist = wishlist[storeId] && wishlist[storeId][docId];
    const isCompare = typeof compareList !== 'undefined' ? compareList.some(item => item.id === docId) : false;

    const productJsonFull = JSON.stringify({
        id: docId,
        ...data
    }).replace(/"/g, '&quot;');

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

// Render products for a specific page
function renderProductsPage(page) {
    const container = document.getElementById('amazon-products-grid');
    if (!container) return;

    const itemsPerPage = 12;
    const totalItems = productsList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    page = Math.max(1, Math.min(page, totalPages));
    currentProductsPage = page;

    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalItems);
    const slice = productsList.slice(start, end);

    if (slice.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No products found.</div>`;
    } else {
        const htmlString = slice.map(p => buildProductCard(p.id, p.data)).join('');
        container.innerHTML = htmlString;

        requestIdleCallback(() => {
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                if (img.complete) return;
                img.decoding = 'async';
            });
        });
    }

    const countElement = document.getElementById('products-count');
    if (countElement) countElement.textContent = `${start + 1}-${end} of ${totalItems} products`;

    const pageNumbersEl = document.querySelector('.page-numbers');
    if (pageNumbersEl) {
        pageNumbersEl.innerHTML = '';

        const isMobile = window.innerWidth <= 768;
        const maxVisible = isMobile ? 3 : 5;
        const halfWindow = Math.floor(maxVisible / 2);

        let startPage = Math.max(1, page - halfWindow);
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === page ? ' active' : '');
            span.textContent = i;
            span.style.cursor = 'pointer';
            span.onclick = () => {
                renderProductsPage(i);
                document.querySelector('.products-header').scrollIntoView({ behavior: 'smooth' });
            };
            pageNumbersEl.appendChild(span);
        }
    }

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

// View product in detail modal
async function viewProduct(productId) {
    const modal = document.getElementById('product-detail-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('pd-title').textContent = 'Loading...';
    document.getElementById('pd-description').textContent = '';
    document.getElementById('pd-image').src = '';
    document.getElementById('pd-price').textContent = '';
    document.getElementById('pd-actions').innerHTML = '';

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
        loadReviewsForProduct(productId);

    } catch (error) {
        console.error('Error viewing product:', error);
        closeProductDetailModal();
        showNotification('Error loading product details');
    }
}

// Close product detail modal
function closeProductDetailModal() {
    const modal = document.getElementById('product-detail-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('product-detail-modal');
    if (e.target === modal) {
        closeProductDetailModal();
    }
});

// Buy now (add to cart and checkout)
function buyNow(productId, storeId, productData) {
    if (!currentUser || userRole !== 'customer') {
        showNotification('Please log in as a customer to buy items.');
        navigateTo('login');
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
    checkoutCart();
}

// Sort products
function sortProducts(sortBy) {
    showNotification(`Sorting by: ${sortBy}`);
    loadAmazonProducts();
}

// Clear all filters
function clearFilters() {
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('price-slider').value = 500;
    showNotification('Filters cleared');
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
        applyFiltersAndRender();
        return;
    }

    const filtered = productsListAll.filter(p => {
        const productName = (p.data?.name || '').toLowerCase();
        return productName.includes(searchValue);
    });

    productsList = filtered;
    currentProductsPage = 1;
    renderProductsPage(currentProductsPage);
}

// Navigate to store and highlight product
function navigateToStoreAndHighlight(storeId, productId) {
    sessionStorage.setItem('highlightProductId', productId);
    navigateTo('store-detail', storeId);
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.value = '';
    }
    applyFiltersAndRender();
    showNotification('Search cleared');
}

// Handle store product search
function handleStoreProductSearch(searchTerm, allProducts) {
    const searchValue = searchTerm.trim().toLowerCase();
    const resultsContainer = document.querySelector('.products-grid');

    if (!resultsContainer) return;

    if (!searchValue) {
        const cards = resultsContainer.querySelectorAll('.product-card');
        cards.forEach(card => card.style.display = 'block');
        return;
    }

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

    if (visibleCount === 0) {
        showNotification(`No products found matching "${searchTerm}"`);
    }
}

// Clear store search
function clearStoreSearch() {
    const searchInput = document.getElementById('store-product-search');
    if (searchInput) {
        searchInput.value = '';
        handleStoreProductSearch('', []);
        showNotification('Search cleared');
    }
}

// Debounced mobile search
let _mobileSearchTimeout = null;
function debouncedMobileSearch(value) {
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

// Clear mobile search
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

// Apply filters and render products
function applyFiltersAndRender() {
    if (!productsListAll || productsListAll.length === 0) {
        loadAmazonProducts();
        return;
    }

    const categoryMap = {
        'cat-electronics': 'electronics',
        'cat-fashion': 'fashion',
        'cat-food': 'food',
        'cat-groceries': 'groceries',
        'cat-home': 'home',
        'cat-books': 'books',
        'cat-sports': 'sports',
        'cat-beauty': 'beauty',
        'cat-automotive': 'automotive',
        'cat-art': 'art',
        'cat-services': 'services'
    };

    const selectedCats = Object.keys(categoryMap).filter(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    }).map(id => categoryMap[id]);

    const priceSlider = document.getElementById('price-slider');
    const maxPrice = priceSlider ? parseFloat(priceSlider.value) : Infinity;

    const ratingChecks = ['rating-4', 'rating-3', 'rating-2'].filter(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    }).map(id => parseInt(id.split('-')[1], 10));

    const inStockEl = document.getElementById('in-stock');
    const inStockOnly = inStockEl ? inStockEl.checked : false;
    const fastDeliveryEl = document.getElementById('fast-delivery');
    const fastOnly = fastDeliveryEl ? fastDeliveryEl.checked : false;

    const filtered = productsListAll.filter(p => {
        const data = p.data || {};

        if (selectedCats.length > 0) {
            const cat = (data.category || '').toString().toLowerCase();
            const matchesCat = selectedCats.some(sc => cat.includes(sc));
            if (!matchesCat) return false;
        }

        const price = parseFloat(data.price) || 0;
        if (!isNaN(maxPrice) && price > maxPrice) return false;

        if (ratingChecks.length > 0) {
            const rating = parseFloat(data.rating) || 0;
            const matchesRating = ratingChecks.some(th => rating >= th);
            if (!matchesRating) return false;
        }

        if (inStockOnly) {
            if (!(data.quantity > 0)) return false;
        }

        if (fastOnly) {
            if (!data.fastDelivery) return false;
        }

        return true;
    });

    productsList = filtered;
    currentProductsPage = 1;
    renderProductsPage(currentProductsPage);
}

// Setup filter listeners
function setupProductFilterListeners() {
    if (_productFiltersInitialized) return;
    _productFiltersInitialized = true;

    const debouncedApplyFilters = debounce(() => applyFiltersAndRender(), 200);

    document.querySelectorAll('.products-sidebar .filter-option input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', debouncedApplyFilters);
    });

    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) {
        priceSlider.addEventListener('input', throttle(debouncedApplyFilters, 100));
    }
}

// Setup infinite scroll
function setupInfiniteScrollForProducts() {
    const container = document.getElementById('amazon-products-grid');
    if (!container) return;

    const images = container.querySelectorAll('img[loading="lazy"]');
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });

        images.forEach(img => imgObserver.observe(img));
    }
}

// Previous page
function prevPage() {
    if (currentProductsPage > 1) {
        renderProductsPage(currentProductsPage - 1);
        const header = document.querySelector('.products-header');
        if (header) header.scrollIntoView({ behavior: 'smooth' });
    }
}

// Next page
function nextPage() {
    const itemsPerPage = 12;
    const totalPages = Math.ceil(productsList.length / itemsPerPage);

    if (currentProductsPage < totalPages) {
        renderProductsPage(currentProductsPage + 1);
        const header = document.querySelector('.products-header');
        if (header) header.scrollIntoView({ behavior: 'smooth' });
    }
}
