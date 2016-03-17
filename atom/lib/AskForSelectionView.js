'use strict';

const SelectListView = require('atom-space-pen-views').SelectListView;

const Deferred = require('./Deferred');

// TODO should this use a context menu instead of an overlay at the top of the
// window?
class AskForSelectionView extends SelectListView {
  /**
   * @param {Function} callback
   */
  initialize() {
    super.initialize();
    this.addClass('overlay from-top');
    this.storeFocusedElement();
    this.panel = atom.workspace.addModalPanel({ item: this });
    this.deferred = new Deferred();
    this.show();
  }

  viewForItem(item) {
    return `<li>${item}</li>`;
  }

  confirmed(item) {
    // The ImportJS CLI tool expects an index from the alternatives list, so we
    // need to find the index.
    // TODO: should we change the API so the CLI tool takes a path instead of an
    // index?
    const itemIndex = this.items.indexOf(item);
    this.deferred.resolve(itemIndex);
    this.hide();
  }

  show() {
    if (this.panel) {
      this.panel.show();
      this.focusFilterEditor();
    }
  }

  hide() {
    if (this.panel) {
      this.panel.hide();
    }
  }

  cancelled() {
    this.deferred.reject();
    this.hide();
  }

  destroy() {
    this.cancel();
    this.panel.destroy();
  }
}

module.exports = AskForSelectionView;
