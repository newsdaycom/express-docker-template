# Multi-architecture image builds

Default `build-image` output is one registry index containing Linux AMD64 and ARM64. Docker Buildx, Node.js, Git and Bash are required; provide a builder with both native targets or explicitly identified emulation. Both architectures must finish successfully. Emulated startup is not native performance qualification. No production pipeline/cluster change is implied by this template.

## Stage promotion and immutable identity

Keep the application feature based on its approved main/master/release, open its early canonical-base PR, then integrate the reviewed feature into origin/stage. Resolve conflicts on a separate stage-based integration branch; never merge stage back into the feature. Fetch and check out the exact stage integration SHA in a clean worktree. The script checks HEAD equals origin/stage and an optional explicit BUILD_SOURCE_SHA; it does not fetch or mutate branches. Build-version and OCI revision labels identify the source. Record feature SHA, stage SHA, index and both child digests in the qualification ledger. A moving branch name is not sufficient provenance.

```bash
git fetch origin stage
# Check out the reviewed integration revision in an isolated clean worktree.
ENV=stage REPO_NAME=newsday/example-service BUILD_SOURCE_SHA=<stage-sha> ./build-image
```

The default tag includes environment, source SHA and UTC timestamp. Optional BUILD_TAG must be unique; latest/stage/production aliases are rejected. After publication the script verifies both platform entries and prints BUILD DIGEST with the immutable index reference. Registry credentials are supplied by the builder, never arguments/source. Deployments must use the recorded digest through Kubernetes IaC and stage acceptance gates. A build failure or missing platform is not an ARM incompatibility verdict: preserve prior images and diagnose/record the failure. No Kubernetes apply occurs in this script.

## Local qualification without publication

Use an absolute output outside the repository, with enough disk space. OCI export does not claim a registry publication and still enforces stage source provenance. Metadata is written next to the archive; verify its platforms and digests before use. Artifact paths must not already exist.

```bash
ENV=stage REPO_NAME=localhost/qualification/example-service BUILD_OUTPUT=oci   BUILD_OUTPUT_PATH=/absolute/artifacts/example-service.tar ./build-image
```

BUILD_PLATFORMS defaults to linux/amd64,linux/arm64. A single explicit architecture is supported for publication and local checks. BUILD_OUTPUT=load requires one platform; push verifies exactly the requested platforms. Existing single-architecture rollback images remain available until functional/native qualification and deployment acceptance. OCI output can be imported into an OCI-capable local image store for isolated runtime tests; it is not automatically suitable for remote deployment.

## Regression checks

`python3 -m unittest discover -s tests/build_contract -v` runs isolated Git repositories and a fake Docker executable: stage revision/dirty-source guards, dual-platform publication, failed build propagation, missing index platform, OCI output selection and single-platform local load behavior. It makes no registry or cluster calls. Python 3 is needed only for this contract test; the build script itself uses Bash/Git/Docker.

Actual builds and runtime observations are recorded separately after source integration. Existing application tests/lint still apply. Template startup smoke checks do not certify an application's external dependencies, persistent state or ARM performance.


Set `BUILDX_BUILDER` to the IaC-managed named builder. On the shared ARM64 host,
ARM64 runs natively and AMD64 runs under pinned emulation; both targets use the
same `docker-container` builder. The default remains both platforms. Explicit
`BUILD_PLATFORMS=linux/amd64` or `linux/arm64` publishes a supported single target.
Build failures never silently remove an architecture. Dockerfile stage platform
constraints remain effective.

Dobby supplies `DEPLOY_SOURCE_SHA` and `DEPLOY_RESULT_FILE`. The producer verifies
the SHA, inspects the published platform image configs, and atomically writes the
verified digest-pinned JSON result. Failed publication writes no success result.
Source and target remain independent.
