# Changelog

## [0.11.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.10.2...v0.11.0) (2026-08-13)


### Features

* **library:** add alphabet index scroller to the library screen ([#185](https://github.com/dylfrancis/aurral-pocket/issues/185)) ([6fac04c](https://github.com/dylfrancis/aurral-pocket/commit/6fac04c26bce6ac855364c2d034444593198a3e9)), closes [#63](https://github.com/dylfrancis/aurral-pocket/issues/63)
* **playlists:** add tracks to static playlists from flows and artist pages ([#187](https://github.com/dylfrancis/aurral-pocket/issues/187)) ([22977ee](https://github.com/dylfrancis/aurral-pocket/commit/22977eea9e9c066ca73b2a657d84c05c688fee54))
* **ui:** add list and grid view options to collection screens ([#191](https://github.com/dylfrancis/aurral-pocket/issues/191)) ([cc1850e](https://github.com/dylfrancis/aurral-pocket/commit/cc1850ec9050e08d3efa37084cf7bce18c65efc0))
* **ui:** use the platform system font to match web branding ([#190](https://github.com/dylfrancis/aurral-pocket/issues/190)) ([81fea93](https://github.com/dylfrancis/aurral-pocket/commit/81fea9364c47cbf36c75dbc55a2e8f0a753f3dbd))


### Bug Fixes

* **search:** keep the Android header search icon from disappearing ([#192](https://github.com/dylfrancis/aurral-pocket/issues/192)) ([5454591](https://github.com/dylfrancis/aurral-pocket/commit/5454591cce3588f5e877b6523883af414ad18791))

## [0.10.2](https://github.com/dylfrancis/aurral-pocket/compare/v0.10.1...v0.10.2) (2026-08-11)


### Bug Fixes

* **flow:** fetch playlist tracks from the jobs endpoint ([#180](https://github.com/dylfrancis/aurral-pocket/issues/180)) ([3ff12b5](https://github.com/dylfrancis/aurral-pocket/commit/3ff12b5e3030ad04aa7cbeef1753e5ddece909c6)), closes [#176](https://github.com/dylfrancis/aurral-pocket/issues/176)
* rename the Flow tab to Playlists ([#183](https://github.com/dylfrancis/aurral-pocket/issues/183)) ([01d2db0](https://github.com/dylfrancis/aurral-pocket/commit/01d2db08859d382e3378de0d20043ebda36897cb)), closes [#178](https://github.com/dylfrancis/aurral-pocket/issues/178)
* show artist cover art in search results ([#182](https://github.com/dylfrancis/aurral-pocket/issues/182)) ([074f5f0](https://github.com/dylfrancis/aurral-pocket/commit/074f5f0d21ec36d54d0c87171c0fd9869896fa54)), closes [#177](https://github.com/dylfrancis/aurral-pocket/issues/177)

## [0.10.1](https://github.com/dylfrancis/aurral-pocket/compare/v0.10.0...v0.10.1) (2026-08-10)


### Bug Fixes

* use black text and icons on brand green surfaces ([f6fbe54](https://github.com/dylfrancis/aurral-pocket/commit/f6fbe54f5bec0e508f8dcf1c19d9258ee8ec15af))
* use native search bar on blocklist and block artists from artist page ([8195c33](https://github.com/dylfrancis/aurral-pocket/commit/8195c33fb782430a11c0eb9cea6e009b24f9bd0a))

## [0.10.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.9.0...v0.10.0) (2026-08-10)


### Features

* **activity:** sync activity page with aurral 2.0 ([#173](https://github.com/dylfrancis/aurral-pocket/issues/173)) ([9d80196](https://github.com/dylfrancis/aurral-pocket/commit/9d80196382389efcf89955997490454f213cbaa9))
* **discover:** sync API contract with aurral test backend ([#148](https://github.com/dylfrancis/aurral-pocket/issues/148)) ([58441ad](https://github.com/dylfrancis/aurral-pocket/commit/58441ad047153d16b4965ebc17d6738c34511613))
* **ui:** ui refresh and update to match aurral 2.0 ([#146](https://github.com/dylfrancis/aurral-pocket/issues/146)) ([0689487](https://github.com/dylfrancis/aurral-pocket/commit/06894877279f4aae324999c83ae063291daaab7b))


### Bug Fixes

* **app:** gate flow fetch on permission and contain route failures ([#168](https://github.com/dylfrancis/aurral-pocket/issues/168)) ([e857d65](https://github.com/dylfrancis/aurral-pocket/commit/e857d651f416852fcd8e013a126766aae252e49f)), closes [#160](https://github.com/dylfrancis/aurral-pocket/issues/160)
* **discover:** contain Playlists for You card artwork ([#154](https://github.com/dylfrancis/aurral-pocket/issues/154)) ([3fbc1f7](https://github.com/dylfrancis/aurral-pocket/commit/3fbc1f7e2153e2bd460cdd485ad2a766bdab57b6)), closes [#153](https://github.com/dylfrancis/aurral-pocket/issues/153)
* **flow:** target aurral 2.0 /playlists mount directly ([#166](https://github.com/dylfrancis/aurral-pocket/issues/166)) ([8dee6a3](https://github.com/dylfrancis/aurral-pocket/commit/8dee6a30a2e1650be1bf50b2990e76d6fbfb1309)), closes [#160](https://github.com/dylfrancis/aurral-pocket/issues/160)
* **ios:** sanitize prerelease version for CFBundleShortVersionString ([#149](https://github.com/dylfrancis/aurral-pocket/issues/149)) ([85e1e41](https://github.com/dylfrancis/aurral-pocket/commit/85e1e41a9a82f7845fd17919cebb062af6280e4d))
* **search:** migrate artist search to /search/unified ([#170](https://github.com/dylfrancis/aurral-pocket/issues/170)) ([4b04a9b](https://github.com/dylfrancis/aurral-pocket/commit/4b04a9b70096167be3ff6456c94e5478772412e0)), closes [#167](https://github.com/dylfrancis/aurral-pocket/issues/167)

## [0.10.0-test.1](https://github.com/dylfrancis/aurral-pocket/compare/v0.10.0-test...v0.10.0-test.1) (2026-06-19)


### Bug Fixes

* **ios:** sanitize prerelease version for CFBundleShortVersionString ([#149](https://github.com/dylfrancis/aurral-pocket/issues/149)) ([85e1e41](https://github.com/dylfrancis/aurral-pocket/commit/85e1e41a9a82f7845fd17919cebb062af6280e4d))

## [0.10.0-test](https://github.com/dylfrancis/aurral-pocket/compare/v0.9.0...v0.10.0-test) (2026-06-19)


### Features

* **discover:** sync API contract with aurral test backend ([#148](https://github.com/dylfrancis/aurral-pocket/issues/148)) ([58441ad](https://github.com/dylfrancis/aurral-pocket/commit/58441ad047153d16b4965ebc17d6738c34511613))
* **ui:** ui refresh and update to match aurral 2.0 ([#146](https://github.com/dylfrancis/aurral-pocket/issues/146)) ([0689487](https://github.com/dylfrancis/aurral-pocket/commit/06894877279f4aae324999c83ae063291daaab7b))

## [0.9.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.8.2...v0.9.0) (2026-06-11)


### Features

* **preview-track:** add new preview url from backend with direct call fallback ([b04b923](https://github.com/dylfrancis/aurral-pocket/commit/b04b9232b2da18242101492dc94e629e05658f4e))
* **settings:** add option to choose between light, dark, and system theme ([352671f](https://github.com/dylfrancis/aurral-pocket/commit/352671f1e2d00267da3c5731cdab1845c88c31b7))


### Bug Fixes

* **artist:** filter unmonitored tracked albums out of library ([deb4761](https://github.com/dylfrancis/aurral-pocket/commit/deb4761efcf6906ea2b12111726f6a00d6f0f87b))
* **artist:** optimistically update recently added artists with new artist ([#134](https://github.com/dylfrancis/aurral-pocket/issues/134)) ([bf9ef6c](https://github.com/dylfrancis/aurral-pocket/commit/bf9ef6c6bbc2e1e5786f0f23422afb6a46ad3c4d))
* **flow:** align flow editing with the aurral API contract ([#141](https://github.com/dylfrancis/aurral-pocket/issues/141)) ([881db04](https://github.com/dylfrancis/aurral-pocket/commit/881db04ae53f3bced150a618ef0c172042102e71)), closes [#139](https://github.com/dylfrancis/aurral-pocket/issues/139)
* **flow:** edit a one-time snapshot so the status poll cannot clobber drafts ([#142](https://github.com/dylfrancis/aurral-pocket/issues/142)) ([86fef32](https://github.com/dylfrancis/aurral-pocket/commit/86fef32c6cd0ffda072f37ce03f8aad25711d506)), closes [#138](https://github.com/dylfrancis/aurral-pocket/issues/138)
* **flow:** refetch status immediately when tab regains focus ([#140](https://github.com/dylfrancis/aurral-pocket/issues/140)) ([fbdecfe](https://github.com/dylfrancis/aurral-pocket/commit/fbdecfe58b2d2e2ffb41355148e3c0b549035ba2)), closes [#131](https://github.com/dylfrancis/aurral-pocket/issues/131)

## [0.8.2](https://github.com/dylfrancis/aurral-pocket/compare/v0.8.1...v0.8.2) (2026-06-01)


### Bug Fixes

* **android:** allow http traffic on non-local networks ([0246651](https://github.com/dylfrancis/aurral-pocket/commit/02466516bc8a3de2c13b23b1d35a7cfae7fa7ec2))

## [0.8.1](https://github.com/dylfrancis/aurral-pocket/compare/v0.8.0...v0.8.1) (2026-05-28)


### Bug Fixes

* **auth:** fix 401 bad path and handling of non-json responses ([70f6911](https://github.com/dylfrancis/aurral-pocket/commit/70f6911464e65ac3df20d2e62b487e469415621e))
* **ios:** allow self-hosted servers with non-ATS-compliant TLS configurations ([519643d](https://github.com/dylfrancis/aurral-pocket/commit/519643d44f86e17b9ae948e56067749d66a86683))

## [0.8.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.7.0...v0.8.0) (2026-05-27)


### Features

* **artist:** add refresh all missing album mechanic ([ef28e0a](https://github.com/dylfrancis/aurral-pocket/commit/ef28e0a227731d2b225293d69c083ae7e06c5ef9))
* **artist:** add refresh all missing albums ([81de7e0](https://github.com/dylfrancis/aurral-pocket/commit/81de7e0fd73dc35d6f91a982431320fe9aff476d))
* **artist:** move action buttons to toolbar ([0419940](https://github.com/dylfrancis/aurral-pocket/commit/041994096caa27e6855c21e053abaca000a6a7b2))
* **shazam:** add shazam integration ([#122](https://github.com/dylfrancis/aurral-pocket/issues/122)) ([1c00e7d](https://github.com/dylfrancis/aurral-pocket/commit/1c00e7dc58b747a5df0ee6ff20b92b1376d66c8d))


### Bug Fixes

* **discover:** correct close button on customize discover sheet ([3b38c4b](https://github.com/dylfrancis/aurral-pocket/commit/3b38c4b94834c03d49e772b1a85fdf171c812269))
* **ios:** add proper navbar background on ios 18 or below ([fa2361b](https://github.com/dylfrancis/aurral-pocket/commit/fa2361b2f927b3ab4892986ac45a77d6d501d6b1))
* **ios:** ios 18 proper background material rendering fix ([c6c2d8c](https://github.com/dylfrancis/aurral-pocket/commit/c6c2d8c12954485cc16675c70452635224b2b38e))

## [0.7.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.6.0...v0.7.0) (2026-05-24)


### Features

* **blocklist:** add blocklist ([#108](https://github.com/dylfrancis/aurral-pocket/issues/108)) ([2b7f33a](https://github.com/dylfrancis/aurral-pocket/commit/2b7f33a7d6c1681f624bb9ac50395c66bbb2c7a3))
* **discover:** add customizable discover page sections ([#111](https://github.com/dylfrancis/aurral-pocket/issues/111)) ([1526383](https://github.com/dylfrancis/aurral-pocket/commit/1526383f32f57d5978fb2403d2a73dfd166c02bb))
* **settings:** add x button ([466a150](https://github.com/dylfrancis/aurral-pocket/commit/466a15073939d4aec770553efee1a6c499cae712))
* **settings:** flesh out settings page ([#106](https://github.com/dylfrancis/aurral-pocket/issues/106)) ([558c032](https://github.com/dylfrancis/aurral-pocket/commit/558c032c48072baa24950cfa14744d5c03180b9e))
* **shows-near-you:** add full shows near you page ([#110](https://github.com/dylfrancis/aurral-pocket/issues/110)) ([172a44a](https://github.com/dylfrancis/aurral-pocket/commit/172a44acbf329bbbbe90ff9c78973a90d4ba13f6))


### Bug Fixes

* **artist:** android image hero style reduction ([3cb34bd](https://github.com/dylfrancis/aurral-pocket/commit/3cb34bda3036394157c5c148793243a913a664b6))
* **artist:** restore deezer preview on release groups ([802ea2c](https://github.com/dylfrancis/aurral-pocket/commit/802ea2c14d05d1799516e7ba4ac9ea4031640bb1))

## [0.6.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.5.0...v0.6.0) (2026-05-11)


### Features

* **artist:** add album search in view all albums view ([#97](https://github.com/dylfrancis/aurral-pocket/issues/97)) ([d8e3870](https://github.com/dylfrancis/aurral-pocket/commit/d8e38705e9b25859cbd8d6283e3cb0450212f814))
* **search:** add album search ([#92](https://github.com/dylfrancis/aurral-pocket/issues/92)) ([c83b8b2](https://github.com/dylfrancis/aurral-pocket/commit/c83b8b2ea201fda5378c148316a43cb90e4b808e))


### Bug Fixes

* **artist:** album art loading refresh and styling updates ([94c17df](https://github.com/dylfrancis/aurral-pocket/commit/94c17dfd8945023ecf4db49536823b76a1e2deed))

## [0.5.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.4.0...v0.5.0) (2026-05-05)


### Features

* **flow:** add flow page ([#84](https://github.com/dylfrancis/aurral-pocket/issues/84)) ([51c5f9b](https://github.com/dylfrancis/aurral-pocket/commit/51c5f9b44db903c894cd7ade7962b614078259fd))

## [0.4.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.3.1...v0.4.0) (2026-04-25)


### Features

* **discover:** discover page improvements ([#74](https://github.com/dylfrancis/aurral-pocket/issues/74)) ([73627cb](https://github.com/dylfrancis/aurral-pocket/commit/73627cbd4d3e6826dcbf443123702c83bfef02f9))
* **requests:** add requests page ([#70](https://github.com/dylfrancis/aurral-pocket/issues/70)) ([a59fa9a](https://github.com/dylfrancis/aurral-pocket/commit/a59fa9ae3c30423e6de4f703653442ee60b1fc71))


### Bug Fixes

* **tag:** fix tag click showing proper screen and results ([#75](https://github.com/dylfrancis/aurral-pocket/issues/75)) ([e2c4863](https://github.com/dylfrancis/aurral-pocket/commit/e2c486349bd568315611f81a41518fa4c14559e4))

## [0.3.1](https://github.com/dylfrancis/aurral-pocket/compare/v0.3.0...v0.3.1) (2026-04-21)


### Bug Fixes

* **artist:** add recycle key on image to load in placeholder on fast scroll ([#69](https://github.com/dylfrancis/aurral-pocket/issues/69)) ([3bf0e8a](https://github.com/dylfrancis/aurral-pocket/commit/3bf0e8afd3be11139b822ea840b02ac5c6ab37c0))
* **auth:** restore Face ID on session re-auth and fix credential persistence ([#60](https://github.com/dylfrancis/aurral-pocket/issues/60)) ([14fccf9](https://github.com/dylfrancis/aurral-pocket/commit/14fccf972b1de2d9236f8c8eedb027eb8ad39399))
* **search:** add try search all if recommended results are empty ([#66](https://github.com/dylfrancis/aurral-pocket/issues/66)) ([b46dd29](https://github.com/dylfrancis/aurral-pocket/commit/b46dd293e74a83d8c9f43246b364dcfa04ceba25))
* **search:** hide subtext if tag result is less than 1 ([#65](https://github.com/dylfrancis/aurral-pocket/issues/65)) ([182a883](https://github.com/dylfrancis/aurral-pocket/commit/182a88393e38125b52ae341df1fc941a328aa299))

## [0.3.0](https://github.com/dylfrancis/aurral-pocket/compare/v0.2.0...v0.3.0) (2026-04-20)

### Features

- **artist:** add skeleton loading for improved ui ([#44](https://github.com/dylfrancis/aurral-pocket/issues/44)) ([d2771a3](https://github.com/dylfrancis/aurral-pocket/commit/d2771a35106e80b53585f2e366163d9c8f0da2bc))
- **discover:** discover page ([#50](https://github.com/dylfrancis/aurral-pocket/issues/50)) ([bd9771c](https://github.com/dylfrancis/aurral-pocket/commit/bd9771c6f4f9a88555f937654a0973ef12163063))

### Bug Fixes

- **auth:** session expired popup on timeout of any request ([#40](https://github.com/dylfrancis/aurral-pocket/issues/40)) ([e7bf988](https://github.com/dylfrancis/aurral-pocket/commit/e7bf9888746b3adcbf39f70ce3de0ee72cf370a3))

## [0.2.0](https://github.com/dylfrancis/aurral-pocket/compare/aurral-pocket-v0.1.0...aurral-pocket-v0.2.0) (2026-04-13)

### Features

- **search:** search page ([#12](https://github.com/dylfrancis/aurral-pocket/issues/12)) ([e9b56bf](https://github.com/dylfrancis/aurral-pocket/commit/e9b56bf62b05f82b7216bef4761eaf8e82dd76ae))

## [0.1.0](https://github.com/dylfrancis/aurral-pocket/compare/aurral-pocket-v0.0.1...aurral-pocket-v0.1.0) (2026-04-13)

### Features

- Auto login and redirect ([#6](https://github.com/dylfrancis/aurral-pocket/issues/6)) ([6f62b49](https://github.com/dylfrancis/aurral-pocket/commit/6f62b49780573c01ef142426061cfe57787f20af))
- continue library page ([#7](https://github.com/dylfrancis/aurral-pocket/issues/7)) ([d022ac8](https://github.com/dylfrancis/aurral-pocket/commit/d022ac8a1234f401b662f666bae81ffa6b598aeb))
- finish out albums & releases section for artist page ([#8](https://github.com/dylfrancis/aurral-pocket/issues/8)) ([56be98c](https://github.com/dylfrancis/aurral-pocket/commit/56be98ceee7277dfd5329bbd4eff0875286e7525))

### Bug Fixes

- regenerate lock file ([a14040a](https://github.com/dylfrancis/aurral-pocket/commit/a14040a8bb7176cfff6904d083c695cbc4c31eab))

### Miscellaneous Chores

- release 0.0.1 ([1009ed2](https://github.com/dylfrancis/aurral-pocket/commit/1009ed20d10ee078e570bf9680f41bcd1c4a7d45))
- release 0.1.0 ([a57e929](https://github.com/dylfrancis/aurral-pocket/commit/a57e929313b67a0f3046134412e49fdbb0b49a25))
