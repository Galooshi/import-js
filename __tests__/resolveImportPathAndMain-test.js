jest.autoMockOff();

describe('resolveImportPathAndMain()', () => {
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
});
