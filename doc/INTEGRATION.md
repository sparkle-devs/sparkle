# Integrating Sparkle with your Snap! fork
Starting with v0.4, people who maintain Snap! forks can now add the Sparkle addon system without requiring the use of browser extensions; this page is a brief guide on how to set it up!

## Preparing for integration
Before trying to integrate Sparkle into your mod, ensure that its URLs are not currently listed in [the extension manifest for Sparkle](manifest.json).

If it is, please open a PR to remove the URLs and wait for the next release of Sparkle before integrating it into your fork.

## Adding the necessary source code files
Visit the Releases tab and choose a Sparkle version. Download the file named `sparkle.js`, and add it to the `src/` directory of your fork.

## Modifying snap.html
In order to make Sparkle automatically load as a component of your fork, open the `snap.html` file, create a new line after the last `<script>...</script>` tag, and paste in the following code: `<script>script src="src/sparkle.js"></script>`.

Congratulations! You've integrated your fork with Sparkle!
