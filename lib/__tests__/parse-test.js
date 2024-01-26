import path from 'path';
import parse, { configureParserPlugins } from '../parse';

const local = (subPath) => path.resolve(__dirname, subPath);

it('infer typescript from file extension', () => {
  expect(() =>
    parse(
      `
        class Employee {
          private name: string;
        }
      `,
      local('foo.tsx'),
    ),
  ).not.toThrowError();
});

it('should understand Flow without being told to', () => {
  expect(() =>
    parse(
      `
        const a : string = "hello";
      `,
      local('foo.js'),
    ),
  ).not.toThrowError();
});

it('should include plugins provided', () => {
  configureParserPlugins([
    [
      'pipelineOperator',
      {
        proposal: 'hack',
        topicToken: '%',
      },
    ],
  ]);

  expect(() =>
    parse(
      `
        "hello" |> console.log(%);
      `,
      local('foo.js'),
    ),
  ).not.toThrowError();
});
