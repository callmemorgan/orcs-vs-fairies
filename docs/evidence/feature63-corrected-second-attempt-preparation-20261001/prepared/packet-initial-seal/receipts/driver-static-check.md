The r2 candidate passes static syntax and preservation checks. It has not been imported or executed. The only writes from this writer are inside /tmp/ovf-feature63-corrective-r2-driver-vmhywo95.

The five-key process descriptor stays compatible with the public producer and collector. Ownership uses a separate immutable PID/startTicks/session/executable/cwd tuple with a bound PIDFD. Raw `/proc/<pid>/cmdline` bytes are stored as hex alongside the NUL-separated list. A joined Chrome title remains one item.

The initial submitted Popen argv and strict initial launch validation remain. Protected PID 1063 keeps its complete five-key identity equality, including argv, and the startTicks 874, cwd, network namespace, 4173 socket-holder checks. Signals use only individual PIDFD calls after immutable and protected socket checks.

The only native launch additions are `--no-sandbox` and `--enable-unsafe-swiftshader`, as root selected through the parent. They align the known passing main15 launch. The FD crash cause remains unproved.

Original source/build/feature/output guards, the capture final block, 16 MiB lifecycle cap, 64 MiB public audit-input cap, and 2 MiB native audit cap remain unchanged. Original-session admission, direct unreaped session reservations, per-family cleanup, and two final observed-session scans remain. No cgroup gate or unobserved descendant absence claim was added.

Process authentication callsites are listed below for review. Line numbers refer to the pinned base and this candidate.

| Base | Candidate | Callsite | Change |
| --- | --- | --- | --- |
| 100 | 101 | identity snapshot | Adds stable PID/start/session/executable/cwd snapshot plus raw NUL cmdline bytes/list. identity() still returns the original five public keys. |
| 154 | 195 | protected root equality | Retained full strict five-key comparison, including argv. No owned-process exception applies to protected PID 1063. |
| 160 | 201 | protected candidate equality | Replaces mutable current-argv equality with bound immutable tuple/PIDFD liveness before and after protected socket disjointness. |
| 259 | 327 | repeat registration equality | Compares complete immutable tuple plus family; cmdline changes only produce separate events. |
| 263 | 336 | PIDFD opening revalidation | Revalidates immutable tuple and PIDFD liveness after opening the kernel descriptor. A later process title cannot invalidate ownership. |
| 274 | 353 | direct root exit identity | Adds immutable original session equality to reserved startTicks. Bound live roots additionally authenticate through observe/PIDFD without reaping. |
| 289 | 353 | direct PID/session reservation | Retains unreaped PID/startTicks reservation and pins the stored original session ID to the direct PID. |
| 304 | 387 | descendant session admission | Uses one stable snapshot session; registration also requires original root session and immutable/PIDFD binding. |
| 314 | 396 | refresh ownership equality | observe validates immutable tuple/PIDFD; this check retains original-family session membership. Raw cmdline changes are audit events only. |
| 341 | 423 | initial launch argv equality | Retained strict captured-initial argv comparison with submitted Popen command; initial descriptor remains immutable as stored data. |
| 342 | 424 | initial launch session equality | Retained direct session ownership check; registration separately binds this session into immutableIdentity. |
| 347 | 429 | signal target liveness | Uses bound PIDFD liveness and immutable tuple; mutable argv never determines a live signal target. |
| 349 | 431 | signal equality before sockets | The preceding observe authenticates immutable ownership. Protected candidate receives the bound resource and rechecks it around socket disjointness. |
| 351 | 432 | signal equality after sockets | Repeats immutable/PIDFD authentication immediately before the only individual signal primitive. |
| 362 | 444 | cleanup direct root observation | Obtains immutable/session/raw cmdline snapshot; registration uses immutable tuple rather than full current argv. |
| 364 | 447 | cleanup direct root reservation equality | Adds stored original session to reserved startTicks equality before any direct-root registration or cleanup. |
| 384 | 468 | parent grace survival equality | Replaces full current identity equality with immutable/PIDFD-authenticated liveness for this family. |
| 390 | 474 | family SIGTERM selection equality | Keeps family filter and selects only immutable/PIDFD-authenticated live records; send repeats protected checks. |
| 396 | 480 | descendant grace survival equality | Uses the same immutable/PIDFD liveness helper; no argv-based false absence. |
| 403 | 487 | first final-scan survival equality | Uses immutable/PIDFD liveness, retaining the original-session scan and family filter. |
| 408 | 492 | second final-scan survival equality | Same helper in the repeated observed-session scan before first reap; no global absence claim. |
| 447 | 532 | listener ownership and timeout protection | Converts five-key descriptor to its bound internal resource; protected root/4173/socket disjointness remains adjacent to startup and timeout checks. |
| 454 | 539 | listener timeout candidate protection | Same bound-resource candidate check immediately before startup timeout failure. |
| 535 | 621 | capture owner liveness equality | Both owned server/browser use the immutable/PIDFD helper instead of full current argv; strict protected root and attempt timeout checks remain. |

Static checks

| Check | Result |
| --- | --- |
| static syntax | PASS |
| semantic and audit guards unchanged | PASS |
| manager output and release unchanged | PASS |
| capture final byte caps and result guards unchanged | PASS |
| constant CHECKOUT | PASS |
| constant PROTECTED_ROOT | PASS |
| constant PORTS | PASS |
| constant REQUIRED_SOURCE | PASS |
| constant MAX_ATTEMPT | PASS |
| constant MAX_CLEANUP | PASS |
| constant MAX_RAW_BYTES | PASS |
| constant MAX_PUBLIC_BYTES | PASS |
| constant MAX_COLLECTOR_BYTES | PASS |
| constant AUDIT_INPUTS | PASS |
| fresh r2 prefix only | PASS |
| five-key public descriptor | PASS |
| cmdline NUL parsing only | PASS |
| protected full identity equality retained | PASS |
| protected root guards retained | PASS |
| no owned current-argv equality remains | PASS |
| initial Popen argv unchanged | PASS |
| initial launch argv validation retained | PASS |
| only root-selected Chrome additions | PASS |
| PIDFD-only individual signaling | PASS |
| unreaped root reservation retained | PASS |
| original-session-only admission retained | PASS |
| no cgroup or unobserved-descendant claim | PASS |

Base SHA256: `e333b6386e4a48ac4194ef760a6ee605bc567252b8fdae832f0d65a630e687be`.

Candidate SHA256: `f1aeeca031e80029f49d3dd4327ccda6caf02848f427bc8a21df72b87ff9618d`.

This receipt provides static review evidence only. It does not authorize another runtime attempt. The failed r1 prefix remains in place.
