import process from 'node:process';
import { emitKeypressEvents } from 'node:readline';

export async function hiddenPassword(
  prompt = 'Password (hidden, 12 to 128 characters): ',
) {
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    function finish(failure) {
      process.stdin.removeListener('keypress', keypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (failure) reject(new Error('Cancelled.'));
      else resolve(password);
      password = '';
    }
    function keypress(text, key) {
      if (key?.ctrl && key.name === 'c') return finish(true);
      if (key?.name === 'return' || key?.name === 'enter') return finish(false);
      if (key?.name === 'backspace') {
        password = [...password].slice(0, -1).join('');
        return;
      }
      if (
        !key?.ctrl &&
        !key?.meta &&
        text &&
        [...text].every(
          (char) => char.codePointAt(0) >= 32 && char.codePointAt(0) !== 127,
        )
      )
        password += text;
    }
    process.stdin.on('keypress', keypress);
  });
}
