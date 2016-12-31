import ExportsStorage from '../ExportsStorage';

let subject;

beforeEach(() => {
  subject = new ExportsStorage(process.cwd());
  return subject.init(':memory:');
});

afterEach(() => subject.close());

it('can add default exports', () =>
  subject.insert({
    name: 'foo',
    pathToFile: './lib/ExportsStorage.js',
    isDefault: true,
  }).then(() =>
    subject.get('Foo').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsStorage.js');
      expect(rows[0].name).toEqual('foo');
      expect(rows[0].isDefault).toEqual(true);
    })
  ));

it('can add non-default exports', () =>
  subject.insert({
    name: 'Bar',
    pathToFile: './lib/ExportsStorage.js',
    isDefault: false,
  }).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsStorage.js');
      expect(rows[0].name).toEqual('Bar');
      expect(rows[0].isDefault).toEqual(false);
    })
  ));

it('can remove entries', () =>
  subject.insert({
    name: 'Bar',
    pathToFile: './lib/ExportsStorage.js',
    isDefault: false,
  }).then(() =>
    subject.remove('./lib/ExportsStorage.js').then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(0);
      })
    )
  ));

it('removes old entries on update', () =>
  subject.update({
    names: ['foo', 'Bar'],
    defaultNames: ['bazgraz'],
    pathToFile: './bazgraz.js',
  }).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      return subject.update({
        names: ['foo'],
        defaultNames: ['bazgraz'],
        pathToFile: './bazgraz.js',
      }).then(() =>
        subject.get('Bar').then((rows) => {
          expect(rows.length).toEqual(0);
        }));
    })
  ));

it('can check a lot of files if they need updating', () => {
  const files = [];
  for (let i = 0; i < 1000; i++) {
    files.push({ path: `./foo-${i}.js`, mtime: i });
  }
  return subject.needsUpdate(files);
});
