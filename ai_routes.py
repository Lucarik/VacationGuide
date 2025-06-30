import requests
import os
import time
from openai import OpenAI
from dotenv import load_dotenv, dotenv_values 
load_dotenv()

client = OpenAI()

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

# Usage with rate limit of 1 request per second
# location = "48.8566,2.3522"  # Paris

# hotels = get_nearby_places_osm(location, "hotel")
# time.sleep(1)  # comply with OSM usage policy
# restaurants = get_nearby_places_osm(location, "restaurant")
# time.sleep(1)
# attractions = get_nearby_places_osm(location, "tourist_attraction")

# Pretty print names & coordinates
def summarize_places(places, type):
    lst = []
    for el in places:
        name = el.get("tags", {}).get("name", "Unnamed")
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        #print(f"{name}: ({lat}, {lon})")
        lst.append({"name":name, "category":type})
    return lst

#hotels = summarize_places(hotels, "hotel")
#restaurants = summarize_places(restaurants, "restaurant")
#attractions = summarize_places(attractions, "tourist attraction")

def generate_description_and_rating(place_name, category):
    prompt = (
        f"Please provide a description and a rating (1.0-5.0) for the following {category}.\n"
        f"Please separate the description and rating.\n\n"
        f"{place_name}.\n\n"
        f"Format the response as:\n"
        f"Description: [description text]\n"
        f"Rating: [rating number between 1.0 and 5.0]"
    )
    
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        result_text = response.choices[0].message.content.strip()
        description, rating = None, None
        for line in result_text.split("\n"):
            if line.startswith("Description:"):
                description = line[len("Description:"):].strip()
            elif line.startswith("Rating:"):
                rating = line[len("Rating:"):].strip()
        return description, rating
    except Exception as e:
        print(f"OpenAI error: {e}")
        return None, None

#hotel = hotels[0]
#description, rating = generate_description_and_rating(hotel["name"], hotel["category"])
#print(f"{hotel['name']} ({hotel['category']}):\nDescription: {description}\nRating: {rating}\n")

# Example usage for a hotel

# place_name = "Hotel Le Meurice"
# category = "hotel"
# description, rating = generate_description_and_rating(place_name, category)

# print(f"Description: {description}")
# print(f"Rating: {rating}")

# places = [
#     {"name": "Hotel Le Meurice", "category": "hotel"},
#     {"name": "Le Bernardin", "category": "restaurant"},
#     {"name": "Eiffel Tower", "category": "tourist attraction"}
# ]

# for place in places:
#     description, rating = generate_description_and_rating(place["name"], place["category"])
#     print(f"{place['name']} ({place['category']}):\nDescription: {description}\nRating: {rating}\n")
