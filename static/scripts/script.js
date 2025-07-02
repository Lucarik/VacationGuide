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
    allHotelsRaw = await fetchPlaces(location, "hotel");
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("footer").classList.remove("absolute");
    await loadMorePlaces(allHotelsRaw, allHotels, "hotel", "hotel-list", hotelsShown);
    allRestaurantsRaw = await fetchPlaces(location, "restaurant");
    await loadMorePlaces(allRestaurantsRaw, allRestaurants, "restaurant", "restaurant-list", restaurantsShown);
    allAttractionsRaw = await fetchPlaces(location, "tourist_attraction");
    await loadMorePlaces(allAttractionsRaw, allAttractions, "attraction", "attraction-list", attractionsShown);
});
// Call OpenStreetMap API and get specified type of locations nearby
async function fetchPlaces(location, type) {
    const headerLoader = document.querySelector(`#${type}-header .header-loader`);
    if (headerLoader) headerLoader.style.display = "inline-block";

    try {
        const response = await fetch("/api/nearby_places", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ location, type })
        });
        const data = await response.json();
        if (!data.country) data.country = "United States";
        window.currentCountry = data.country;
        return data.places || [];
    } finally {
        if (headerLoader) headerLoader.style.display = "none";
    }
}
// Call api to get a description and rating for each location
async function enrichPlace(element, type) {
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
        console.error("Error enriching place:", e);
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
        <li class="place-item" style="animation-delay: ${index * 0.1}s;" data-map="https://maps.google.com/?q=${item.coords}">
            <div class="map-link" title="View on Google Maps">
                <a href="https://maps.google.com/?q=${item.coords}" target="_blank" title="View on Google Maps">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                </a>
            </div>
            <h4>${item.name} ${getStarRating(item.rating)}</h4>
            <p>${item.description}</p>
            <img src="${item.image}" alt="Image of ${item.name}" class="hover-image">
        </li>
    `;
}
// Increase number of hotels displayed
async function loadMorePlaces(allRaw, allProcessed, type, listElementId, shownCount, increment = 3) {
    const listEl = document.getElementById(listElementId);
    const nextBatch = allRaw.slice(shownCount.count, shownCount.count + increment);
    console.log(shownCount.count + increment);
    for (const element of nextBatch) {
        console.log('good0.5');
        // Add inline loader
        const loadingLi = document.createElement("li");
        loadingLi.innerHTML = `<span class="inline-loader"></span> Loading ${type}...`;
        listEl.appendChild(loadingLi);
        console.log('good1');
        // Enrich with description & rating & image
        const enriched = await enrichPlace(element, type);
        allProcessed.push(enriched);
        shownCount.count++;
        console.log('good2');
        // Replace loading with actual item
        loadingLi.outerHTML = createSingleListItem(enriched, shownCount.count - 1);
        console.log('good3');
        await new Promise(resolve => setTimeout(resolve, 1100));
    }

    // Hide "Show more" button if needed
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