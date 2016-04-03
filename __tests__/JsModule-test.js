jest.autoMockOff();

const JsModule = require('../lib/JsModule');

describe('JsModule', () => {
  it('does not modify lookupPath when it is .', () => {
    const lookupPath = '.';
    JsModule.construct({ lookupPath });
    expect(lookupPath).toEqual('.');
  });

  it('does not modify relativeFilePath when it is .', () => {
    const relativeFilePath = '.';
    JsModule.construct({ relativeFilePath });
    expect(relativeFilePath).toEqual('.');
  });

  it('strips out the lookup path from relativeFilePath', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('strips file extensions that are configured to be stripped', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.js', '.jsx'],
    });

    expect(jsModule.importPath).toEqual('lib/foo');
  });

  it('strips double extensions', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.web.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('lib/foo');
  });

  it('does not strip parts of double extensions', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('strips stripFromPath from the beginning of the path', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'lib',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('/foo.js');
  });

  it('does not strip anything when stripFromPath is not at the beginning', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'foo',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('prefers makeRelativeTo over stripFromPath', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'lib',
      relativeFilePath: 'app/lib/foo.js',
      makeRelativeTo: 'app/assets/bar.js',
    });

    expect(jsModule.importPath).toEqual('../lib/foo.js');
  });

  it('creates a valid JsModule when index.js is part of the name', () => {
    const jsModule = JsModule.construct({
      relativeFilePath: 'lib/index.js/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/index.js/foo.js');
    expect(jsModule.displayName()).toEqual('lib/index.js/foo.js');
  });

  it('produces a correct path when lookupPath is the current directory', () => {
    const jsModule = JsModule.construct({
      lookupPath: '.',
      relativeFilePath: './app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('app/lib/foo.js');
  });

  it('produces a correct path when lookupPath starts with a dot', () => {
    const jsModule = JsModule.construct({
      lookupPath: './app',
      relativeFilePath: './app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('produces a correct path with a relative file in the same directory', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct same-directory relative path when lookupPath starts with a dot', () => {
    const jsModule = JsModule.construct({
      lookupPath: './app',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  xit('produces a correct same-directory relative path when lookupPath is current directory', () => {
    // TODO figure out why this isn't working and fix it
    const jsModule = JsModule.construct({
      lookupPath: '.',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct relative path when other file is in a parent directory', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./lib/foo.js');
  });

  it('produces a correct relative path when other file is in a sibling directory', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/foo/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../lib/foo.js');
  });

  it('has correct path when other file is in a child of a sibling directory', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/foo/gas/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../../lib/foo.js');
  });

  it('does not create a relative path when other file is in a different lookupPath', () => {
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'spec/foo/gas/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  //describe('#open_file_path', () => {
    //context('when the file path is present', () => {
      //let(:path_to_current_file) { '/path/to/file' }

      //context('when relative file path ends with /package.json ', () => {
        //let(:relative_file_path) { 'node_modules/foo/package.json' }
        //let(:main_file) { 'index.jsx' }
        //before do
          //allow(File).to receive(:exist?)
            //.with(relative_file_path)
            //.and_return(true)
          //allow(File).to receive(:read)
            //.with(relative_file_path)
            //.and_return("{ \"main\": \"#{main_file}\" }")
        //});

        //it('replaces /package.json with the main file', () => {
          //expect(subject.open_file_path(path_to_current_file))
            //.toEqual('node_modules/foo/index.jsx')
        //});
      //});

      //context('when relative file path has /package.json in the middle', () => {
        //let(:relative_file_path) { 'node_modules/foo/package.json/bar' }

        //it('does not modify the path', () => {
          //expect(subject.open_file_path(path_to_current_file))
            //.toEqual(relative_file_path)
        //});
      //});
    //});

    //context('when the file path is empty', () => {
      //# This can happen when resolving aliases
      //let(:path_to_current_file) { '/path/to/file' }
      //subject { described_class.new(import_path: import_path) }

      //context('when the import path starts with a ./', () => {
        //let(:import_path) { './index.scss' }

        //it('makes the path relative to the path to the current file', () => {
          //expect(subject.open_file_path(path_to_current_file))
            //.toEqual('/path/to/index.scss')
        //});
      //});

      //context('when the import path starts with a ../', () => {
        //let(:import_path) { '../index.scss' }

        //it('makes the path relative to the path to the current file', () => {
          //expect(subject.open_file_path(path_to_current_file))
            //.toEqual('/path/index.scss')
        //});
      //});

      //context('when the import path does not have any dots at the beginning', () => {
        //let(:import_path) { 'my-package' }

        //context('when it is an alias of a package', () => {
          //let(:main_file) { 'index.jsx' }
          //before do
            //allow(File).to receive(:exist?)
              //.with("node_modules/#{import_path}/package.json")
              //.and_return(true)
            //allow(File).to receive(:read)
              //.with("node_modules/#{import_path}/package.json")
              //.and_return("{ \"main\": \"#{main_file}\" }")
          //});

          //it('gives the main path found in the package.json', () => {
            //expect(subject.open_file_path(path_to_current_file))
              //.toEqual("node_modules/#{import_path}/#{main_file}")
          //});
        //});

        //context('when it is not an alias of a package', () => {
          //it('does nothing to the path', () => {
            //expect(subject.open_file_path(path_to_current_file))
              //.toEqual(import_path)
          //});
        //});
      //});
    //});
  //});

  //describe('.resolve_import_path_and_main', () => {
    //let(:file_path) { '' }
    //let(:strip_file_extensions) { [] }

    //subject do
      //described_class.resolve_import_path_and_main(
        //file_path, strip_file_extensions)
    //});

    //context('when the file path ends with /package.json', () => {
      //let(:package_path) { 'node_modules/foo' }
      //let(:file_path) { "#{package_path}/package.json" }

      //context('when the file path does not exist', () => {
        //it('returns nulls', () => {
          //expect(subject).toEqual([null, null])
        //});
      //});

      //context('when the file is empty', () => {
        //before do
          //allow(File).to receive(:exist?).with(file_path).and_return(true)
          //allow(File).to receive(:read).with(file_path).and_return('')
        //});

        //it('returns nulls', () => {
          //expect(subject).toEqual([null, null])
        //});
      //});

      //context('when the file has JSON but no main file', () => {
        //before do
          //allow(File).to receive(:exist?).and_call_original
          //allow(File).to receive(:exist?).with(file_path).and_return(true)
          //allow(File).to receive(:read).with(file_path)
            //.and_return('{}')
        //});

        //it('returns nulls', () => {
          //expect(subject).toEqual([null, null])
        //});

        //context('when there is an index.js', () => {
          //before do
            //allow(File).to receive(:exist?)
              //.with("#{package_path}/index.js")
              //.and_return(true)
          //});

          //it('resolves to index.js', () => {
            //expect(subject).toEqual([package_path, 'index.js'])
          //});
        //});

        //context('when there is an index.jsx', () => {
          //before do
            //allow(File).to receive(:exist?)
              //.with("#{package_path}/index.jsx")
              //.and_return(true)
          //});

          //it('resolves to index.jsx', () => {
            //expect(subject).toEqual([package_path, 'index.jsx'])
          //});
        //});
      //});

      //context('when the file has JSON with a main file', () => {
        //let(:main_file) { 'index.jsx' }
        //before do
          //allow(File).to receive(:exist?).with(file_path).and_return(true)
          //allow(File).to receive(:read).with(file_path)
            //.and_return("{ \"main\": \"#{main_file}\" }")
        //});

        //it('returns the package path and the main file', () => {
          //expect(subject).toEqual([package_path, main_file])
        //});

        //context('when main is a directory', () => {
          //let(:main_file) { 'bar' }
          //let(:main_path) { "#{package_path}/#{main_file}" }

          //before do
            //allow(File).to receive(:exist?).with(main_path).and_return(true)
            //allow(File).to receive(:directory?).with(main_path).and_return(true)
          //});

          //context('and the main directory has an index.js file', () => {
            //let(:main_index) { 'index.js' }
            //let(:main_index_path) { "#{main_path}/#{main_index}" }

            //before do
              //allow(File).to receive(:exist?)
                //.with("#{main_path}/index.jsx").and_return(false)
              //allow(File).to receive(:exist?)
                //.with(main_index_path).and_return(true)
            //});

            //it('returns the package path and main/index.js', () => {
              //expect(subject)
                //.toEqual([package_path, "#{main_file}/#{main_index}"])
            //});
          //});

          //context('and the main directory has an index.jsx file', () => {
            //let(:main_index) { 'index.jsx' }
            //let(:main_index_path) { "#{main_path}/#{main_index}" }

            //before do
              //allow(File).to receive(:exist?)
                //.with("#{main_path}/index.js").and_return(false)
              //allow(File).to receive(:exist?)
                //.with(main_index_path).and_return(true)
            //});

            //it('returns the package path and main/index.jsx', () => {
              //expect(subject)
                //.toEqual([package_path, "#{main_file}/#{main_index}"])
            //});
          //});
        //});
      //});
    //});

    //context('when the file path ends with index.js', () => {
      //let(:file_path) { 'path/to/foo/index.js' }

      //it('returns the directory path and index.js', () => {
        //expect(subject).toEqual(['path/to/foo', 'index.js'])
      //});
    //});

    //context('when the file path ends with index.jsx', () => {
      //let(:file_path) { 'path/to/foo/index.jsx' }

      //it('returns the directory path and index.jsx', () => {
        //expect(subject).toEqual(['path/to/foo', 'index.jsx'])
      //});
    //});

    //context('when the file path is to a non-index js file', () => {
      //let(:file_path) { 'path/to/foo.js' }

      //it('returns the file path', () => {
        //expect(subject).toEqual([file_path, null])
      //});

      //context('when .js is an extension to strip', () => {
        //let(:strip_file_extensions) { ['.js', '.jsx'] }

        //it('returns the file path without the extension', () => {
          //expect(subject).toEqual(['path/to/foo', null])
        //});
      //});
    //});

    //context('when the file path is to a non-index jsx file', () => {
      //let(:file_path) { 'path/to/foo.jsx' }

      //it('returns the file path', () => {
        //expect(subject).toEqual([file_path, null])
      //});

      //context('when .jsx is an extension to strip', () => {
        //let(:strip_file_extensions) { ['.js', '.jsx'] }

        //it('returns the file path without the extension', () => {
          //expect(subject).toEqual(['path/to/foo', null])
        //});
      //});
    //});
  //});
});
