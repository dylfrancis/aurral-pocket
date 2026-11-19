# Contributing

Contributions are welcome. Opening a pull request doesn't guarantee a review or a merge: a change may be closed, split, deferred, or done another way.

## Pocket's direction

Pocket brings what the Aurral web app does to your phone, in a native mobile layout rather than a copy of the web UI. It supports only the Aurral release pinned in [`.aurral-version`](./.aurral-version), with no fallbacks for older servers.

## Before you start

Search existing issues and pull requests first.

- **Bug:** open a [bug report](https://github.com/dylfrancis/aurral-pocket/issues/new?template=bug_report.md) with steps to reproduce it, your device, and your Aurral version.
- **Feature:** open a [feature request](https://github.com/dylfrancis/aurral-pocket/issues/new?template=feature_request.md) and wait for a maintainer to agree that it fits before you write code. For a new screen or layout, include a sketch so the layout can be agreed first.

## Pull requests

- Keep each pull request to one focused change. Leave out unrelated fixes, refactors, formatting, and dependency updates.
- Use a [Conventional Commit](https://www.conventionalcommits.org/) title, such as `fix(player): resume after a phone call`. Pull requests are squash-merged, so the title becomes the commit, and release-please builds the changelog from commits.
- Link the issue it closes.
- Add tests for changed behavior.
- For UI changes, include screenshots or a short recording, on both iOS and Android if both change.
- Say how you tested it, including the devices or simulators you used.

## Run the checks

Setup is in the README's [Development](./README.md#development) section. Before you push, run:

```bash
npm run lint
npm test
npm run test:android
```

CI runs both test suites on every pull request. If you change `lib/api/`, also run the [API contract check](./README.md#api-contract-check).

## Use an AI agent

Agents are welcome.

- **Say what did the work.** End the pull request description with the model and harness, such as `Created with <model> in <harness>.`, and name any subagent models that wrote part of the change. Start each comment an agent posts for you with this note:

  ```md
  > [!NOTE]
  > 🤖 **<model> responding on behalf of <your name>**
  ```

  Commit messages don't need it. Reviewers want to know what they're reading, and it isn't held against you.

- **You answer for what you submit.** Read the diff, run the app, and be ready to explain the change.
- **The review is the same** whether a person or an agent wrote the change.
