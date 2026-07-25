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

const environmentApi = {
    getEnvVariables: (environmentalVariables) => 
        fetch(`${getBaseURL()}/environment/variables`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(environmentalVariables),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),

    checkEEKey: () => 
        fetch(`${getBaseURL()}/environment/check-ee-keys`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })
          .then(handleResponse)
          .then((data) => data.msg ?? data.results ?? data),

    authenticateEE: (project) =>
    fetch(`${getBaseURL()}/environment/authenticate/${encodeURIComponent(project)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),

    uploadEnvironment: (file, mapping, variables) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mapping", JSON.stringify(mapping));
        formData.append("variables", JSON.stringify(variables));
        return fetch(`${getBaseURL()}/environment/upload`, {
            method: "POST",
            body: formData,
        })
            .then(handleResponse)
            .then((data) => data.msg ?? data.results ?? data);
    },

    attachGrid: (occurrences, grid) =>
        fetch(`${getBaseURL()}/environment/attach-grid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ occurrences, grid }),
        })
            .then(handleResponse)
            .then((data) => data.msg ?? data.results ?? data),
};
export default environmentApi;
