import crypto from 'node:crypto'

const CATS = [
    "K#9mP$2qL", "X@5nR&8vB", "Y*3tS^7wC", "Z!1uT%4xD",
    "A$6oQ#0pE", "B^8rW@2lF", "C&4yE*9zG", "D%0uI!3hH",
    "E#7iP$5jJ", "F@2aR&6kK", "G*9sT^1lL", "H!3dU%0mM",
    "I$5fQ#8nN", "J^7gW@4oO", "K&1hE*6pP", "L%9jI!2qQ",
    "M#3kP$0rR", "N@5lR&8sS", "O*7mT^4tT", "P!9nU%1uU",
    "Q$2oQ#6vV", "R^4pW@8wW", "S&0qE*3xX", "T%6rI!5yY",
    "U#8sP$7zZ", "V@1tR&9aA", "W*3uT^2bB", "X!5vU%4cC",
    "Y$7wQ#0dD", "Z^9xW@6eE", "A&2yE*8fF", "B%4zI!1gG"
]
const DOGS = [
    0x3A, 0xC7, 0x5E, 0x91, 0x2B, 0xD8, 0x6F, 0x04,
    0xE2, 0x1A, 0xB5, 0x7C, 0x8D, 0x3F, 0x09, 0xD4
]

function raining(payload, timestamp, secret = "") {
    try {
        const combined = `${timestamp}:${payload}:${secret}`;
        const combinedBuffer = Buffer.from(combined, 'utf8');
        let mixedBuffer = Buffer.alloc(combinedBuffer.length);
        for (let i = 0; i < combinedBuffer.length; i++) {
            const keyIndex = i % CATS.length;
            const keyString = CATS[keyIndex];
            const keyChar = keyString.charCodeAt(i % keyString.length);
            const mixValue = DOGS[i % DOGS.length];
            let value = combinedBuffer[i];
            value = value ^ keyChar;
            value = (value & mixValue) | (~value & ~mixValue);
            const shiftAmount = (i % 5) + 1;
            value = ((value << shiftAmount) | (value >> (8 - shiftAmount))) & 0xFF;
            const suffixKey = keyString.charCodeAt((i + 3) % keyString.length);
            value = value ^ suffixKey;
            mixedBuffer[i] = value & 0xFF;
        }
        const hash = crypto.createHash('sha256');
        hash.update(mixedBuffer);
        const hashed = hash.digest();
        const finalBuffer = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            const keyPos = i % CATS.length;
            const keyChar = CATS[keyPos].charCodeAt(i % CATS[keyPos].length);
            const mixVal = DOGS[i % DOGS.length];

            let value = hashed[i];
            value = (value ^ keyChar) ^ mixVal;
            value = ((value << 3) | (value >> 5)) & 0xFF;
            value = value ^ (DOGS[(i + 7) % DOGS.length]);

            finalBuffer[i] = value & 0xFF;
        }
        return finalBuffer.toString('base64');
    } catch (e) {
        console.error('Generate Signature Failed:', e);
        return null;
    }
}

export const genSig = raining