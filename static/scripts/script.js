let allHotelsRaw = [], allRestaurantsRaw = [], allAttractionsRaw = [];
let allHotels = [], allRestaurants = [], allAttractions = [];
const hotelsShown = { count: 0 }, restaurantsShown = { count: 0 }, attractionsShown = { count: 0 };
let currentLocation = ''

// When user submits form, get location and search for locations in the area
document.getElementById("location-form").addEventListener("submit", async function(event) {
    event.preventDefault();
    allHotelsRaw = [], allRestaurantsRaw = [], allAttractionsRaw = [];
    allHotels = [], allRestaurants = [], allAttractions = [];
    hotelsShown.count = 0, restaurantsShown.count = 0, attractionsShown.count = 0;
    
    const location = document.getElementById("location-input").value.trim();
    if (!location) {
        alert("Please enter a location!");
        return;
    }
    currentLocation = location;
    
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("footer").classList.remove("absolute");
    allHotelsRaw = await fetchPlaces(location, "hotel");
    document.getElementById("hotel-count").textContent = allHotelsRaw.length;
    await loadMorePlaces(allHotelsRaw, allHotels, "hotel", "hotel-list", hotelsShown);
    document.getElementById("show-more-hotels").classList.remove("hidden");
    allRestaurantsRaw = await fetchPlaces(location, "restaurant");
    document.getElementById("restaurant-count").textContent = allRestaurantsRaw.length;
    await loadMorePlaces(allRestaurantsRaw, allRestaurants, "restaurant", "restaurant-list", restaurantsShown);
    document.getElementById("show-more-restaurants").classList.remove("hidden");
    allAttractionsRaw = await fetchPlaces(location, "tourist_attraction");
    document.getElementById("attraction-count").textContent = allAttractionsRaw.length;
    await loadMorePlaces(allAttractionsRaw, allAttractions, "attraction", "attraction-list", attractionsShown);
    document.getElementById("show-more-attractions").classList.remove("hidden");
});

// Call OpenStreetMap API and get specified type of locations nearby
async function fetchPlaces(location, type, radius=1600) {
    const headerLoader = document.querySelector(`#${type}-header .header-loader`);
    if (headerLoader) headerLoader.style.display = "inline-block";

    try {
        const response = await fetch("/api/nearby_places", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ location, type, radius })
        });
        const data = await response.json();
        if (!data.country) data.country = "United States";
        window.currentCountry = data.country;
        return data.places || [];
    } finally {
        if (headerLoader) headerLoader.style.display = "none";
    }
}

// Call llama api to get a description and rating for each location
async function ratePlace(element, type) {
    const headerLoader = document.querySelector(`#${type}-header .header-loader`);
    if (headerLoader) headerLoader.style.display = "inline-block";

    const name = element.tags?.name || "Unnamed";
    const lat = element.lat || (element.center && element.center.lat) || 0;
    const lon = element.lon || (element.center && element.center.lon) || 0;

    try {
        const descResponse = await fetch("/api/description", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ place_name: name, location: currentLocation, category: type })
        });
        const descData = await descResponse.json();

        let imageUrl = await getPlaceImage(element, name);
        if (!imageUrl) imageUrl = element.static_map;

        return {
            name,
            description: descData.description || "No description available.",
            rating: parseFloat(descData.rating) || 3,
            coords: lat + "," + lon || "48.8566,2.3522",
            image: imageUrl
        };
    } catch (e) {
        console.error("Error getting description and rating for location:", e);
        return {
            name,
            description: "No description available.",
            rating: 3,
            coords: lat + "," + lon || "48.8566,2.3522",
            image: element.static_map
        };
    } finally {
        if (headerLoader) headerLoader.style.display = "none";
    }
}
// Helper function to only check Wikipedia pages of relevent languages for country
function getWikiLanguagesByCountry(country) {
    const countryLangMap = {
        "France": ["fr", "en"],//, "es", "de"],
        "Germany": ["de", "en"],//, "fr", "es"],
        "Spain": ["es", "en"],//, "fr", "de"],
        "Italy": ["it", "en"],//, "fr", "es"],
        "Portugal": ["pt", "en"],//, "es"],
        "Brazil": ["pt", "en"],//, "es"],
        "Canada": ["en", "fr"],
        "Belgium": ["fr", "nl"],//, "de", "en"],
        "Netherlands": ["nl", "en"],//, "de", "fr"],
        "Switzerland": ["de", "fr"],//, "it", "en"],
        "India": ["en", "hi"],
        "Japan": ["ja", "en"],
        "China": ["zh", "en"],
        "Russia": ["ru", "en"],
        "United States": ["en", "es"],//, "fr"],
        "United Kingdom": ["en", "fr"],//, "de"],
        "Mexico": ["es", "en"],
        "Argentina": ["es", "en"],
        "Chile": ["es", "en"],
        "Peru": ["es", "en"],
        "Australia": ["en", "fr"],
        "New Zealand": ["en", "mi"],
        "Turkey": ["tr", "en"],
        "Egypt": ["ar", "en"],
        "Morocco": ["fr", "ar"],//, "en"],
        "South Africa": ["en", "af"],//, "zu"]
    };

    // Fallback for unknown countries
    return countryLangMap[country] || ["en", "fr", "es", "de"];
}
// Helper function for getting images of location from Wikipedia
async function getWikiImage(placeName, lang = "en") {
    try {
        const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(placeName)}`;
        const response = await fetch(apiUrl, {
            headers: {
                "Accept": "application/json"
            }
        });
        if (!response.ok) {
            // console.warn(`No summary found for ${placeName} in ${lang}`);
            return null;
        }

        const data = await response.json();
        if (data.thumbnail && data.thumbnail.source) {
            return data.thumbnail.source;
        } else if (data.originalimage && data.originalimage.source) {
            return data.originalimage.source;
        }
        return null;
    } catch (err) {
        console.error(`Wiki fetch error for ${placeName} in ${lang}:`, err);
        return null;
    }
}
// Gets image for a location
async function getPlaceImage(element, placeName) {
    const country = window.currentCountry || "United States";
    const languages = getWikiLanguagesByCountry(country);

    const osmImage = element?.tags?.image;
    if (osmImage) return osmImage;

    for (const lang of languages) {
        const wikiImage = await getWikiImage(placeName, lang);
        if (wikiImage) return wikiImage;
    }
    return null;
}

// Creates html for displayed locations
function createSingleListItem(item, index) {
    return `
        <li class="place-item" 
            data-image="${item.image}" 
            style="animation-delay: ${index * 0.1}s;"
            data-map="https://maps.google.com/?q=${item.coords}">
            <div class="map-link" title="View on Google Maps">
                <a href="https://maps.google.com/?q=${item.coords}" target="_blank">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                </a>
            </div>
            <h4 class="location-name">${item.name} ${getStarRating(item.rating)}</h4>
            <p>${item.description}</p>
        </li>
    `;
}
// Increase number of locations displayed
async function loadMorePlaces(allRaw, allProcessed, type, listElementId, shownCount, increment = 3) {
    const listEl = document.getElementById(listElementId);
    const nextBatch = allRaw.slice(shownCount.count, shownCount.count + increment);
    console.log(shownCount.count + increment);
    for (const element of nextBatch) {
        // Add inline loader
        const loadingLi = document.createElement("li");
        loadingLi.innerHTML = `<span class="inline-loader"></span> Loading ${type}...`;
        listEl.appendChild(loadingLi);
        const descriptionAndRating = await ratePlace(element, type);
        allProcessed.push(descriptionAndRating);
        shownCount.count++;
        // Replace loading with actual item
        loadingLi.outerHTML = createSingleListItem(descriptionAndRating, shownCount.count - 1);
        await new Promise(resolve => setTimeout(resolve, 1100));
    }
    if (shownCount.count >= allRaw.length) {
        document.getElementById(`show-more-${type}s`).style.display = "none";
    } else {
        document.getElementById(`show-more-${type}s`).style.display = "block";
    }
}
// Display the rating of the current location
function getStarRating(rating) {
    const clampedRating = Math.max(0, Math.min(5, rating));
    const percentage = (clampedRating / 5) * 100;
    return `
        <span class="star-rating">
            <span class="star-fill" style="width: ${percentage}%;">★★★★★</span>
            ★★★★★
        </span>
    `;
}
// Set click events for 'show more' buttons
document.getElementById("show-more-hotels").addEventListener("click", () => {
    loadMorePlaces(allHotelsRaw, allHotels, "hotel", "hotel-list", hotelsShown);
});

document.getElementById("show-more-restaurants").addEventListener("click", () => {
    loadMorePlaces(allRestaurantsRaw, allRestaurants, "restaurant", "restaurant-list", restaurantsShown);
});

document.getElementById("show-more-attractions").addEventListener("click", () => {
    loadMorePlaces(allAttractionsRaw, allAttractions, "attraction", "attraction-list", attractionsShown);
});

// Events for image showing on hover
document.addEventListener("mousemove", (e) => {
    const preview = document.getElementById("hover-preview");
    preview.style.left = e.clientX + "px";
    preview.style.top = e.clientY + "px";
});

document.addEventListener("mouseover", (e) => {
    const li = e.target.closest(".place-item");
    if (li && li.dataset.image) {
        const img = document.getElementById("hover-preview-img");
        img.src = li.dataset.image;
        img.alt = `Preview of ${li.querySelector("h4").innerText}`;
        document.getElementById("hover-preview").style.display = "block";
    }
});

document.addEventListener("mouseout", (e) => {
    const li = e.target.closest(".place-item");
    if (li) {
        document.getElementById("hover-preview").style.display = "none";
    }
});

// Events for radius search dropdown
document.getElementById("hotel-radius").addEventListener("change", async (e) => {
    const radius = e.target.value;
    hotelsShown.count = 0;
    allHotels = [];
    allHotelsRaw = await fetchPlaces(currentLocation, "hotel", radius);
    document.getElementById("hotel-list").innerHTML = "";
    document.getElementById("hotel-count").textContent = allHotelsRaw.length;
    await loadMorePlaces(allHotelsRaw, allHotels, "hotel", "hotel-list", hotelsShown);
});

document.getElementById("restaurant-radius").addEventListener("change", async (e) => {
    const radius = e.target.value;
    restaurantsShown.count = 0;
    allRestaurants = [];
    allRestaurantsRaw = await fetchPlaces(currentLocation, "restaurant", radius);
    document.getElementById("restaurant-list").innerHTML = "";
    document.getElementById("restaurant-count").textContent = allRestaurantsRaw.length;
    await loadMorePlaces(allRestaurantsRaw, allRestaurants, "restaurant", "restaurant-list", restaurantsShown);
});

document.getElementById("attraction-radius").addEventListener("change", async (e) => {
    const radius = e.target.value;
    attractionsShown.count = 0;
    allAttractions = [];
    allAttractionsRaw = await fetchPlaces(currentLocation, "tourist_attraction", radius);
    document.getElementById("attraction-list").innerHTML = "";
    document.getElementById("attraction-count").textContent = allAttractionsRaw.length;
    await loadMorePlaces(allAttractionsRaw, allAttractions, "attraction", "attraction-list", attractionsShown);
});
// Events for dark mode toggle button
const toggleBtn = document.getElementById("theme-toggle");
const toggleLabel = toggleBtn.querySelector(".toggle-label");

toggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        toggleLabel.textContent = "Light Mode";
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        toggleLabel.textContent = "Dark Mode";
    }
});