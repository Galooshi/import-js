import ExportsCache from '../ExportsCache';

let subject;

beforeEach(() => {
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

afterEach(() => subject.close());
