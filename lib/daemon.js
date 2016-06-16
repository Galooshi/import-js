import readline from 'readline';

export default function daemon() {
  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (str: string) => {
    console.log('You just typed: ' + str);
  });
}
