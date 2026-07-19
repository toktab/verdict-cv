# VERDICT Four-State Analysis

## What you need to provide

Only `Person_AI State` and `WAR_AI State` need an AI provider. Provide one
OpenAI-compatible chat-completions API key. Do not commit the real key.

Set these values in the root `.env` file:

```properties
VERDICT_LLM_API_KEY=your-secret-key
VERDICT_LLM_MODEL=your-provider-model-id
VERDICT_LLM_URL=https://your-provider.example/v1/chat/completions
```

For OpenAI's compatible endpoint, the default URL already points to
`https://api.openai.com/v1/chat/completions`. The model ID must be a model
available to the account that owns the key.

Also set the current provider pricing so persisted cost estimates are honest:

```properties
VERDICT_LLM_INPUT_COST_PER_MILLION=0.00
VERDICT_LLM_OUTPUT_COST_PER_MILLION=0.00
```

The following values are optional and already have production-minded defaults:

```properties
VERDICT_LLM_TIMEOUT_SECONDS=20
VERDICT_LLM_MAX_ATTEMPTS=3
VERDICT_LLM_BACKOFF_MILLIS=500
VERDICT_LLM_TEMPERATURE=0.2
```

Restart the backend after changing `.env`.

## State behavior

| State | Engine | AI required | Proof posture |
| --- | --- | --- | --- |
| Light | `LOCAL_LIGHT_V2` | No | Lenient, fast screening; obvious gaps only |
| WAR | `LOCAL_WAR_V2` | No | Deterministic evidence pressure and risky-word checks |
| Person_AI | configured LLM or `LOCAL_PERSON_FALLBACK_V2` | Recommended | Contextual review, paraphrases, transferable evidence |
| WAR_AI | `LOCAL_STRICT_V2` plus configured LLM | Recommended | Both engines run; the stricter verdict wins |

The API returns `requiresLlm`, `aiConfigured`, and `availabilityMessage` for
every state. Missing AI configuration does not crash an audit. It produces a
clearly named local fallback and writes an observability event.

## Architecture

`StateAnalysisOrchestrator` is the only routing authority. Standalone audits
and candidate scoring both call it.

Candidate matching audits project requirements as claims and the candidate CV
as evidence. The persisted candidate record includes:

- selected state and actual engine
- prompt/policy version and completion time
- prompt, completion, and total token counts
- estimated provider cost
- state-specific claim verdicts, score, match, and risk

Audit prompts are versioned files:

- `back/src/main/resources/prompts/audit/base-system-v2.txt`
- `back/src/main/resources/prompts/audit/person-v2.txt`
- `back/src/main/resources/prompts/audit/strict-war-ai-v2.txt`
- `back/src/main/resources/prompts/audit/output-contract-v2.txt`

The base prompt treats CV, claim, and evidence text as untrusted data, rejects
prompt injection, prohibits outside knowledge, and requires exact evidence
excerpts. The output parser validates the JSON envelope and fills missing rows
with conservative unsupported verdicts.

## Verification after adding a key

1. Open the audit workspace and confirm Person_AI and WAR_AI say
   `AI provider connected`.
2. Run the same claim/evidence pair in all four states.
3. Confirm Light and WAR engines are local.
4. Confirm Person_AI's engine starts with `LLM_`.
5. Confirm WAR_AI shows `LOCAL_STRICT_V2+LLM_...`.
6. Open the audit detail and verify token counts and estimated cost are nonzero.
7. Initialize each state on a project candidate and verify the candidate's
   engine, prompt version, tokens, cost, claim counts, and score change.
8. Temporarily remove the key and confirm Person_AI and WAR_AI show a local
   fallback instead of failing the request.

Run the automated coverage with:

```powershell
.\mvnw.cmd "-Dtest=LlmAuditAnalyzerSchemaTest,LocalAuditStatePolicyTest,CheckStateAnalyzerRoutingTest" test
cd front
npm run build
```
