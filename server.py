import os
import pickle
import numpy as np
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from typing import List, Optional

app = FastAPI(title="Tennessee Eastman Process (TEP) Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 34 Variables metadata in Tennessee Eastman Process
VARIABLES_METADATA = [
    # 22 Process Measurements (XMEAS 1 to 22)
    {"id": 0, "tag": "XMEAS(1)", "name": "Vazão de Alimentação A", "unit": "kscmh", "type": "Medição", "desc": "Vazão de A na corrente 1"},
    {"id": 1, "tag": "XMEAS(2)", "name": "Vazão de Alimentação D", "unit": "kg/h", "type": "Medição", "desc": "Vazão de D na corrente 2"},
    {"id": 2, "tag": "XMEAS(3)", "name": "Vazão de Alimentação E", "unit": "kg/h", "type": "Medição", "desc": "Vazão de E na corrente 3"},
    {"id": 3, "tag": "XMEAS(4)", "name": "Vazão Total A + C", "unit": "kscmh", "type": "Medição", "desc": "Vazão total de A e C na corrente 4"},
    {"id": 4, "tag": "XMEAS(5)", "name": "Vazão de Reciclo", "unit": "kscmh", "type": "Medição", "desc": "Vazão de reciclo na corrente 8"},
    {"id": 5, "tag": "XMEAS(6)", "name": "Vazão de Alimentação do Reator", "unit": "kscmh", "type": "Medição", "desc": "Vazão na corrente 6 (entrada reator)"},
    {"id": 6, "tag": "XMEAS(7)", "name": "Pressão do Reator", "unit": "kPa man", "type": "Medição", "desc": "Pressão interna no reator"},
    {"id": 7, "tag": "XMEAS(8)", "name": "Nível do Reator", "unit": "%", "type": "Medição", "desc": "Nível de líquido no reator"},
    {"id": 8, "tag": "XMEAS(9)", "name": "Temperatura do Reator", "unit": "°C", "type": "Medição", "desc": "Temperatura interna da reação"},
    {"id": 9, "tag": "XMEAS(10)", "name": "Vazão de Purga", "unit": "kscmh", "type": "Medição", "desc": "Vazão na corrente de purga 9"},
    {"id": 10, "tag": "XMEAS(11)", "name": "Temp. Separador do Produto", "unit": "°C", "type": "Medição", "desc": "Temperatura no separador"},
    {"id": 11, "tag": "XMEAS(12)", "name": "Nível do Separador", "unit": "%", "type": "Medição", "desc": "Nível de líquido no vaso separador"},
    {"id": 12, "tag": "XMEAS(13)", "name": "Pressão do Separador", "unit": "kPa man", "type": "Medição", "desc": "Pressão interna no separador"},
    {"id": 13, "tag": "XMEAS(14)", "name": "Vazão Subproduto Separador", "unit": "m³/h", "type": "Medição", "desc": "Vazão de líquido corrente 10"},
    {"id": 14, "tag": "XMEAS(15)", "name": "Nível da Stripper", "unit": "%", "type": "Medição", "desc": "Nível de fundo da torre stripper"},
    {"id": 15, "tag": "XMEAS(16)", "name": "Pressão da Stripper", "unit": "kPa man", "type": "Medição", "desc": "Pressão no topo da stripper"},
    {"id": 16, "tag": "XMEAS(17)", "name": "Vazão de Produto da Stripper", "unit": "m³/h", "type": "Medição", "desc": "Vazão de saída de produto na corrente 11"},
    {"id": 17, "tag": "XMEAS(18)", "name": "Temp. Fundo da Stripper", "unit": "°C", "type": "Medição", "desc": "Temperatura de fundo da stripper"},
    {"id": 18, "tag": "XMEAS(19)", "name": "Vazão de Vapor da Stripper", "unit": "kg/h", "type": "Medição", "desc": "Vazão de vapor fornecido à stripper"},
    {"id": 19, "tag": "XMEAS(20)", "name": "Potência do Compressor", "unit": "kW", "type": "Medição", "desc": "Potência elétrica consumida pelo compressor"},
    {"id": 20, "tag": "XMEAS(21)", "name": "Temp. Saída Água Refrig. Reator", "unit": "°C", "type": "Medição", "desc": "Temperatura de saída da camisa de resfriamento"},
    {"id": 21, "tag": "XMEAS(22)", "name": "Temp. Saída Água Condensador", "unit": "°C", "type": "Medição", "desc": "Temperatura de saída da água no condensador"},
    # 12 Manipulated Variables (XMV 1 to 12)
    {"id": 22, "tag": "XMV(1)", "name": "Válvula Alimentação D", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de controle corrente 2"},
    {"id": 23, "tag": "XMV(2)", "name": "Válvula Alimentação E", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de controle corrente 3"},
    {"id": 24, "tag": "XMV(3)", "name": "Válvula Alimentação A", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de controle corrente 1"},
    {"id": 25, "tag": "XMV(4)", "name": "Válvula Alimentação A+C", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de controle corrente 4"},
    {"id": 26, "tag": "XMV(5)", "name": "Válvula de Purga do Compressor", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de purga"},
    {"id": 27, "tag": "XMV(6)", "name": "Válvula Purga do Separador", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de purga corrente 9"},
    {"id": 28, "tag": "XMV(7)", "name": "Válvula Saída Separador", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de nível corrente 10"},
    {"id": 29, "tag": "XMV(8)", "name": "Válvula Produto Stripper", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de produto corrente 11"},
    {"id": 30, "tag": "XMV(9)", "name": "Válvula Vapor Stripper", "unit": "%", "type": "Manipulada", "desc": "Abertura da válvula de vapor"},
    {"id": 31, "tag": "XMV(10)", "name": "Válvula Refrig. Reator", "unit": "%", "type": "Manipulada", "desc": "Abertura da água de resfriamento do reator"},
    {"id": 32, "tag": "XMV(11)", "name": "Válvula Refrig. Condensador", "unit": "%", "type": "Manipulada", "desc": "Abertura da água de resfriamento do condensador"},
    {"id": 33, "tag": "XMV(12)", "name": "Válvula Agitador do Reator", "unit": "rpm", "type": "Manipulada", "desc": "Velocidade/Agitação no reator"},
]

# Faults 0 to 28 metadata
FAULT_DESCRIPTIONS = {
    0: {"name": "Operação Normal", "type": "Normal", "desc": "Processo operando em estado estacionário sob controle nominal."},
    1: {"name": "Falha 1 (Degrau)", "type": "Degrau", "desc": "Razão de alimentação A/C, fração B constante (Corrente 4)"},
    2: {"name": "Falha 2 (Degrau)", "type": "Degrau", "desc": "Fração de B, razão A/C constante (Corrente 4)"},
    3: {"name": "Falha 3 (Degrau)", "type": "Degrau", "desc": "Temperatura de alimentação de D (Corrente 2)"},
    4: {"name": "Falha 4 (Degrau)", "type": "Degrau", "desc": "Temp. de entrada da água de refrigeração do reator"},
    5: {"name": "Falha 5 (Degrau)", "type": "Degrau", "desc": "Temp. de entrada da água do condensador"},
    6: {"name": "Falha 6 (Degrau)", "type": "Degrau", "desc": "Perda na alimentação de A (Corrente 1)"},
    7: {"name": "Falha 7 (Degrau)", "type": "Degrau", "desc": "Perda de pressão no cabeçote de C (Corrente 4)"},
    8: {"name": "Falha 8 (Aleatória)", "type": "Aleatória", "desc": "Variação aleatória da composição de A, B e C (Corrente 4)"},
    9: {"name": "Falha 9 (Aleatória)", "type": "Aleatória", "desc": "Variação aleatória na temperatura de D (Corrente 2)"},
    10: {"name": "Falha 10 (Aleatória)", "type": "Aleatória", "desc": "Variação aleatória na temperatura de C (Corrente 4)"},
    11: {"name": "Falha 11 (Aleatória)", "type": "Aleatória", "desc": "Variação aleatória na água de resfriamento do reator"},
    12: {"name": "Falha 12 (Aleatória)", "type": "Aleatória", "desc": "Variação aleatória na água do condensador"},
    13: {"name": "Falha 13 (Deriva)", "type": "Deriva lenta", "desc": "Deriva lenta na cinética de reação"},
    14: {"name": "Falha 14 (Atuação)", "type": "Válvula", "desc": "Travamento da válvula de refrigeração do reator"},
    15: {"name": "Falha 15 (Atuação)", "type": "Válvula", "desc": "Travamento da válvula de refrigeração do condensador"},
    16: {"name": "Falha 16 (Térmica)", "type": "Incógnita", "desc": "Incrustação / transferência de calor no trocador"},
    17: {"name": "Falha 17 (Processo)", "type": "Incógnita", "desc": "Perturbação no reciclo interno"},
    18: {"name": "Falha 18 (Processo)", "type": "Incógnita", "desc": "Perturbação na válvula de vapor da stripper"},
    19: {"name": "Falha 19 (Cinética)", "type": "Incógnita", "desc": "Flutuação na taxa de reação secundária"},
    20: {"name": "Falha 20 (Compressão)", "type": "Incógnita", "desc": "Instabilidade de pressão no compressor"},
    21: {"name": "Falha 21 (Válvula)", "type": "Válvula", "desc": "Válvula da corrente 4 fixa no estado estacionário"},
    22: {"name": "Falha 22 (Variação)", "type": "Outro", "desc": "Variação combinada de vazão de alimentação"},
    23: {"name": "Falha 23 (Variação)", "type": "Outro", "desc": "Perturbação no condensador de topo"},
    24: {"name": "Falha 24 (Variação)", "type": "Outro", "desc": "Flutuação no nível do separador de alta pressão"},
    25: {"name": "Falha 25 (Variação)", "type": "Outro", "desc": "Alteração de carga na stripper"},
    26: {"name": "Falha 26 (Variação)", "type": "Outro", "desc": "Distúrbio na temperatura de reciclo"},
    27: {"name": "Falha 27 (Variação)", "type": "Outro", "desc": "Perturbação mista em reagentes"},
    28: {"name": "Falha 28 (Variação)", "type": "Outro", "desc": "Comportamento não-linear induzido no reator"},
}

DATASET_CACHE = {}
HF_DATASET_REPO = os.environ.get("HF_DATASET_REPO", "Lvdash/tep-dataset")

def load_dataset(mode: int):
    if mode in DATASET_CACHE:
        return DATASET_CACHE[mode]
    
    file_path = os.path.join(BASE_DIR, f"TEPDataset_Mode{mode}.pickle")
    if not os.path.exists(file_path):
        try:
            from huggingface_hub import hf_hub_download
            print(f"Baixando TEPDataset_Mode{mode}.pickle do Hugging Face Dataset ({HF_DATASET_REPO})...")
            file_path = hf_hub_download(
                repo_id=HF_DATASET_REPO,
                filename=f"TEPDataset_Mode{mode}.pickle",
                repo_type="dataset",
                local_dir=BASE_DIR
            )
        except Exception as e:
            print(f"Erro ao baixar do Hugging Face: {e}")
            raise HTTPException(status_code=404, detail=f"Arquivo {file_path} não encontrado e falha no download do Hugging Face.")
    
    with open(file_path, "rb") as f:
        data = pickle.load(f)
    
    # Store in memory cache
    DATASET_CACHE[mode] = {
        "Signals": data["Signals"].astype(np.float32),
        "Labels": data["Labels"].astype(np.int32),
        "Folds": {k: v.astype(np.int32).tolist() for k, v in data["Folds"].items()}
    }
    return DATASET_CACHE[mode]

# Preload Mode 1
try:
    load_dataset(1)
except Exception as e:
    print(f"Erro ao pré-carregar Modo 1: {e}")

@app.get("/api/modes")
def get_modes():
    modes = []
    for i in range(1, 7):
        path = os.path.join(BASE_DIR, f"TEPDataset_Mode{i}.pickle")
        exists = os.path.exists(path) or bool(HF_DATASET_REPO)
        size_mb = round(os.path.getsize(path) / (1024 * 1024), 1) if os.path.exists(path) else 470.0
        modes.append({
            "mode": i,
            "name": f"Modo Operacional {i}",
            "filename": f"TEPDataset_Mode{mode_i := i}.pickle",
            "available": True,
            "sizeMB": size_mb
        })
    return modes


@app.get("/api/variables")
def get_variables():
    return VARIABLES_METADATA

@app.get("/api/fault-types")
def get_fault_types():
    return FAULT_DESCRIPTIONS

@app.get("/api/dataset-info")
def get_dataset_info(mode: int = Query(1, ge=1, le=6)):
    dataset = load_dataset(mode)
    signals = dataset["Signals"]
    labels = dataset["Labels"]
    folds = dataset["Folds"]

    unique, counts = np.unique(labels, return_counts=True)
    label_dist = {int(u): int(c) for u, c in zip(unique, counts)}

    fold_dist = {k: len(v) for k, v in folds.items()}

    return {
        "mode": mode,
        "totalSamples": int(signals.shape[0]),
        "timeSteps": int(signals.shape[1]),
        "numVariables": int(signals.shape[2]),
        "totalClasses": len(unique),
        "labelDistribution": label_dist,
        "foldDistribution": fold_dist,
    }

@app.get("/api/samples")
def get_samples(
    mode: int = Query(1, ge=1, le=6),
    label: Optional[int] = Query(None),
    fold: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=2900),
    offset: int = Query(0, ge=0)
):
    dataset = load_dataset(mode)
    labels = dataset["Labels"]
    folds = dataset["Folds"]

    indices = np.arange(len(labels))

    if fold and fold in folds:
        fold_indices = np.array(folds[fold])
        indices = np.intersect1d(indices, fold_indices)

    if label is not None:
        label_indices = np.where(labels == label)[0]
        indices = np.intersect1d(indices, label_indices)

    total_matched = len(indices)
    paged_indices = indices[offset:offset + limit]

    results = []
    for idx in paged_indices:
        results.append({
            "index": int(idx),
            "label": int(labels[idx]),
            "faultName": FAULT_DESCRIPTIONS.get(int(labels[idx]), {}).get("name", f"Falha {labels[idx]}"),
            "faultType": FAULT_DESCRIPTIONS.get(int(labels[idx]), {}).get("type", "Outro")
        })

    return {
        "total": total_matched,
        "offset": offset,
        "limit": limit,
        "samples": results
    }

@app.get("/api/signals")
def get_signals(
    mode: int = Query(1, ge=1, le=6),
    sample_idx: int = Query(0, ge=0, le=2899),
    variable_ids: Optional[str] = Query(None, description="Vírgula separada de IDs (ex: 0,1,6,8)")
):
    dataset = load_dataset(mode)
    signals = dataset["Signals"]
    labels = dataset["Labels"]

    if sample_idx >= len(signals):
        raise HTTPException(status_code=400, detail="Índice de amostra inválido")

    if variable_ids:
        try:
            var_list = [int(v.strip()) for v in variable_ids.split(",") if v.strip() != ""]
        except ValueError:
            var_list = list(range(34))
    else:
        var_list = [0, 1, 6, 8, 22, 31] # default sample vars

    # (600, 34)
    sample_matrix = signals[sample_idx]
    
    series_data = {}
    for vid in var_list:
        if 0 <= vid < 34:
            series_data[vid] = sample_matrix[:, vid].tolist()

    label = int(labels[sample_idx])
    return {
        "mode": mode,
        "sampleIndex": sample_idx,
        "label": label,
        "faultInfo": FAULT_DESCRIPTIONS.get(label, {}),
        "timeSteps": list(range(600)),
        "series": series_data
    }

@app.get("/api/compare")
def compare_signals(
    mode: int = Query(1, ge=1, le=6),
    sample_a: int = Query(0, ge=0, le=2899),
    sample_b: int = Query(100, ge=0, le=2899),
    variable_id: int = Query(6, ge=0, le=33)
):
    dataset = load_dataset(mode)
    signals = dataset["Signals"]
    labels = dataset["Labels"]

    sig_a = signals[sample_a, :, variable_id].tolist()
    sig_b = signals[sample_b, :, variable_id].tolist()

    return {
        "variable": VARIABLES_METADATA[variable_id],
        "sampleA": {
            "index": sample_a,
            "label": int(labels[sample_a]),
            "faultInfo": FAULT_DESCRIPTIONS.get(int(labels[sample_a]), {}),
            "data": sig_a
        },
        "sampleB": {
            "index": sample_b,
            "label": int(labels[sample_b]),
            "faultInfo": FAULT_DESCRIPTIONS.get(int(labels[sample_b]), {}),
            "data": sig_b
        },
        "timeSteps": list(range(600))
    }

@app.get("/api/pca")
def get_pca(
    mode: int = Query(1, ge=1, le=6),
    subsample: int = Query(600, ge=100, le=2900)
):
    dataset = load_dataset(mode)
    signals = dataset["Signals"] # (2900, 600, 34)
    labels = dataset["Labels"]

    # Flatten or mean per time step for representative feature vector:
    # Feature representation: mean and std over 600 timesteps -> 68 features per sample
    means = np.mean(signals, axis=1) # (2900, 34)
    stds = np.std(signals, axis=1)   # (2900, 34)
    features = np.hstack([means, stds]) # (2900, 68)

    # Subsample balanced across labels
    n_samples = len(labels)
    if subsample < n_samples:
        indices = np.linspace(0, n_samples - 1, subsample, dtype=int)
    else:
        indices = np.arange(n_samples)

    sub_feat = features[indices]
    sub_labels = labels[indices]

    # Standardize
    feat_norm = (sub_feat - np.mean(sub_feat, axis=0)) / (np.std(sub_feat, axis=0) + 1e-6)

    # SVD for PCA 2D
    u, s, vh = np.linalg.svd(feat_norm, full_matrices=False)
    coords_2d = feat_norm @ vh[:2].T

    explained_variance_ratio = (s[:2] ** 2) / np.sum(s ** 2)

    points = []
    for i, (x, y) in enumerate(coords_2d):
        lbl = int(sub_labels[i])
        points.append({
            "x": float(np.round(x, 3)),
            "y": float(np.round(y, 3)),
            "sampleIndex": int(indices[i]),
            "label": lbl,
            "faultName": FAULT_DESCRIPTIONS.get(lbl, {}).get("name", f"Falha {lbl}"),
            "type": FAULT_DESCRIPTIONS.get(lbl, {}).get("type", "Outro")
        })

    return {
        "mode": mode,
        "explainedVariance": [float(np.round(explained_variance_ratio[0] * 100, 2)), float(np.round(explained_variance_ratio[1] * 100, 2))],
        "points": points
    }

@app.get("/api/correlation")
def get_correlation(
    mode: int = Query(1, ge=1, le=6),
    label: Optional[int] = Query(0, description="0 for normal, or fault class 1-28")
):
    dataset = load_dataset(mode)
    signals = dataset["Signals"]
    labels = dataset["Labels"]

    if label is not None:
        indices = np.where(labels == label)[0]
        if len(indices) == 0:
            indices = np.arange(min(100, len(labels)))
    else:
        indices = np.arange(len(labels))

    # Average signal matrix over the samples: (N, 600, 34) -> reshape to (N*600, 34)
    # Take slice to keep fast computation
    sub_sig = signals[indices[:50]].reshape(-1, 34)
    
    # Compute correlation matrix 34x34
    corr_matrix = np.corrcoef(sub_sig, rowvar=False)
    corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

    # Format for heatmap: [[i, j, value], ...]
    heatmap_data = []
    for i in range(34):
        for j in range(34):
            heatmap_data.append([i, j, float(np.round(corr_matrix[i, j], 3))])

    return {
        "mode": mode,
        "label": label,
        "labelName": FAULT_DESCRIPTIONS.get(label, {}).get("name", f"Falha {label}"),
        "variables": [v["tag"] for v in VARIABLES_METADATA],
        "heatmapData": heatmap_data
    }

# Serve frontend
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("server:app", host=host, port=port, reload=False)

