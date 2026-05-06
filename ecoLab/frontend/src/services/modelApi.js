const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const modelApi = {
    runModels: (models) => 
        fetch(`${API_BASE}/models`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(models),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),


    runMetrics: (metrics) => 
        fetch(`${API_BASE}/models/metrics`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(metrics),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),
};
export default modelApi;
