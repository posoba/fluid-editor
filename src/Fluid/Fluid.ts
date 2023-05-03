import { type Game } from "../Game";

import {
    createFramebuffers,
    createPrograms,
    createRenderer,
    getTextureWidthAndHeight,
    type IDoubleFrameBufferObject,
} from "./fluidUtils";
import { type GLProgram } from "./GLProgram";

export interface ISplat {
    x: number;
    y: number;
    dx: number;
    dy: number;
    moved: boolean;
    down: boolean;
    emitTime: number;
    color: [r: number, g: number, b: number];
}

interface IFluidConfig {
    densityDissipation: number;
    velocityDissipation: number;
    pressureDissipation: number;
    pressureIterations: number;
    curl: number;
    splatRadius: number;
}

const defaultConfig: IFluidConfig = {
    densityDissipation: 0.98,
    velocityDissipation: 0.99,
    pressureDissipation: 0.8,
    pressureIterations: 25,
    curl: 30,
    splatRadius: 0.0015,
};

export class Fluid {
    public readonly config: IFluidConfig;

    private readonly game: Game;
    private readonly canvas: HTMLCanvasElement;
    private readonly gl: WebGL2RenderingContext;
    private readonly programs: Record<string, GLProgram>;
    private readonly framebuffers: Record<string, IDoubleFrameBufferObject>;
    private readonly mouseSplat: ISplat;

    private splats: ISplat[];
    private textureWidth: number;
    private textureHeight: number;

    public constructor(game: Game, config?: Partial<IFluidConfig>) {
        this.game = game;
        this.config = { ...defaultConfig, ...config };
        const { canvas, gl } = createRenderer();
        this.canvas = canvas;
        this.gl = gl;
        this.programs = createPrograms(gl);
        this.textureHeight = 0;
        this.textureWidth = 0;
        this.framebuffers = {};
        this.mouseSplat = this.makeSplat();
        this.splats = [];

        document.body.appendChild(this.canvas);
        this.setListeners();
    }

    public reset(): void {
        this.initFramebuffers();
        this.splats = [];
    }

    public async emitSplats(splats: ISplat[], emitTime = 3000, waitTime = 3000): Promise<void> {
        this.splats = splats;

        await this.game.tweenRunner.create(emitTime, (progress: number) => {
            splats.forEach(splat => {
                if (progress < splat.emitTime) {
                    splat.moved = true;
                }
            });
        });
        await this.game.tweenRunner.create(waitTime, () => {});
    }

    public makeSplat(): ISplat {
        return {
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
            emitTime: 1,
            moved: false,
            down: false,
            color: [0, 0, 0],
        };
    }

    public timestep(dt: number): void {
        this.update(dt);
    }

    private resizeCanvas(): void {
        const { canvas } = this;
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            const { textureWidth, textureHeight } = getTextureWidthAndHeight(this.gl);
            this.textureWidth = textureWidth;
            this.textureHeight = textureHeight;
            this.initFramebuffers();
        }
    }

    private initFramebuffers(): void {
        Object.assign(this.framebuffers, createFramebuffers(this.gl, this.textureWidth, this.textureHeight));
    }

    private blit(destination: WebGLFramebuffer | null): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    private splat(x: number, y: number, dx: number, dy: number, color: number[]) {
        const { gl, programs, canvas, framebuffers: fb } = this;
        const { splat } = programs;
        splat.bind();
        gl.uniform1i(splat.uniforms.uTarget, fb.velocity.read.textId);
        gl.uniform1f(splat.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splat.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
        gl.uniform3f(splat.uniforms.color, dx, -dy, 1.0);
        gl.uniform1f(splat.uniforms.radius, this.config.splatRadius);
        this.blit(fb.velocity.write.framebuffer);
        fb.velocity.swap();

        gl.uniform1i(splat.uniforms.uTarget, fb.density.read.textId);
        gl.uniform3f(splat.uniforms.color, color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
        this.blit(fb.density.write.framebuffer);
        fb.density.swap();
    }

    private update(dt: number): void {
        const { gl, textureWidth, textureHeight, programs, framebuffers: fb, mouseSplat } = this;
        this.resizeCanvas();
        gl.viewport(0, 0, textureWidth, textureHeight);

        programs.advection.bind();
        gl.uniform2f(programs.advection.uniforms.texelSize, fb.velocity.read.width, fb.velocity.read.height);
        gl.uniform1i(programs.advection.uniforms.uVelocity, fb.velocity.read.textId);
        gl.uniform1i(programs.advection.uniforms.uSource, fb.velocity.read.textId);
        gl.uniform1f(programs.advection.uniforms.dt, dt);
        gl.uniform1f(programs.advection.uniforms.dissipation, this.config.velocityDissipation);
        this.blit(fb.velocity.write.framebuffer);
        fb.velocity.swap();

        gl.uniform1i(programs.advection.uniforms.uVelocity, fb.velocity.read.textId);
        gl.uniform1i(programs.advection.uniforms.uSource, fb.density.read.textId);
        gl.uniform1f(programs.advection.uniforms.dissipation, this.config.densityDissipation);
        this.blit(fb.density.write.framebuffer);
        fb.density.swap();

        if (mouseSplat.moved) {
            mouseSplat.moved = false;
            this.splat(mouseSplat.x, mouseSplat.y, mouseSplat.dx, mouseSplat.dy, mouseSplat.color);
        }

        this.splats.forEach(splat => {
            if (splat.moved) {
                splat.moved = false;
                this.splat(splat.x, splat.y, splat.dx, splat.dy, splat.color);
            }
        });

        programs.curl.bind();
        gl.uniform2f(programs.curl.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(programs.curl.uniforms.uVelocity, fb.velocity.read.textId);
        this.blit(fb.curl.read.framebuffer);

        programs.vorticity.bind();
        gl.uniform2f(programs.vorticity.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(programs.vorticity.uniforms.uVelocity, fb.velocity.read.textId);
        gl.uniform1i(programs.vorticity.uniforms.uCurl, fb.curl.read.textId);
        gl.uniform1f(programs.vorticity.uniforms.curl, this.config.curl);
        gl.uniform1f(programs.vorticity.uniforms.dt, dt);
        this.blit(fb.velocity.write.framebuffer);
        fb.velocity.swap();

        programs.divergence.bind();
        gl.uniform2f(programs.divergence.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(programs.divergence.uniforms.uVelocity, fb.velocity.read.textId);
        this.blit(fb.divergence.read.framebuffer);

        programs.clear.bind();
        gl.bindTexture(gl.TEXTURE_2D, fb.pressure.read.texture);
        gl.uniform1i(programs.clear.uniforms.uTexture, fb.pressure.read.textId);
        gl.uniform1f(programs.clear.uniforms.value, this.config.pressureDissipation);
        this.blit(fb.pressure.write.framebuffer);
        fb.pressure.swap();

        programs.pressure.bind();
        gl.uniform2f(programs.pressure.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(programs.pressure.uniforms.uDivergence, fb.divergence.read.textId);
        gl.uniform1i(programs.pressure.uniforms.uPressure, fb.pressure.read.textId);
        for (let i = 0; i < this.config.pressureIterations; i++) {
            gl.bindTexture(gl.TEXTURE_2D, fb.pressure.read.texture);
            this.blit(fb.pressure.write.framebuffer);
            fb.pressure.swap();
        }

        programs.gradienSubtract.bind();
        gl.uniform2f(programs.gradienSubtract.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(programs.gradienSubtract.uniforms.uPressure, fb.pressure.read.textId);
        gl.uniform1i(programs.gradienSubtract.uniforms.uVelocity, fb.velocity.read.textId);
        this.blit(fb.velocity.write.framebuffer);
        fb.velocity.swap();

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        programs.display.bind();
        gl.uniform1i(programs.display.uniforms.uTexture, fb.density.read.textId);
        this.blit(null);
    }

    private setListeners(): void {
        const { canvas, mouseSplat } = this;
        canvas.addEventListener("mousemove", e => {
            mouseSplat.moved = mouseSplat.down;
            mouseSplat.dx = (e.offsetX - mouseSplat.x) * 10.0;
            mouseSplat.dy = (e.offsetY - mouseSplat.y) * 10.0;
            mouseSplat.x = e.offsetX;
            mouseSplat.y = e.offsetY;
        });

        canvas.addEventListener("mousedown", () => {
            mouseSplat.down = true;
            mouseSplat.color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2];
        });

        window.addEventListener("mouseup", () => {
            mouseSplat.down = false;
        });
    }
}
