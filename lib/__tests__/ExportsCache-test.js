import ExportsCache from '../ExportsCache';
import lastUpdate from '../lastUpdate';

jest.mock('../lastUpdate');

let subject;

beforeEach(() => {
  lastUpdate.mockImplementation((pathToFile) =>
    Promise.resolve({ pathToFile, mtime: Date.now() }));
  subject = new ExportsCache(process.cwd());
  return subject.init(':memory:');
});

it('can add default exports', () =>
  subject.add('Foo', './lib/ExportsCache.js', true).then(() =>
    subject.get('Foo').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsCache.js');
      expect(rows[0].name).toEqual('default');
    })
  ));

it('can add non-default exports', () =>
  subject.add('Bar', './lib/ExportsCache.js', false).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsCache.js');
      expect(rows[0].name).toEqual('Bar');
    })
  ));

it('updates existing entries', () =>
  subject.add('Bar', './lib/ExportsCache.js', false).then(() =>
    subject.add('bar', './lib/ExportsCache.js', false).then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(1);
        expect(rows[0].path).toEqual('./lib/ExportsCache.js');
        expect(rows[0].name).toEqual('bar');
      })
    )
  ));

it('can remove entries', () =>
  subject.add('Bar', './lib/ExportsCache.js', false).then(() =>
    subject.remove('./lib/ExportsCache.js').then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(0);
      })
    )
  ));

it('can check a lot of files if they need updating', () => {
  const files = [];
  for (let i = 0; i < 1000; i++) {
    files.push(`./foo-${i}.js`);
  }
  return subject.needsUpdate(files);
});

afterEach(() => subject.close());
