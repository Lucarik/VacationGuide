from flask import Flask, render_template, request, jsonify
import time
import json
import redis
import os
from ai_routes import get_country_from_coords, get_nearby_places_osm, generate_description_and_rating
from dotenv import load_dotenv

load_dotenv()  # load .env into environment variables
# To run use docker-compose up --build
LOCATIONIQ_KEY = os.getenv("LOCATIONIQ_KEY")

app = Flask(__name__)

# Use values from .env (or defaults)
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", 6379))
redis_db = int(os.getenv("REDIS_DB", 0))

r = redis.Redis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)

# Main page
@app.route("/")
def index():
    return render_template("index.html")

# Call OSM api to return hotels/restaurants/attractions close to input location
@app.route("/api/nearby_places", methods=["POST"])
def nearby_places():
    data = request.json
    location = data.get("location")
    type_of_place = data.get("type")
    radius = data.get("radius")
    #places = get_nearby_places_osm(location, type_of_place, radius=radius)
    cache_key = f"{location}:{type_of_place}:{radius}"

    # Check Redis cache
    cached_data = r.get(cache_key)
    if cached_data:
        print(f"Cache hit for {cache_key}")
        cached_json = json.loads(cached_data)
        places = cached_json.get("places", [])
        country = cached_json.get("country", "United States")
    else:
        print(f"Cache miss for {cache_key}, fetching from Overpass")
        places = get_nearby_places_osm(location, type_of_place, radius)

        # Determine country
        country = "United States"
        if places:
            first_place = places[0]
            lat = first_place.get("lat") or first_place.get("center", {}).get("lat")
            lon = first_place.get("lon") or first_place.get("center", {}).get("lon")
            if lat and lon:
                country_result = get_country_from_coords(lat, lon)
                if country_result:
                    country = country_result

        # Cache places + country together
        r.setex(cache_key, 3600, json.dumps({"places": places, "country": country}))
        time.sleep(1)  # Respect Overpass

    # Now add static map URL for each place in the response
    formatted_places = []
    for place in places:
        lat = place.get("lat") or place.get("center", {}).get("lat")
        lon = place.get("lon") or place.get("center", {}).get("lon")
        static_map = None
        if lat and lon:
            static_map = (
                f"https://maps.locationiq.com/v3/staticmap"
                f"?key={LOCATIONIQ_KEY}&center={lat},{lon}"
                f"&zoom=15&size=400x300&markers=icon:small-red-cutout|{lat},{lon}"
            )

        formatted_places.append({
            **place,
            "static_map": static_map
        })

    return jsonify({
        "places": formatted_places,
        "country": country
    })

# Call llama3 to generate a description and rating for desired location
@app.route("/api/description", methods=["POST"])
def description():
    data = request.json
    place_name = data.get("place_name")
    location = data.get("location")
    category = data.get("category")
    cache_key = f"desc:{place_name}:{location}:{category}"

    # Check Redis cache
    cached = r.get(cache_key)
    if cached:
        print(f"Cache hit for {cache_key}")
        try:
            cached_data = json.loads(cached)
            return jsonify({
                "description": cached_data.get("description"),
                "rating": cached_data.get("rating")
            })
        except Exception as e:
            print(f"Cache decode error: {e}")

    # Generate via LLaMA
    description, rating = generate_description_and_rating(place_name, location, category)

    # Safe fallback
    if not description:
        description = f"{place_name} is a notable {category} located in {location}."
    if not rating:
        rating = "3.5"

    # Cache it for 24 hours
    r.setex(cache_key, 86400, json.dumps({"description": description, "rating": rating}))

    return jsonify({"description": description, "rating": rating})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)