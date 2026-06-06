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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const interactionApi = {
    searchInteractions: (interactions) => 
        fetch(`${getBaseURL()}/interactions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(interactions),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),


    searchInteractionOccurrence: (interactions) => 
        fetch(`${getBaseURL()}/interactions/occurrence`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(interactions),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),
};
export default interactionApi;
