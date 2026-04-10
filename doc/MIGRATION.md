# Migrating code written for Crackle
Originally, the code for a Crackle addon would look something like this:

~~~javascript
return {
    // Metadata
    id: "example-mod", // the id of the mod
    name: "Example Mod", // human-readable name
    description: "A example mod for CrackleSDK.", // description
    version: "1.0", // version
    author: "Your Name", // author
    depends: [], // dependencies (mod ids, useful for libraries)
    doMenu: true, // whether to add a menu item

    // Main function - gets ran when the mod is loaded
    main(api) {
        // Example adding a menu item - see morphic.js's MenuMorph
        // for more info on menus
        this.menu.addItem("Say hello", () => {
            api.inform("Hello, world!", "Example Mod");
        });

        // Example of using events
        this.addEventListener('categoryCreating', (e) => {
            if (e.detail.name == "Hello") {
                api.inform("I dont accept your hello.", "Example Mod");

                e.preventDefault();
            }
        });

        // Example of menu hooking
        api.registerMenuHook("projectMenu", (menu) => {
            menu.addLine();
            menu.addItem("Example Mod - Say hello", () => {
                alert("hi");
            })
        });
    },

    // Cleanup functions - get ran when the mod is "deleted"
    cleanupFuncs: [
        () => {
            console.log("Goodbye!");
        }
    ],
}
~~~

Towards the end of Crackle's development, efforts were made to modernize this style to use a class-based system, but support for it was never fully realized until Sparkle came around. The modern style looks quite different:

~~~javascript
return class extends Mod {
    // Metadata
    ID = "example-mod"; // the id of the mod
    NAME = "Example Mod"; // human-readable name
    DESCRIPTION = "A example mod for Sparkle."; // description
    VERSION = "1.0"; // version
    AUTHOR = "Your Name"; // author
    DEPENDS = []; // dependencies (mod ids, useful for libraries)
    DO_MENU = true; // whether to add a menu item

    // Main function - gets ran when the mod is loaded
    main() {
        // allow access to the API in the menu functions and such, shortcut
        let api = this.api;

        // Example adding a menu item - see morphic.js's MenuMorph
        // for more info on menus
        this.menu.addItem("Say hello", () => {
            api.inform("Hello, world!", "Example Mod");
        });

        // Example of using events
        this.addEventListener('categoryCreating', (e) => {
            if (e.detail.name == "Hello") {
                api.inform("I dont accept your hello.", "Example Mod");

                e.preventDefault();
            }
        });

        // Example of menu hooking
        api.registerMenuHook("projectMenu", (menu) => {
            menu.addLine();
            menu.addItem("Example Mod - Say hello", () => {
                alert("hi");
            })
        });
    }

    // Cleanup function - get ran when the mod is "deleted"
    cleanupFunc() {
        console.log("Goodbye!");
    }
}
~~~

In Sparkle v0.3, support for the old style was officially removed, so developers should learn the modern style instead. The remainder of this document contains several tips on porting your old code to modern-day Sparkle.

## Variable names
In the modern style of Sparkle addons, there are a number of notable differences in variable names:
- The `main()` function no longer accepts an `api` argument and instead uses the `this.api` variable
- The `cleanupFuncs` array has been replaced by the singular `cleanupFunc` function
- `id` has become `ID`, `name` has become `NAME`, `description` has become `DESCRIPTION`, `version` has become `VERSION`, `author` has become `AUTHOR`, `depends` has become `DEPENDS`, and `doMenu` has become `DO_MENU`

Make sure to adjust these variable names when porting.

## Return style
In the old style, an addon would return a dictionary in the form `return {...}`; in the modern style, `return class extends Mod {...}` is used instead.

## Backwards compatibility
All versions of Crackle support the old style, and all Sparkle versions before v0.3 do as well. Starting with v0.3, outdated addons will fail with an error, so developers are heavily advised to start migrating now.

The SparkleMods repository does not accept addons that do not follow the latest development guidelines.
