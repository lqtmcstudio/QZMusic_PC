import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Compile only this dependency-free module in memory; no test framework/DOM dependency.
const source = readFileSync(new URL('../src/renderer/src/utils/htmlAudioBackend.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { HtmlAudioBackend, toMediaUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

class FakeAudio extends EventTarget {
    src = '';
    volume = 1;
    duration = NaN;
    currentTime = 0;
    readyState = 0;
    paused = true;
    ended = false;
    loadCount = 0;
    playResult = null;
    load() { this.loadCount++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    async play() {
        if (this.playResult) return this.playResult;
        this.paused = false;
        this.dispatchEvent(new Event('playing'));
    }
    pause() {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    }
    fire(name) { this.dispatchEvent(new Event(name)); }
}

function setup() {
    const elements = [];
    const backend = new HtmlAudioBackend(() => {
        const element = new FakeAudio();
        elements.push(element);
        return element;
    });
    const events = [];
    backend.onEvent((_, event) => events.push(event));
    return { backend, elements, events };
}

function property(events, name) {
    return events.filter(event => event.name === name).at(-1)?.data;
}

test('local media URLs encode reserved characters and preserve network URLs', () => {
    assert.equal(toMediaUrl('/Users/me/Music/中文 #100%?.flac'), 'file:///Users/me/Music/%E4%B8%AD%E6%96%87%20%23100%25%3F.flac');
    assert.equal(toMediaUrl('C:\\Music\\a #.mp3'), 'file:///C:/Music/a%20%23.mp3');
    for (const url of ['http://127.0.0.1:5266/music?source=x&id=1', 'https://example.com/a.mp3', 'file:///a%20b.mp3']) {
        assert.equal(toMediaUrl(url), url);
    }
});

test('load, volume and playback use the same millisecond event contract as QZPlayer', async () => {
    const { backend, elements, events } = setup();
    await backend.setVolume(37);
    await backend.load('/music/test.mp3');
    const audio = elements[0];
    assert.equal(audio.volume, 0.37);
    assert.equal(audio.preload, 'auto');
    assert.equal(property(events, 'time-pos'), 0);
    assert.equal(property(events, 'duration'), 0);
    assert.deepEqual(property(events, 'spectrum'), []);
    audio.duration = 120.5;
    audio.readyState = 1;
    audio.fire('loadedmetadata');
    assert.equal(property(events, 'duration'), 120500);
    await backend.play();
    assert.equal(property(events, 'pause'), false);
    audio.currentTime = 12.25;
    audio.fire('timeupdate');
    assert.equal(property(events, 'time-pos'), 12250);
    await backend.togglePause();
    assert.equal(audio.paused, true);
    assert.equal(property(events, 'pause'), true);
    await backend.togglePause();
    assert.equal(property(events, 'pause'), false);
    await backend.setVolume(200);
    assert.equal(audio.volume, 1);
    await backend.setVolume(-50);
    assert.equal(audio.volume, 0);
});

test('seek before metadata is deferred, converted to seconds and clamped', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/test.mp3');
    const audio = elements[0];
    await backend.seek(15000);
    assert.equal(audio.currentTime, 0);
    audio.duration = 60;
    audio.readyState = 1;
    audio.fire('loadedmetadata');
    assert.equal(audio.currentTime, 15);
    await backend.seek(999999);
    assert.equal(audio.currentTime, 60);
    audio.fire('seeked');
    assert.equal(property(events, 'time-pos'), 60000);
    await backend.seek(-1);
    assert.equal(audio.currentTime, 0);
    await backend.seek(NaN);
    assert.equal(audio.currentTime, 0);
});

test('EOF and streaming errors reach queue/retry listeners exactly once', async () => {
    const { backend, elements, events } = setup();
    await backend.load('http://127.0.0.1:5266/music?id=1');
    await backend.play();
    const pauses = events.filter(event => event.name === 'pause').length;
    elements[0].ended = true;
    elements[0].fire('pause');
    elements[0].fire('ended');
    assert.deepEqual(events.at(-1), { event: 'end-file', reason: 'eof' });
    assert.equal(events.filter(event => event.name === 'pause').length, pauses, 'EOF must not send a together PAUSE');
    await backend.load('http://127.0.0.1:5266/music?id=2');
    await backend.play();
    elements[1].fire('error');
    elements[1].fire('error');
    assert.equal(events.filter(event => event.reason === 'error').length, 1);
});

test('play rejection is handled by the caller, not duplicated as end-file error', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/unsupported.xyz');
    let rejectPlay;
    elements[0].playResult = new Promise((_, reject) => { rejectPlay = reject; });
    const playing = backend.play();
    elements[0].fire('error');
    rejectPlay(new Error('unsupported codec'));
    await assert.rejects(playing, /unsupported codec/);
    elements[0].fire('error');
    assert.equal(events.filter(event => event.reason === 'error').length, 0);
});

test('switching tracks ignores stale events/rejections and clears deferred seeks', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/old.mp3');
    const old = elements[0];
    await backend.seek(30000);
    let rejectPlay;
    old.playResult = new Promise((_, reject) => { rejectPlay = reject; });
    const playing = backend.play();
    await backend.load('/music/new.mp3');
    assert.equal(old.src, '');
    const count = events.length;
    old.fire('ended');
    old.fire('error');
    old.fire('timeupdate');
    old.fire('playing');
    rejectPlay(new Error('aborted'));
    await playing;
    assert.equal(events.length, count);
    elements[1].duration = 100;
    elements[1].readyState = 1;
    elements[1].fire('loadedmetadata');
    assert.equal(elements[1].currentTime, 0);
});

test('pause while buffering does not treat an interrupted play as a codec failure', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/slow.mp3');
    let rejectPlay;
    elements[0].playResult = new Promise((_, reject) => { rejectPlay = reject; });
    const playing = backend.play();
    await backend.pause();
    rejectPlay(new Error('interrupted'));
    await playing;
    assert.equal(property(events, 'pause'), true);
    assert.equal(events.filter(event => event.reason === 'error').length, 0);
});

test('pause then resume ignores the previous pending play rejection', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/slow.mp3');
    let rejectPlay;
    elements[0].playResult = new Promise((_, reject) => { rejectPlay = reject; });
    const first = backend.play();
    await backend.pause();
    elements[0].playResult = null;
    await backend.play();
    rejectPlay(new Error('old play aborted'));
    await first;
    assert.equal(property(events, 'pause'), false);
    assert.equal(events.filter(event => event.reason === 'error').length, 0);
});

test('stop releases the stream and resets state without emitting EOF', async () => {
    const { backend, elements, events } = setup();
    await backend.load('/music/test.mp3');
    await backend.play();
    await backend.stop();
    assert.equal(elements[0].src, '');
    assert.equal(elements[0].paused, true);
    assert.equal(property(events, 'pause'), true);
    assert.equal(property(events, 'time-pos'), 0);
    assert.equal(property(events, 'duration'), 0);
    const count = events.length;
    elements[0].fire('ended');
    assert.equal(events.length, count);
});
