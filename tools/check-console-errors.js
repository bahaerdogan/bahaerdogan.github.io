const { spawn } = require('child_process');
const glob = require('glob');

async function main() {
    const port = 9555;
    const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    try {
        let wsUrl = null;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                const res = await fetch(`http://127.0.0.1:${port}/json/version`);
                if (res.ok) {
                    const d = await res.json();
                    wsUrl = d.webSocketDebuggerUrl;
                    break;
                }
            } catch (e) {}
        }
        if (!wsUrl) throw new Error('Could not connect to Chrome');

        const ws = new WebSocket(wsUrl);
        await new Promise(r => ws.onopen = r);

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
        await sendPage('Log.enable');

        const allErrors = [];
        let currentFile = '';

        ws.addEventListener('message', (evt) => {
            const data = JSON.parse(evt.data);
            if (data.method === 'Runtime.exceptionThrown') {
                allErrors.push({
                    file: currentFile,
                    type: 'exception',
                    detail: data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || '')
                });
            }
            if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {
                allErrors.push({
                    file: currentFile,
                    type: 'log_error',
                    detail: data.params.entry.text
                });
            }
        });

        const pages = glob.sync('*.html');
        for (const file of pages) {
            currentFile = file;
            await sendPage('Page.navigate', { url: `http://localhost:8088/${file}` });
            await new Promise(r => setTimeout(r, 120));
        }

        ws.close();

        console.log(`Audited ${pages.length} pages for runtime console errors.`);
        // Filter out expected external tracking failures if GA is offline or CSP connects
        const filtered = allErrors.filter(e => !e.detail.includes('google-analytics') && !e.detail.includes('googletagmanager'));
        console.log(`Found ${filtered.length} relevant console errors/exceptions:`);
        for (const err of filtered) {
            console.log(`[${err.type}] ${err.file}: ${err.detail}`);
        }
    } finally {
        chrome.kill('SIGKILL');
    }
}

main().catch(console.error);
