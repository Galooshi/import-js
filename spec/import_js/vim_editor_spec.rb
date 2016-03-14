require 'spec_helper'

describe ImportJS::VIMEditor do
  module VIM
    # Empty mock module, used only to set up expectations
  end

  let(:editor) { ImportJS::VIMEditor.new }

  describe '#message' do
    before do
      allow(editor).to receive(:available_columns).and_return(30)
    end

    context 'when Vim is narrower than the message' do
      it 'truncates the message' do
        expect(VIM).to receive(:command).with(
          ":call importjs#WideMsg('this text is exactly 40 char…')")
        editor.message('this text is exactly 40 characters long')
      end
    end
  end
end
