# Multi-architecture build qualification

ENV-13 under infrastructure epic ENV-1. Candidate work: default linux/amd64 and linux/arm64 Buildx output, stage revision guard, propagated failures and immutable index identity. No build result or published image is claimed by this initial planning commit. Feature begins at origin/main. Integrate the reviewed feature into origin/stage before the deployable build; stage must never merge back into this feature. Production automation is outside this change.
