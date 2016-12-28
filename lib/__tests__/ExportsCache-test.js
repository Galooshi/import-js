import ExportsCache from '../ExportsCache';

let subject;

beforeEach(() => {
  subject = new ExportsCache(process.cwd());
  return subject.init(':memory:');
});

afterEach(() => subject.close());

it('can add default exports', () =>
  subject.upsert({
    name: 'Foo',
    pathToFile: './lib/ExportsCache.js',
    isDefault: true,
  }).then(() =>
    subject.get('Foo').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsCache.js');
      expect(rows[0].name).toEqual('default');
    })
  ));

it('can add non-default exports', () =>
  subject.upsert({
    name: 'Bar',
    pathToFile: './lib/ExportsCache.js',
    isDefault: false,
  }).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/ExportsCache.js');
      expect(rows[0].name).toEqual('Bar');
    })
  ));

it('updates existing entries', () =>
  subject.upsert({
    name: 'Bar',
    pathToFile: './lib/ExportsCache.js',
    isDefault: false,
  }).then(() =>
    subject.upsert({
      name: 'bar',
      pathToFile: './lib/ExportsCache.js',
      isDefault: false,
    }).then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(1);
        expect(rows[0].path).toEqual('./lib/ExportsCache.js');
        expect(rows[0].name).toEqual('bar');
      })
    )
  ));

it('can remove entries', () =>
  subject.upsert({
    name: 'Bar',
    pathToFile: './lib/ExportsCache.js',
    isDefault: false,
  }).then(() =>
    subject.remove('./lib/ExportsCache.js').then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(0);
      })
    )
  ));

it('removes old entries on update', () =>
  subject.update({
    names: ['foo', 'Bar'],
    defaultName: 'bazgraz',
    pathToFile: './bazgraz.js',
  }).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      return subject.update({
        names: ['foo'],
        defaultName: 'bazgraz',
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
