const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const environmentApi = {
    getEnvVariables: (environmentalVariables) => 
        fetch(`${API_BASE}/environment/variables`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(environmentalVariables),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),

    checkEEKey: () => 
        fetch(`${API_BASE}/environment/check-ee-keys`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })
          .then(handleResponse)
          .then((data) => data.msg ?? data.results ?? data),

    authenticateEE: (project) =>
    fetch(`${API_BASE}/environment/authenticate/${encodeURIComponent(project)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),
};
export default environmentApi;
