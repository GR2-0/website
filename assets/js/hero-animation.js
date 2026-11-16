
import {
    Application,
    Assets,
    Sprite,
    Filter,
    GlProgram
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8.14.3/dist/pixi.min.mjs';

// ==========================================
// GR 2.0 — HERO ANIMATION
// ==========================================

// Десктопные настройки не меняем
const SETTINGS = {
    speed: 0.85,
    breathing: 0.026,
    leftAmplitude: 0.55,
    centerAmplitude: 0.85,
    rightAmplitude: 1.45,
    glow: 1.25,
    maxFPS: 45,
    maxResolution: 1.5
};

// Мобильная версия до 768px
const MOBILE_SETTINGS = {
    speed: 0.65,
    breathing: 0.018,

    leftAmplitude: 1.20,
    centerAmplitude: 1.00,
    rightAmplitude: 0.75,

    glow: 1.10,

    terrainStart: 0.30,
    terrainEnd: 0.55,
    bottomStrength: 0.75,

    // Мягкий изгиб левой волны
    leftBend: 0.008
};

const hero = document.querySelector('.hero');
const canvas = hero?.querySelector('.singularity-live');

const reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)'
);

const mobileQuery = matchMedia(
    '(max-width: 768px)'
);

const imageURL = new URL(
    '/assets/images/hero-bg.png',
    import.meta.url
).href;

// ==========================================
// VERTEX SHADER
// ==========================================

const vertex = `
    in vec2 aPosition;
    out vec2 vTextureCoord;

    uniform vec4 uInputSize;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;

    void main() {
        vec2 p =
            aPosition * uOutputFrame.zw +
            uOutputFrame.xy;

        p.x =
            p.x * (2.0 / uOutputTexture.x) - 1.0;

        p.y =
            p.y *
            (2.0 * uOutputTexture.z / uOutputTexture.y)
            - uOutputTexture.z;

        gl_Position = vec4(p, 0.0, 1.0);

        vTextureCoord =
            aPosition *
            (uOutputFrame.zw * uInputSize.zw);
    }
`;

// ==========================================
// FRAGMENT SHADER
// ==========================================

const fragment = `
    in vec2 vTextureCoord;

    uniform sampler2D uTexture;
    uniform vec4 uVisibleRect;

    uniform float uTime;
    uniform float uBreathing;
    uniform float uGlow;

    uniform float uLeftAmplitude;
    uniform float uCenterAmplitude;
    uniform float uRightAmplitude;

    uniform float uTerrainStart;
    uniform float uTerrainEnd;
    uniform float uBottomStrength;

    uniform float uMobile;
    uniform float uLeftBend;

    out vec4 finalColor;

    void main() {

        vec2 uv = vTextureCoord;

        // Координаты относительно видимой
        // области hero, а не всей картинки
        vec2 screenUV =
            (uv - uVisibleRect.xy) /
            uVisibleRect.zw;

        float t = uTime;

        // ======================================
        // ОБЛАСТЬ ОБЩЕГО ДВИЖЕНИЯ
        // ======================================

        float terrain = smoothstep(
            uTerrainStart,
            uTerrainEnd,
            screenUV.y
        );

        // Оригинальное затухание на десктопе
        float desktopEdge =
            smoothstep(
                0.0, 0.10, screenUV.x
            ) *
            (
                1.0 - smoothstep(
                    0.90, 1.0, screenUV.x
                )
            );

        // На мобильном затухание мягче,
        // чтобы двигалась и левая часть
        float mobileEdge =
            smoothstep(
                0.0, 0.025, screenUV.x
            ) *
            (
                1.0 - smoothstep(
                    0.96, 1.0, screenUV.x
                )
            );

        float edge = mix(
            desktopEdge,
            mobileEdge,
            uMobile
        );

        float strength = terrain * edge;

        // ======================================
        // ОСНОВНАЯ ВОЛНА
        // ======================================

        float phase =
            screenUV.x * 7.0 -
            t * 1.12 +
            screenUV.y * 2.75;

        float primary = sin(
            phase +
            0.20 * sin(
                screenUV.x * 3.6 +
                t * 0.27
            )
        );

        float secondary = sin(
            phase * 1.68 -
            t * 0.17 +
            screenUV.y * 1.5
        );

        float longSwell = sin(
            screenUV.x * 3.2 -
            t * 0.48 +
            screenUV.y * 1.9
        );

        float wave =
            primary * 0.72 +
            secondary * 0.12 +
            longSwell * 0.16;

        // ======================================
        // АМПЛИТУДА ПО ГОРИЗОНТАЛИ
        // ======================================

        float leftZone =
            1.0 - smoothstep(
                0.18,
                0.48,
                screenUV.x
            );

        float rightZone = smoothstep(
            0.52,
            0.82,
            screenUV.x
        );

        float centerZone = max(
            0.0,
            1.0 - leftZone - rightZone
        );

        // Десктопное распределение
        float amplitude =
            leftZone * uLeftAmplitude +
            centerZone * uCenterAmplitude +
            rightZone * uRightAmplitude;

        // Мобильное распределение
        float mobileAmplitude = mix(
            uLeftAmplitude,
            uRightAmplitude,
            smoothstep(
                0.05,
                0.95,
                screenUV.x
            )
        );

        amplitude = mix(
            amplitude,
            mobileAmplitude,
            uMobile
        );

        // ======================================
        // ЗАПАЗДЫВАНИЕ ПРАВОГО ГРЕБНЯ
        // ======================================

        float delayedWave = sin(
            phase - rightZone * 0.38
        );

        float shapedWave = mix(
            wave,
            wave * 0.78 +
            delayedWave * 0.22,
            rightZone
        );

        // ======================================
        // БАЛАНС ДВИЖЕНИЯ ПО ВЫСОТЕ
        // ======================================

        float depth = smoothstep(
            0.42,
            0.98,
            screenUV.y
        );

        float depthBalance = mix(
            1.0,
            uBottomStrength,
            smoothstep(
                0.55,
                0.95,
                screenUV.y
            )
        );

        // ======================================
        // ОБЩЕЕ ДЫХАНИЕ ПОВЕРХНОСТИ
        // ======================================

        // Убрали дополнительную мобильную
        // синусоиду из предыдущей версии.
        // Она накладывалась на локальный изгиб
        // и создавала слишком сложную деформацию.

        float rise =
            shapedWave *
            uBreathing *
            strength *
            amplitude *
            (0.88 + 0.22 * depth) *
            depthBalance;

        // ======================================
        // ПЛАВНЫЙ ИЗГИБ ЛЕВОЙ ВОЛНЫ
        // Только на мобильных экранах
        // ======================================

        // Широкая горизонтальная область.
        // Действие постепенно затухает
        // от левого края к центру.


        // ======================================
        // МЯГКОЕ ДВИЖЕНИЕ ЛЕВОЙ ВОЛНЫ
        // ======================================

        float leftArea =
            1.0 - smoothstep(
                0.05,
                0.65,
                screenUV.x
            );

        float lineArea =
            smoothstep(
                0.42,
                0.52,
                screenUV.y
            ) *
            (
                1.0 - smoothstep(
                    0.74,
                    0.88,
                    screenUV.y
                )
            );

        // Длинная медленная волна
        float leftWave = sin(
            screenUV.x * 3.0 -
            t * 0.55
        );

        float localBend =
            leftWave *
            uLeftBend *
            leftArea *
            lineArea *
            uMobile;

        // ======================================
        // СМЕЩЕНИЕ ИЗОБРАЖЕНИЯ
        // ======================================


        // В левой мобильной области плавно
        // заменяем общую деформацию локальной,
        // вместо сложения двух волн.

        float localBlend =
            leftArea *
            lineArea *
            uMobile;

        float verticalMotion = mix(
            rise,
            localBend,
            localBlend
        );

        vec2 displacedUV = clamp(
            uv + vec2(
                rise * 0.075 * uVisibleRect.z,
                verticalMotion * uVisibleRect.w
            ),
            vec2(0.001),
            vec2(0.999)
        );


        vec4 base = texture(
            uTexture,
            displacedUV
        );

        // ======================================
        // ПОДСВЕТКА СУЩЕСТВУЮЩИХ ТОЧЕК
        // ======================================

        float bright = max(
            base.r,
            max(base.g, base.b)
        );

        float neon = smoothstep(
            0.09,
            0.48,
            bright
        );

        float crest = smoothstep(
            0.05,
            0.85,
            shapedWave
        );

        // ======================================
        // БЕГУЩИЕ СВЕТОВЫЕ ИМПУЛЬСЫ
        // ======================================

        float band = pow(
            max(
                0.0,
                cos(
                    phase * 1.08 -
                    t * 0.18
                )
            ),
            10.0
        );

        float band2 = pow(
            max(
                0.0,
                cos(
                    screenUV.x * 8.2 -
                    t * 0.67 +
                    screenUV.y * 3.5
                )
            ),
            18.0
        );

        float light =
            (
                band * 0.58 +
                band2 * 0.20 +
                crest * 0.22
            ) *
            neon *
            strength;

        vec3 tint = mix(
            vec3(0.60, 0.26, 1.0),
            vec3(0.20, 0.68, 1.0),
            0.5 + 0.5 * sin(
                t * 0.35 +
                screenUV.x * 2.0
            )
        );

        base.rgb +=
            tint *
            light *
            uGlow *
            0.45;

        finalColor = base;
    }
`;

// ==========================================
// PIXIJS
// ==========================================

async function start() {

    if (
        !hero ||
        !canvas ||
        reducedMotion.matches
    ) {
        return;
    }

    let app;

    try {

        app = new Application();

        await app.init({
            canvas,
            resizeTo: hero,
            backgroundAlpha: 0,
            preference: 'webgl',
            antialias: false,
            autoDensity: true,

            resolution: Math.min(
                window.devicePixelRatio || 1,
                SETTINGS.maxResolution
            ),

            powerPreference: 'low-power'
        });

        const texture = await Assets.load(imageURL);

        const background = new Sprite(texture);

        // ======================================
        // GLSL FILTER
        // ======================================

        const filter = new Filter({

            glProgram: GlProgram.from({
                vertex,
                fragment,
                name: 'organic-neon-landscape'
            }),

            resources: {
                motionUniforms: {

                    uTime: {
                        value: 0,
                        type: 'f32'
                    },

                    uBreathing: {
                        value: SETTINGS.breathing,
                        type: 'f32'
                    },

                    uGlow: {
                        value: SETTINGS.glow,
                        type: 'f32'
                    },

                    uLeftAmplitude: {
                        value: SETTINGS.leftAmplitude,
                        type: 'f32'
                    },

                    uCenterAmplitude: {
                        value: SETTINGS.centerAmplitude,
                        type: 'f32'
                    },

                    uRightAmplitude: {
                        value: SETTINGS.rightAmplitude,
                        type: 'f32'
                    },

                    uTerrainStart: {
                        value: 0.39,
                        type: 'f32'
                    },

                    uTerrainEnd: {
                        value: 0.70,
                        type: 'f32'
                    },

                    uBottomStrength: {
                        value: 1.0,
                        type: 'f32'
                    },

                    uMobile: {
                        value: 0,
                        type: 'f32'
                    },

                    uLeftBend: {
                        value: 0,
                        type: 'f32'
                    },

                    uVisibleRect: {
                        value: new Float32Array([
                            0, 0, 1, 1
                        ]),
                        type: 'vec4<f32>'
                    }

                }
            }
        });

        background.filters = [filter];

        app.stage.addChild(background);

        const uniforms =
            filter.resources.motionUniforms.uniforms;

        // ======================================
        // АДАПТИВНЫЕ НАСТРОЙКИ
        // ======================================

        function applyMotionSettings() {

            const mobile = mobileQuery.matches;

            const motion = mobile
                ? MOBILE_SETTINGS
                : SETTINGS;

            uniforms.uBreathing =
                motion.breathing;

            uniforms.uGlow =
                motion.glow;

            uniforms.uLeftAmplitude =
                motion.leftAmplitude;

            uniforms.uCenterAmplitude =
                motion.centerAmplitude;

            uniforms.uRightAmplitude =
                motion.rightAmplitude;

            uniforms.uTerrainStart = mobile
                ? motion.terrainStart
                : 0.39;

            uniforms.uTerrainEnd = mobile
                ? motion.terrainEnd
                : 0.70;

            uniforms.uBottomStrength = mobile
                ? motion.bottomStrength
                : 1.0;

            uniforms.uMobile = mobile
                ? 1.0
                : 0.0;

            uniforms.uLeftBend = mobile
                ? motion.leftBend
                : 0.0;
        }

        applyMotionSettings();

        mobileQuery.addEventListener(
            'change',
            applyMotionSettings
        );

        // ======================================
        // МАСШТАБИРОВАНИЕ ФОНА
        // Сохраняем текущую композицию
        // ======================================

        function fit() {

            const w = app.screen.width;
            const h = app.screen.height;

            const maxBackgroundWidth = 1920;

            const targetWidth = Math.min(
                w,
                maxBackgroundWidth
            );

            const scale = Math.max(
                targetWidth / texture.width,
                h / texture.height
            );

            background.scale.set(scale);

            const renderedW =
                texture.width * scale;

            const renderedH =
                texture.height * scale;

            const left =
                (w - renderedW) / 2;

            const top =
                (h - renderedH) / 2;

            background.position.set(left, top);

            // ==================================
            // КООРДИНАТЫ ВИДИМОЙ ОБЛАСТИ
            // ==================================

            const rect = uniforms.uVisibleRect;

            rect[0] = -left / renderedW;
            rect[1] = -top / renderedH;
            rect[2] = w / renderedW;
            rect[3] = h / renderedH;

            // ==================================
            // МЯГКОЕ РАСТВОРЕНИЕ КРАЁВ
            // ==================================

            const imageLeft = Math.max(
                0,
                left
            );

            const imageRight = Math.min(
                w,
                left + renderedW
            );

            const fadeWidth = Math.min(
                180,
                Math.max(
                    65,
                    renderedW * 0.10
                ),
                w * 0.22
            );

            const leftEnd = Math.min(
                imageLeft + fadeWidth,
                w / 2
            );

            const rightStart = Math.max(
                imageRight - fadeWidth,
                w / 2
            );

            canvas.style.setProperty(
                '--fade-left-start',
                `${imageLeft}px`
            );

            canvas.style.setProperty(
                '--fade-left-end',
                `${leftEnd}px`
            );

            canvas.style.setProperty(
                '--fade-right-start',
                `${rightStart}px`
            );

            canvas.style.setProperty(
                '--fade-right-end',
                `${imageRight}px`
            );
        }

        fit();

        const resizeObserver =
            new ResizeObserver(fit);

        resizeObserver.observe(hero);

        // ======================================
        // CANVAS
        // ======================================

        canvas.style.display = 'block';
        canvas.style.opacity = '1';
        canvas.style.mixBlendMode = 'normal';

        // Отключаем дублирующий CSS-фон
        hero.style.backgroundImage = 'none';

        app.ticker.maxFPS = SETTINGS.maxFPS;

        // ======================================
        // АНИМАЦИЯ
        // ======================================

        let time = 0;

        app.ticker.add(ticker => {

            const speed = mobileQuery.matches
                ? MOBILE_SETTINGS.speed
                : SETTINGS.speed;

            time +=
                Math.min(
                    ticker.deltaMS,
                    50
                ) *
                0.001 *
                speed;

            uniforms.uTime = time;
        });

        // ======================================
        // ОСТАНОВКА ВНЕ ЭКРАНА
        // ======================================

        let inView = true;

        function sync() {

            if (
                inView &&
                !document.hidden &&
                !reducedMotion.matches
            ) {
                app.ticker.start();
            } else {
                app.ticker.stop();
            }
        }

        const observer = new IntersectionObserver(
            ([entry]) => {

                inView = entry.isIntersecting;

                sync();
            },
            {
                threshold: 0.01
            }
        );

        observer.observe(hero);

        document.addEventListener(
            'visibilitychange',
            sync
        );

        reducedMotion.addEventListener(
            'change',
            sync
        );

        sync();

        console.info(
            '[Hero] Smooth mobile wave ready'
        );

    } catch (error) {

        console.error(
            '[Hero] Animation failed:',
            error
        );

        if (app) {
            app.destroy();
        }

        hero.style.backgroundImage = '';
        canvas.style.display = 'none';
    }
}

start();
