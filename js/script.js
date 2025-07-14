import { 
  db, collection, addDoc, doc, updateDoc,
  getDocs, query, orderBy, limit, serverTimestamp,
  auth, signInAnonymously, onAuthStateChanged
} from './firebase-config.js';

// Map & App Variables
let map;
let routeControl;
let startPoint = null;
let destinationPoint = null;
let startMarker = null;
let destinationMarker = null;
let manualStartMode = false;
let manualDestinationMode = false;
let distanceInKm = 0;
let currentTransaction = null;

// DOM Elements
const elements = {
    mapContainer: document.getElementById('map'),
    startPointInfo: document.getElementById('startPointInfo'),
    destinationInput: document.getElementById('destinationInput'),
    distanceResult: document.getElementById('distanceResult'),
    distanceInput: document.getElementById('distance'),
    buyerService: document.getElementById('buyerService'),
    buyerFields: document.getElementById('buyerFields'),
    hoursInput: document.getElementById('hours'),
    weightInput: document.getElementById('weight'),
    weightWarning: document.getElementById('weightWarning'),
    resultContainer: document.getElementById('result'),
    deliveryCost: document.getElementById('deliveryCost'),
    buyerServiceDetails: document.getElementById('buyerServiceDetails'),
    totalPrice: document.getElementById('totalPrice'),
    useMyLocationBtn: document.getElementById('useMyLocationBtn'),
    manualStartBtn: document.getElementById('manualStartBtn'),
    manualDestBtn: document.getElementById('manualDestBtn'),
    clearStartBtn: document.getElementById('clearStartBtn'),
    calculateRouteBtn: document.getElementById('calculateRouteBtn'),
    priceCalculatorForm: document.getElementById('priceCalculatorForm'),
    calculatePriceBtn: document.getElementById('calculatePriceBtn'),
    confirmBookingBtn: document.getElementById('confirmBookingBtn'),
    completeTransactionBtn: document.getElementById('completeTransactionBtn'),
    transactionsList: document.getElementById('transactionsList'),
    riderName: document.getElementById('riderName'),
    riderId: document.getElementById('riderId')
};

// Transaction history
const transactionHistory = [];

// ======================
// Authentication Setup
// ======================

function showLoadingState() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-state';
    loadingDiv.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <p>Initializing application...</p>
    `;
    document.body.appendChild(loadingDiv);
    return loadingDiv;
}

function hideLoadingState() {
    const loadingElement = document.querySelector('.loading-state');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// ======================
// Map Functions
// ======================

function initMap() {
    try {
        // Initialize map with default view (Manila)
        map = L.map('map').setView([15.3062, 120.8573], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
        
        setupMapClickHandlers();
    } catch (error) {
        console.error("Map initialization failed:", error);
        showMapError("Failed to load map. Please refresh the page.");
    }
}

function setupMapClickHandlers() {
    map.on('click', function(e) {
        if (manualStartMode) {
            startPoint = [e.latlng.lat, e.latlng.lng];
            updateStartPoint();
            manualStartMode = false;
            elements.manualStartBtn.classList.remove('active-mode');
            map.setView(startPoint, 15);
        } else if (manualDestinationMode) {
            destinationPoint = [e.latlng.lat, e.latlng.lng];
            updateDestinationPoint();
            manualDestinationMode = false;
            elements.manualDestBtn.classList.remove('active-mode');
        }
    });
}

function showMapError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'map-error';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
        <button onclick="window.location.reload()">Retry</button>
    `;
    elements.mapContainer.appendChild(errorDiv);
}

// ======================
// Location Functions
// ======================

function useMyLocation() {
    if (navigator.geolocation) {
        elements.useMyLocationBtn.disabled = true;
        elements.useMyLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
        
        navigator.geolocation.getCurrentPosition(
            position => {
                startPoint = [position.coords.latitude, position.coords.longitude];
                updateStartPoint();
                map.setView(startPoint, 15);
                elements.useMyLocationBtn.disabled = false;
                elements.useMyLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Use My Location';
            },
            error => {
                alert("Error getting location: " + error.message);
                elements.useMyLocationBtn.disabled = false;
                elements.useMyLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Use My Location';
            },
            { timeout: 10000 }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function activateManualStartMode() {
    manualStartMode = true;
    manualDestinationMode = false;
    elements.manualStartBtn.classList.add('active-mode');
    elements.manualDestBtn.classList.remove('active-mode');
    alert("Click on the map to set start point");
}

function activateManualDestMode() {
    manualDestinationMode = true;
    manualStartMode = false;
    elements.manualDestBtn.classList.add('active-mode');
    elements.manualStartBtn.classList.remove('active-mode');
    alert("Click on the map to set destination point");
}

function updateStartPoint() {
    if (startMarker) map.removeLayer(startMarker);
    
    startMarker = L.marker(startPoint, {
        icon: new L.Icon({
            iconUrl: 'https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png',
            iconSize: [32, 32]
        })
    }).addTo(map)
      .bindPopup("Start Point").openPopup();
    
    elements.startPointInfo.textContent = `Start: ${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)}`;
    elements.clearStartBtn.disabled = false;
    checkRouteReady();
}

function updateDestinationPoint() {
    if (destinationMarker) map.removeLayer(destinationMarker);
    
    destinationMarker = L.marker(destinationPoint, {
        icon: new L.Icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            iconSize: [32, 32]
        })
    }).addTo(map)
      .bindPopup("Destination").openPopup();
    
    elements.destinationInput.value = `${destinationPoint[0].toFixed(6)}, ${destinationPoint[1].toFixed(6)}`;
    checkRouteReady();
}

function checkRouteReady() {
    elements.calculateRouteBtn.disabled = !(startPoint && destinationPoint);
}

function clearStartPoint() {
    if (startMarker) map.removeLayer(startMarker);
    if (routeControl) map.removeControl(routeControl);
    startPoint = null;
    startMarker = null;
    routeControl = null;
    elements.startPointInfo.textContent = "Start point not set";
    elements.clearStartBtn.disabled = true;
    elements.calculateRouteBtn.disabled = true;
    elements.distanceResult.textContent = "Waiting for route calculation...";
    elements.distanceInput.value = "0";
    elements.calculatePriceBtn.disabled = true;
    elements.resultContainer.style.display = 'none';
}

// ======================
// Route Calculation
// ======================

async function calculateRoute() {
    if (!startPoint || !destinationPoint) {
        alert("Please set both start and destination points");
        return;
    }

    try {
        elements.calculateRouteBtn.disabled = true;
        elements.calculateRouteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        elements.distanceResult.textContent = "Calculating route...";
        
        if (routeControl) map.removeControl(routeControl);
        
        routeControl = L.Routing.control({
            waypoints: [
                L.latLng(startPoint[0], startPoint[1]),
                L.latLng(destinationPoint[0], destinationPoint[1])
            ],
            routeWhileDragging: true,
            show: false,
            lineOptions: {
                styles: [{color: '#4CAF50', opacity: 0.7, weight: 5}]
            }
        }).addTo(map);
        
        routeControl.on('routesfound', function(e) {
            const routes = e.routes;
            const distance = routes[0].summary.totalDistance / 1000;
            distanceInKm = distance.toFixed(2);
            elements.distanceInput.value = distanceInKm;
            elements.distanceResult.textContent = `Distance: ${distanceInKm} km`;
            elements.calculatePriceBtn.disabled = false;
            elements.calculateRouteBtn.disabled = false;
            elements.calculateRouteBtn.innerHTML = '<i class="fas fa-route"></i> Calculate Route';
        });
        
        routeControl.on('routingerror', function(e) {
            console.error("Routing error:", e.error);
            elements.distanceResult.textContent = "Error calculating route";
            elements.calculateRouteBtn.disabled = false;
            elements.calculateRouteBtn.innerHTML = '<i class="fas fa-route"></i> Calculate Route';
        });
        
    } catch (error) {
        console.error("Route calculation failed:", error);
        elements.distanceResult.textContent = "Error calculating route";
        elements.calculateRouteBtn.disabled = false;
        elements.calculateRouteBtn.innerHTML = '<i class="fas fa-route"></i> Calculate Route';
    }
}

// ======================
// Price Calculation
// ======================

function toggleBuyerFields() {
    elements.buyerFields.style.display = elements.buyerService.checked ? 'block' : 'none';
}

function checkWeightLimit() {
    const weight = parseFloat(elements.weightInput.value) || 0;
    elements.weightWarning.style.display = weight > 7 ? 'flex' : 'none';
}

function calculatePrice(e) {
    e.preventDefault();
    
    const distance = parseFloat(elements.distanceInput.value) || 0;
    const hasBuyerService = elements.buyerService.checked;
    const hours = parseFloat(elements.hoursInput.value) || 0;
    const weight = parseFloat(elements.weightInput.value) || 0;
    
    // Validate inputs
    if (isNaN(distance)) {
        alert("Please calculate a route first");
        return;
    }
    
    if (hasBuyerService && (isNaN(hours) || hours < 0.5)) {
        alert("Please enter valid hours (minimum 0.5)");
        return;
    }
    
    if (hasBuyerService && (isNaN(weight) || weight <= 0)) {
        alert("Please enter valid weight");
        return;
    }
    
    // Calculate base price (₱60 base + ₱10 per km)
    //let basePrice = 60 + (distance * 10;
  let basePrice = 60;
    if (distance > 3) {
    basePrice += (distance - 3) * 15;
    }

  
    let total = basePrice;
    
    // Add buyer service if enabled
    if (hasBuyerService) {
        const serviceFee = hours * 60;
        let extraWeightFee = 0;
        
        if (weight > 7) {
            extraWeightFee = (weight - 7) * 10;
        }
        
        total += serviceFee + extraWeightFee;
        
        // Update buyer service details
        elements.buyerServiceDetails.innerHTML = `
            <p>Buyer Service (${hours} hrs): ₱${serviceFee.toFixed(2)}</p>
            ${weight > 7 ? `<p>Extra Weight (${(weight-7).toFixed(1)} kg): ₱${extraWeightFee.toFixed(2)}</p>` : ''}
        `;
    }
    
    // Update UI
    elements.deliveryCost.innerHTML = `<p>Base Delivery (${distance.toFixed(2)} km): ₱${basePrice.toFixed(2)}</p>`;
    elements.totalPrice.textContent = `Total: ₱${total.toFixed(2)}`;
    elements.resultContainer.style.display = 'block';
    elements.confirmBookingBtn.disabled = false;
}

// ======================
// Firestore Transactions
// ======================

async function confirmBooking() {
    if (!auth.currentUser) {
        alert("System is initializing, please try again in a moment");
        return;
    }

    // Validate rider info
    if (!elements.riderName.value.trim()) {
        alert("Please enter rider name");
        return;
    }
    if (!elements.riderId.value.trim()) {
        alert("Please enter rider ID");
        return;
    }

    try {
        elements.confirmBookingBtn.disabled = true;
        elements.confirmBookingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        const transactionData = {
            bookingTime: serverTimestamp(),
            startPoint: elements.startPointInfo.textContent,
            destination: elements.destinationInput.value,
            distance: elements.distanceInput.value,
            price: elements.totalPrice.textContent,
            status: 'Pending',
            buyerService: elements.buyerService.checked ? 'Yes' : 'No',
            hours: elements.buyerService.checked ? elements.hoursInput.value : '0',
            weight: elements.buyerService.checked ? elements.weightInput.value : '0',
            riderInfo: {
                name: elements.riderName.value.trim(),
                id: elements.riderId.value.trim()
            }
        };

        const docRef = await addDoc(collection(db, "transactions"), transactionData);
        
        transactionData.id = docRef.id;
        currentTransaction = transactionData;
        addToTransactionHistory(transactionData);
        elements.completeTransactionBtn.disabled = false;
        elements.confirmBookingBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Booking';

        alert('Booking confirmed!');
    } catch (error) {
        console.error("Error saving booking:", error);
        alert("Failed to save booking");
        elements.confirmBookingBtn.disabled = false;
        elements.confirmBookingBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Booking';
    }
}

async function completeCurrentTransaction() {
    if (!currentTransaction) return;
    
    if (!auth.currentUser) {
        alert("System is initializing, please try again in a moment");
        return;
    }

    if (!elements.riderName.value.trim()) {
        alert("Please enter rider name");
        return;
    }
    if (!elements.riderId.value.trim()) {
        alert("Please enter rider ID");
        return;
    }

    try {
        elements.completeTransactionBtn.disabled = true;
        elements.completeTransactionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        await updateDoc(doc(db, "transactions", currentTransaction.id), {
            status: "Completed",
            completedAt: serverTimestamp(),
            completedBy: {
                name: elements.riderName.value.trim(),
                id: elements.riderId.value.trim()
            }
        });

        currentTransaction.status = "Completed";
        currentTransaction.completedAt = new Date().toISOString();
        currentTransaction.completedBy = {
            name: elements.riderName.value.trim(),
            id: elements.riderId.value.trim()
        };
        renderTransactionHistory();
        resetTransaction();
        elements.completeTransactionBtn.innerHTML = '<i class="fas fa-check-double"></i> Complete Transaction';
        
        alert('Transaction completed!');
    } catch (error) {
        console.error("Error completing transaction:", error);
        alert("Failed to complete transaction");
        elements.completeTransactionBtn.disabled = false;
        elements.completeTransactionBtn.innerHTML = '<i class="fas fa-check-double"></i> Complete Transaction';
    }
}

async function completeTransaction(index) {
    currentTransaction = transactionHistory[index];
    await completeCurrentTransaction();
}

async function loadInitialTransactions() {
    try {
        const q = query(
            collection(db, "transactions"),
            orderBy("bookingTime", "desc"),
            limit(5)
        );
        
        const snapshot = await getDocs(q);
        transactionHistory.length = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.bookingTime && data.bookingTime.toDate) {
                data.bookingTime = data.bookingTime.toDate().toISOString();
            }
            if (data.completedAt && data.completedAt.toDate) {
                data.completedAt = data.completedAt.toDate().toISOString();
            }
            addToTransactionHistory({ id: doc.id, ...data });
        });
    } catch (error) {
        console.error("Error loading transactions:", error);
    }
}

function addToTransactionHistory(transaction) {
    transactionHistory.unshift(transaction);
    if (transactionHistory.length > 5) transactionHistory.pop();
    renderTransactionHistory();
}

function renderTransactionHistory() {
    elements.transactionsList.innerHTML = transactionHistory
        .map((txn, index) => `
            <div class="transaction-item">
                <p><strong>${formatDate(txn.bookingTime)}</strong></p>
                <p>From: ${txn.startPoint || 'N/A'}</p>
                <p>To: ${txn.destination || 'N/A'}</p>
                <p>Distance: ${txn.distance || '0'} km</p>
                <p>Price: ${txn.price || '₱0'}</p>
                <p>Booked by: ${txn.riderInfo?.name || 'N/A'} (ID: ${txn.riderInfo?.id || 'N/A'})</p>
                ${txn.completedAt ? `
                    <p>Completed at: ${formatDate(txn.completedAt)}</p>
                    <p>Completed by: ${txn.completedBy?.name || 'N/A'} (ID: ${txn.completedBy?.id || 'N/A'})</p>
                ` : ''}
                <p class="status-${txn.status.toLowerCase()}">Status: ${txn.status}</p>
                ${txn.status === 'Pending' ? 
                    `<button class="complete-btn" data-index="${index}">Mark as Completed</button>` : ''}
            </div>
        `)
        .join('');
}

function resetTransaction() {
    currentTransaction = null;
    elements.confirmBookingBtn.disabled = true;
    elements.completeTransactionBtn.disabled = true;
}

// ======================
// Utility Functions
// ======================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

function updateCopyrightYear() {
    document.getElementById('year').textContent = new Date().getFullYear();
}

// ======================
// Event Listeners Setup
// ======================

function setupEventListeners() {
    // Map controls
    elements.useMyLocationBtn.addEventListener('click', useMyLocation);
    elements.manualStartBtn.addEventListener('click', activateManualStartMode);
    elements.manualDestBtn.addEventListener('click', activateManualDestMode);
    elements.clearStartBtn.addEventListener('click', clearStartPoint);
    elements.calculateRouteBtn.addEventListener('click', calculateRoute);
    
    // Form submissions
    elements.priceCalculatorForm.addEventListener('submit', calculatePrice);
    
    // Checkbox and input changes
    elements.buyerService.addEventListener('change', toggleBuyerFields);
    elements.weightInput.addEventListener('input', checkWeightLimit);
    
    // Transaction buttons
    elements.confirmBookingBtn.addEventListener('click', confirmBooking);
    elements.completeTransactionBtn.addEventListener('click', completeCurrentTransaction);
    
    // Transaction history clicks
    elements.transactionsList.addEventListener('click', function(e) {
        if (e.target.classList.contains('complete-btn')) {
            completeTransaction(parseInt(e.target.dataset.index));
        }
    });
}

// ======================
// Application Initialization
// ======================

async function initializeApp() {
    const loadingElement = showLoadingState();
    
    try {
        // Initialize Firebase Auth
        await signInAnonymously(auth);
        console.log("Anonymous authentication successful");
        
        // Set up auth state observer
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User is signed in:", user.uid);
                // Initialize application components
                initMap();
                setupEventListeners();
                loadInitialTransactions();
                updateCopyrightYear();
                toggleBuyerFields();
                checkWeightLimit();
                hideLoadingState();
            } else {
                console.log("User is signed out");
                // Handle signed out state if needed
                hideLoadingState();
                showMapError("Authentication failed. Please refresh.");
            }
        });
    } catch (error) {
        console.error("Initialization error:", error);
        hideLoadingState();
        showMapError("System initialization failed. Please refresh.");
        // Retry after 5 seconds
        setTimeout(initializeApp, 5000);
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
