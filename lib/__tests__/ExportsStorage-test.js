import ExportsStorage from '../ExportsStorage';

let subject;

beforeEach(() => {
  subject = new ExportsStorage(process.cwd());
  return subject.init(':memory:');
});

afterEach(() => subject.close());

it('can add default exports', () =>
  subject
    .update({
      names: [],
      defaultNames: [{ name: 'foo' }],
      pathToFile: './lib/foo.js',
      mtime: 1,
    })
    .then(() =>
      subject.get('Foo').then((rows) => {
        expect(rows.length).toEqual(1);
        expect(rows[0].path).toEqual('./lib/foo.js');
        expect(rows[0].name).toEqual('foo');
        expect(rows[0].isDefault).toEqual(true);
      }),
    ));

it('can search for modules', () =>
  Promise.all([
    subject.update({
      names: ['Foo'],
      pathToFile: './lib/Foo.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      names: ['Bar'],
      pathToFile: './lib/Bar.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      types: ['BarType'],
      pathToFile: './types/Bar.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      names: [],
      pathToFile: './lib/BarBar.js',
      defaultNames: [{ name: 'barbar' }],
      mtime: 1,
    }),
  ]).then(() =>
    subject.search('bar*').then((rows) => {
      expect(rows.length).toEqual(3);
      rows.sort((left, right) => left.name.localeCompare(right.name));

      expect(rows[0].path).toEqual('./lib/Bar.js');
      expect(rows[0].name).toEqual('Bar');

      expect(rows[1].path).toEqual('./lib/BarBar.js');
      expect(rows[1].name).toEqual('barbar');

      expect(rows[2].path).toEqual('./types/Bar.js');
      expect(rows[2].name).toEqual('BarType');
      expect(rows[2].isType).toBeTruthy();
    }),
  ));

it('can add non-default exports', () =>
  subject
    .update({
      names: ['Bar'],
      pathToFile: './lib/something.js',
      defaultNames: [],
      mtime: 1,
    })
    .then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(1);
        expect(rows[0].path).toEqual('./lib/something.js');
        expect(rows[0].name).toEqual('Bar');
        expect(rows[0].isDefault).toEqual(false);
      }),
    ));

it('can remove entries', () =>
  subject
    .update({
      names: ['Bar'],
      pathToFile: './lib/something.js',
      defaultNames: [],
      mtime: 1,
    })
    .then(() =>
      subject.remove('./lib/something.js').then(() =>
        subject.get('Bar').then((rows) => {
          expect(rows.length).toEqual(0);
        }),
      ),
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
      subject
        .get('Bar')
        .then((rows) => {
          expect(rows.length).toEqual(0);
        })
        .then(() =>
          subject.get('Foo').then((rows) => {
            expect(rows.length).toEqual(1);
          }),
        ),
    ),
  ));

it('removes old entries on update', () =>
  subject
    .update({
      names: ['foo', 'Bar'],
      defaultNames: [{ name: 'bazgraz' }],
      pathToFile: './bazgraz.js',
      mtime: 1,
    })
    .then(() =>
      subject.get('Bar').then((rows) => {
        expect(rows.length).toEqual(1);
        return subject
          .update({
            names: ['foo'],
            defaultNames: [{ name: 'bazgraz' }],
            pathToFile: './bazgraz.js',
          })
          .then(() =>
            subject.get('Bar').then((rows) => {
              expect(rows.length).toEqual(0);
            }),
          );
      }),
    ));

it('can check a lot of files if they need updating', () => {
  const files = [];
  for (let i = 0; i < 1000; i += 1) {
    files.push({ path: `./foo-${i}.js`, mtime: i });
  }
  return subject.needsUpdate(files).then((needsUpdate) => {
    expect(needsUpdate.length).toEqual(1000);
  });
});

it('can purge dead node_modules', (done) => {
  Promise.all([
    subject.update({
      names: ['glob'],
      pathToFile: './node_modules/glob/glob.js',
      defaultNames: [],
      mtime: 1,
    }),
    subject.update({
      names: [],
      pathToFile: '../../node_modules/foo/index.js',
      defaultNames: [{ name: 'Foo' }],
      mtime: 1,
    }),
  ])
    .then(() => subject.purgeDeadNodeModules(process.cwd()))
    .then(() => {
      subject
        .get('glob')
        .then((rows) => {
          expect(rows.length).toEqual(1);
        })
        .then(() =>
          subject.get('Foo').then((rows) => {
            expect(rows.length).toEqual(0);
            done();
          }),
        );
    });
});
