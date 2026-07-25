let BASE_URL = "http://localhost:8000"; // fallback dev

export async function initConfig() {
    try {
        const res = await fetch("/api/config");
        const data = await res.json();
        BASE_URL = `http://localhost:${data.port}`;
    } catch (e) {
        console.warn("Usando porta padrão 8000");
    }
}

export function getBaseURL() {
    return BASE_URL + "/api";
}

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const modelApi = {
    runModels: (models) => 
        fetch(`${getBaseURL()}/models`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(models),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),


    runMetrics: (metrics) => 
        fetch(`${getBaseURL()}/models/metrics`, {
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
