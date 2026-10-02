# Feature63 consumed r2 capture closure review

Status: `PASS_READONLY_CAPTURE_FAILURE_AND_BOUNDED_OPERATIONAL_CLOSURE`.

The single authorized r2 invocation was consumed and failed during startup. The exact assignment SHA256 was `8f0e36dde392d934a3a684b1e3da7fa4a486500aad79c50e196bf128199bd6e1`, the source pin was `1257b24db0121a72a12a6de10592397dc4996038`, and the wrapper SHA256 was `f1aeeca031e80029f49d3dd4327ccda6caf02848f427bc8a21df72b87ff9618d`. The result is `FAIL_FIRST_FAILURE_NO_RETRY` with one invocation, zero retries, wrapper exit code 1, and the error “Managed PID/start/session/executable/cwd changed; no signal is permitted.” Browser stderr contains repeated FD ownership violation crashes. The producer started, the collector did not, no public output directory exists, and `feature63Qualified` is false.

Operational closure is a separate bounded result. The launcher remembered 14 registered resources: one server, twelve browser processes, and one public producer. It opened nine PIDFDs while those identities were alive. The retained closure records every remembered identity absent, ports 5373 and 5374 clear, and protected PID 1063/start 874/session 1063/executable/cwd/argv/fd22/socket3783 unchanged. A fresh read-only check found all 14 remembered PIDs plus the launcher and wrapper absent, no members in their remembered sessions, both private ports clear, and the protected root unchanged.

That evidence supports slot release for the retained identities, original sessions, and private ports. It does not prove global descendant absence. Both the wrapper result and launcher closure retain `unobservedDescendantsExcluded=false` and `rootNativeLifetimeDispositionRequired=true`. Root owns the final native-lifetime decision before extraction, audit, or qualification.

The two-row trail states the outcome honestly: one exact invocation failed, and closure is reported separately from feature proof. The active transcript directory was unavailable, so authorization rests on the bound artifacts and supplied in-session messages rather than a complete independently authenticated transcript. The one runtime authorization is consumed; no retry authority remains.

I read database metadata only. The file was device 52, inode 42331276, 184320 bytes, mode 0644; its contents were not read, hashed, copied, sealed, queried, extracted, or audited. I did not launch a browser or runtime, import candidates, call generator or candidate functions, send signals, package or clean up files, perform extraction or audit, or write the control directory, r2 prefix, source root, Git state, or ledger.

The JSON review records every reviewed path with byte count, SHA256, numeric mode, and observed modification time. Later parent artifacts are outside this review unless listed there. The requested model was `gpt-5.6-sol`; the actual provider family is unverified.

