# Configuring Sparkle for forks
This document is an (incomplete) guide on how to let Sparkle users get the best out of your Snap! fork.

## Name & version information
In order to let Sparkle detect what fork it's on and provide these details to addons, you should specify `window.snapForkName` (the name of your Snap! fork) and `window.snapForkVersion` (the version string for your Snap! fork). 

If Sparkle cannot find these details, it will try to figure them out on its own, but this process has a tendency to produce unreliable information.
