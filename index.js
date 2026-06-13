"use strict";
/*
    Sparkle - A modding framework for Snap! and its forks
    
    Copyright (c) 2025-2026 Mojavesoft Group
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/
if (window.__crackle__) {
    throw new Error("Another instance of Sparkle is already running; quitting!");
}

function commaOr(...items) {
    if (items.length == 0) return "";
    if (items.length == 1) return items[0];
    if (items.length == 2) return items[0] + " or " + items[1];

    return items.slice(0, -1).join(", ") + " or " + items[items.length - 1];
}

// API for mods
class API {
    constructor(mod) {
        this.mod = mod;
        this.world = world;
        this.ide = world.children[0];
        this.crackle = window.__crackle__;
        this.snap = this.crackle.snap;
        this.storage = {
            set: (key, value) => {
                let data =
                    JSON.parse(this.crackle.storage.get(`sparkle-${this.mod.ID}`)) || {};
                data[key] = value;
                this.crackle.storage.set(
                    `sparkle-${this.mod.ID}`,
                    JSON.stringify(data),
                );
            },
            get: (key, defaultValue) => {
                return (
                    (JSON.parse(this.crackle.storage.get(`sparkle-${this.mod.ID}`)) ||
                    {})[key] ?? defaultValue
                );
            },
        };

        this.versionStringFromSemver = API.versionStringFromSemver;
    }

    //this.showMsg = this.ide.showMessage; showMsg API is removed starting with v0.8.

    addApi(name, obj) {
        API.prototype[name] = obj;
    }

    /*inform(text, title) {
        this.ide.inform(title || "Information", text);
    }*/ // inform API is removed starting with v0.8.

    wrapFunction(object, name, wrapper, overwrite, importance) {
        wrapper.importance = importance || 0;
        const originalFunction = object[name];
        if (originalFunction[window.__crackle__.crackleSymbol]) {
            originalFunction[window.__crackle__.crackleSymbol].functions[
                this.mod.ID
            ] = wrapper;
            if (overwrite) {
                let overwrites = originalFunction[window.__crackle__.crackleSymbol].overwrites;
                !overwrites.includes(this.mod.ID) && overwrites.push(this.mod.ID);
            };
            return originalFunction;
        }

        const FUNCTION_ID = Symbol("Function ID");

        let proxy = new Proxy(originalFunction, {
            apply(target, ctx, args) {
                let overwrites = window.__crackle__.wrappedFunctions.get(FUNCTION_ID)?.overwrites || [];
                if (!window.__crackle__.wrappedFunctions.get(FUNCTION_ID)) {
                    return Reflect.apply(target, ctx, args);
                }
                if (
                    overwrites.length == 0
                ) {
                    Reflect.apply(target, ctx, args); // This calls the original function
                }
                // target is the original function (original object)
                // ctx is the ide object,
                // args is the arguments that were passed into the function

                // And then crackle will run all the functions that mods have defined

                let wrappers =
                    window.__crackle__.wrappedFunctions.get(FUNCTION_ID)?.functions;
                if (wrappers) {
                    let sortedWrappers = Object.values(window.__crackle__.wrappedFunctions.get(FUNCTION_ID).functions).sort(
                            (wrap, wrap2) => wrap2.importance - wrap.importance
                        ),
                        i = 0;
                    for (let wrapper of sortedWrappers) {
                        let returnValue = wrapper.apply(ctx, args);
                        if (i === 0 && overwrites.length > 0) {
                            return returnValue;
                        }
                        if (i === sortedWrappers.length - 1) {
                            return returnValue;
                        }
                        i++;
                    }
                }
            },
            get(target, property, receiver) {
                if (property === window.__crackle__.crackleSymbol) {
                    return window.__crackle__.wrappedFunctions.get(FUNCTION_ID);
                }
                return Reflect.get(target, property, receiver);
            },
        });
        const wrapData = {
            target: originalFunction,
            functions: {
                [this.mod.ID]: wrapper,
            },
        };
        if (overwrite) {
            wrapData.overwrites = [this.mod.ID];
        };
        window.__crackle__.wrappedFunctions.set(FUNCTION_ID, wrapData);

        object[name] = proxy;
        return proxy;
    }

    registerMenuHook(name, func) {
        this.mod.menuHooks.push({
            name,
            func
        });
    }

    requireSnaps(...names) {
        if (!names.includes(this.snap.snap)) {
            let msg = `Addon "${this.mod.NAME}" requires ${commaOr(...names)}, but you are using ${this.snap.snap}.`;
            world.children[0].inform("Incompatible Snap", msg);
            throw new Error("snap not compatible");
        }
    }

    suggestSnaps(...names) {
        if (!names.includes(this.snap.snap)) {
            world.children[0].inform(
                "Sparkle",
                `This addon is designed for ${commaOr(...names)}, but you are using ${this.snap.snap}.
        The addon might still work; continue at your own risk.`

            );
        }
    }

    disallowSnaps(...names) {
        if (names.includes(this.snap.snap)) {
            let msg = `The addon "${this.mod.NAME}" does not work with ${this.snap.snap}. `;
            world.children[0].inform("Incompatible Snap", msg);
            window.__crackle__.deleteMod(this.mod.ID ?? this.mod.id);
            throw new Error("snap not compatible");
        }
    }

    requestPendingAction(action) {
        Mod.pendingActions.add(action);
        return Mod.pendingActions;
    }

    environmentType() {
        if (window.__TAURI__) {
            return "tauri";
        }

        else {
            return "web";
        }
    }

    semverIsGreaterThan(a, b) {
        if (a[0] > b[0]) { // if a's major version > b's major version
            return true;
        }

        else if (a[0] < b[0]) {
            return false;
        }

        else {
            if (a[1] > b[1]) { // if a's minor version > b's minor version
                return true;
            }

            else if (a[2] > b[2] && a[1] == b[1]) { // if a's patch version > b's patch version AND both have same minor version
                return true;
            }

            else {
                return false
            }
        }
    }

    static versionStringFromSemver(a) {
        return `v${a[0]}.${a[1]}.${a[2]}`;
    }

    suggestMinVersion(a) {
        if (this.semverIsGreaterThan(a, this.crackle.versionArray)) {
            world.children[0].inform(
                "Sparkle",
                `This addon is designed for Sparkle ${this.versionStringFromSemver(a)} or later, but you are using ${this.versionStringFromSemver(this.crackle.versionArray)}.
        The addon might still work; continue at your own risk.`

            );
        }
    }
}

// A Mod, loaded from code
class Mod extends EventTarget {
    static ID = "unknown-mod";
    static NAME = "Unknown Addon";
    static DESCRIPTION = "No description available.";
    static VERSION = "1.0";
    static AUTHOR = "John Doe";
    static DEPENDS = [];
    static DO_MENU = false;
    static pendingActions = new Set();
    //static globalMod = new Mod(); Disabled because it causes race conditions.
    constructor() {
        super(); // initialize EventTarget
        this.api = new API(this);
        this.menuHooks = [];
        if (!this.CONTRIBUTORS) {
            this.CONTRIBUTORS = "N/A"
        }
    }

    setupOptions() {
        if (this.OPTIONS_FORMAT) {
            this.options = JSON.parse(
                window.__crackle__.storage.get(`sparkle-${this.ID}-options`),
            );
            if (this.options) {
                Object.keys(this.options).forEach((o) => {
                    if (
                        JSON.stringify(Object.keys(this.options[o])) === '["r","g","b","a"]'
                    ) {
                        this.options[o] = new Color(
                            this.options[o].r,
                            this.options[o].g,
                            this.options[o].b,
                            this.options[o].a,
                        );
                    }
                });
            }
            if (!this.options) {
                this.options = {};
                this.OPTIONS_FORMAT.forEach((format) => {
                    if (format?.id) {
                        this.options[format.id] = format.default;
                    }
                });
            }
        }
    }

    executeAddon(autoloaded) {
        this.main();
        if (!autoloaded) {
            Mod.performAllPendingActions();
        }
    }

    static findModById(id) {
        return window.__crackle__.loadedMods.find((mod) => mod.ID == id);
    }

    static dispatchEvent(event) {
        let ret = true;
        for (const mod of window.__crackle__.loadedMods) {
            ret = ret && mod.dispatchEvent(event);
        }

        Object.values(window.__crackle__.allEventTargets).forEach((element) =>
            element.dispatchEvent(event),
        );

        return ret;
    }

    static performAllPendingActions() {
        let tempAPI = new API();
        if (Mod.pendingActions.has("refreshIDE")) {
            console.log("Refreshing IDE...");
            tempAPI.ide.refreshIDE();
        }

        if (Mod.pendingActions.has("refreshLogo")) {
            console.log("Refreshing logo...");
            tempAPI.ide.buildPanes();
            tempAPI.ide.fixLayout();
        }

        this.pendingActions.clear();
    }
}

class CrackleMorph extends ScrollFrameMorph {
    constructor(crackle, vertical) {
        super();
        this.crackle = crackle;
        this.vertical = vertical || false;
        this.type = null;
        this.myPadding = DialogBoxMorph.prototype.padding;
        this.acceptsDrops = false;
        this.contents.acceptsDrops = false;
    }

    setupLibraries(list) {
        this.type = "import";
        this.libraryData = list || [];
        this.filteredLibrariesList = this.libraryData;
        this.buildContents();
        this.fixLayout();
    }
    setupManager(reopen) {
        this.type = "manage";
        this.reopen = reopen;
        this.buildContents();
        this.fixLayout();
    }
    setupSettings() {
        this.type = "settings";
        this.buildContents();
        this.fixLayout();
    }
    setupModOptions(mod) {
        this.type = "options";
        this.mod = mod;
        this.buildContents();
        this.fixLayout();
    }
    fixListFieldItemColors() {
        // remember to always fixLayout() afterwards for the changes
        // to take effect
        this.mods.contents.children[0].alpha = 0;
        this.mods.contents.children[0].children.forEach((item) => {
            item.pressColor = DialogBoxMorph.prototype.titleBarColor.darker(20);
            item.color = new Color(0, 0, 0, 0);
            if (item.children[0]) {
                item.children[0].color = this.mods.color.b < 128 ? WHITE : BLACK;
            }
        });
    }
    buildModsList() {
        if (this.mods) {
            this.mods.destroy();
        }

        this.mods = new ListMorph(
            this.filteredLibrariesList,
            (element) =>
            element.name + (element.version ? ` (${element.version})` : ""),
            null,
            null,
            "~", // separator
            false, // verbatim
        );
        this.mods.action = (lib) => {
            if (lib.author === null) {
                this.selected = null;
            } else {
                this.selected = lib;
                this.notesText.text =
                    lib.description +
                    (lib.author ? "\n\n" + "made by " + lib.author : "");
                this.notesText.fixLayout();
                this.notesText.rerender();
            }
        };

        this.mods.fixLayout = nop;
        this.mods.edge = InputFieldMorph.prototype.edge / (this.crackle.snap.snap == "Split" ? 2 : 1);
        this.mods.fontSize = InputFieldMorph.prototype.fontSize;
        this.mods.typeInPadding = InputFieldMorph.prototype.typeInPadding;
        this.mods.contrast = InputFieldMorph.prototype.contrast;
        this.mods.render = InputFieldMorph.prototype.render;
        this.mods.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;
        this.mods.color = PushButtonMorph.prototype.color;

        this.addContents(this.mods);
        this.fixListFieldItemColors();
    }
    buildLibrary() {
        if (this.filterField) {
            this.filterField.destroy();
        }
        if (this.magnifyingGlass) {
            this.magnifyingGlass.destroy();
        }

        if (this.notesField) {
            this.notesField.destroy();
        }
        this.filterField = new InputFieldMorph("");
        this.filterField.doContrastingColor = true;
        this.contents.color = PushButtonMorph.prototype.color;
        this.magnifyingGlass = new SymbolMorph(
            "magnifyingGlass",
            this.filterField.height(),
            BLACK,
        );

        this.filterField.reactToInput = () => {
            function getLibrarySearchData({
                name,
                description,
                author,
                id
            }) {
                return [name, description, author, id].join(" ").toLowerCase();
            }

            let query = this.filterField.getValue().toLowerCase();
            this.filteredLibrariesList = this.libraryData.filter(
                (library) => getLibrarySearchData(library).indexOf(query) > -1,
            );
            if (this.filteredLibrariesList.length < 1) {
                this.filteredLibrariesList.push({
                    name: "(no matches)",
                    description: null,
                    author: null,
                });
            }
            this.notesText.text = "";
            this.notesText.fixLayout();
            this.notesText.rerender();
            this.buildModsList();
            this.fixLayout();
            /*this.mods.adjustScrollBars();
            this.mods.scrollY(this.mods.top());*/
        };

        this.buildModsList();

        this.notesText = new TextMorph("");
        this.notesText.color = PushButtonMorph.prototype.labelColor;
        this.notesField = new ScrollFrameMorph();
        this.notesField.fixLayout = nop;
        this.notesField.acceptsDrops = false;
        this.notesField.contents.acceptsDrops = false;
        this.notesField.isTextLineWrapping = true;
        this.notesField.padding = 3;
        this.notesField.setContents(this.notesText);

        this.notesText.color = PushButtonMorph.prototype.labelColor;
        this.notesField.fixLayout = nop;
        this.notesField.edge = InputFieldMorph.prototype.edge / (this.crackle.snap.snap == "Split" ? 2 : 1);
        this.notesField.fontSize = InputFieldMorph.prototype.fontSize;
        this.notesField.typeInPadding = InputFieldMorph.prototype.typeInPadding;
        this.notesField.contrast = InputFieldMorph.prototype.contrast;
        this.notesField.render = InputFieldMorph.prototype.render;
        this.notesField.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;
        this.notesField.color = PushButtonMorph.prototype.color;

        this.addContents(this.magnifyingGlass);
        this.addContents(this.filterField);
        this.addContents(this.notesField);
    }
    fixLibrariesLayout() {
        if (this.vertical) {
            this.mods.setWidth(this.width() - this.myPadding);
            this.mods.setHeight(this.height() / 2 - this.myPadding);
            this.mods.setTop(this.top());
            this.mods.setLeft(this.left());

            this.notesField.setWidth(this.width());
            this.notesField.setHeight(this.height() / 2 - this.myPadding);
            this.notesField.setTop(this.mods.bottom() + this.myPadding);
            this.notesField.setLeft(this.left());
        } else {
            this.magnifyingGlass.setTop(this.top());
            this.magnifyingGlass.setLeft(this.left());

            this.filterField.setTop(this.top());
            this.filterField.setCenter(this.magnifyingGlass.center());
            this.filterField.setLeft(this.magnifyingGlass.right() + 10);

            this.mods.setLeft(this.left());
            this.mods.setTop(this.filterField.bottom() + 10);
            this.mods.setWidth(200);
            this.mods.setHeight(200);

            this.notesField.setHeight(200);
            this.notesField.setWidth(200);
            this.notesField.setTop(this.mods.top());
            this.notesField.setLeft(this.mods.right() + 10);

            this.setWidth(this.mods.width() + 10 + this.notesField.width());
            this.bounds.setHeight(
                this.filterField.height() + 14 + this.mods.height(),
            );
            this.contents.setHeight(this.bounds.height());
            this.contents.fixLayout();
            this.filterField.bounds.corner.x = this.right();
            this.filterField.fixLayout();
        }
    }
    buildManager() {
        const myself = this;
        this.setColor(new Color(20, 20, 20));
        if (!this.vertical) {
            //this.setExtent(new Point(400, 200));
        }

        const oddColor = new Color(20, 20, 20);
        const evenColor = new Color(40, 40, 40);
        let useOdd = false;

        function makeModMorph(mod) {
            const crackle = myself.crackle;
            // Show mod information dialog
            const rowHeight = 25;

            const modMorph = new Morph();
            modMorph.setExtent(new Point(400, rowHeight));
            modMorph.setColor(useOdd ? oddColor : evenColor);
            modMorph.acceptsDrops = false;
            const enableTick = new ToggleMorph(
                "checkbox",
                null,
                () => {
                    if (crackle.disabledMods[mod.ID]) {
                        crackle.enableMod(mod.ID);
                    } else {
                        crackle.disableMod(mod.ID);
                    };
                    enableTick.hint = crackle.disabledMods[mod.ID] ? "check to enable" : "check to disable";
                },
                null,
                () => !crackle.disabledMods[mod.ID],
                null,
                crackle.disabledMods[mod.ID] ? "check to enable" : "check to disable"
            );
            enableTick.setPosition(new Point(5, 5));
            modMorph.add(enableTick);
            const labelFrame = new FrameMorph();
            console.log(mod);
            const label = new TextMorph(`${mod.NAME} (${mod.ID})`);
            label.setPosition(new Point(0, 5));
            label.setColor(new Color(240, 240, 240));
            labelFrame.setExtent(modMorph.extent());
            labelFrame.add(label);
            labelFrame.alpha = 0;
            labelFrame.color = CLEAR;
            modMorph.addChild(labelFrame);

            const infoButton = new PushButtonMorph(
                this,
                () => {
                    new DialogBoxMorph().inform(
                        `Addon Information`,
                        `Name: ${mod.NAME}\n` +
                        `ID: ${mod.ID}\n` +
                        `Description: ${mod.DESCRIPTION}\n` +
                        `Version: ${mod.VERSION}\n` +
                        `Contributors: ${mod.CONTRIBUTORS}\n` +
                        `Author: ${mod.AUTHOR}`,
                        world,
                    );
                },
                "Info",
            );

            infoButton.setColor(new Color(100, 100, 250));
            modMorph.addChild(infoButton);
            modMorph.infoButton = infoButton;

            const autoloadButton = new PushButtonMorph(
                this,
                () => {
                    if (crackle.autoload.isAutoloaded(mod.ID)) {
                        crackle.autoload.delete(mod.ID);
                        world.children[0].showMessage(
                            `${mod.NAME} will no longer run on startup again.`,
                        );
                    } else {
                        crackle.autoload.add(mod.ID);
                        world.children[0].showMessage(
                            `${mod.NAME} will now run every time you open ${crackle.snap.snap}!`,
                        );
                    }
                    autoloadButton.labelString = crackle.autoload.isAutoloaded(mod.ID) ?
                        "Un-autoload" :
                        "Autoload";
                    autoloadButton.createLabel();
                    autoloadButton.fixLayout();
                    modMorph.fixLayout();
                },
                crackle.autoload.isAutoloaded(mod.ID) ? "Un-autoload" : "Autoload",
            );
            autoloadButton.setColor(new Color(250, 250, 100));
            if (crackle.isDev) {
                modMorph.addChild(autoloadButton);
            }
            modMorph.autoloadButton = autoloadButton;

            const optionsButton = new PushButtonMorph(
                this,
                () => {
                    myself.crackle.showModOptions(mod);
                },
                "Options",
            );

            optionsButton.setColor(new Color(163, 135, 252));
            modMorph.addChild(optionsButton);
            modMorph.optionsButton = optionsButton;

            const deleteButton = new PushButtonMorph(
                this,
                () => {
                    crackle.deleteMod(mod.ID);
                    myself.reopen(); // reopen with refreshed list
                },
                "Delete",
            );
            deleteButton.setColor(new Color(250, 100, 100));
            modMorph.deleteButton = deleteButton;
            modMorph.addChild(deleteButton);

            if (mod.preloaded) {
                deleteButton.hide();
                autoloadButton.hide();
            }

            useOdd = !useOdd;
            modMorph.fixLayout = function() {
                this.deleteButton.setTop(this.top() + 2);
                this.deleteButton.setRight(this.right() - 2);
                this.optionsButton.setTop(this.top() + 2);
                if (Object.keys(mod.OPTIONS_FORMAT || {}).length === 0) {
                    this.optionsButton.hide();
                    this.optionsButton.setLeft(this.deleteButton.left());
                } else {
                    this.optionsButton.show();
                    this.optionsButton.setRight(this.deleteButton.left() - 3);
                }
                this.autoloadButton.setTop(this.top() + 2);
                if (!this.deleteButton.isVisible) {
                    if (this.optionsButton.isVisible) {
                        this.optionsButton.setRight(this.deleteButton.right());
                    } else {
                        this.optionsButton.setLeft(this.right());
                    }
                    this.autoloadButton.setRight(this.deleteButton.right());
                };
                this.autoloadButton.setRight(this.optionsButton.left() - 3);
                this.infoButton.setTop(this.top() + 2);
                this.infoButton.setRight(
                    (crackle.isDev && this.autoloadButton.isVisible ? this.autoloadButton : this.optionsButton).left() - 3,
                );
                labelFrame.setPosition(this.position().add(new Point(25, 0)));
                labelFrame.bounds.corner.x = this.infoButton.left() - 3;
                labelFrame.bounds.corner.y = this.bottom();
                labelFrame.fixLayout(true);
                label.rerender();
            };
            // modMorph.step = () => modMorph.bounds.setWidth(myself.width());
            modMorph.fixLayout();

            // jens... plz fix...
            MorphicPreferences.isFlat && (infoButton.label.shadowColor = null);
            MorphicPreferences.isFlat && (optionsButton.label.shadowColor = null);
            MorphicPreferences.isFlat && (autoloadButton.label.shadowColor = null);
            MorphicPreferences.isFlat && (deleteButton.label.shadowColor = null);

            modMorph.acceptsDrops = false;
            return modMorph;
        }

        let index = 0;
        for (const mod of this.crackle.loadedMods) {
            const modMorph = makeModMorph(mod);
            modMorph.setPosition(new Point(0, index * modMorph.height()));
            this.addContents(modMorph);
            index++;
        }
    }
    fixManageLayout() {
        this.contents.children.forEach(
            (child) => (child.bounds.setWidth(this.width()), child.fixLayout()),
        );
        this.contents.fixLayout();
    }
    /*
    buildSettings() {
        if (this.settings) {
            this.settings.destroy();
        }
        this.settings = new AlignmentMorph("column", 5);
        const autoload = new ToggleMorph(
            "checkbox",
            null,
            () => this.crackle.toggleDev(), // action,
            "Developer Mode", // label
            () => this.crackle.isDev, //query
        );
        this.settings.add(autoload);
        this.settings.fixLayout();

        this.alpha = 0;
        if (!this.vertical) {
            this.setWidth(200);
            this.setHeight(Math.min(this.settings.height(), 150));
        }
        this.addContents(this.settings);
    }
    */
    buildOptionMorph(format, getter, setter) {
        let morph;
        if (format.type === "boolean") {
            morph = new ToggleMorph(
                "checkbox",
                null,
                () => setter(morph.state), // action,
                null, // label
                getter, // query
            );
        } else if (
            format.type === "number" &&
            !isNil(format.min) &&
            !isNil(format.max)
        ) {
            if (!format.resolution) {
                format.resolution = 1e-3;
            }
            morph = new AlignmentMorph("row", 5);
            const slider = new SliderMorph(
                    +format.min / format.resolution,
                    +format.max / format.resolution,
                    +getter() / format.resolution,
                    2,
                    "horizontal",
                ),
                setResolution = (x) => {
                    return x
                        .toFixed(Math.floor(Math.log(1 / format.resolution) - 1))
                        .toString();
                },
                text = new StringMorph(
                    `${setResolution(+getter())}`,
                    10,
                    "sans-serif",
                    false,
                    null,
                    false,
                    false,
                    null,
                    BLACK,
                );
            slider.setExtent(new Point(100, 12));
            slider.updateValue();
            slider.action = () => {
                text.text = setResolution(slider.value * format.resolution);
                text.changed();
                text.fixLayout();
                text.rerender();
                setter(slider.value * format.resolution);
                morph.fixLayout();
                let parent = morph.parent;
                while (parent) {
                    if (parent) {
                        parent.fixLayout();
                    }
                    parent = parent.parent;
                }
            };
            morph.add(slider);
            morph.add(text);
            morph.fixLayout();
        } else if (format.type === "number") {
            morph = new InputFieldMorph(
                `${getter()}`,
                true,
                format.menu,
                format.readOnly,
            );
            morph.doContrastingColor = true;
            morph.reactToInput = () => {
                setter(+morph.getValue());
            };
            morph.setChoice = function(aStringOrFloat) {
                this.setContents(aStringOrFloat);
                this.escalateEvent("reactToChoice", aStringOrFloat);
                setter(+aStringOrFloat)
            };
            morph.accept = () => {
                if (!isNil(format.min) && +morph.getValue() < +format.min) {
                    morph.setContents(`${format.min}`);
                    setter(+format.min);
                }
                if (!isNil(format.max) && +morph.getValue() > +format.max) {
                    morph.setContents(`${format.max}`);
                    setter(+format.max);
                }
            };
        } else if (format.type === "color") {
            morph = new BoxMorph(2, 1);
            morph.setColor(getter());
            morph.setExtent(new Point(22, 22));
            morph.mouseClickLeft = () => {
                var hand = world.hand,
                    posInDocument = getDocumentPositionOf(world.worldCanvas),
                    mouseMoveBak = hand.processMouseMove,
                    mouseDownBak = hand.processMouseDown,
                    mouseUpBak = hand.processMouseUp,
                    pal = new ColorPaletteMorph(null, new Point(160, 100));

                world.add(pal);
                pal.setPosition(morph.topRight().add(new Point(this.edge, 0)));

                hand.processMouseMove = (event) => {
                    var clr = world.getGlobalPixelColor(hand.position());
                    hand.setPosition(
                        new Point(
                            event.pageX - posInDocument.x,
                            event.pageY - posInDocument.y,
                        ),
                    );
                    if (!clr.a) {
                        // ignore transparent,
                        // needed for retina-display support
                        return;
                    }
                    morph.setColor(clr);
                    setter(clr.copy());
                };

                hand.processMouseDown = nop;

                hand.processMouseUp = () => {
                    pal.destroy();
                    hand.processMouseMove = mouseMoveBak;
                    hand.processMouseDown = mouseDownBak;
                    hand.processMouseUp = mouseUpBak;
                };
            };
        } else {
            morph = new InputFieldMorph(
                `${getter()}`,
                false,
                format.menu,
                format.readOnly,
            );
            morph.doContrastingColor = true;
            setter(morph.getValue());
            morph.reactToInput = () => {
                setter(`${morph.getValue()}`);
            };
            morph.setChoice = function(aStringOrFloat) {
                this.setContents(aStringOrFloat);
                this.escalateEvent("reactToChoice", aStringOrFloat);
                setter(`${aStringOrFloat}`)
            };
        }
        return morph;
    }
    buildOptions() {
        if (this.settings) {
            this.settings.destroy();
        }
        this.newOptions = this.mod.options;
        Object.keys(this.newOptions).forEach((key) => {
            if (Array.isArray(this.newOptions[key])) {
                this.newOptions[key] = [...this.newOptions[key]];
            }
        });
        this.settings = new AlignmentMorph("column", 5);
        this.settings.alignment = "left";
        this.mod.OPTIONS_FORMAT.forEach((format) => {
            if (format?.id && Array.isArray(format.default)) {
                const myself = this;
                let list,
                    label = new StringMorph(
                        format.name,
                        12,
                        "sans-serif",
                        true,
                        null,
                        false,
                        false,
                        null,
                        BLACK,
                    ),
                    plus = new PushButtonMorph(
                        this,
                        () => {
                            if (!Array.isArray(myself.newOptions[format.id])) {
                                myself.newOptions[format.id] = [];
                            }
                            if (myself.newOptions[format.id].length > format.maxLength) {
                                remakeLayout();
                                return;
                            }
                            myself.newOptions[format.id].push(
                                format.default[
                                    myself.newOptions[format.id].length % format.default.length
                                ],
                            );
                            remakeLayout();
                        },
                        "+",
                    ),
                    less = new PushButtonMorph(
                        this,
                        () => {
                            if (myself.newOptions[format.id].length - 1 < format.minLength) {
                                remakeLayout();
                                return;
                            }
                            myself.newOptions[format.id].pop();
                            remakeLayout();
                        },
                        "-",
                    ),
                    buttonGroup = new AlignmentMorph("row", 5);
                buttonGroup.alignment = "left";
                buttonGroup.add(plus);
                buttonGroup.add(less);
                buttonGroup.fixLayout();
                list = new AlignmentMorph("column", 5);
                list.alignment = "left";

                let total = new AlignmentMorph("column", 5);
                total.alignment = "left";
                total.add(label);
                total.add(list);
                total.add(buttonGroup);
                this.settings.add(total);

                let remakeLayout = () => {
                    while (list.children.length > 0) {
                        list.children.forEach((child) => child.destroy());
                    }
                    list.color = PushButtonMorph.prototype.color;
                    for (let i = 0; i < this.newOptions[format.id].length; i++) {
                        list.add(
                            this.buildOptionMorph(
                                Object.assign(Object.assign({}, format), {
                                    default: this.newOptions[format.id][i],
                                }),
                                () => this.newOptions[format.id][i],
                                (x) => (this.newOptions[format.id][i] = x),
                            ),
                        );
                    }
                    list.fixLayout();
                    total.fixLayout();
                    this.fixLayout();
                    if (this.parent) {
                        this.parent.fixLayout();
                    }
                };

                remakeLayout();
            } else if (format?.id) {
                let morph,
                    label = new StringMorph(
                        format.name,
                        12,
                        "sans-serif",
                        true,
                        null,
                        false,
                        false,
                        null,
                        BLACK,
                    );

                morph = this.buildOptionMorph(
                    format,
                    () => this.newOptions[format.id],
                    (x) => (this.newOptions[format.id] = x),
                );
                let total = new AlignmentMorph("row", 5);
                total.color = PushButtonMorph.prototype.color;
                total.alignment = "left";
                total.add(label);
                total.add(morph);
                total.fixLayout();
                this.settings.add(total);
            } else if (typeof format === "string") {
                let morph = new StringMorph(
                    format,
                    15,
                    "sans-serif",
                    false,
                    null,
                    false,
                    false,
                    null,
                    BLACK,
                );
                this.settings.add(morph);
            } else if (format === null) {
                let morph = new Morph();
                morph.alpha = 0;
                morph.setExtent(new Point(200, 5));
                this.settings.add(morph);
            }
        });
        this.settings.fixLayout();

        this.alpha = 0;
        if (!this.vertical) {
            this.setWidth(200);
            this.setHeight(Math.min(this.settings.height(), 150));
        }
        this.addContents(this.settings);
    }
    ok() {
        this.mod.options = this.newOptions;
        this.mod.dispatchEvent(
            new CustomEvent("optionsChanged"),
        );
        this.crackle.saveModOptions(this.mod);
    }
    fixOptionsLayout() {
        this.settings.fixLayout();
        this.settings.setWidth(200);
        this.setHeight(this.settings.height());
        this.setWidth(this.settings.width());
        this.contents.adjustBounds();
    }
    buildContents() {
        switch (this.type) {
            case "import":
                this.buildLibrary();
                break;
            case "manage":
                this.buildManager();
                break;
            case "settings":
                this.buildSettings();
                break;
            case "options":
                this.buildOptions();
                break;
        }
    }

    fixLayout() {
        ScrollFrameMorph.prototype.fixLayout.call(this);
        this.contents.adjustBounds();
        switch (this.type) {
            case "import":
                this.fixLibrariesLayout();
                break;
            case "manage":
                this.fixManageLayout();
                break;
            case "options":
                this.fixOptionsLayout();
                break;
        }
    }
}

// I import mods from CrackleTeam/CrackleMods
class CrackleImportLibraryMorph extends DialogBoxMorph {
    constructor(environment, action) {
        super(environment, action);
        this.container = new CrackleMorph(window.__crackle__, false);
        this.tab = "import"; // for vertical
        this.path =
            window.__crackle__.addonRepoPath;
        this.labelString = "Import Addon";
        this.key = "crackle import mods";
        fetch(this.path + "mods.json")
            .then((x) => x.json())
            .then(
                (list) => (
                    (this.librariesList = list),
                    this.container.setupLibraries(list),
                    this.buildContents(),
                    this.popUp(world),
                    this.container.fixLayout()
                ),
            );
    }
    buildContents() {
        this.container.type == "import" && (this.container.alpha = 0);

        this.createLabel();

        this.addBody(this.container);
        if (this.buttons.children.length == 0) {
            this.addButton("ok", "Import");
            this.addButton("cancel", "Cancel");
        }
        this.fixLayout();
    }
    ok() {
        fetch(this.path + "mods/" + this.container.selected.id + ".js")
            .then((x) => x.text())
            .then(
                (mod) => (
                    this.action(mod, this.container.selected.name),
                    this.vertical || this.destroy()
                ),
            );
    }
}

class VerticalCrackleDialogMorph extends CrackleImportLibraryMorph {
    constructor(environment, action) {
        super(environment, action);
        this.corner = 0;
        this.tab = "import";
        this.container.vertical = true;
        this.vertical = true;
    }
    reactToWorldResize(rect) {
        this.changed();
        this.bounds = rect;
        this.rerender();
        this.fixLayout();
    }
    switchTab(tab) {
        this.changed();
        this.container = new CrackleMorph(window.__crackle__, true);
        this.container.type = this.tab || "import";
        this.tab = tab;
        switch (tab) {
            case "import":
                this.container.setupLibraries(this.librariesList || []);
                break;
            case "manage":
                this.container.setupManager(() => this.container.setupManager());
                break;
            case "settings":
                this.container.setupSettings();
                break;
        }
        this.buildContents();
        this.fixContainerLayout();
        this.fixLayout();
    }
    buildTabs() {
        if (this.tabs) {
            this.tabs.destroy();
        }

        function setTab(tab) {
            tab.getPressRenderColor = function() {
                return this.pressColor;
            };
            tab.corner = 10;
            tab.padding = 3;
            tab.edge = 1;
            tab.labelShadowOffset = new Point(-1, -1);
            tab.fontSize = 10;
            tab.labelColor = WHITE;
            tab.labelShadowColor = BLACK;
            tab.labelShadowOffset = new Point(1, 1);
            tab.fixLayout();
        }

        let tab,
            colors = [
                PushButtonMorph.prototype.color.darker(),
                PushButtonMorph.prototype.highlightColor.darker(),
                PushButtonMorph.prototype.pressColor.darker(),
            ];
        this.tabs = new AlignmentMorph("row", -15, "center");
        this.tabs.alignment = "center";
        tab = new TabMorph(
            colors,
            null,
            () => {
                this.switchTab("import");
            },
            "Explore",
            () => this.tab == "import",
        );
        setTab(tab);
        this.tabs.add(tab);
        tab = new TabMorph(
            colors,
            null,
            () => {
                this.switchTab("manage");
            },
            "Manage",
            () => this.tab == "manage",
        );
        setTab(tab);
        this.tabs.add(tab);
        tab = new TabMorph(
            colors,
            null,
            () => {
                this.switchTab("settings");
            },
            "Settings",
            () => this.tab == "settings",
        );
        setTab(tab);
        this.tabs.add(tab);
        this.addHead(this.tabs);
    }
    buildContents() {
        CrackleImportLibraryMorph.prototype.buildContents.call(this);
        this.buildTabs();
        this.buttons.children[1]?.destroy?.();
    }
    fixContainerLayout() {
        this.container.setExtent(this.extent());
        this.container.bounds.corner.x = this.right() - this.padding;
        this.container.bounds.corner.y = this.buttons.top() - this.padding;
        this.container.fixLayout();
        this.container.contents.adjustBounds();
    }
    popUp(world) {
        CrackleImportLibraryMorph.prototype.popUp.call(this, world);
        this.setPosition(new Point(0, 0));
        this.setWidth(world.width());
        this.setHeight(world.height());
        this.fixLayout();
        this.fixContainerLayout();
        this.fixLayout();
        // this.isDraggable = false;
    }
    fixLayout() {
        // determine by extent and arrange my components
        const th = fontHeight(this.titleFontSize) + this.titlePadding * 2,
            stack = isNil(this.stackPadding) ? this.padding : this.stackPadding;

        if (this.head) {
            this.head.setPosition(
                this.position().add(new Point(this.padding, th + this.padding)),
            );
            this.head.setWidth(this.right() - this.head.left() - this.padding);
        }

        if (this.body) {
            this.body.setPosition(
                (this.head ?
                    this.head.bottomLeft().subtract(new Point(0, this.padding * 2)) :
                    this.position()
                ).add(new Point(this.padding, th + stack)),
            );
            this.body.fixLayout();
        }

        if (this.label) {
            this.label.setCenter(this.center());
            this.label.setTop(this.top() + (th - this.label.height()) / 2);
        }

        if (this.buttons && this.buttons.children.length > 0) {
            this.buttons.fixLayout();
            /*this.bounds.setHeight(
                  this.height()
                      + this.buttons.height()
                      + this.padding
              );*/
            this.bounds.setWidth(
                Math.max(this.width(), this.buttons.width() + 2 * this.padding),
            );
            this.buttons.setCenter(this.center());
            this.buttons.setBottom(this.bottom() - this.padding);
        }

        // refresh a shallow shadow
        this.removeShadow();
        this.addShadow();
    }
}

class ResizableDialogBoxMorph extends DialogBoxMorph {
    constructor(env, action) {
        super(env, action);
    }
    fixLayout(done) {
        var titleHeight = fontHeight(this.titleFontSize) + this.titlePadding * 2,
            thin = this.padding / 2,
            inputField = this.filterField;

        if (this.body) {
            this.body.setPosition(
                this.position().add(
                    new Point(this.padding, titleHeight + this.padding),
                ),
            );
            this.body.setExtent(
                new Point(
                    this.width() - this.padding * 2,
                    this.height() -
                    this.padding * 3 - // top, bottom, filterfield, button padding
                    titleHeight -
                    this.buttons.height(),
                ),
            );
        }

        if (this.label) {
            this.label.setCenter(this.center());
            this.label.setTop(this.top() + (titleHeight - this.label.height()) / 2);
        }

        if (this.buttons) {
            this.buttons.fixLayout();
            window.__crackle__.snap.snap === "Split" ?
                this.buttons.setRight(this.right() - this.padding) :
                this.buttons.setCenter(this.center());
            this.buttons.setBottom(this.bottom() - this.padding);
        }

        this.removeShadow();
        this.addShadow();
    }
}

// wait for Snap! to be ready and get references
function waitForSnapReady() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (typeof world !== "undefined" && world.children.length > 0) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

function preloadAddonFromPath(path) {
    fetch(path).then((x) => {
        if (!x.ok) {
            return "";
        };
        return x.text();
    }).then((code) => {
        window.__crackle__.preloadMod(code);
    })
}

(async function() {
    // attach hooks for menu hooks functions
    function attachMenuHooks(ide) {
        function applyHooks(menu, name) {
            window.__crackle__.loadedMods.forEach((mod) => {
                if (window.__crackle__.disabledMods[mod.ID]) {
                    return
                };
                mod.menuHooks.forEach((hook) => {
                    if (hook.name == name) hook.func(menu);
                });
            });
        }

        // hook MenuMorph to call hooks for different menus
        MenuMorph.prototype.popup = new Proxy(MenuMorph.prototype.popup, {
            apply(target, ctx, args) {
                if (ctx.target) {
                    if (window.__crackle__.currentMenu)
                        applyHooks(ctx, window.__crackle__.currentMenu);
                }
                return Reflect.apply(...arguments);
            },
        });

        // projectMenu
        IDE_Morph.prototype.projectMenu = new Proxy(
            IDE_Morph.prototype.projectMenu,
            {
                apply(target, ctx, args) {
                    window.__crackle__.currentMenu = "projectMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    window.__crackle__.currentMenu = null;
                },
            },
        );

        // settingsMenu
        IDE_Morph.prototype.settingsMenu = new Proxy(
            IDE_Morph.prototype.settingsMenu,
            {
                apply(target, ctx, args) {
                    window.__crackle__.currentMenu = "settingsMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    window.__crackle__.currentMenu = null;
                },
            },
        );

        // cloudMenu (or userMenu, in Snavanced)
        if (IDE_Morph.prototype.userMenu) {
            IDE_Morph.prototype.userMenu = new Proxy(IDE_Morph.prototype.userMenu, {
                apply(target, ctx, args) {
                    window.__crackle__.currentMenu = "cloudMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    window.__crackle__.currentMenu = null;
                },
            });
        }
        if (IDE_Morph.prototype.cloudMenu) {
            IDE_Morph.prototype.cloudMenu = new Proxy(IDE_Morph.prototype.cloudMenu, {
                apply(target, ctx, args) {
                    window.__crackle__.currentMenu = "cloudMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    window.__crackle__.currentMenu = null;
                },
            });
        }

        // snapMenu
        IDE_Morph.prototype.snapMenu = new Proxy(IDE_Morph.prototype.snapMenu, {
            apply(target, ctx, args) {
                window.__crackle__.currentMenu = "snapMenu";
                Reflect.apply(...arguments); // This calls the original function
                window.__crackle__.currentMenu = null;
            },
        });

        // scriptsMenu
        ScriptsMorph.prototype.userMenu = new Proxy(
            ScriptsMorph.prototype.userMenu,
            {
                apply(target, ctx, args) {
                    window.__crackle__.currentMenu = "scriptsMenu";
                    let menu = Reflect.apply(target, ctx, args); // This calls the original function
                    window.__crackle__.currentMenu = null;
                    return menu;
                },
            },
        );

        // paletteMenu
        //
        // NOTE: If a user opens a category before loading a mod
        // that uses paletteMenu, the hook will not take effect.
        //
        // TODO: Remove any palette cache on hooks of this
        // and refresh the current palette
        SpriteMorph.prototype.freshPalette = new Proxy(
            SpriteMorph.prototype.freshPalette,
            {
                apply(target, ctx, args) {
                    let palette = Reflect.apply(...arguments); // This calls the original function

                    palette.userMenu = new Proxy(palette.userMenu, {
                        apply(target, ctx, args) {
                            let menu = Reflect.apply(...arguments);
                            applyHooks(menu, "paletteMenu");
                            return menu;
                        },
                    });

                    return palette;
                },
            },
        );
    }

    // Attach event handlers to the IDE for mod events
    function attachEventHandlers(ide) {
        // projectCreating and projectCreated

        // this.backup tells the user about unsaved changes,
        // so we need to manually modify it here so the event
        // only gets called when backup actually calls the
        // callback
        ide.createNewProject = function() {
            this.backup(() => {
                if (
                    Mod.dispatchEvent(new Event("projectCreating", {
                        cancelable: true
                    }))
                ) {
                    this.newProject();

                    Mod.dispatchEvent(new Event("projectCreated"));
                }
            });
        };

        // categoryCreating and categoryCreated
        IDE_Morph.prototype.addPaletteCategory = new Proxy(
            IDE_Morph.prototype.addPaletteCategory,
            {
                apply(target, ctx, args) {
                    if (
                        Mod.dispatchEvent(
                            new CustomEvent("categoryCreating", {
                                cancelable: true,
                                detail: {
                                    name: args[0],
                                    color: args[1]
                                },
                            }),
                        )
                    ) {
                        Reflect.apply(...arguments); // This calls the original function

                        Mod.dispatchEvent(
                            new CustomEvent("categoryCreated", {
                                detail: {
                                    name: args[0],
                                    color: args[1]
                                },
                            }),
                        );
                    }
                },
            },
        );
    }

    const BUTTON_OFFSET = 5; // pixels between buttons
    await waitForSnapReady();
    const ide = world.children[0];
    const controlBar = ide.controlBar;

    // create the __crackle__ object
    window.__crackle__ = {
        versionArray: [0, 10, 2]
    };
    Object.assign(window.__crackle__, {
        version: API.versionStringFromSemver(window.__crackle__.versionArray),
        source: "https://github.com/sparkle-devs/sparkle/releases",
        loadedMods: [],
        extraApi: {},
        disabledMods: {},
        autoloadMods: {},
        modCodes: {},
        allEventTargets: {},
        crackleSymbol: Symbol("Crackle Data"),
        wrappedFunctions: new Map(),
        addonRepoPath: "https://raw.githubusercontent.com/sparkle-devs/SparkleAddons/refs/heads/master/",
        snap: (function() {
            // Jameson?
            if (window.isJameson) {
                return {
                    snap: "Jameson",
                    version: window.SnapVersion,
                };
            }

            // Snavanced
            if (window.SnavancedVersion) {
                return {
                    snap: "Snavanced",
                    version: window.SnavancedVersion,
                };
            }

            // Split?
            if (typeof window.SplitVersion !== "undefined") {
                return {
                    snap: "Split",
                    version: window.SplitVersion,
                };
            }

            // default to Snap
            return {
                snap: "Snap",
                version: window.SnapVersion,
            };
        })(),

        // load a mod from code, TEMPORARY. use addMod for loading normal mods from the menu or download.
        loadMod(code, autoloaded) {
            let mod = new(Function(code)())();

            if (this.loadedMods.some((element) => element.ID == mod.ID)) {
                ide.showMessage("Addon already loaded, reloading it..");
                this.deleteMod(mod.ID);
            }

            this.loadedMods.push(mod);
            this.modCodes[mod.ID] = code;
            if (mod.DO_MENU) mod.menu = new MenuMorph();

            try {
                mod.setupOptions();
                if (!this.disabledMods[mod.ID]) {
                    mod.executeAddon(autoloaded);
                }
            } catch (e) {
                ide.showMessage(
                    `Failed to load addon:\n${e}. Check the console for more details.`,
                );
                console.error(e);
            }
            return mod;
        },

        // load a mod and save it across runs
        addMod(code) {
            const mod = this.loadMod(code);
            this.autoload.add(mod.ID);
            return mod;
        },

        preloadMod(code) {
            if (!code) {
                return;
            }
            const mod = this.loadMod(code);
            mod.preloaded = true;
            return mod;
        },

        // Delete a mod by its ID
        deleteMod(id) {
            let mod = Mod.findModById(id);
            if (mod.cleanupFunc && !this.disabledMods[id]) mod.cleanupFunc();

            window.__crackle__.loadedMods = window.__crackle__.loadedMods.filter(
                (mod) => mod.ID != id,
            );

            this.removeModAttachments(id)

            delete this.disabledMods[id];
            this.saveDisabled();
            // remove autoload
            delete this.modCodes[id];
            if (!isNil(this.autoloadMods[id])) {
                this.autoload.delete(id);
            }

            // remove settings
            this.storage.remove(`sparkle-${id}-options`);
        },

        removeModAttachments(id) {
            // remove wraps
            window.__crackle__.wrappedFunctions.forEach((value, key) => {
                if (value.functions[id]) {
                    delete value.functions[id];
                }
                if (!value.overwrites) {
                    value.overwrites = [];
                }
                value.overwrites = value.overwrites.filter((modId) => modId != id);
                if (value.overwrites.length == 0 && Object.keys(value.functions).length == 0) {
                    window.__crackle__.wrappedFunctions.delete(key);
                };
            });
            if (id in window.__crackle__.allEventTargets) {
                delete window.__crackle__.allEventTargets[id];
            }
        },

        enableMod(id) {
            const mod = Mod.findModById(id);
            this.disabledMods[id] = false;
            this.saveDisabled();
            if (mod.DO_MENU) mod.menu = new MenuMorph();
            mod.executeAddon(false);
        },
        disableMod(id) {
            const mod = Mod.findModById(id);
            this.disabledMods[id] = true;
            this.saveDisabled();
            mod.cleanupFunc && mod.cleanupFunc();
            this.removeModAttachments(id);
        },
        saveDisabled() {
            this.storage.set("crackle_disabled_mods", JSON.stringify(this.disabledMods));
        },
        loadDisabled() {
            this.disabledMods = JSON.parse(this.storage.get("crackle_disabled_mods") || "{}");
        },

        autoload: {
            load() {
                let data = window.__crackle__.storage.get("crackle_autoload_mods");
                if (!data || data == "[]")
                    (window.__crackle__.storage.set("crackle_autoload_mods", "{}"),
                        (data = "{}"));

                return JSON.parse(data) || {};
            },

            save() {
                window.__crackle__.storage.set(
                    "crackle_autoload_mods",
                    JSON.stringify(window.__crackle__.autoloadMods),
                );
            },

            add(id) {
                window.__crackle__.autoloadMods[id] = window.__crackle__.modCodes[id];
                this.save();
            },

            delete(id) {
                delete window.__crackle__.autoloadMods[id];
                this.save();
            },
            isAutoloaded(id) {
                return !!window.__crackle__.autoloadMods[id];
            },

            loadAuto: async function(ide) {
                window.__crackle__.autoloadMods = this.load();
                window.__crackle__.loadDisabled();

                for (const id of Object.keys(window.__crackle__.autoloadMods)) {
                    const mod = window.__crackle__.autoloadMods[id];
                    try {
                        // TODO: optional fetching of mods
                        window.__crackle__.loadMod(mod, true);
                    } catch (e) {
                        ide.showMessage(
                            "Failed to autoload addon, check console for more info",
                        );

                        console.log("Failed to load addon: ", mod, e); // Make this console.log in order to stop a scary "Errors" button from showing up on Chrome
                    }
                }
                Mod.performAllPendingActions();
            },
        },
        isDev: true,
        /*
        toggleDev() {
            window.__crackle__.isDev = !window.__crackle__.isDev;
            this.saveSettings();
        },

        loadSettings() {
            const settings = JSON.parse(this.storage.get("crackle_settings") || "{}");
            this.isDev = settings.isDev !== false;
        },

        saveSettings() {
            this.storage.set(
                "crackle_settings",
                JSON.stringify({
                    isDev: window.__crackle__.isDev,
                }),
            );
        },
        */

        showModOptions(mod) {
            const dlg = new ResizableDialogBoxMorph(),
                modMorph = new CrackleMorph(window.__crackle__, false);

            modMorph.setupModOptions(mod);
            dlg.key = mod.ID + "-options";
            dlg.labelString = mod.NAME + " Options";
            dlg.action = modMorph.ok;
            dlg.createLabel();
            dlg.addBody(modMorph);
            dlg.addButton(() => (modMorph.ok(), dlg.destroy()), "OK");
            dlg.addButton(() => modMorph.ok(), "Apply");
            dlg.addButton("cancel", "Cancel");
            dlg.popUp(world);
            modMorph.fixLayout();
            dlg.bounds.setExtent(new Point(modMorph.width() + 28, modMorph.height() + 101));
            dlg.handle = new HandleMorph(dlg, dlg.width(), dlg.height(), dlg.corner, dlg.corner);
            dlg.fixLayout();
        },

        saveModOptions(mod) {
            this.storage.set(
                `sparkle-${mod.ID}-options`,
                JSON.stringify(mod.options),
            );
        },

        storage: {
            set(key, value) {
                localStorage.setItem(key, value);
            },
            remove(key) {
                localStorage.removeItem(key);
            },
            get(key) {
                return localStorage.getItem(key);
            },
        },

        currentMenu: null,
    });
    //window.__crackle__.loadSettings();

    // adjust the project label position to be after the mod button
    // this is needed because the fixLayout for the IDE doesn't know
    // about our new button, so it puts it after the normal place
    function adjustLabel(modButton) {
        controlBar.label.setPosition(
            new Point(
                controlBar.label.left() + BUTTON_OFFSET + modButton.width(),
                controlBar.label.top(),
            ),
        );
        controlBar.label.children[0].setPosition(controlBar.label.position());
    }

    // create mod button
    IDE_Morph.prototype.createModButton = function() {
        const controlBar = this.controlBar;
        let modButton;
        if (controlBar.modButton) {
            controlBar.modButton.destroy();
        }

        if (
            window.__crackle__.snap.snap == "Split" ||
            window.__crackle__.snap.snap
        ) {
            modButton = controlBar.settingsButton.fullCopy();
            controlBar.modButton = modButton;
            controlBar.addChild(modButton);
        }

        // add functionality to mod button
        Object.assign(modButton, {
            about() {
                // show the dialog. soon after the image will load and update
                // the dialog with it.
                let dlg = new DialogBoxMorph();
                dlg.inform(
                    "About Sparkle",
                    `Sparkle, a modding framework for Snap! and its forks\n` +
                    `Developed by codingisfun2831t and d016\n` +
                    `Inspired by tethrarxitet and orchestrated by PPPDUD\n` +
                    `Version ${window.__crackle__.version}\n`,
                    world,
                );
            },
            /*
            settings() {
                const dlg = new DialogBoxMorph(),
                    body = new CrackleMorph(window.__crackle__, false);
                body.setupSettings();

                dlg.key = "settings";
                dlg.labelString = "Sparkle settings";
                dlg.createLabel();
                dlg.addBody(body);
                dlg.addButton("ok", "OK");
                dlg.fixLayout();
                dlg.popUp(world);
            },
            */
            download() {
                window.open(window.__crackle__.source, "_blank");
            },

            // dialog to load mod from code
            loadMod(temporary = false) {
                new DialogBoxMorph(
                    this,
                    (input) => {
                        let mod;

                        try {
                            if (temporary) {
                                mod = window.__crackle__.loadMod(input);
                            } else {
                                mod = window.__crackle__.addMod(input);
                            }
                            ide.showMessage(`Addon loaded successfully!`);
                        } catch (e) {
                            ide.showMessage(
                                `Failed to load addon:\n${e}. Check the console for more details.`,
                            );
                            console.log(e);
                        }
                    },
                    this,
                ).promptCode(
                    "Load addon from code",
                    "// Paste your addon code here",
                    world,
                );
            },

            // load mod from file, uses file input
            loadModFile(temporary = false) {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".js,text/javascript,application/javascript";
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        let mod;
                        try {
                            if (temporary) {
                                mod = window.__crackle__.loadMod(e.target.result);
                            } else {
                                mod = window.__crackle__.addMod(e.target.result);
                            }
                            ide.showMessage(`Addon "${mod.NAME}" loaded successfully!`);
                        } catch (e) {
                            ide.showMessage(`Failed to load addon:\n${e}`);
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            },

            // manage loaded mods dialog
            manageLoadedMods() {
                const dlg = new ResizableDialogBoxMorph();
                dlg.key = "manageLoadedMods";
                dlg.labelString = "Manage Loaded Mods";
                dlg.createLabel();

                const list = new CrackleMorph(window.__crackle__, false);
                list.setExtent(new Point(400, 200));
                dlg.bounds.setExtent(new Point(428, 301));
                dlg.handle = new HandleMorph(dlg, 428, 301, dlg.corner, dlg.corner);
                list.setupManager(() => (dlg.destroy(), this.manageLoadedMods()));
                dlg.addBody(list);
                dlg.addButton("ok", "OK");
                dlg.fixLayout();
                dlg.popUp(world);
            },

            // action on click - show mod menu
            action() {
                const menu = new MenuMorph(modButton),
                    world = this.world(),
                    hiddenColor =
                    window.__crackle__.snap.snap == "Split" ?
                    new Color(255, 100, 100) :
                    new Color(100, 0, 0);
                if (IDE_Morph.prototype.ideRender) {
                    menu.bgColor = controlBar.color;
                    IDE_Morph.prototype.ideRender(menu);
                }
                menu.addItem("About Sparkle...", "about");
                //menu.addItem("Sparkle settings...", "settings");
                menu.addItem("Download source...", "download");
                menu.addLine();
                menu.addItem(
                    "Download addons...",
                    () => {
                        new CrackleImportLibraryMorph(this, (code, name) => {
                            window.__crackle__.addMod(code, true);
                            new MenuMorph(
                                null,
                                `"${name}" addon loaded`,
                            ).popUpCenteredInWorld(this.world());
                        });
                    },
                    null,
                    null,
                    true,
                );
                menu.addItem("Load addon from file...", "loadModFile");
                if (window.__crackle__.isDev || world.currentKey === 16) {
                    // shift
                    menu.addLine();
                    menu.addItem(
                        "Load temporary addon from code...",
                        () => modButton.loadMod(true),
                        "load a temporary addon from code" +
                        (window.__crackle__.isDev ? "" : ", mainly for development"),
                        window.__crackle__.isDev ? null : hiddenColor,
                    );
                    menu.addItem(
                        "Load temporary addon from file...",
                        () => modButton.loadModFile(true),
                        "load a temporary addon from file" +
                        (window.__crackle__.isDev ? "" : ", mainly for development"),
                        window.__crackle__.isDev ? null : hiddenColor,
                    );
                }
                menu.addLine();
                menu.addItem("Manage loaded addons...", "manageLoadedMods");

                let menus = {};
                for (let mod of window.__crackle__.loadedMods) {
                    if (mod.DO_MENU && !window.__crackle__.disabledMods[mod.ID]) {
                        menus[mod.NAME] = mod.menu;
                    }
                }

                if (Object.keys(menus).length > 0) {
                    menu.addLine();

                    for (let [title, modMenu] of Object.entries(menus)) {
                        menu.addMenu(title, modMenu);
                    }
                }

                menu.popup(world, modButton.bottomLeft());
            },
        });

        // customize the button appearance
        modButton.children[0].name = "cross";
        modButton.hint = modButton.hint && "Sparkle";

        if (window.__crackle__.snap.snap === "Split") {
            modButton.children[1].text = "Sparkle";
            modButton.children[1].fixLayout();
            modButton.children[2].setLeft(modButton.children[1].right() + 5);
            modButton.setWidth(
                30 + modButton.children.reduce((sum, child) => sum + child.width(), 0),
            );
        }

        controlBar.modButton = modButton;
        const originalUpdateLabel = controlBar.updateLabel;
        controlBar.updateLabel = function() {
            originalUpdateLabel.call(this);
            this.label.setPosition(
                new Point(
                    this.label.left() + BUTTON_OFFSET + this.modButton.width(),
                    this.label.top(),
                ),
            );

            if (window.__crackle__.snap.snap !== "Split") {
                this.label.setExtent(
                    new Point(
                        this.steppingButton.left() - this.modButton.right() - 5 * 2,
                        this.label.children[0].height(),
                    ),
                );

                this.label.children[0].setPosition(this.label.position());
            }
        };
        controlBar.fixLayout = new Proxy(controlBar.fixLayout, {
            apply(target, ctx, args) {
                Reflect.apply(...arguments);
                let btn =
                    window.__crackle__.snap.snap == "Split" ?
                    ctx.editButton :
                    ctx.settingsButton;
                ctx.modButton.setPosition(
                    new Point(btn.right() + BUTTON_OFFSET, btn.top()),
                );
            },
        });
        adjustLabel(controlBar.modButton);
        controlBar.fixLayout();
    };
    IDE_Morph.prototype.toggleAppMode = new Proxy(
        IDE_Morph.prototype.toggleAppMode,
        {
            apply(target, ctx, args) {
                Reflect.apply(...arguments);
                ctx.isAppMode ?
                    ctx.controlBar.modButton.hide() :
                    ctx.controlBar.modButton.show();
            },
        },
    );
    // create mod button

    ide.createModButton();
    ide.createControlBar = new Proxy(ide.createControlBar, {
        apply(target, ctx, args) {
            Reflect.apply(...arguments);
            ctx.createModButton();
        },
    });

    // attach final things
    attachEventHandlers(ide);
    attachMenuHooks(ide);
    await window.__crackle__.autoload.loadAuto(ide);
})();
