/* eslint-disable no-bitwise */
import { GLProgram } from "./GLProgram";

import advectionGLSL from "./shaders/advection.glsl";
import baseVertexGLSL from "./shaders/baseVertex.glsl";
import clearGLSL from "./shaders/clear.glsl";
import curlGLSL from "./shaders/curl.glsl";
import displayGLSL from "./shaders/display.glsl";
import divergenceGLSL from "./shaders/divergence.glsl";
import gradientSubtractGLSL from "./shaders/gradientSubtract.glsl";
import pressureGLSL from "./shaders/pressure.glsl";
import splatGLSL from "./shaders/splat.glsl";
import vorticityGLSL from "./shaders/vorticity.glsl";

interface IFluidRenderer {
    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
}

interface IFrameBufferObject {
    texture: WebGLTexture | null;
    framebuffer: WebGLFramebuffer | null;
    textId: number;
    width: number;
    height: number;
}

export interface IDoubleFrameBufferObject {
    read: IFrameBufferObject;
    write: IFrameBufferObject;
    swap: () => void;
}

export function createRenderer(): IFluidRenderer {
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        // pointerEvents: "none",
    });
    const gl = canvas.getContext("webgl2", { alpha: true }) as WebGL2RenderingContext;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    return { canvas: canvas, gl: gl };
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type) as WebGLShader;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw gl.getShaderInfoLog(shader);
    }

    return shader;
}

export function createPrograms(gl: WebGL2RenderingContext): Record<string, GLProgram> {
    const programs: Record<string, GLProgram> = {};

    const baseVertexShader = compileShader(gl, gl.VERTEX_SHADER, baseVertexGLSL);
    const clearShader = compileShader(gl, gl.FRAGMENT_SHADER, clearGLSL);
    const displayShader = compileShader(gl, gl.FRAGMENT_SHADER, displayGLSL);
    const splatShader = compileShader(gl, gl.FRAGMENT_SHADER, splatGLSL);
    const advectionShader = compileShader(gl, gl.FRAGMENT_SHADER, advectionGLSL);
    const divergenceShader = compileShader(gl, gl.FRAGMENT_SHADER, divergenceGLSL);
    const curlShader = compileShader(gl, gl.FRAGMENT_SHADER, curlGLSL);
    const vorticityShader = compileShader(gl, gl.FRAGMENT_SHADER, vorticityGLSL);
    const pressureShader = compileShader(gl, gl.FRAGMENT_SHADER, pressureGLSL);
    const gradientSubtractShader = compileShader(gl, gl.FRAGMENT_SHADER, gradientSubtractGLSL);

    programs.clear = new GLProgram(gl, baseVertexShader, clearShader);
    programs.display = new GLProgram(gl, baseVertexShader, displayShader);
    programs.splat = new GLProgram(gl, baseVertexShader, splatShader);
    programs.advection = new GLProgram(gl, baseVertexShader, advectionShader);
    programs.divergence = new GLProgram(gl, baseVertexShader, divergenceShader);
    programs.curl = new GLProgram(gl, baseVertexShader, curlShader);
    programs.vorticity = new GLProgram(gl, baseVertexShader, vorticityShader);
    programs.pressure = new GLProgram(gl, baseVertexShader, pressureShader);
    programs.gradienSubtract = new GLProgram(gl, baseVertexShader, gradientSubtractShader);

    return programs;
}

function createFrameBufferObject(
    gl: WebGL2RenderingContext,
    textId: number,
    w: number,
    h: number,
    internalFormat: number,
    format: number,
    type: number,
    param: number,
): IFrameBufferObject {
    gl.activeTexture(gl.TEXTURE0 + textId);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return {
        width: 1 / w,
        height: 1 / h,
        texture: texture,
        framebuffer: framebuffer,
        textId: textId,
    };
}

function createDoubleFrameBufferObject(
    gl: WebGL2RenderingContext,
    texId: number,
    w: number,
    h: number,
    internalFormat: number,
    format: number,
    type: number,
    param: number,
): IDoubleFrameBufferObject {
    let fbo1 = createFrameBufferObject(gl, texId, w, h, internalFormat, format, type, param);
    let fbo2 = createFrameBufferObject(gl, texId + 1, w, h, internalFormat, format, type, param);

    return {
        get read() {
            return fbo1;
        },
        get write() {
            return fbo2;
        },
        swap: () => {
            const temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        },
    };
}

export function getTextureWidthAndHeight(gl: WebGL2RenderingContext): { textureWidth: number; textureHeight: number; } {
    return {
        textureWidth: gl.drawingBufferWidth >> 1,
        textureHeight: gl.drawingBufferHeight >> 1,
    };
}

export function createFramebuffers(
    gl: WebGL2RenderingContext,
    w: number,
    h: number,
): Record<string, IDoubleFrameBufferObject> {
    const framebuffers: Record<string, IDoubleFrameBufferObject> = {};

    const texType = gl.HALF_FLOAT;
    const rgba = { if: gl.RGBA16F, f: gl.RGBA };
    const rg = { if: gl.RG16F, f: gl.RG };
    const r = { if: gl.R16F, f: gl.RED };

    framebuffers.velocity = createDoubleFrameBufferObject(gl, 0, w, h, rg.if, rg.f, texType, gl.LINEAR);
    framebuffers.density = createDoubleFrameBufferObject(gl, 2, w, h, rgba.if, rgba.f, texType, gl.LINEAR);
    framebuffers.divergence = createDoubleFrameBufferObject(gl, 4, w, h, r.if, r.f, texType, gl.NEAREST);
    framebuffers.curl = createDoubleFrameBufferObject(gl, 6, w, h, r.if, r.f, texType, gl.NEAREST);
    framebuffers.pressure = createDoubleFrameBufferObject(gl, 8, w, h, r.if, r.f, texType, gl.NEAREST);

    return framebuffers;
}
