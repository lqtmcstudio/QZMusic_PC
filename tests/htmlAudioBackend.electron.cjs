// Optional real Chromium media-element smoke test: electron tests/htmlAudioBackend.electron.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qz-audio-test-'));
const deadline = setTimeout(() => { console.error('Audio smoke test timed out'); app.exit(1); }, 30000);
app.on('will-quit', () => {
    clearTimeout(deadline);
    fs.rmSync(directory, { recursive: true, force: true });
});

app.whenReady().then(async () => {
    const window = new BrowserWindow({
        show: false,
        webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
    });
    try {
        // Two seconds of silent PCM, with a deliberately awkward local filename.
        const sampleRate = 8000;
        const wav = Buffer.alloc(44 + sampleRate * 2 * 2);
        wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
        wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
        wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
        wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
        const audioPath = path.join(directory, '测试 #100%?.wav');
        // Windows disallows ? in filenames; the unit test covers encoding it separately.
        const localPath = process.platform === 'win32' ? audioPath.replace('?.wav', '.wav') : audioPath;
        fs.writeFileSync(localPath, wav);
        fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>Audio backend smoke test</title>');
        await window.loadFile(path.join(directory, 'index.html'));
        const source = fs.readFileSync(path.join(__dirname, '../src/renderer/src/utils/htmlAudioBackend.ts'), 'utf8');
        const { outputText } = ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
        });
        const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
        const result = await window.webContents.executeJavaScript(`(async () => {
            const { HtmlAudioBackend } = await import(${JSON.stringify(moduleUrl)});
            const events = [];
            const backend = new HtmlAudioBackend(() => {
                const audio = new Audio(); audio.muted = true; return audio;
            });
            backend.onEvent((_, event) => events.push(event));
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            const waitFor = async predicate => {
                const end = Date.now() + 5000;
                while (!predicate()) {
                    if (Date.now() > end) throw new Error('Timed out waiting for media event: ' + JSON.stringify(events));
                    await new Promise(resolve => setTimeout(resolve, 25));
                }
            };
            await backend.load(${JSON.stringify(localPath)});
            await backend.seek(500); // metadata may not be loaded yet
            await backend.play();
            await waitFor(() => events.some(e => e.name === 'duration' && e.data === 2000));
            await waitFor(() => events.some(e => e.name === 'time-pos' && e.data >= 500));
            await backend.pause();
            await waitFor(() => events.at(-1).name === 'pause' && events.at(-1).data === true);
            await backend.seek(1750);
            await backend.play();
            await waitFor(() => events.some(e => e.reason === 'eof'));
            await backend.stop();
            assert(events.at(-1).name === 'duration' && events.at(-1).data === 0, 'stop reset');
            await backend.load('data:audio/wav;base64,AAAA');
            let rejected = false;
            try { await backend.play(); } catch { rejected = true; }
            assert(rejected, 'invalid audio should reject play');
            assert(!events.some(e => e.reason === 'error'), 'no duplicated error event');
            await backend.stop();
            return { duration: 2000, events: events.length, localPath: true, deferredSeek: true, eof: true, invalidMedia: true };
        })()`);
        console.log('Chromium HTML Audio smoke test passed:', result);
        window.destroy();
        app.quit();
    } catch (error) {
        console.error(error);
        window.destroy();
        clearTimeout(deadline);
        fs.rmSync(directory, { recursive: true, force: true });
        app.exit(1);
    }
});
