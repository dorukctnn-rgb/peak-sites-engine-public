# peak-sites-engine-public

Source-available, not open source (see LICENSE: all rights reserved).
No support, no issues, no outside contributions.

- `uyarla/` page generator and quality gates
- `hat/` cloud pipeline (GitHub Actions scripts)
- `lead/` public-source business discovery and scoring
- `sektor/` sector rules
- `inceleme/` review tools

Templates, fonts, message texts, review instructions and word lists are not in
this repository. Together with all business data, queues and secrets they live
in a private repository that the workflows reach with a restricted token
(`node hat/ozel-getir.mjs --kaynak <checkout>` places them next to the code;
they are git-ignored). The full test suite needs them: `npm ci && npm test`.
