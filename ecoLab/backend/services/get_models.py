from .Models import gam, maxent, random_forest, svm, brt, create_absence, create_grid, create_model_maps
import pandas as pd

def run_models(models: dict):
    selectedSpecies = models.get("selectedSpecies", [])
    interactionData = models.get("interactionData", [])
    geeProject      = models.get("geeProject", "")
    finalData       = models.get("finalData", [])
    modelsData      = models.get("modelsData", [])
    country         = models.get("country", [])
    points          = models.get("points", None)
    country         = country.get("label", None)

    selected_models  = modelsData.get("selectedModels", [])
    presence_type    = modelsData.get("presenceType", [])
    selected_metrics = modelsData.get("selectedMetrics", [])

    selected_species_names = [s.get("name") for s in selectedSpecies] if selectedSpecies else []

    if isinstance(finalData, list):
        finalData = pd.DataFrame(finalData)

    results = {}

    if not selected_models:
        return results
    
    backgroundData = create_grid.generate_prediction_grid(
        geeProject, country, points,
        interactionData,
        selectedSpecies,
        finalData,
    )
    backgroundData = backgroundData.drop(columns=[c for c in ["geometry"] if c in backgroundData.columns])

    
    
    not_features = {"eventDate", "latitude", "longitude", "geometry", "presence", "year",
                    'id', 'country', 'day', 'month', 'scientificName', 'source'}
                                    
    if presence_type == "presence_only":
        finalData["presence"] = 1
        features = [col for col in finalData.columns if col not in not_features]

        # Monta background com presence=0 usando o grid do país
        background_sample = backgroundData[features].copy()
        background_sample["presence"] = 0

        # Combina presença real + background sintético
        presence_only_df = pd.concat(
            [finalData[features + ["presence"]], background_sample],
            ignore_index=True
        )
        results["maxent"] = maxent.run(presence_only_df, features, selected_metrics)
        maps = create_model_maps.generate_model_maps(
            results, backgroundData, country, species_name=selected_species_names
        )
        return maps
        
    if len(selected_species_names) <= 1:
        
        data_with_absences = create_absence.build_presence_dataframe(backgroundData, finalData)
        features = [col for col in data_with_absences.columns if col not in not_features]
        for model in selected_models:
            try:
                if model == "gam":
                    results["gam"] = gam.run(data_with_absences, features, selected_metrics)
                elif model == "maxent":
                    results["maxent"] = maxent.run(data_with_absences, features, selected_metrics)
                elif model == "random_forest":
                    results["random_forest"] = random_forest.run(data_with_absences, features, selected_metrics)
                elif model == "svm":
                    results["svm"] = svm.run(data_with_absences, features, selected_metrics)
                elif model == "brt":
                    results["brt"] = brt.run(data_with_absences, features, selected_metrics)
            except Exception as e:
                print(f"  Erro ao rodar {model}: {e}")

        maps = create_model_maps.generate_model_maps(results, data_with_absences, country, species_name=selected_species_names)
        return maps

    species_col = None
    for candidate in ["species", "scientificName", "taxon", "name"]:
        if candidate in finalData.columns:
            species_col = candidate
            break

    interaction_columns = set()
    for i in interactionData:
        interaction_columns.add(i.get("source"))
        interaction_columns.add(i.get("target"))

    interaction_col_candidates = []
    env_only_cols = []
    for c in finalData.columns:
        if c in not_features:
            continue
        if any(ic in c for ic in interaction_columns):
            interaction_col_candidates.append(c)
        else:
            env_only_cols.append(c)

    all_maps = {}

    for species_name in selected_species_names:
        print(f"\n{'='*60}\nModelando espécie: {species_name}\n{'='*60}")

        if species_name and species_col and species_col in finalData.columns:
            finalData[species_col] = finalData[species_col].str.lower().str.strip()
            species_name_lower = species_name.lower().strip()
            species_mask = finalData[species_col].str.contains(species_name_lower, na=False)
            species_finalData = finalData[species_mask].copy()
        else:
            species_finalData = finalData.copy()

        species_interaction_cols = []
        for i in interaction_col_candidates:
            for j in interactionData:
                if j.get("source") in i and j.get("target", "").lower() == species_name.lower():
                    species_interaction_cols.append(i)
                elif j.get("target") in i and j.get("source", "").casefold():
                    species_interaction_cols.append(i)

        features_for_species = env_only_cols + species_interaction_cols

        bg_for_species = backgroundData.copy()
        data_with_absences = create_absence.build_presence_dataframe(
            grid_df=bg_for_species, occurrences=species_finalData
        )

        for col in species_interaction_cols:
            if col in data_with_absences.columns:
                data_with_absences[col] = data_with_absences[col].fillna(0)

        species_results = {}
        for model in selected_models:
            try:
                if model == "gam":
                    species_results["gam"] = gam.run(data_with_absences, features_for_species, selected_metrics)
                elif model == "maxent":
                    species_results["maxent"] = maxent.run(data_with_absences, features_for_species, selected_metrics)
                elif model == "random_forest":
                    species_results["random_forest"] = random_forest.run(data_with_absences, features_for_species, selected_metrics)
                elif model == "svm":
                    species_results["svm"] = svm.run(data_with_absences, features_for_species, selected_metrics)
                elif model == "brt":
                    species_results["brt"] = brt.run(data_with_absences, features_for_species, selected_metrics)
            except Exception as e:
                print(f"  Erro ao rodar {model} para {species_name}: {e}")

        species_maps = create_model_maps.generate_model_maps(
            species_results, data_with_absences, country,
            species_name=species_name,
        )

        for model_key, map_data in species_maps.items():
            all_maps[f"{model_key}::{species_name}"] = map_data

    return all_maps


def run_metrics(metrics: dict):
    return "Running Metrics"