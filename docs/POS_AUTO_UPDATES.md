# Rawaqan POS automatic updates

The desktop application checks the public GitHub Releases feed 15 seconds after startup and every four hours while it remains open. A new installer downloads in the background. Once downloaded, the cashier can restart and install immediately or defer until later. Network failures are logged and never block offline POS operation.

## One-time activation

Version 1.2.4 and older do not contain the updater. Install version 1.3.0 manually on the cashier device once. Releases after 1.3.0 are discovered and installed automatically.

## Publishing a later version

1. Bump `desktop/package.json` with `npm version <version> --prefix desktop --no-git-tag-version`.
2. Commit and push the change to `main`; wait for `Build POS desktop installer` to pass.
3. Create and push the matching tag, for example `git tag v1.3.1` and `git push origin v1.3.1`.
4. The `Release POS desktop update` workflow builds and publishes the installer, blockmap, and `latest.yml` as a public GitHub Release.

Never reuse a version number or move an existing release tag.

## Windows signing

Configure repository secrets `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` before customer distribution so Windows and the updater can verify the publisher. The workflow supports unsigned builds for transition/testing but emits a warning; it never disables Electron's update signature verification.
