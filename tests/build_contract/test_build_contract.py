"""Exercise build provenance and failure gates in disposable repositories.

The fake Docker command records arguments and registry results without external
calls. Real dual-platform builds and startup remain separate acceptance checks.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class BuildContract(unittest.TestCase):
    """Validate public build-script behavior without a daemon or registry."""

    def setUp(self):
        """Create a clean repository with an origin/stage tracking reference."""
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        source = Path(__file__).resolve().parents[2] / 'build-image'
        shutil.copyfile(source, self.repo / 'build-image')
        self.git('init', '-q')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'user.name', 'Build contract fixture')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.sha = self.git('rev-parse', 'HEAD').strip()
        self.git('update-ref', 'refs/remotes/origin/stage', self.sha)
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        fake = bin_dir / 'docker'
        fake.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with open(os.environ['DOCKER_CALLS'], 'a') as out:
    out.write(json.dumps(args) + '\\n')
if args[:2] == ['buildx', 'build']:
    sys.exit(int(os.getenv('DOCKER_BUILD_EXIT', '0')))
if args[:3] == ['buildx', 'imagetools', 'inspect']:
    if 'Manifest.Digest' in args[args.index('--format') + 1]:
        print(os.getenv('REGISTRY_DIGEST', 'sha256:' + 'a' * 64))
    else:
        platforms = os.getenv('REGISTRY_PLATFORMS', 'linux/amd64\\nlinux/arm64').splitlines()
        print(json.dumps({p: {'os': p.split('/')[0], 'architecture': p.split('/')[1]} for p in platforms}))
''')
        fake.chmod(0o755)
        self.calls = self.root / 'calls.jsonl'
        self.env = {**os.environ, 'PATH': str(bin_dir) + ':' + os.environ['PATH'],
                    'DOCKER_CALLS': str(self.calls), 'ENV': 'stage',
                    'REPO_NAME': 'example.invalid/service'}
        for key in ['BUILD_SOURCE_SHA', 'BUILD_OUTPUT', 'BUILD_OUTPUT_PATH',
                    'BUILD_PLATFORMS', 'BUILD_TAG', 'DOCKER_BUILD_EXIT',
                    'REGISTRY_DIGEST', 'REGISTRY_PLATFORMS', 'DEPLOY_SOURCE_SHA', 'DEPLOY_RESULT_FILE', 'BUILDX_BUILDER']:
            self.env.pop(key, None)

    def tearDown(self):
        """Delete only this test's repository and command recorder."""
        self.temp.cleanup()

    def git(self, *args):
        """Run Git only in the isolated fixture repository."""
        return subprocess.check_output(['git', *args], cwd=self.repo, text=True)

    def invoke(self, **changes):
        """Run the script with explicit per-test environment overrides."""
        return subprocess.run(['bash', './build-image'], cwd=self.repo,
                              env={**self.env, **changes}, text=True,
                              capture_output=True)

    def arguments(self):
        """Return recorded Docker calls, or none for an early rejection."""
        if not self.calls.exists():
            return []
        return [json.loads(line) for line in self.calls.read_text().splitlines()]

    def test_dual_index_success_reports_digest_and_revision(self):
        """Publish both targets with source labels and verified digest output."""
        result = self.invoke(BUILD_SOURCE_SHA=self.sha)
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(x for x in self.arguments() if x[:2] == ['buildx', 'build'])
        self.assertEqual(call[call.index('--platform') + 1], 'linux/amd64,linux/arm64')
        self.assertIn('--push', call)
        self.assertIn('org.opencontainers.image.revision=' + self.sha, call)
        self.assertIn('BUILD DIGEST: example.invalid/service@sha256:', result.stdout)

    def test_dirty_source_is_rejected_before_docker(self):
        """Never build uncommitted stage content under a committed SHA."""
        (self.repo / 'uncommitted.txt').write_text('change')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertEqual(self.arguments(), [])

    def test_wrong_stage_revision_is_rejected(self):
        """A feature revision cannot masquerade as the stage integration."""
        self.git('commit', '--allow-empty', '-qm', 'new feature')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertEqual(self.arguments(), [])

    def test_queued_sha_survives_branch_advancement(self):
        """Dobby's verified queued SHA stays authoritative after origin/stage moves."""
        self.git('commit', '--allow-empty', '-qm', 'new stage')
        newer = self.git('rev-parse', 'HEAD').strip()
        self.git('update-ref', 'refs/remotes/origin/stage', newer)
        self.git('checkout', '--detach', self.sha)
        result = self.invoke(DEPLOY_SOURCE_SHA=self.sha)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('org.opencontainers.image.revision=' + self.sha,
                      next(x for x in self.arguments() if x[:2] == ['buildx', 'build']))

    def test_missing_stage_reference_is_rejected(self):
        """Require a fetched stage identity rather than guessing the branch."""
        self.git('update-ref', '-d', 'refs/remotes/origin/stage')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertEqual(self.arguments(), [])

    def test_source_pin_mismatch_is_rejected(self):
        """Respect the explicitly selected immutable source revision."""
        self.assertNotEqual(self.invoke(BUILD_SOURCE_SHA='0' * 40).returncode, 0)
        self.assertEqual(self.arguments(), [])

    def test_failed_architecture_build_does_not_report_completion(self):
        """Propagate Buildx failure and do not inspect or advertise an index."""
        result = self.invoke(DOCKER_BUILD_EXIT='17')
        self.assertEqual(result.returncode, 17)
        self.assertNotIn('BUILD COMPLETE', result.stdout)
        self.assertFalse(any(x[:3] == ['buildx', 'imagetools', 'inspect']
                             for x in self.arguments()))

    def test_missing_arm_index_entry_rejects_success(self):
        """Registry inspection must prove both requested platform entries."""
        result = self.invoke(REGISTRY_PLATFORMS='linux/amd64')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('BUILD COMPLETE', result.stdout)

    def test_invalid_registry_digest_rejects_success(self):
        """Reject malformed registry identity instead of outputting it."""
        result = self.invoke(REGISTRY_DIGEST='latest')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('BUILD COMPLETE', result.stdout)

    def test_oci_export_never_pushes(self):
        """Export both platforms to an explicit artifact, without publishing."""
        result = self.invoke(BUILD_OUTPUT='oci',
                             BUILD_OUTPUT_PATH=str(self.root / 'image.tar'))
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(x for x in self.arguments() if x[:2] == ['buildx', 'build'])
        self.assertIn('--output', call)
        self.assertNotIn('--push', call)
        self.assertNotIn('BUILD DIGEST:', result.stdout)

    def test_oci_inside_source_is_rejected(self):
        """Do not write an image into its own Docker build context."""
        result = self.invoke(BUILD_OUTPUT='oci',
                             BUILD_OUTPUT_PATH=str(self.repo / 'image.tar'))
        self.assertNotEqual(result.returncode, 0)

    def test_multi_platform_load_is_rejected(self):
        """Require an explicit single target for host-only load checks."""
        self.assertNotEqual(self.invoke(BUILD_OUTPUT='load').returncode, 0)
        self.assertFalse(any(x[:2] == ['buildx', 'build'] for x in self.arguments()))

    def test_single_platform_load_is_explicit_and_never_pushes(self):
        """Allow a selected local architecture without claiming publication."""
        result = self.invoke(BUILD_OUTPUT='load', BUILD_PLATFORMS='linux/arm64')
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(x for x in self.arguments() if x[:2] == ['buildx', 'build'])
        self.assertIn('--load', call)
        self.assertNotIn('--push', call)

    def test_single_platform_publication_and_structured_result(self):
        """Explicit AMD64 and ARM64 output use the selected builder and verified digest."""
        for platform in ['linux/amd64', 'linux/arm64']:
            result_file = self.root / 'result.json'
            result = self.invoke(BUILD_PLATFORMS=platform, REGISTRY_PLATFORMS=platform,
                                 BUILDX_BUILDER='worker-multiarch', DEPLOY_SOURCE_SHA=self.sha,
                                 DEPLOY_RESULT_FILE=str(result_file))
            self.assertEqual(result.returncode, 0, result.stderr)
            image = json.loads(result_file.read_text())['images'][0]
            self.assertEqual(image['reference'], 'example.invalid/service@sha256:' + 'a' * 64)
            call = [x for x in self.arguments() if x[:2] == ['buildx', 'build']][-1]
            self.assertEqual(call[call.index('--builder') + 1], 'worker-multiarch')

    def test_worker_source_pin_and_no_result_on_failure(self):
        """Reject source drift and do not emit a deployable result after failed publication."""
        result_file = self.root / 'result.json'
        self.assertNotEqual(self.invoke(DEPLOY_SOURCE_SHA='0' * 40).returncode, 0)
        self.assertEqual(self.arguments(), [])
        result = self.invoke(DOCKER_BUILD_EXIT='17', DEPLOY_RESULT_FILE=str(result_file))
        self.assertEqual(result.returncode, 17)
        self.assertFalse(result_file.exists())

    def test_mutable_tag_is_rejected(self):
        """Avoid overwriting a generic deployment or rollback alias."""
        self.assertNotEqual(self.invoke(BUILD_TAG='latest').returncode, 0)
        self.assertFalse(any(x[:2] == ['buildx', 'build'] for x in self.arguments()))


if __name__ == '__main__':
    unittest.main()
