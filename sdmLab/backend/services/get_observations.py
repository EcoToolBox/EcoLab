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
