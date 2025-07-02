import requests
import re
from openai import OpenAI
from dotenv import load_dotenv, dotenv_values 
load_dotenv()

client = OpenAI()

# Get latitude and longitude coordinates from a location name 
def geocode_location(location_name):
    """
    Use OpenStreetMap's Nominatim API to convert a location name to (lat, lon).
    """
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_name,
        "format": "json",
        "limit": 1
    }
    headers = {
        "User-Agent": "VacationGuide/1.0 (altacount124@gmail.com)"  # OSM requires this
    }
    response = requests.get(url, params=params, headers=headers, timeout=10)
    response.raise_for_status()
    data = response.json()
    if not data:
        raise ValueError(f"Could not geocode location: {location_name}")
    return float(data[0]["lat"]), float(data[0]["lon"])
def get_country_from_coords(lat, lon):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 3,
    }
    headers = {"User-Agent": "VacationGuide/1.0 (your@email.com)"}
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        country = data.get("address", {}).get("country")
        print(f"Reverse geocode: ({lat}, {lon}) -> {country}")
        return country
    except Exception as e:
        print(f"Reverse geocode error: {e}")
        return None
# Return locations of specified type near an area
def get_nearby_places_osm(location_name, type_of_place, radius=1500):
    """
    Accepts a location name (like 'Paris, France'), geocodes it,
    then searches Overpass API for nearby places of type `type_of_place`.
    """
    lat, lon = geocode_location(location_name)
    
    # Map your type_of_place to OSM tags
    osm_mapping = {
        "hotel": '["tourism"="hotel"]',
        "restaurant": '["amenity"="restaurant"]',
        "tourist_attraction": '["tourism"="attraction"]'
    }
    
    osm_tag = osm_mapping.get(type_of_place)
    if not osm_tag:
        print(f"No mapping for type: {type_of_place}")
        return []
    
    # Build Overpass QL query
    query = f"""
    [out:json][timeout:25];
    (
      node{osm_tag}(around:{radius},{lat},{lon});
      way{osm_tag}(around:{radius},{lat},{lon});
      relation{osm_tag}(around:{radius},{lat},{lon});
    );
    out center;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        response = requests.post(url, data={"data": query}, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("elements", [])
    except requests.RequestException as e:
        print(f"Request error: {e}")
        return []

def parse_response(text):
    description = None
    rating = None

    # Try strict line starts
    for line in text.splitlines():
        if line.lower().startswith("description:"):
            description = line.split(":",1)[1].strip()
        elif line.lower().startswith("rating:"):
            rating = line.split(":",1)[1].strip()

    # Regex fallback
    if not description:
        match = re.search(r"[Dd]escription:\s*(.*)", text)
        if match:
            description = match.group(1).strip()
    if not rating:
        match = re.search(r"[Rr]ating:\s*([0-9.]+)", text)
        if match:
            rating = match.group(1).strip()

    return description, rating


def generate_description_and_rating(place_name, location, category):
    prompt = (
        f"Please provide a short description (2-3 sentences) and a rating from 1.0 to 5.0 "
        f"for the following {category}. Format as:\n\n"
        f"Description: ...\nRating: ...\n\n"
        f"{place_name} located in {location}."
    )

    try:
        response = requests.post(
            "http://host.docker.internal:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            },
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        content = data.get("response", "")

        description, rating = parse_response(content)

        # Debug output
        print("----- RAW LLaMA OUTPUT -----")
        print(content)
        print("----------------------------")
        print(f"Parsed -> Description: {description}, Rating: {rating}")

        return description, rating

    except Exception as e:
        print(f"⚠️ Ollama error: {e}")
        return None, None