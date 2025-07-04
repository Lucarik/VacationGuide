let allHotelsRaw = [], allRestaurantsRaw = [], allAttractionsRaw = [];
let allHotels = [], allRestaurants = [], allAttractions = [];
let hotelsShown = 0, restaurantsShown = 0, attractionsShown = 0;

document.getElementById("location-form").addEventListener("submit", async function(event) {
    event.preventDefault();
    allHotelsRaw = [], allRestaurantsRaw = [], allAttractionsRaw = [];
    allHotels = [], allRestaurants = [], allAttractions = [];
    hotelsShown = 0, restaurantsShown = 0, attractionsShown = 0;
    
    const location = document.getElementById("location-input").value.trim();
    if (!location) {
        alert("Please enter a location!");
        return;
    }
    allHotelsRaw = await fetchPlaces(location, "hotel");
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("footer").classList.remove("absolute");
    await loadMoreHotels();
    allRestaurantsRaw = await fetchPlaces(location, "restaurant");
    await loadMoreRestaurants();
    allAttractionsRaw = await fetchPlaces(location, "tourist_attraction");
    await loadMoreAttractions();
});

async function fetchPlaces(location, type) {
    const response = await fetch("/nearby_places", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ location, type })
    });
    const data = await response.json();
    return data.places || [];
}
async function enrichPlace(element, type) {
    console.log(element);
    const name = element.tags?.name || "Unnamed";
    const descResponse = await fetch("/description", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ place_name: name, category: type })
    });
    const descData = await descResponse.json();
    return {
        name,
        description: descData.description || "No description available.",
        rating: parseFloat(descData.rating) || 3,
        coords: element.lat + "," + element.lon || "48.8566,2.3522"
    };
}
function createList(location, shown) {
    return location.slice(0, shown).map((item, index) => `
        <li class="place-item" style="animation-delay: ${index * 0.1}s;" data-map="https://maps.google.com/?q=${item.coords}">
            <div class="map-link" title="View on Google Maps">
                <a href="$https://maps.google.com/?q=${item.coords}" target="_blank" title="View on Google Maps">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                </a>
            </div>
            <h4>${item.name} ${getStarRating(item.rating)}</h4>
            <p>${item.description}</p>
        </li>
    `).join('');
}
function renderHotels() {
    if (hotelsShown >= allHotelsRaw.length) {
        document.getElementById("show-more-hotels").style.display = "none";
    } else {
        document.getElementById("show-more-hotels").style.display = "block";
        const hotelList = document.getElementById("hotel-list");
        hotelList.innerHTML = createList(allHotels, hotelsShown);
    }
}
function renderRestaurants() {
    if (restaurantsShown >= allRestaurantsRaw.length) {
        document.getElementById("show-more-restaurants").style.display = "none";
    } else {
        document.getElementById("show-more-restaurants").style.display = "block";
        const restaurantList = document.getElementById("restaurant-list");
        restaurantList.innerHTML = createList(allRestaurants, restaurantsShown);
    }
}
function renderAttractions() {
    if (attractionsShown >= allAttractionsRaw.length) {
        document.getElementById("show-more-attractions").style.display = "none";
    } else {
        document.getElementById("show-more-attractions").style.display = "block";
        const attractionList = document.getElementById("attraction-list");
        attractionList.innerHTML = createList(allAttractions, attractionsShown);
    }
}
async function loadMoreHotels() {
    const nextBatch = allHotelsRaw.slice(hotelsShown, hotelsShown + 1);
    for (const element of nextBatch) {
        const enriched = await enrichPlace(element, "hotel");
        allHotels.push(enriched);
        hotelsShown++;
        renderHotels(); // immediately show new item
        await new Promise(resolve => setTimeout(resolve, 1100));
    }
}
async function loadMoreRestaurants() {
    const nextBatch = allRestaurantsRaw.slice(restaurantsShown, restaurantsShown + 1);
    for (const element of nextBatch) {
        allRestaurants.push(await enrichPlace(element, "restaurant"));
        restaurantsShown++;
        renderRestaurants();
        await new Promise(resolve => setTimeout(resolve, 1100));
    }
}
async function loadMoreAttractions() {
    const nextBatch = allAttractionsRaw.slice(attractionsShown, attractionsShown + 1);
    for (const element of nextBatch) {
        allAttractions.push(await enrichPlace(element, "tourist_attraction"));
        attractionsShown++;
        renderAttractions();
        await new Promise(resolve => setTimeout(resolve, 1100));
    }
}
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

document.getElementById("show-more-hotels").addEventListener("click", loadMoreHotels);
document.getElementById("show-more-restaurants").addEventListener("click", loadMoreRestaurants);
document.getElementById("show-more-attractions").addEventListener("click", loadMoreAttractions);