const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const interactionApi = {
    searchInteractions: (interactions) => 
        fetch(`${API_BASE}/interactions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(interactions),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),


    searchInteractionOccurrence: (interactions) => 
        fetch(`${API_BASE}/interactions/occurrence`, {
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
