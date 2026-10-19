const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'laptop-1366', width: 1366, height: 768 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'wide-1920', width: 1920, height: 1080 },
];

const PAGES_TO_TEST = [
    'http://localhost:8088/index.html',
    'http://localhost:8088/BlogPosts.html',
    'http://localhost:8088/DistanceCalculatingMethods.html',
    'http://localhost:8088/AgenticAiTechDepth.html',
    'http://localhost:8088/privacy.html'
];

async function runAudit() {
    const port = 9333;
    const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    try {
        let targetWsUrl = null;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                const res = await fetch(`http://127.0.0.1:${port}/json/version`);
                if (res.ok) {
                    const data = await res.json();
                    targetWsUrl = data.webSocketDebuggerUrl;
                    break;
                }
            } catch (e) {}
        }

        if (!targetWsUrl) throw new Error('Could not connect to Chrome debugging port');

        const ws = new WebSocket(targetWsUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let id = 1;
        const pending = new Map();
        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.id && pending.has(data.id)) {
                const { resolve, reject } = pending.get(data.id);
                pending.delete(data.id);
                if (data.error) reject(data.error);
                else resolve(data.result);
            }
        };

        function send(method, params = {}) {
            const msgId = id++;
            return new Promise((resolve, reject) => {
                pending.set(msgId, { resolve, reject });
                ws.send(JSON.stringify({ id: msgId, method, params }));
            });
        }

        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

        function sendPage(method, params = {}) {
            const msgId = id++;
            return new Promise((resolve, reject) => {
                pending.set(msgId, { resolve, reject });
                ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
            });
        }

        await sendPage('Page.enable');
        await sendPage('Runtime.enable');

        const outDir = '/tmp/audit-shots';
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const results = [];

        for (const url of PAGES_TO_TEST) {
            const pageName = path.basename(new URL(url).pathname);
            for (const vp of VIEWPORTS) {
                for (const theme of ['light', 'dark']) {
                    await sendPage('Emulation.setDeviceMetricsOverride', {
                        width: vp.width,
                        height: vp.height,
                        deviceScaleFactor: 1,
                        mobile: vp.width < 768
                    });
                    await sendPage('Emulation.setEmulatedMedia', {
                        media: 'screen',
                        features: [{ name: 'prefers-color-scheme', value: theme }]
                    });
                    await sendPage('Page.addScriptToEvaluateOnNewDocument', {
                        source: `try { localStorage.setItem('theme', '${theme}'); document.documentElement.setAttribute('data-theme', '${theme}'); } catch(e){}`
                    });

                    await sendPage('Page.navigate', { url });
                    await new Promise(r => setTimeout(r, 800));

                    // Evaluate page for overflow and heading visibility
                    const evalRes = await sendPage('Runtime.evaluate', {
                        expression: `(() => {
                            const scrollW = document.documentElement.scrollWidth;
                            const innerW = window.innerWidth;
                            const h1 = document.querySelector('h1');
                            const h1Visible = h1 ? (h1.offsetWidth > 0 && h1.offsetHeight > 0 && window.getComputedStyle(h1).display !== 'none' && window.getComputedStyle(h1).visibility !== 'hidden') : false;
                            const h1Color = h1 ? window.getComputedStyle(h1).color : null;
                            const h1Text = h1 ? h1.innerText.trim() : null;
                            return {
                                overflow: scrollW > innerW,
                                scrollW,
                                innerW,
                                h1Text,
                                h1Visible,
                                h1Color
                            };
                        })()`,
                        returnByValue: true
                    });

                    const info = evalRes.result.value;
                    const shotFile = path.join(outDir, `${pageName}_${vp.name}_${theme}.png`);
                    const { data } = await sendPage('Page.captureScreenshot', { format: 'png' });
                    fs.writeFileSync(shotFile, Buffer.from(data, 'base64'));

                    results.push({
                        page: pageName,
                        viewport: vp.name,
                        width: vp.width,
                        theme,
                        shotFile,
                        ...info
                    });
                }
            }
        }

        ws.close();
        console.log(JSON.stringify(results, null, 2));
    } finally {
        chromeProcess.kill('SIGKILL');
    }
}

runAudit().catch(err => {
    console.error(err);
    process.exit(1);
});
