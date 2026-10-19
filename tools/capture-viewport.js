const { spawn } = require('child_process');
const fs = require('fs');

async function capture({ url, width, height, theme = 'light', outputPath, waitFor = 1000 }) {
    const port = 9222 + Math.floor(Math.random() * 1000);
    const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    try {
        // Wait for Chrome to be ready
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

        // Connect to browser target
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

        // Create a new target (page)
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

        function sendPage(method, params = {}) {
            const msgId = id++;
            return new Promise((resolve, reject) => {
                pending.set(msgId, { resolve, reject });
                ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
            });
        }

        // Configure emulation
        await sendPage('Page.enable');
        await sendPage('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width < 768
        });
        await sendPage('Emulation.setEmulatedMedia', {
            media: 'screen',
            features: [{ name: 'prefers-color-scheme', value: theme }]
        });

        // Set theme in localStorage / DOM if needed
        await sendPage('Page.addScriptToEvaluateOnNewDocument', {
            source: `try { localStorage.setItem('theme', '${theme}'); document.documentElement.setAttribute('data-theme', '${theme}'); } catch(e){}`
        });

        // Navigate
        await sendPage('Page.navigate', { url });
        await new Promise(r => setTimeout(r, waitFor));

        // Capture screenshot
        const { data } = await sendPage('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));

        ws.close();
        console.log(`Saved screenshot (${width}x${height}, ${theme}) to ${outputPath}`);
    } finally {
        chromeProcess.kill('SIGKILL');
    }
}

const args = process.argv.slice(2);
if (args.length >= 5) {
    capture({
        url: args[0],
        width: parseInt(args[1], 10),
        height: parseInt(args[2], 10),
        theme: args[3],
        outputPath: args[4]
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
} else {
    module.exports = { capture };
}
