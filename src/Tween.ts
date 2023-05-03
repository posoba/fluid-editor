function clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
}

class Tween {
    public accumulator: number;
    public constructor(
        public index: number,
        public duration: number,
        public resolve: () => void,
        public callback: (progress: number) => void,
    ) {
        this.accumulator = 0;
    }

    public fireCallback(): number {
        const progress = clamp(this.accumulator / this.duration);

        this.callback(progress);
        return progress;
    }
}
export class TweenRunner {
    private cache: Tween[];

    public constructor() {
        this.cache = [];
    }

    public async create(duration: number, callback: (progress: number) => void): Promise<void> {
        return new Promise(resolve => {
            const index = this.cache.length;
            const tween = new Tween(index, duration, resolve, callback);
            this.cache.push(tween);
        });
    }

    public timestep(dt: number): void {
        for (let i = this.cache.length - 1; i >= 0; --i) {
            const tween = this.cache[i];
            const progress = this.cache[i].fireCallback();

            if (progress >= 1) {
                tween.resolve();
                this.cache = this.cache.filter(el => el !== tween);
            } else {
                tween.accumulator += dt;
            }
        }
    }
}
