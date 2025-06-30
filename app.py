from flask import Flask, render_template, request, jsonify
import time
from ai_routes import get_nearby_places_osm, generate_description_and_rating
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/nearby_places", methods=["POST"])
def nearby_places():
    data = request.json
    location = data.get("location")
    type_of_place = data.get("type")
    places = get_nearby_places_osm(location, type_of_place)
    time.sleep(1)  # enforce 1 request/sec limit for Overpass
    return jsonify({"places": places})

@app.route("/description", methods=["POST"])
def description():
    data = request.json
    place_name = data.get("place_name")
    category = data.get("category")
    description, rating = generate_description_and_rating(place_name, category)
    return jsonify({"description": description, "rating": rating})

if __name__ == "__main__":
    app.run(debug=True)