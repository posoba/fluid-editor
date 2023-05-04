import GUI from "lil-gui";

import { TweenRunner } from "./Tween";
import { Fluid, type ISplat } from "./Fluid";

export class Game {
    public readonly tweenRunner: TweenRunner;
    public gui: GUI;
    public readonly fluid: Fluid;

    private lastTime: number;
    private splats: ISplat[];
    private splatsCounter: number;
    private resetCounter: number;
    private resetBeforeNextEmit: boolean;

    private emitTime: number;
    private waitTime: number;

    public constructor() {
        this.emitTime = 3000;
        this.waitTime = 1000;
        this.lastTime = Date.now();
        this.splats = [];
        this.splatsCounter = 0;
        this.resetCounter = 0;
        this.resetBeforeNextEmit = false;

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
        const folder = this.gui.addFolder("Splat " + this.splatsCounter);
        folder.add(splat, "x");
        folder.add(splat, "y");
        folder.add(splat, "dx", -300, 300);
        folder.add(splat, "dy", -300, 300);
        folder.add(splat, "emitTime", 0, 1);
        folder.addColor(splat, "color", 1);

        const settings = {
            remove: () => {
                this.splats = this.splats.filter(el => el !== splat);
                this.reset();
                folder.destroy();
            },
        };

        folder.add(settings, "remove");
    }

    private reset = (): void => {
        this.resetCounter++;
        this.fluid.reset();
        this.runSplats();
    };

    private async runSplats(): Promise<void> {
        if (this.resetBeforeNextEmit) {
            this.reset();
        }
        const currentResetCounter = this.resetCounter;
        await this.fluid.emitSplats(this.splats, this.emitTime, this.waitTime);
        if (currentResetCounter === this.resetCounter) {
            this.runSplats();
        }
    }

    private update = (): void => {
        const now = Date.now();
        const delatMS = Math.min(now - this.lastTime, 16);
        const dt = delatMS / 1000;
        this.tweenRunner.timestep(delatMS);
        this.lastTime = now;
        this.fluid.timestep(dt);

        requestAnimationFrame(this.update);
    };

    private makeGUI(): GUI {
        const gui = new GUI();
        const config = this.fluid.config;
        gui.add(config, "densityDissipation", 0.8, 1.1);
        gui.add(config, "velocityDissipation", 0.8, 1.1);
        gui.add(config, "pressureDissipation", 0, 1.1);
        gui.add(config, "pressureIterations", 0, 50);
        gui.add(config, "curl", 0, 50);
        gui.add(config, "splatRadius", 0.0001, 0.02);
        gui.add(this, "emitTime", 0, 5000);
        gui.add(this, "waitTime", 0, 5000);
        gui.add(this, "resetBeforeNextEmit");
        gui.add(this, "reset");
        gui.add(this, "addSplat");
        gui.add(this, "save");
        gui.add(this, "load");
        return gui;
    }

    private save(): void {
        const data = {
            config: this.fluid.config,
            splats: this.splats,
            emitTime: this.emitTime,
            waitTime: this.waitTime,
            resetBeforeNextEmit: this.resetBeforeNextEmit,
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
                    this.emitTime = data.emitTime;
                    this.waitTime = data.waitTime;
                    this.resetCounter = 0;
                    this.splatsCounter = 0;
                    this.resetBeforeNextEmit = data.resetBeforeNextEmit;
                    this.gui.destroy();
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
