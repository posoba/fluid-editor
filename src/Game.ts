import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";

import { TweenRunner } from "./Tween";
import { Fluid, type ISplat } from "./Fluid";

export class Game {
    public readonly tweenRunner: TweenRunner;
    public gui: Pane;
    public readonly fluid: Fluid;

    private fpsGraph!: EssentialsPlugin.FpsGraphBladeApi;
    private lastTime: number;
    private splats: ISplat[];
    private splatsCounter: number;
    private resetCounter: number;
    private config: {
        emitTime: number;
        waitTime: number;
        resetBeforeNextEmit: false;
        FPS: number;
    };

    public constructor() {
        this.config = {
            emitTime: 3000,
            waitTime: 1000,
            resetBeforeNextEmit: false,
            FPS: 60,
        };
        this.lastTime = performance.now();
        this.splats = [];
        this.splatsCounter = 0;
        this.resetCounter = 0;

        this.tweenRunner = new TweenRunner();
        this.fluid = new Fluid(this);
        this.gui = this.makeGUI();

        const startSplat1 = this.fluid.makeSplat();
        startSplat1.x = Math.round(0.2 * window.innerWidth);
        startSplat1.y = Math.round(0.9 * window.innerHeight);
        startSplat1.dx = 150;
        startSplat1.dy = -150;
        startSplat1.color = [1, 0, 0];
        this.splats.push(startSplat1);
        this.addSplatFolder(startSplat1);

        const startSplat2 = this.fluid.makeSplat();
        startSplat2.x = Math.round(0.8 * window.innerWidth);
        startSplat2.y = startSplat1.y;
        startSplat2.dx = -startSplat1.dx;
        startSplat2.dy = startSplat1.dy;
        startSplat2.color = [0, 1, 0];
        this.splats.push(startSplat2);
        this.addSplatFolder(startSplat2);

        this.reset();
        this.update();
    }

    private addSplat(): ISplat {
        const splat = this.fluid.makeSplat();
        splat.x = Math.round(window.innerWidth * (0.25 + Math.random() * 0.5));
        splat.y = Math.round(window.innerHeight * (0.25 + Math.random() * 0.5));
        splat.dx = Math.round(-100 + Math.random() * 100);
        splat.dy = Math.round(-100 + Math.random() * 100);
        splat.color = [Math.random(), Math.random(), Math.random()];

        this.addSplatFolder(splat);
        this.splats.push(splat);
        this.reset();
        return splat;
    }

    private addSplatFolder(splat: ISplat) {
        this.splatsCounter++;
        const xShift = window.innerWidth / 2;
        const yShift = window.innerHeight / 2;
        const settings = {
            Color: { r: splat.color[0] * 255, g: splat.color[1] * 255, b: splat.color[2] * 255 },
            Position: { x: splat.x - xShift, y: splat.y - yShift },
            Strength: { x: splat.dx, y: splat.dy },
        };

        const folder = this.gui.addFolder({ title: "Splat " + this.splatsCounter });
        folder
            .addInput(settings, "Position", {
                x: { min: -xShift, max: xShift },
                y: { min: -yShift, max: yShift },
            })
            .on("change", () => {
                splat.x = settings.Position.x + xShift;
                splat.y = settings.Position.y + yShift;
            });

        folder
            .addInput(settings, "Strength", {
                x: { min: -500, max: 500 },
                y: { min: -500, max: 500 },
            })
            .on("change", () => {
                splat.dx = settings.Strength.x;
                splat.dy = settings.Strength.y;
            });
        folder.addInput(splat, "emitRange", { min: 0, max: 1, label: "Emit range" });
        folder.addInput(settings, "Color", { view: "color" }).on("change", () => {
            splat.color[0] = settings.Color.r / 255;
            splat.color[1] = settings.Color.g / 255;
            splat.color[2] = settings.Color.b / 255;
        });
        folder.addButton({ title: "Remove splat" }).on("click", () => {
            this.splats = this.splats.filter(el => el !== splat);
            folder.dispose();
            this.reset();
        });
    }

    private reset(): void {
        this.resetCounter++;
        this.fluid.reset();
        this.runSplats();
    }

    private async runSplats(): Promise<void> {
        if (this.config.resetBeforeNextEmit) {
            this.resetCounter++;
            this.fluid.reset();
        }
        const currentResetCounter = this.resetCounter;
        await this.fluid.emitSplats(this.splats, this.config.emitTime, this.config.waitTime);
        if (currentResetCounter === this.resetCounter) {
            this.runSplats();
        }
    }

    private update = (): void => {
        this.fpsGraph.begin();
        const now = performance.now();
        const delatMS = Math.min(16, now - this.lastTime);
        const dt = delatMS / 1000;
        this.config.FPS = Math.round(1000 / delatMS);
        this.tweenRunner.timestep(delatMS);
        this.lastTime = now;
        this.fluid.timestep(dt);

        this.fpsGraph.end();
        requestAnimationFrame(this.update);
    };

    private makeGUI(): Pane {
        const gui = new Pane({ expanded: true });
        gui.registerPlugin(EssentialsPlugin);

        const settings = gui.addFolder({ title: "Settings" });
        gui.addButton({ title: "Add splat" }).on("click", () => this.addSplat());

        const config = this.fluid.config;
        this.fpsGraph = settings.addBlade({
            view: "fpsgraph",
            label: "Performance",
            lineCount: 2,
            min: 0,
            max: 130,
        }) as EssentialsPlugin.FpsGraphBladeApi;
        settings.addInput(config, "densityDissipation", { min: 0.9, max: 1, label: "Dissipation" });
        settings.addInput(config, "velocityDissipation", { min: 0.9, max: 1, label: "Velocity" });
        settings.addInput(config, "pressureDissipation", { min: 0, max: 1, label: "Pressure" });
        settings.addInput(config, "pressureIterations", { min: 0, max: 50, label: "Pressure iterations", step: 1 });
        settings.addInput(config, "curl", { min: 0, max: 50, label: "Curl" });
        settings.addInput(config, "splatRadius", { min: 0.0001, max: 0.02, label: "Splat radius" });
        settings.addInput(this.config, "emitTime", { min: 0, max: 5000, label: "Emit time", step: 10 });
        settings.addInput(this.config, "waitTime", { min: 0, max: 5000, label: "Wait time", step: 10 });
        settings.addInput(this.config, "resetBeforeNextEmit", { label: "Reset before next emit" });
        settings.addButton({ title: "Reset" }).on("click", () => this.reset());
        settings.addButton({ title: "Save" }).on("click", () => this.save());
        settings.addButton({ title: "Load" }).on("click", () => this.load());
        return gui;
    }

    private save(): void {
        const data = {
            config: this.fluid.config,
            splats: this.splats,
            emitTime: this.config.emitTime,
            waitTime: this.config.waitTime,
            resetBeforeNextEmit: this.config.resetBeforeNextEmit,
        };

        const anchor = document.createElement("a");
        anchor.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data)));
        anchor.setAttribute("download", "fluid.json");
        anchor.click();
    }

    private load(): void {
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("multiple", "false");
        input.setAttribute("accept", ".json");

        input.click();
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (file) {
                try {
                    const json = await file.text();
                    const data = JSON.parse(json);
                    this.splats = data.splats;
                    Object.assign(this.fluid.config, data.config);
                    this.config.emitTime = data.emitTime;
                    this.config.waitTime = data.waitTime;
                    this.resetCounter = 0;
                    this.splatsCounter = 0;
                    this.config.resetBeforeNextEmit = data.resetBeforeNextEmit;
                    this.gui.dispose();
                    this.gui = this.makeGUI();
                    this.splats.forEach(splat => this.addSplatFolder(splat));
                    this.reset();
                } catch (e) {
                    console.log(e);
                }
            }
        });
    }
}
