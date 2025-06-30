from flask import Flask, render_template, request, jsonify
import time
import json
import redis
import os
from ai_routes import get_nearby_places_osm, generate_description_and_rating
from dotenv import load_dotenv

load_dotenv()  # load .env into environment variables

app = Flask(__name__)

# Use values from .env (or defaults)
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", 6379))
redis_db = int(os.getenv("REDIS_DB", 0))

r = redis.Redis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/nearby_places", methods=["POST"])
def nearby_places():
    data = request.json
    location = data.get("location")
    type_of_place = data.get("type")
    cache_key = f"{location}:{type_of_place}"

    # Check Redis cache
    cached_data = r.get(cache_key)
    if cached_data:
        print(f"Cache hit for {cache_key}")
        places = json.loads(cached_data)
    else:
        print(f"Cache miss for {cache_key}, fetching from Overpass")
        places = get_nearby_places_osm(location, type_of_place)
        r.setex(cache_key, 3600, json.dumps(places))  # Cache for 1 hour

    # Respect Overpass limit
    time.sleep(1)

    return jsonify({"places": places})

@app.route("/api/description", methods=["POST"])
def description():
    data = request.json
    place_name = data.get("place_name")
    location = data.get("location")
    category = data.get("category")
    description, rating = generate_description_and_rating(place_name, location, category)
    return jsonify({"description": description, "rating": rating})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)