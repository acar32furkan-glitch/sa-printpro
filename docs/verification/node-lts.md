# Verification: Node.js LTS

**Question (§0, item 3):** Confirm which Node version is current LTS (master prompt
assumes Node 20 LTS) and that it is still supported by the current Astro version.

## Finding

| Release | Codename | Status (as of 2026-09-11) | Latest patch seen |
|---------|----------|---------------------------|-------------------|
| Node.js v26.x | — | Current | v26.8.1 (2026-08-26) |
| Node.js v24.x | Krypton | **Active LTS** | v24.20.0 (2026-08-26) |
| Node.js v22.x | Jod | LTS (maintenance) | v22.23.2 (2026-07-29) |
| Node.js v20.x | Iron | **EOL** | — |

- **Current Active LTS is Node.js 24 (Krypton).** Node 20 (Iron) is end-of-life and
  must not be used.
- Node 22 (Jod) is still receiving LTS maintenance patches and is supported.
- **Astro 7 supports Node 22 and 24** (evidence: Astro issue #16482 reports Astro
  7.1.5 running on Node v22.14.0 and v24.15.0).

## Correction applied
Master prompt §2 states "Node 20 LTS." → **Correction:** Node 20 is EOL.
Phase 0 toolchain is built for **Node 24 LTS**; Node 22 LTS is also acceptable.
Local sandbox runs Node v22.19.0 (Jod LTS) and the Astro toolchain runs on it.

### Env note (node range warning)
`astro-eslint-parser@3.1.0` (a transitive of `eslint-plugin-astro@3.1.0`) declares
an Engines range of `^22.22.3 || ^24.16.0 || >=26.3.0`. The sandbox Node
v22.19.0 is 4 patches below `^22.22.3`; npm emits an `EBADENGINE` warning but
installs and runs it. If a stricter runtime host is used, run on Node >=22.22.3
(or Node 24) to clear the warning.

## Sources
- Node.js releases (current / LTS / EOL table):
  https://nodejs.org/en/about/previous-releases
- Latest release announcements:
  https://nodejs.org/en/blog/release (v24.20.0 LTS 2026-08-26; v22.23.2 LTS 2026-07-29)
- Node.js GitHub releases: https://github.com/nodejs/node/releases
- Astro 7 engine evidence (Node v22.14 / v24.15):
  https://github.com/withastro/astro/issues/16482

Date searched: **2026-09-11**
