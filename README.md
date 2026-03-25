# Sparkle
![Sparkle logo](sparkle.gif)

[History](HISTORY.md) | [License](LICENSE)

A modding framework for Snap!, made by [@tethrarxitet](https://forum.snap.berkeley.edu/u/tethrarxitet), [@codingisfun2831t](https://forum.snap.berkeley.edu/u/codingisfun2831t), and [@e016](https://forum.snap.berkeley.edu/u/d016) among others.

# Loading in browser
For now, Sparkle does not have any pages for it on common browser extension stores, so you will have to load it manually for your browser.

## Firefox
Go to `about:debugging`, go to `This Firefox`, click `Load Temporary Add-on...` and select the `manifest.json` file in this directory. Now, whenever you launch Snap! you should see the new addon button.

## Chrome
First, go to [chrome://extensions/](chrome://extensions/). There should be a "Developer mode" options. Simply press that, and then go to the "Manage Extensions" option/There should be a "Load unpacked" button at the top left. Import your Sparkle folder in there, and see the results.

# How to use
When launching Snap! or one of its forks with Sparkle open, you should see a new button being added to the title bar:

![Snap! Topbar buttons, but with the new Addon button](doc/Buttons.png)

If you were to click on the addon button, you'll see this menu popup:

![Sparkle menu](doc/Menu.png)

Here is what each of those options do:

* `About Sparkle...` - Display a dialog containing info about Sparkle
* `Load addon from code...` - Load mod from direct code
* `Load addon from file...` - Load mod from a file on your computer
* `Manage loaded addons...` - Display a menu allowing you to see info or delete currently-loaded addons

For mod creators, check out [the API documentation](doc/API.md) so you can make your own addons.

## A note about manmade code
The owner of this project believes in good faith that it complies with [The Manmade Software Declaration 1.0](https://mojavesoft.net/ai-policy/1.0).
Contributors are encouraged to follow the guidelines described at the aforementioned link when proposing any code changes, and patches that appear to violate those rules may be rejected at any time.
