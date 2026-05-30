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

function commaOr(...items) {
    if (items.length == 0) return "";
    if (items.length == 1) return items[0];
    if (items.length == 2) return items[0] + " or " + items[1];

    return items.slice(0, -1).join(", ") + " or " + items[items.length - 1];
}

// API for mods
class API {
    constructor(sparkle, mod) {
        this.sparkle = sparkle;
        this.mod = mod;
        this.world = sparkle.world;
        this.ide = sparkle.ide;
    }
    
    setStorage(key, value) {
        let data =
            JSON.parse(localStorage.getItem(`sparkle-${this.mod.ID}`)) || {};
        data[key] = value;
        localStorage.setItem(
            `sparkle-${this.mod.ID}`,
            JSON.stringify(data),
        );
    };

    getStorage(key, defaultValue){
        return (
            (JSON.parse(localStorage.getItem(`sparkle-${this.mod.ID}`)) ||
            {})[key] ?? defaultValue
        );
    }

    //this.showMsg = this.ide.showMessage; showMsg API is removed starting with v0.8.

    addApi(name, obj) {
        API.prototype[name] = obj;
    }

    /*inform(text, title) {
        this.ide.inform(title || "Information", text);
    }*/ // inform API is removed starting with v0.8.

    static OBJ_FUNCS_HOOKS = Symbol("Function Hooks")

    wrapFunction(object, name, callback, type = "after") {
        if (typeof object[name] !== 'function') {
            throw new Error("Not a function or doesn't exist.");
        }

        if (!object[OBJ_FUNCS_HOOKS]) {
            object[OBJ_FUNCS_HOOKS] = new Map();
        }

        let objHooks = object[OBJ_FUNCS_HOOKS]
        let isNew = false;
        if (!objHooks.has(name)) {
            objHooks.set(name, { before: [], instead: null, after: [], original: object[name] })
            isNew = true;
        }

        let hooks = objHooks.get(name)

        if (type == "instead") {
            hooks.instead = callback;
        } else {
            hooks[type].push(callback);
        }

        if (isNew) {
            object[name] = function (...args) {
                const context = {
                    args: args,
                    ret: undefined,
                    cancel: false,
                    target: this
                }

                // BEFORE
                for (const hook of hooks.before) {
                    hook(context);
                    if (context.cancel) return context.ret;
                }

                // INSTEAD / ORIGINAL
                let result;
                if (hooks.instead) {
                    result = hooks.instead(context, hooks.original.bind(context.target));
                } else {
                    result = hooks.original.apply(context.target, context.args);
                }

                if (context.ret === undefined) context.ret = result;

                // AFTER
                for (const hook of hooks.after) {
                    hook(context);
                }

                return context.ret;
            }
        }
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
            this.inform(msg, "Incompatible Snap");
            myself.sparkle.deleteMod(this.mod.ID ?? this.mod.id);
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
        if (names.includes(Sparkle.snap.snap)) {
            let msg = `The addon "${this.mod.NAME}" does not work with ${this.snap.snap}. `;
            this.inform(msg, "Incompatible Snap");
            myself.sparkle.deleteMod(this.mod.ID ?? this.mod.id);
            throw new Error("snap not compatible");
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

    constructor(sparkle) {
        super(); // initialize EventTarget

        this.api = new API(sparkle, this);
        this.sparkle = sparkle;
        this.menuHooks = [];
    }

    setupOptions() {
        if (this.OPTIONS_FORMAT) {
            this.options = JSON.parse(
                localStorage.getItem(`sparkle-${this.ID}-options`),
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
}

class SparkleMorph extends ScrollFrameMorph {
    constructor(sparkle, vertical) {
        super();
        this.sparkle = sparkle;
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
        this.mods.edge = InputFieldMorph.prototype.edge / (Sparkle.snap.snap == "Split" ? 2 : 1);
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
        this.notesField.edge = InputFieldMorph.prototype.edge / (Sparkle.snap.snap == "Split" ? 2 : 1);
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
            const sparkle = myself.sparkle;
            // Show mod information dialog
            const rowHeight = 25;

            const modMorph = new Morph();
            modMorph.setExtent(new Point(400, rowHeight));
            modMorph.setColor(useOdd ? oddColor : evenColor);
            const enableTick = new ToggleMorph(
                "checkbox",
                null,
                () => {
                    if (sparkle.disabledMods[mod.ID]) {
                        sparkle.enableMod(mod.ID);
                    } else {
                        sparkle.disableMod(mod.ID);
                    };
                    enableTick.hint = sparkle.disabledMods[mod.ID] ? "check to enable" : "check to disable";
                },
                null,
                () => !sparkle.disabledMods[mod.ID],
                null,
                sparkle.disabledMods[mod.ID] ? "check to enable" : "check to disable"
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
                    if (sparkle.isAutoloaded(mod.ID)) {
                        sparkle.deleteAutoload(mod.ID);
                        world.children[0].showMessage(
                            `${mod.NAME} will no longer run on startup again.`,
                        );
                    } else {
                        sparkle.addAutoload(mod.ID);
                        world.children[0].showMessage(
                            `${mod.NAME} will now run every time you open ${Sparkle.snap.snap}!`,
                        );
                    }
                    autoloadButton.labelString = sparkle.isAutoloaded(mod.ID) ?
                        "Un-autoload" :
                        "Autoload";
                    autoloadButton.createLabel();
                    autoloadButton.fixLayout();
                    modMorph.fixLayout();
                },
                sparkle.isAutoloaded(mod.ID) ? "Un-autoload" : "Autoload",
            );
            autoloadButton.setColor(new Color(250, 250, 100));
            if (sparkle.isDev) {
                modMorph.addChild(autoloadButton);
            }
            modMorph.autoloadButton = autoloadButton;

            const optionsButton = new PushButtonMorph(
                this,
                () => {
                    myself.sparkle.showModOptions(mod);
                },
                "Options",
            );

            optionsButton.setColor(new Color(163, 135, 252));
            modMorph.addChild(optionsButton);
            modMorph.optionsButton = optionsButton;

            const deleteButton = new PushButtonMorph(
                this,
                () => {
                    sparkle.deleteMod(mod.ID);
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
                    (sparkle.isDev && this.autoloadButton.isVisible ? this.autoloadButton : this.optionsButton).left() - 3,
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
        for (const mod of this.sparkle.loadedMods) {
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
    buildSettings() {
        if (this.settings) {
            this.settings.destroy();
        }
        this.settings = new AlignmentMorph("column", 5);
        const autoload = new ToggleMorph(
            "checkbox",
            null,
            () => this.sparkle.toggleDev(), // action,
            "Developer Mode", // label
            () => this.sparkle.isDev, //query
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
        this.sparkle.saveModOptions(this.mod);
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

// I import mods from Mojavesoft-Group/SparkleAddons
class SparkleImportLibraryMorph extends DialogBoxMorph {
    constructor(environment, action, sparkle) {
        super(environment, action);
        this.container = new SparkleMorph(sparkle, false);
        this.tab = "import"; // for vertical
        this.path =
            sparkle.addonRepoPath;
        this.labelString = "Import Addon";
        this.key = "sparkle import mods";
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

class VerticalSparkleDialogMorph extends SparkleImportLibraryMorph {
    constructor(environment, action, sparkle) {
        super(environment, action, sparkle);
        this.sparkle = sparkle;
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
        this.container = new SparkleMorph(this.sparkle, true);
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
        SparkleImportLibraryMorph.prototype.buildContents.call(this);
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
        SparkleImportLibraryMorph.prototype.popUp.call(this, world);
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
            Sparkle.snap.snap === "Split" ?
                this.buttons.setRight(this.right() - this.padding) :
                this.buttons.setCenter(this.center());
            this.buttons.setBottom(this.bottom() - this.padding);
        }

        this.removeShadow();
        this.addShadow();
    }
}

class Sparkle {
    /**
     * Global instance of Sparkle.
     */
    static instance;

    /**
     * `opts` can have:
     *  * preloadAddons -> list of objects, with a "type" property
     *    being either "code" or "url", with a "content" property
     *    being that code or url.
     */
    constructor(opts) {
        this.opts = opts;

        this.world = null;
        this.ide = null;
        this.controlBar = null;
        this.isDev = false;
        this.currentMenu = null;

        this.loadedMods = [];
        this.extraApi = {};
        this.disabledMods = {};
        this.autoloadMods = {};
        this.modCodes = {};
        this.allEventTargets = {};
        this.wrappedFunctions = new Map();

        Sparkle.instance = this;
    }

    static version = "0.5";
    static source = "https://github.com/Mojavesoft-Group/sparkle/releases";
    loadedMods;
    extraApi;
    disabledMods;
    autoloadMods;
    modCodes;
    allEventTargets;
    wrappedFunctions;
    static sparkleSymbol = Symbol("Sparkle Data");

    static snap = (function() {
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
    })();

    /**
     * load a mod from code, TEMPORARY. use addMod for loading normal mods from the menu or download.
     */
    loadMod(code) {
        let mod = new(Function(code)())(this);

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
                mod.main();
            }
        } catch (e) {
            this.ide.showMessage(
                `Failed to load addon:\n${e}. Check the console for more details.`,
            );
            console.error(e);
        }
        return mod;
    };

    /**
     * load a mod and save it across runs
     */
    addMod(code) {
        const mod = this.loadMod(code);
        this.addAutoload(mod.ID);
        return mod;
    };

    preloadMod(code) {
        if (!code) {
            return;
        }
        const mod = this.loadMod(code);
        mod.preloaded = true;
        return mod;
    };

    // Delete a mod by its ID
    deleteMod(id) {
        let mod = this.findModById(id);
        if (mod.cleanupFunc && !this.disabledMods[id]) mod.cleanupFunc();

        this.loadedMods = this.loadedMods.filter(
            (mod) => mod.ID != id,
        );

        this.removeModAttachments(id)

        delete this.disabledMods[id];

        // remove autoload
        delete this.modCodes[id];
        if (!isNil(this.autoloadMods[id])) {
            this.deleteAutoload(id);
        }

        // remove settings
        localStorage.removeItem(`sparkle-${id}-options`);
    };

    removeModAttachments(id) {
        // remove wraps
        this.wrappedFunctions.forEach((value, key) => {
            if (value.functions[id]) {
                delete value.functions[id];
                value.overwrites = value.overwrites.filter((modId) => modId != id);
                if (value.overwrites.length == 0 && Object.keys(value.functions).length == 0) {
                    thiswrappedFunctions.delete(key);
                }
            }
        });
        if (id in this.allEventTargets) {
            delete this.allEventTargets[id];
        }
    };

    enableMod(id) {
        const mod = this.findModById(id);
        this.disabledMods[id] = false;
        this.saveDisabled();
        if (mod.DO_MENU) mod.menu = new MenuMorph();
        mod.main();
    };

    disableMod(id) {
        const mod = this.findModById(id);
        this.disabledMods[id] = true;
        this.saveDisabled();
        mod.cleanupFunc && mod.cleanupFunc();
        this.removeModAttachments(id);
    };

    saveDisabled() {
        localStorage.setItem("sparkle_disabled_mods", JSON.stringify(this.disabledMods));
    };

    loadDisabled() {
        this.disabledMods = JSON.parse(localStorage.getItem("sparkle_disabled_mods") || "{}");
    };

    loadAutoload() {
        let data = localStorage.getItem("sparkle_autoload_mods");
        if (!data) {
            localStorage.setItem("sparkle_autoload_mods", "{}");
            return {};
        }

        try {
            return JSON.parse(data) || {};
        } catch {
            return {}
        }
    };

    saveAutoload() {
        localStorage.setItem(
            "sparkle_autoload_mods",
            JSON.stringify(this.autoloadMods),
        );
    };

    addAutoload(id) {
        this.autoloadMods[id] = this.modCodes[id];
        this.saveAutoload();
    };

    deleteAutoload(id) {
        delete this.autoloadMods[id];
        this.saveAutoload();
    };

    isAutoloaded(id) {
        return !!this.autoloadMods[id];
    };

    async loadAuto() {
        this.autoloadMods = this.loadAutoload();
        this.loadDisabled();

        for (const id of Object.keys(this.autoloadMods)) {
            const mod = this.autoloadMods[id];
            try {
                // TODO: optional fetching of mods
                this.loadMod(mod, true);
            } catch (e) {
                this.ide.showMessage(
                    "Failed to autoload addon, check console for more info",
                );

                console.log("Failed to load addon: ", mod, e); // Make this console.log in order to stop a scary "Errors" button from showing up on Chrome
            }
        }
    };
    
    toggleDev() {
        this.isDev = !this.isDev;
        this.saveSettings();
    };

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem("sparkle_settings") || "{}");
        this.isDev = settings.isDev !== false;
    };

    saveSettings() {
        localStorage.setItem(
            "sparkle_settings",
            JSON.stringify({
                isDev: this.isDev,
            }),
        );
    };

    showModOptions(mod) {
        const dlg = new DialogBoxMorph(),
            modMorph = new SparkleMorph(this, false);

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
        dlg.fixLayout();
    };

    saveModOptions(mod) {
        localStorage.setItem(
            `sparkle-${mod.ID}-options`,
            JSON.stringify(mod.options),
        );
    };

    /**
     * Returns a Promise which is resolved when the Snap! world and IDE
     * is created.
     */
    waitForSnapReady() {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (typeof world !== "undefined" && world.children.length > 0) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Load addons from opts.preloadAddons.
     */
    preloadAddons() {
        for (let addon of this.opts.preloadAddons) {
            if (addon.type == "code") {
                this.preloadAddons(addon.content);
            } else if (addon.type == "url") {
                fetch(addon.content).then((x) =>
                {
                    if (!x.ok) {
                        return "";
                    };
                    return x.text();
                }).then((code) => {
                    this.preloadMod(code);
                })
            }
        }
    }

    /**
     * Attach menu hooks for mods.
     * @param {*} ide 
     */
    attachMenuHooks() {
        let myself = this;

        function applyHooks(menu, name) {
            myself.loadedMods.forEach((mod) => {
                if (myself.disabledMods[mod.ID]) {
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
                    if (MenuMorph.__currentMenu)
                        applyHooks(ctx, MenuMorph.__currentMenu);
                }
                return Reflect.apply(...arguments);
            },
        });

        // projectMenu
        IDE_Morph.prototype.projectMenu = new Proxy(
            IDE_Morph.prototype.projectMenu,
            {
                apply(target, ctx, args) {
                    MenuMorph.__currentMenu = "projectMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    MenuMorph.__currentMenu = null;
                },
            },
        );

        // settingsMenu
        IDE_Morph.prototype.settingsMenu = new Proxy(
            IDE_Morph.prototype.settingsMenu,
            {
                apply(target, ctx, args) {
                    MenuMorph.__currentMenu = "settingsMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    MenuMorph.__currentMenu = null;
                },
            },
        );

        // cloudMenu (or userMenu, in Snavanced)
        if (IDE_Morph.prototype.userMenu) {
            IDE_Morph.prototype.userMenu = new Proxy(IDE_Morph.prototype.userMenu, {
                apply(target, ctx, args) {
                    MenuMorph.__currentMenu = "cloudMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    MenuMorph.__currentMenu = null;
                },
            });
        }
        if (IDE_Morph.prototype.cloudMenu) {
            IDE_Morph.prototype.cloudMenu = new Proxy(IDE_Morph.prototype.cloudMenu, {
                apply(target, ctx, args) {
                    MenuMorph.__currentMenu = "cloudMenu";
                    Reflect.apply(...arguments); // This calls the original function
                    MenuMorph.__currentMenu = null;
                },
            });
        }

        // snapMenu
        IDE_Morph.prototype.snapMenu = new Proxy(IDE_Morph.prototype.snapMenu, {
            apply(target, ctx, args) {
                MenuMorph.__currentMenu = "snapMenu";
                Reflect.apply(...arguments); // This calls the original function
                MenuMorph.__currentMenu = null;
            },
        });

        // scriptsMenu
        ScriptsMorph.prototype.userMenu = new Proxy(
            ScriptsMorph.prototype.userMenu,
            {
                apply(target, ctx, args) {
                    MenuMorph.__currentMenu = "scriptsMenu";
                    let menu = Reflect.apply(target, ctx, args); // This calls the original function
                    MenuMorph.__currentMenu = null;
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

    /**
     * Attach event handlers for mods
     * @param {*} ide 
     */
    attachEventHandlers() {
        // projectCreating and projectCreated
        let myself = this;

        // this.backup tells the user about unsaved changes,
        // so we need to manually modify it here so the event
        // only gets called when backup actually calls the
        // callback
        this.ide.createNewProject = function() {
            this.backup(() => {
                if (
                    myself.dispatchModEvent(new Event("projectCreating", {
                        cancelable: true
                    }))
                ) {
                    this.newProject();

                    myself.dispatchModEvent(new Event("projectCreated"));
                }
            });
        };

        // categoryCreating and categoryCreated
        IDE_Morph.prototype.addPaletteCategory = new Proxy(
            IDE_Morph.prototype.addPaletteCategory,
            {
                apply(target, ctx, args) {
                    if (
                        myself.dispatchModEvent(
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

                        myself.dispatchModEvent(
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

    static BUTTON_OFFSET = 5; // pixels between buttons
    
    async main() {
        let myself = this;

        await this.waitForSnapReady();
        this.world = window.world;
        this.ide = world.children[0];
        this.controlBar = this.ide.controlBar;
        this.loadSettings();

        // adjust the project label position to be after the mod button
        // this is needed because the fixLayout for the IDE doesn't know
        // about our new button, so it puts it after the normal place
        function adjustLabel(modButton) {
            myself.controlBar.label.setPosition(
                new Point(
                    myself.controlBar.label.left() + Sparkle.BUTTON_OFFSET + modButton.width(),
                    myself.controlBar.label.top(),
                ),
            );
            myself.controlBar.label.children[0].setPosition(myself.controlBar.label.position());
        }

        // create mod button
        IDE_Morph.prototype.createModButton = function() {
            const controlBar = this.controlBar;
            let myself = this;

            let modButton;
            if (controlBar.modButton) {
                controlBar.modButton.destroy();
            }

            if (
                Sparkle.snap.snap == "Split" ||
                Sparkle.snap.snap
            ) {
                modButton = controlBar.settingsButton.fullCopy();
                controlBar.modButton = modButton;
                controlBar.addChild(modButton);
            }

            // add functionality to mod button
            Object.assign(modButton, {
                sparkle: this.sparkle,

                about() {
                    // show the dialog. soon after the image will load and update
                    // the dialog with it.
                    let dlg = new DialogBoxMorph();
                    dlg.inform(
                        "About Sparkle",
                        `Sparkle, a modding framework for Snap! and its forks\n` +
                        `Developed by codingisfun2831t and d016\n` +
                        `Inspired by tethrarxitet and orchestrated by PPPDUD\n` +
                        `Version ${Sparkle.version}\n`,
                        world,
                    );
                },
                settings() {
                    const dlg = new DialogBoxMorph(),
                        body = new SparkleMorph(this.sparkle, false);
                    body.setupSettings();

                    dlg.key = "settings";
                    dlg.labelString = "Sparkle settings";
                    dlg.createLabel();
                    dlg.addBody(body);
                    dlg.addButton("ok", "OK");
                    dlg.fixLayout();
                    dlg.popUp(world);
                },
                download() {
                    window.open(Sparkle.source, "_blank");
                },

                // dialog to load mod from code
                loadMod(temporary = false) {
                    new DialogBoxMorph(
                        this,
                        (input) => {
                            let mod;

                            try {
                                if (temporary) {
                                    mod = this.sparkle.loadMod(input);
                                } else {
                                    mod = this.sparkle.addMod(input);
                                }
                                myself.showMessage(`Addon loaded successfully!`);
                            } catch (e) {
                                myself.showMessage(
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
                                    mod = this.sparkle.loadMod(e.target.result);
                                } else {
                                    mod = this.sparkle.addMod(e.target.result);
                                }
                                myself.showMessage(`Addon "${mod.NAME}" loaded successfully!`);
                            } catch (e) {
                                myself.showMessage(`Failed to load addon:\n${e}`);
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

                    const list = new SparkleMorph(this.sparkle, false);
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
                        Sparkle.snap.snap == "Split" ?
                        new Color(255, 100, 100) :
                        new Color(100, 0, 0);
                    if (IDE_Morph.prototype.ideRender) {
                        menu.bgColor = IDE_Morph.prototype.getControlBarColor();
                        IDE_Morph.prototype.ideRender(menu);
                    }
                    menu.addItem("About Sparkle...", "about");
                    menu.addItem("Sparkle settings...", "settings");
                    menu.addItem("Download source...", "download");
                    menu.addLine();
                    menu.addItem(
                        "Download addons...",
                        () => {
                            new SparkleImportLibraryMorph(this, (code, name) => {
                                this.sparkle.addMod(code, true);
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
                    if (this.sparkle.isDev || world.currentKey === 16) {
                        // shift
                        menu.addLine();
                        menu.addItem(
                            "Load temporary addon from code...",
                            () => modButton.loadMod(true),
                            "load a temporary addon from code" +
                            (this.sparkle.isDev ? "" : ", mainly for development"),
                            this.sparkle.isDev ? null : hiddenColor,
                        );
                        menu.addItem(
                            "Load temporary addon from file...",
                            () => modButton.loadModFile(true),
                            "load a temporary addon from file" +
                            (this.sparkle.isDev ? "" : ", mainly for development"),
                            this.sparkle.isDev ? null : hiddenColor,
                        );
                    }
                    menu.addLine();
                    menu.addItem("Manage loaded addons...", "manageLoadedMods");

                    let menus = {};
                    for (let mod of this.sparkle.loadedMods) {
                        if (mod.DO_MENU && !this.sparkle.disabledMods[mod.ID]) {
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

            if (Sparkle.snap.snap === "Split") {
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
                        this.label.left() + Sparkle.BUTTON_OFFSET + this.modButton.width(),
                        this.label.top(),
                    ),
                );

                if (Sparkle.snap.snap !== "Split") {
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
                        Sparkle.snap.snap == "Split" ?
                        ctx.editButton :
                        ctx.settingsButton;
                    ctx.modButton.setPosition(
                        new Point(btn.right() + Sparkle.BUTTON_OFFSET, btn.top()),
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

        this.ide.sparkle = this;
        this.ide.createModButton();
        this.ide.createControlBar = new Proxy(this.ide.createControlBar, {
            apply(target, ctx, args) {
                Reflect.apply(...arguments);
                ctx.createModButton();
            },
        });

        // attach final things
        this.attachEventHandlers();
        this.attachMenuHooks();
        await this.loadAuto();
    }

    findModById(id) {
        return this.loadedMods.find((mod) => mod.ID == id);
    }

    dispatchModEvent(event) {
        let ret = true;
        for (const mod of this.loadedMods) {
            ret = ret && mod.dispatchEvent(event);
        }

        Object.values(this.allEventTargets).forEach((element) =>
            element.dispatchEvent(event),
        );

        return ret;
    }
}
