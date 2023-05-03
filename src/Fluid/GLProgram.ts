export class GLProgram {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly uniforms: Record<string, any>;
    public readonly gl: WebGL2RenderingContext;
    public readonly program: WebGLProgram;

    public constructor(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
        this.gl = gl;
        this.uniforms = {};
        const program = gl.createProgram();
        if (!program) {
            throw new Error();
        }
        this.program = program;

        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw gl.getProgramInfoLog(this.program);
        }

        const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = gl.getActiveUniform(this.program, i)?.name;
            if (uniformName) {
                this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
            }
        }
    }

    public bind(): void {
        this.gl.useProgram(this.program);
    }
}
