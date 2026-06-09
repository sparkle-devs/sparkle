return class extends Mod {
    // Metadata
    ID = "example-mod"; // the id of the mod
    NAME = "Example Mod"; // human-readable name
    DESCRIPTION = "A example mod for Sparkle."; // description
    VERSION = "1.0"; // version
    AUTHOR = "Your Name"; // author
    DEPENDS = []; // dependencies (mod ids, useful for libraries)
    DO_MENU = true; // whether to add a menu item
    OPTIONS_FORMAT = [
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
            resolution: 0.1
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
                "Hello": "hello",
                "Example": "example",
                "Sparkle": "sparkle",
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
        {
            id: "validHellos",
            name: "Select all hellos that apply",
            type: "multiSelect",
            options: {
                "Hi": "hi",
                "Hello": "hello",
                "Sick": "sick",
                "Howdy": "howdy",
            },
            default: {
                "hi": true,
                "hello": true,
                "sick": false,
                "howdy": false,
            },
        }
    ]; // format for options

    // Main function - gets ran when the mod is loaded
    main() {
        // allow access to the API in the menu functions and such, shortcut
        let api = this.api;
        let myself = this;

        // Example adding a menu item - see morphic.js's MenuMorph
        // for more info on menus
        this.menu.addItem("Say hello", () => {
            api.ide.inform(
                "Example Mod",
                "Hello, world! My number is: " + this.options.number

            );
        });

        this.menu.addItem("Check hello", () => {
            new DialogBoxMorph(
                myself,
                (choice) => {
                    let valid = myself.options.validHellos[choice];

                    new DialogBoxMorph().inform(
                        "Result",
                        valid ? "Yeah. That's good." : "Yeah, no. Get out of here.",
                        api.world
                    );
                }
            ).prompt(
                "Check a hello",
                "hello",
                api.world,
                null,
                {
                    "Hi": "hi",
                    "Hello": "hello",
                    "Sick": "sick",
                    "Howdy": "howdy",
                }
            );
        })

        this.menu.addLine();
        this.menu.addItem("Settings", () => {
            api.openSettings()
        })

        // Example of using events
        this.addEventListener("categoryCreating", (e) => {
            if (this.options.everyHello.includes(e.detail.name.toLowerCase())) {
                api.ide.inform("Example Mod", "I don't accept your hello.");

                e.preventDefault();
            }
        });

        // Example of menu hooking
        api.registerMenuHook("projectMenu", (menu) => {
            menu.addLine();
            menu.addItem("Example Mod - Say hello", () => {
                alert(this.options.helloTest);
            });
        });
    }

    // Cleanup function - get ran when the mod is "deleted"
    cleanupFunc() {
        console.log("Goodbye!");
    }
};
