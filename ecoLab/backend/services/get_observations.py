import ecoobs

def get_autocomplete(speciesname:str):
    data = ecoobs.get_species_autocomplete(name=speciesname)
    if data:
        return [
            {"key": item["key"], "name": item["canonicalName"]}
            for item in data
        ]
    else:
        return []

def get_kingdoms():
    data = ecoobs.get_kingdoms()
    print(data)
    if data:
        return [
            {
                "key": item.get("key"),
                "name": item.get("name"),
                "canonicalName": item.get("canonicalName"),
                "rank": item.get("rank"),
                "hasChildren": item.get("hasChildren"),
                "numDescendants": item.get("numDescendants", 0)
            }
            for item in data
        ]
    
    return []

def get_children(key: int, limit: int = 50, offset: int = 0):
    data = ecoobs.get_tree_node(usage_key=key, limit=limit, offset=offset)
    if data and "results" in data:
        return [
            {
                "key": item.get("key"),
                "name": item.get("name"),
                "canonicalName": item.get("canonicalName"),
                "rank": item.get("rank"),
                "hasChildren": item.get("hasChildren"),
                "numDescendants": item.get("numDescendants", 0)
            }
            for item in data["results"]
        ]
    return []

def check_gbif_key():
    try:
        return ecoobs.gbif_key_exists()
    except Exception as e:
        return {"success": False, "message": f"Key check failed: {str(e)}"}
    

def check_specieslink_key():
    try:
        return ecoobs.species_link_key_exists()
    except Exception as e:
        return {"success": False, "message": f"Key check failed: {str(e)}"}

def authenticate_gbif(gbif: dict):
    email = gbif.get("email")
    userId = gbif.get("userId")
    apiKey = gbif.get("apiKey")

    if not email or not userId or not apiKey:
        return {"error": "Missing required fields: email, userId, apiKey"} 

    try:
        auth_result = ecoobs.save_gbif_credentials(email=email, user=userId, password=apiKey)
        return {"success": True, "message": "Authentication successful", "data": auth_result}
    except Exception as e:
        return {"success": False, "message": f"Authentication failed: {str(e)}"}
    

def authenticate_specieslink(specieslink: dict):
    print(specieslink)
    apiKey = specieslink.get("apiKey")

    if not apiKey:
        return {"error": "Missing required fields: apiKey"} 

    try:
        auth_result = ecoobs.save_specieslink_apikey(apikey=apiKey)
        return {"success": True, "message": "Authentication successful", "data": auth_result}
    except Exception as e:
        return {"success": False, "message": f"Authentication failed: {str(e)}"}
    

def search(occurrences: dict):
    sources = occurrences.get("sources", [])
    gbif = "gbif" in sources
    specieslink = "specieslink" in sources
    inaturalist = "inaturalist" in sources

    speciesList = [s.get("name") for s in occurrences.get("speciesList", [])]
    country = occurrences.get("country", "{}")
    year = occurrences.get("year", (None, None))
    points = occurrences.get("points", [])

    lat_min = points[0][0] if len(points) > 0 else None
    lng_min = points[0][1] if len(points) > 0 else None
    lat_max = points[3][0] if len(points) > 0 else None
    lng_max = points[3][1] if len(points) > 0 else None

    try:
        search_result = ecoobs.get_occurrences(
          includeSpeciesLink=specieslink,
          includeGbif=gbif,
          includeInaturalist=inaturalist,
          species_names=speciesList,
          country=country,
          year_range=year,
          lat_min=lat_min,
          lon_min=lng_min,
          lat_max=lat_max,
          lon_max=lng_max
        )

        #search_result = search_result[(search_result['longitude'] != 0) & (search_result['latitude'] != 0)].reset_index(drop=True)

        return search_result.convert_dtypes().to_dict(orient="records")
    except Exception as e:
        return {"success": False, "message": f"Search failed: {str(e)}"}