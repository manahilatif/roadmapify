# `/generate-roadmap` E2E sample (local)

Use this for Postman or to compare with your notebook. **Take a screenshot** of the response body for whoever owns the notebook.

## Run the API

From the **repo root** (`roadmapify/`):

```bash
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## curl (Git Bash or cmd)

```bash
curl -X POST http://127.0.0.1:8000/generate-roadmap ^
  -H "Content-Type: application/json" ^
  -d "{\"goal\": \"Learn data science from scratch\"}"
```

## PowerShell (`Invoke-RestMethod`)

```powershell
$body = '{"goal": "Learn data science from scratch"}'
Invoke-RestMethod -Uri "http://127.0.0.1:8000/generate-roadmap" `
  -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10
```

## Postman

- **Method:** POST  
- **URL:** `http://127.0.0.1:8000/generate-roadmap`  
- **Headers:** `Content-Type: application/json`  
- **Body:** raw JSON: `{"goal": "Learn data science from scratch"}`  

## Sample response (no `GEMINI_API_KEY`)

Without `backend/.env` or with an empty `GEMINI_API_KEY`, the API returns a **sample** roadmap JSON (status `sample`). With a valid key and populated ChromaDB, expect `status: "generated"` and the structured roadmap from `roadmap_chain`.

See also: `sample_generate_roadmap_response.json` in this folder for a saved example.
