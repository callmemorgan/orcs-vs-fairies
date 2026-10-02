# Model attribution addendum

This note corrects the distinction between the requested model override and the model that ran the review. It does not change the review or machine audit.

The parent requested `gpt-5.6-sol` when spawning this task. The active model was OpenAI GPT-6.1 Sol. The actual identity controls attribution, so the review remains attributed to OpenAI GPT-6.1 Sol in Codex and must not be described as a GPT-5.6 Sol review.

`modelIdentitySource` is the trusted active orchestration message from the parent/root host after completion. It explicitly reported both facts: the spawn requested `gpt-5.6-sol`, while the model that ran was GPT-6.1 Sol. This is host context for the active task, not a model guess or a value read from repository files.

Because the requested override did not become active, this review does not provide a GPT-5.6-family opinion and cannot count as a different-family review merely because the spawn request named that model. Any different-family requirement must use the family that ran.

The two original artifacts remain unchanged:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `original-combat-admission-review.md` | 10,893 | `34388e2009c35779b34fa6143db7107ec71a8759dceb04361e71ef382a113537` |
| `original-combat-admission-audit.json` | 10,179 | `8fbfb9e4df66e234516372cecaa247e91a76dac5839d91f160de7fd4519ea947` |
