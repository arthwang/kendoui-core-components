/// <reference types='jquery' />
/// <reference types="kendo-ui" />


$(document).ready(function () {
  interface IComponent {
    attachTag: string;
    compTag: string;
    attrs: string[];
  }
  var kendoTags = null;
  var isHybridUI = false;
  function myEval(str) {
    return Function('"use strict";return (' + str + ')')();
  }
  function checkHybridUI(): boolean {
    return ($(document.body).children().filter(function () { return this.nodeName.toLowerCase().startsWith('km-') && this.nodeName.toLowerCase().endsWith('view') }).length > 0) ||
      ($(document.body).children('[data-role]')
        .filter(function () { return $(this).attr('data-role').endsWith('view') }).length > 0);
  }
  function adjustAttachTagName(elem, comp: IComponent): string {
    if (comp.attachTag != 'dynamic')
      return comp.attachTag;
    let tagName = comp.attachTag;
    if (elem.children.length > 0) {
      switch (elem.children[0].nodeName.toLowerCase()) {
        case 'option':
          tagName = 'select';
          break;
        case 'li':
          tagName = 'ul';
          break;
        default:
          tagName = 'div';
          break;
      }
    } else if ($(elem).text() !== '' || elem.attributes['data-template'] || elem.attributes['template']) {
      tagName = 'div'
    } else {
      tagName = 'input'
    }
    return tagName;
  }
  function divideAttrsAndOptions(attrsGiven: any, comp: IComponent) {
    let result = {
      attrs: {},
      options: {}
    };
    for (let i = 0; i < attrsGiven.length; i++) {
      let attrName = attrsGiven[i].name;
      let val = attrsGiven[attrName].value;
      if (!val) val = '';

      if (comp.attrs.indexOf(attrName) > -1) {
        const camelName = attrName.split('-')
          .map((word, idx) => idx > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
          .join('');
        try {
          if (myEval('typeof ' + val)) {
            try {
              result.options[camelName] = $('#' + val).length > 0 ? $('#' + val).html() : myEval(val);
            } catch (error) {
              result.options[camelName] = myEval(val);
            }
          } else {
            result.options[camelName] = val;
          }
        } catch (error) {
          result.options[camelName] = val;
        }
      } else {
        result.attrs[attrName] = val;
      }
    }
    return result;
  }
  function genWidgetId() {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return letter + (Date.now() - Math.round(1e10 * Math.random()));
  }
  function notInitAttrs(tag: string, attrsGiven: any, comp: IComponent) {
    let attrs = {};
    for (let i = 0; i < attrsGiven.length; i++) {
      let attrName = attrsGiven[i].name;
      const val = attrsGiven[attrName].value;

      if (comp.attrs.indexOf(attrName) > -1 && !attrName.startsWith('data-')) {
        attrName = 'data-' + attrName;
      }
      attrs[attrName] = val ? val : '';
    }
    if (!attrsGiven['data-role']) {
      const role = tag.replace(/^km?-/, '').replace(/-/g, '');
      attrs['data-role'] = role;
    }
    return attrs;
  }
  function genId() {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return letter + (Date.now() - Math.round(1e10 * Math.random()));
  }
  function genKendoWidget(jelem: JQuery<HTMLElement>, action?: Function, target?: any): JQuery<HTMLElement> {
    let elem = jelem[0];
    let tagName = elem.nodeName.toLocaleLowerCase();
    let comp: IComponent;
    $.ajax({
      type: 'GET',
      url: "/assets/components/" + tagName + '.json',
      dataType: 'json',
      success: function (data) { comp = data; },
      async: false
    });
    let tmp = tagName === 'k-range-slider' ? '<input/><input/>' : elem.innerHTML;
    let attrs, attrsAndOpts;
    const notInit = isHybridUI || elem.attributes['data-bind'];

    if (notInit) {
      attrs = notInitAttrs(tagName, elem.attributes, comp);
    } else {
      attrsAndOpts = divideAttrsAndOptions(elem.attributes, comp);
      attrs = attrsAndOpts.attrs;
    }
    const attachTagName = adjustAttachTagName(elem, comp);
    const closeAttachTag = attachTagName === 'input' ? '/' : `>${tmp}</${attachTagName}`;
    const attachElem = $(`<${attachTagName}${closeAttachTag}>`);

    for (let attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        attachElem.attr(attr, attrs[attr]);
      }
    }
    if (!attrs['id']) {
      attachElem.attr('id', genWidgetId())
    }
    $(elem).empty();
    attachElem.appendTo(elem);
    attachElem.unwrap();
    if (action && target) {
      action.apply(attachElem, target);
    }
    if (!notInit) {
      let jqName = tagName.split('-').slice(1)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      jqName = tagName.startsWith('km-') ? 'kendoMobile' + jqName : 'kendo' + jqName;
      $('#' + attachElem.attr('id'))[jqName](attrsAndOpts.options);
    }
    return attachElem;
  }

  function filterKendos(elemsIn) {
    return elemsIn.filter(function () {
      return (/^km?-/i.test(this.nodeName) && kendoTags.indexOf(this.nodeName.toLocaleLowerCase()) > -1);
    });
  }
  function overrideFunction(fun: string) {
    let oldFun = (<any>jQuery).fn[fun];
    (<any>jQuery).fn[fun] = function () {
      let kendos = filterKendos(this);
      if (kendos.length === 0) {
        return oldFun.apply(this, arguments);
      }
      const jqObj = this;
      const args = arguments;
      const widgets = jqObj.map(function () {
        return genKendoWidget($(this), oldFun, args);
      });
      initHybridUI(jqObj);
      return widgets;
    }
  }
  ['appendTo', 'prependTo', 'insertBefore', 'insertAfter'].forEach(fun => {
    overrideFunction(fun);
  });

  function loadKendoTags() {
    const url = $('script[src*="kendo-core-components"]')
      .attr('src')
      .replace(/(dist|out)\/.*/, 'assets/components/tags.json');
    $.ajax({
      type: 'GET',
      url: url,
      dataType: 'json',
      success: function (data) { kendoTags = data },
      async: false
    });
  }
  function initHybridUI(kendos: JQuery<HTMLElement>) {
    const containsMobile = kendos.filter(function () {
      return this.nodeName.startsWith('km-');
    }).length > 0;
    if (containsMobile && !isHybridUI) {
      kendo.init(document.body, kendo.mobile.ui, kendo.ui);
    }
  }
  console.log($('script[src*="kendo-core-components"]').attr('src'));

  loadKendoTags();
  isHybridUI = checkHybridUI();

  let kendos = filterKendos($('*'));
  while (kendos.length > 0) {
    let elem = (<any>kendos).splice(kendos.length - 1, 1);
    genKendoWidget(elem);
    kendos = filterKendos($('*'));
  }
  initHybridUI(kendos);
});
