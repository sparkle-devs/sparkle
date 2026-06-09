# Sparkle API

This file will describe the interface you have with addons, both the `api` variable, the `Mod` object, and `Mod` events.

## Addons structure

A typical addon file is a simple "return" statement, returing a class extending Mod containing metadata about the addon and its code. Here is an example:

```js
return class extends Mod {
  // Metadata
  ID = "example-addon"; // the id of the addon
  NAME = "Example Addon"; // human-readable name
  DESCRIPTION = "An example addon for Sparkle."; // description
  VERSION = "1.0"; // version
  AUTHOR = "Your Name"; // author
  CONTRIBUTORS = "N/A"; // non-author contributors to addon (only displayed in Sparkle >=v0.10.0)
  DEPENDS = []; // dependencies (addon ids, useful for libraries)
  DO_MENU = true; // whether to add a menu item
  // format for options dialog
  OPTIONS_FORMAT = [
    // ...
  ];

  // Main function - gets ran when the addon is loaded
  main() {
    // ...
  }

  // Cleanup function - get ran when the addon is "deleted"
  cleanupFunc() {
    // ...
  }
};
```

The comments in the above code describe the intended purpose of each section of an addon. Here is a list of APIs that are exposed to addons:

## API

This section describes the variables/functions that can be invoked from `this.api` in `main()`.

### Variables

- `ide` - The `IDE_Morph` (check Snap!'s `gui.js` for more infomation) Snap! is using. This is the Snap! interface.
- `world` - The `WorldMorph` object from Snap!.
- `crackle` - Sparkle's internal state; handle with care. The data contained within this variable is subject to change at any point.

### Functions

- `addApi` - Add an extra API to the API object of each new addon.
- `wrapFunction` - Lets you add extra code that runs after a function. Sparkle automatically discards each wrap when deleting an addon!
- `registerMenuHook` - Attach a menu hook. The first argument is the menu name, and the second one is a function which accepts a `MenuMorph` as its first argument. Here's a list of possible menu names:
  - `projectMenu` - Menu from file button
  - `settingsMenu` - Menu from settings button
  - `cloudMenu` - Menu from cloud button
  - `scriptsMenu` - Menu when you right-click on a scripting area
  - `snapMenu` - Menu when you click the Snap! logo
- `storage` - An object with procedures for storing data, local for each mod:
  - `get` - Gets a property, second parameter is a default value if the property is non-existent
  - `set` - Sets a property
- `requestPendingAction` - Informs Sparkle that a task (specified as a string in the first argument) should be performed when all addons are done loading. (Possible values are `"refreshIDE"` and `"refreshLogo"`.)
- `openSettings` - Open this mods settings menu.

### Removed APIs
Support for these APIs is no longer included in Sparkle.
- `inform`: Deprecated starting with v0.7 and removed starting with v0.8 because it's a small wrapper around Snap!'s `this.api.ide.inform`
- `showMsg`: Deprecated starting with v0.7 and removed starting with v0.8 because it has the exact same behavior as Snap!'s `this.api.ide.showMessage`


## `mod.options` and `OPTIONS_FORMAT`

Addons with an `OPTIONS_FORMAT` array will have an "Options" button in the addon manager. It usually looks something like this:

```js
[
  "HEADING 1", // Headings
  {
    id: "number",
    name: "A number",
    type: "number",
    default: 3,
    // optional
    min: 1,
  },
  {
    id: "slider",
    name: "A number slider",
    type: "number",
    default: 3,
    // optional, both min and max will make the input into a slider
    min: 1,
    max: 4,
    resolution: 0.1,
  },
  null, // spacer
  {
    id: "helloTest",
    name: "Hello String",
    type: "string",
    default: "Hello!",
  },
  {
    id: "dropDown",
    name: "Hi Dropdown",
    type: "string",
    default: "hello",
    menu: {
      Hello: "hello",
      Example: "example",
      Sparkle: "sparkle",
    },
    readOnly: true,
  },
  {
    id: "color",
    name: "A color",
    type: "color",
    default: new Color(255, 0, 128),
  },
  {
    id: "theBoolean",
    name: "Useless Checkbox",
    type: "boolean",
    default: true,
  },
  {
    id: "everyHello",
    name: "All Category Hellos",
    type: "string",
    // numbers and strings can have arrays as defaults
    default: ["hi", "hello", "sick", "howdy"],
    // optional, for arrays
    minLength: 1,
    maxLength: 5,
  },
  default: {
      "hi": true,
      "hello": true,
      "sick": false,
      "howdy": false,
  },
];
```

When the addon is loaded, the option data is loaded into the `options` property, which contains just the options data:

```js
{
    number: 3,
    slider: 2,
    helloTest: "Hello!",
    dropdown: "hello",
    color: new Color(255, 0, 128),
    everyHello: ["hi", "hello", "sick", "howdy"],
}
```

Addon options are automatically saved and deleted by Sparkle.

## `this` in `main`

The object stored in `this` is a `Mod` object. This object supports events using EventTarget. You add event listeners with `addEventListener`, just like with DOM elements. What follows is a list of possible events that you can add listeners for:

### Events

- `projectCreating` - Triggered whenever the current project is about to be replaced with a new one. You can cancel this action by calling "preventDefault" on it.
- `projectCreated` - Triggered after a project is created, if it was not cancelled by another event
- `categoryCreating` - Triggered whenever a new category is about to be created. You can cancel this action by calling "preventDefault" on it. The 'detail' property of the event object contains the `name` and `color` (Color) of the category.
- `categoryCreated` - Triggered after a category is created, if it was not cancelled by another event. The 'detail' property of the event object contains the `name` and `color` (Color) of the category.
- `optionsChanged` - Triggered after changing the options of a mod. Useful if you want to change something on the fly after setting new options.

## "Snap" detection

One very interesting feature in Sparkle is its cross-modness. This means, that not only can you run Sparkle and make addons for Snap!, you can also use it on other Snap! mods!

The current term for a Snap! mod (including Snap! itself) is simply a "Snap".

There are functions that allow you to require, suggest OR disallow a specfic Snap!. For example, if you are making an addon for [Split](https://www.github.com/e016/split-mod) that should only be supported on Split, you can call `requireSnaps`. Here are the functions you can use (all of these can take multiple params, for each snap):

- `requireSnaps`: Require either one of a set of snaps to run your addon
- `suggestSnaps`: Suggest a list of snaps that would work perfectly with your addon
- `disallowSnaps`: Disallow a list of snaps that your addon doesn't support. (e.g. better-flat-design, which won't work with Split as Split already has good flat design built-in)
