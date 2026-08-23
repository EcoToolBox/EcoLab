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
    country         = country.get("ingles", None)
    envGridData     = models.get("envGridData", [])
    print("14")
    selected_models  = modelsData.get("selectedModels", [])
    presence_type    = modelsData.get("presenceType", [])
    selected_metrics = modelsData.get("selectedMetrics", [])

    # Validação: aleatória (padrão, uso genérico) ou espacial (K-means por
    # coordenadas). backgroundRatio controla quantos pontos de background por
    # presença (padrão 2:1). backgroundSource é informativo: "grid_random"
    # usa o grid gerado automaticamente; "provided" reflete que o usuário
    # enviou sua própria planilha ambiental (envGridData), que já é usada
    # como grid/background quando presente.
    validation_mode  = modelsData.get("validationMode", "random")
    n_folds          = int(modelsData.get("nFolds", 10) or 10)
    background_ratio = float(modelsData.get("backgroundRatio", 2) or 2)
    background_source = modelsData.get("backgroundSource", "grid_random")
    if validation_mode not in ("random", "spatial"):
        validation_mode = "random"

    selected_species_names = [s.get("name") for s in selectedSpecies] if selectedSpecies else []

    if isinstance(finalData, list):
        finalData = pd.DataFrame(finalData)

    user_grid_df = pd.DataFrame(envGridData) if envGridData else None

    results = {}

    if not selected_models:
        raise ValueError("Selecione ao menos um modelo para executar.")
    if finalData.empty:
        raise ValueError("Não há dados de ocorrência para executar a modelagem.")
    if not country:
        raise ValueError("Selecione um país para gerar os mapas do modelo.")
    
    backgroundData = create_grid.generate_prediction_grid(
        geeProject, country, points,
        interactionData,
        selectedSpecies,
        finalData,
        user_grid=user_grid_df,
    )
    backgroundData = backgroundData.drop(columns=[c for c in ["geometry"] if c in backgroundData.columns])

    # Quando o grid vem de uma planilha do usuário, as ocorrências (finalData)
    # não têm variáveis ambientais próprias. Herdamos os valores do ponto do
    # grid mais próximo de cada ocorrência, pra presença e ausência usarem as
    # mesmas variáveis no treino.
    if user_grid_df is not None and not user_grid_df.empty and not finalData.empty:
        grid_feature_cols = [
            c for c in backgroundData.columns
            if c not in {"latitude", "longitude", "eventDate", "geometry"}
        ]
        missing_in_final = [c for c in grid_feature_cols if c not in finalData.columns]
        if missing_in_final:
            finalData = create_grid.attach_nearest_grid_features(finalData, backgroundData, missing_in_final)

    not_features = {"eventDate", "latitude", "longitude", "geometry", "presence", "year",
                    "id", "country", "day", "month", "scientificName", "species", "taxon", "name", "source"}
                                    
    if presence_type == "presence_only":
        features = [col for col in finalData.columns if col not in not_features]
        if not features:
            raise ValueError("Nenhuma variável ambiental foi encontrada para treinar o modelo.")

        # Presença/background: mantém 100% das ocorrências e amostra
        # background do grid ambiental na razão configurada (padrão 2:1).
        # Esses pontos de background NÃO são "ausências reais".
        presence_only_df = create_absence.build_presence_dataframe(
            backgroundData, finalData, background_ratio=background_ratio,
        )
        if "maxent" not in selected_models:
            raise ValueError("MaxEnt deve ser selecionado para dados de presença apenas.")
        results["maxent"] = maxent.run(
            presence_only_df, features, selected_metrics,
            validation_mode=validation_mode, n_folds=n_folds,
        )
        maps = create_model_maps.generate_model_maps(
            results, backgroundData, presence_only_df, country,
            species_name=selected_species_names[0] if selected_species_names else None,
        )
        return maps
        
    if len(selected_species_names) <= 1:
        print("83")
        data_with_absences = create_absence.build_presence_dataframe(
            backgroundData, finalData, background_ratio=background_ratio,
        )
        features = [col for col in data_with_absences.columns if col not in not_features]
        if not features:
            raise ValueError("Nenhuma variável ambiental foi encontrada para treinar o modelo.")
        model_errors = []
        for model in selected_models:
            print("90")
            try:
                if model == "gam":
                    results["gam"] = gam.run(
                        data_with_absences, features, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "maxent":
                    results["maxent"] = maxent.run(
                        data_with_absences, features, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "random_forest":
                    results["random_forest"] = random_forest.run(
                        data_with_absences, features, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "svm":
                    results["svm"] = svm.run(
                        data_with_absences, features, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "brt":
                    results["brt"] = brt.run(
                        data_with_absences, features, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
            except Exception as e:
                print(f"  Erro ao rodar {model}: {e}")
                model_errors.append(f"{model}: {e}")

        if not results:
            raise ValueError("Nenhum modelo pôde ser executado. " + " | ".join(model_errors))

        maps = create_model_maps.generate_model_maps(
            results,
            backgroundData,
            data_with_absences,
            country,
            species_name=selected_species_names[0] if selected_species_names else None,
        )
        return {"maps": maps, "warnings": model_errors}

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
    all_warnings = []

    for species_name in selected_species_names:
        print(f"\n{'='*60}\nModelando espécie: {species_name}\n{'='*60}")

        if species_name and species_col and species_col in finalData.columns:
            finalData[species_col] = finalData[species_col].str.lower().str.strip()
            species_name_lower = species_name.lower().strip()
            species_mask = finalData[species_col].str.contains(species_name_lower, na=False)
            species_finalData = finalData[species_mask].copy()
        else:
            species_finalData = finalData.copy()
        print(species_finalData)
        species_interaction_cols = []
        for i in interaction_col_candidates:
            for j in interactionData:
                if j.get("source") in i and j.get("target", "").lower() == species_name.lower():
                    species_interaction_cols.append(i)
                elif j.get("target") in i and j.get("source", "").casefold() == species_name.casefold():
                    species_interaction_cols.append(i)

        features_for_species = env_only_cols + species_interaction_cols
        if not features_for_species:
            raise ValueError(f"Nenhuma variável ambiental ou de interação foi encontrada para {species_name}.")

        bg_for_species = backgroundData.copy()
        data_with_absences = create_absence.build_presence_dataframe(
            grid_df=bg_for_species, occurrences=species_finalData,
            background_ratio=background_ratio,
        )

        for col in species_interaction_cols:
            if col in data_with_absences.columns:
                data_with_absences[col] = data_with_absences[col].fillna(0)
            # O grid de predição também precisa dessas colunas de interação
            # (0 = sem interação registrada nessa célula), já que ele é
            # usado diretamente para prever em cada célula do grid.
            if col not in bg_for_species.columns:
                bg_for_species[col] = 0
            else:
                bg_for_species[col] = bg_for_species[col].fillna(0)
        if "species" not in data_with_absences.columns:
            data_with_absences["species"] = species_name
        species_results = {}
        model_errors = []
        for model in selected_models:
            try:
                if model == "gam":
                    species_results["gam"] = gam.run(
                        data_with_absences, features_for_species, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "maxent":
                    species_results["maxent"] = maxent.run(
                        data_with_absences, features_for_species, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "random_forest":
                    species_results["random_forest"] = random_forest.run(
                        data_with_absences, features_for_species, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "svm":
                    species_results["svm"] = svm.run(
                        data_with_absences, features_for_species, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
                elif model == "brt":
                    species_results["brt"] = brt.run(
                        data_with_absences, features_for_species, selected_metrics,
                        validation_mode=validation_mode, n_folds=n_folds,
                    )
            except Exception as e:
                print(f"  Erro ao rodar {model} para {species_name}: {e}")
                model_errors.append(f"{model}: {e}")

        if not species_results:
            raise ValueError(
                f"Nenhum modelo pôde ser executado para {species_name}. " + " | ".join(model_errors)
            )
        all_warnings.extend(f"{species_name}: {error}" for error in model_errors)

        species_maps = create_model_maps.generate_model_maps(
            species_results, bg_for_species, data_with_absences, country,
            species_name=species_name,
        )

        for model_key, map_data in species_maps.items():
            all_maps[f"{model_key}::{species_name}"] = map_data

    return {"maps": all_maps, "warnings": all_warnings}
