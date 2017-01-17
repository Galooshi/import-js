import ExportsStorage from '../ExportsStorage';

let subject;

beforeEach(() => {
  subject = new ExportsStorage(process.cwd());
  return subject.init(':memory:');
});

afterEach(() => subject.close());

it('can add default exports', () =>
  subject.update({
    names: [],
    defaultNames: ['foo'],
    pathToFile: './lib/foo.js',
    mtime: 1,
  }).then(() =>
    subject.get('Foo').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/foo.js');
      expect(rows[0].name).toEqual('foo');
      expect(rows[0].isDefault).toEqual(true);
    })
  ));

it('can add non-default exports', () =>
  subject.update({
    names: ['Bar'],
    pathToFile: './lib/something.js',
    defaultNames: [],
    mtime: 1,
  }).then(() =>
    subject.get('Bar').then((rows) => {
      expect(rows.length).toEqual(1);
      expect(rows[0].path).toEqual('./lib/something.js');
      expect(rows[0].name).toEqual('Bar');
      expect(rows[0].isDefault).toEqual(false);
    })
  ));

it('can remove entries', () =>
  subject.update({
    names: ['Bar'],
    pathToFile: './lib/something.js',
    defaultNames: [],
    mtime: 1,
  }).then(() =>
    subject.remove('./lib/something.js').then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(0);
      })
    )
  ));

it('can remove entries based on a glob pattern', () =>
  Promise.all([
    subject.update({
      names: ['Bar'],
      pathToFile: './lib/something/foo/Bar.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      names: ['Foo'],
      pathToFile: './app/Foo.js',
      defaultNames: [],
      mtime: 1,
    }),
  ]).then(() =>
    subject.removeAll('./lib/**/*.js').then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(0);
      }).then(() =>
        subject.get('Foo').then((rows) => {
          expect(rows.length).toEqual(1);
        }))
    )));

it('removes old entries on update', () =>
  subject.update({
    names: ['foo', 'Bar'],
    defaultNames: ['bazgraz'],
    pathToFile: './bazgraz.js',
    mtime: 1,
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
  return subject.needsUpdate(files).then((needsUpdate) => {
    expect(needsUpdate.length).toEqual(1000);
  });
});

it('can purge dead node_modules', (done) => {
  Promise.all([
    subject.update({
      names: ['deasync'],
      pathToFile: './node_modules/deasync/index.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      names: [],
      pathToFile: './node_modules/foo/index.js',
      defaultNames: ['Foo'],
      mtime: 1,
    }),
  ])
    .then(() => subject.purgeDeadNodeModules(process.cwd()))
    .then(() => {
      subject.get('deasync').then((rows) => {
        expect(rows.length).toEqual(1);
      }).then(() =>
        subject.get('Foo').then((rows) => {
          expect(rows.length).toEqual(0);
          done();
        }));
    });
});
