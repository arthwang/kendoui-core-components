/// <reference types='jquery' />
/// <reference types="kendo-ui" />


$(document).ready(function () {
  interface IComponent {
    attachTag: string;
    compTag: string;
    attrs: string[];
  }
  interface IWidgetConfig {
    id: string;
    jqName: string;
    options: object;
  }

  var kendoTags = null;
  var isHybridUI = false;
  var widgetsToInit: IWidgetConfig[] = [];
  function myEval(str) {
    return Function('"use strict";return (' + str + ')')();
  }
  function initWidgets() {
    while (widgetsToInit.length > 0) {
      const widget = widgetsToInit.pop();
      $(widget.id)[widget.jqName](widget.options);
    }
  }
  function checkHybridUI(): boolean {
    return ($(document.body).children().filter(function () { return this.nodeName.toLowerCase().startsWith('km-') && this.nodeName.toLowerCase().endsWith('view') }).length > 0) ||
      ($(document.body).children('[data-role]')
        .filter(function () { return $(this).attr('data-role').endsWith('view') }).length > 0);
  }
  function adjustAttachTagName(elem, comp: IComponent): string {
    const nodeName = elem.nodeName.toLowerCase();
    if (nodeName === 'k-editor' && elem.attributes['inline']) {
      return 'div';
    }
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
        case 'table':
          tagName = 'table';
          break;
        default:
          tagName = 'div';
          break;
      }
    } else if ($(elem).text() !== '' || elem.attributes['data-template'] || elem.attributes['template'] || nodeName === 'k-tree-view' || nodeName === 'k-grid') {
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
      if (!val) val = dashCaseToCamel(attrName);

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
  function tagToJqName(tagName: string): string {
    let jqName = tagName.toLowerCase().split('-').slice(1)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    return tagName.startsWith('km-') ? 'kendoMobile' + jqName : 'kendo' + jqName;
  }
  function dashCaseToCamel(dashCase: string) {
    return dashCase.toLowerCase().split('-').map((word, i) =>
      i > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    ).join('');
  }
  function notInitAttrs(tag: string, attrsGiven: any, comp: IComponent) {
    let attrs = {};
    for (let i = 0; i < attrsGiven.length; i++) {
      let attrName = attrsGiven[i].name;
      const val = attrsGiven[attrName].value;

      if (comp.attrs.indexOf(attrName) > -1 && !attrName.startsWith('data-')) {
        attrName = 'data-' + attrName;
      }
      attrs[attrName] = val ? val : dashCaseToCamel(val);
    }
    if (!attrsGiven['data-role']) {
      const role = tag.replace(/^km?-/, '').replace(/-/g, '');
      attrs['data-role'] = role;
    }
    return attrs;
  }
  function genKendoWidgets(jelem: JQuery<HTMLElement>): JQuery<HTMLElement> {
    return jelem.map(function () {
      return genKendoWidget($(this))[0];
    })
  }
  function genKendoWidget(jelem: JQuery<HTMLElement>): JQuery<HTMLElement> {
    if (jelem.length > 1) {
      return genKendoWidgets(jelem);
    }
    let elem = jelem[0];
    let tagName = elem.nodeName.toLowerCase();
    if (!isKendoWidget(elem)) {
      return jelem;
    }
    let comp: IComponent;
    $.ajax({
      type: 'GET',
      url: getUrl("assets/components/" + tagName + '.json'),
      dataType: 'json',
      success: function (data) { comp = data; },
      async: false
    });
    let tmp = tagName === 'k-range-slider' ? '<input/><input/>' :
      ((tagName === 'k-grid' && elem.children.length > 0 && elem.children[0].nodeName && elem.children[0].nodeName.toLowerCase() === 'table') ?
        elem.children[0].innerHTML :
        elem.innerHTML);
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
    $(elem).replaceWith(attachElem);
    if (!notInit) {
      const jqName = tagToJqName(tagName);
      const id = '#' + attachElem.attr('id');
      $(id)[jqName](attrsAndOpts.options);
      if ($(id).data(jqName) === undefined) {
        widgetsToInit.push({
          id,
          jqName,
          options: attrsAndOpts.options
        });
      }
    }
    return attachElem;
  }
  function isKendoWidget(elem: HTMLElement): boolean {
    return (/^km?-/i.test(elem.nodeName) && kendoTags.indexOf(elem.nodeName.toLocaleLowerCase()) > -1);
  }
  function filterKendos(elemsIn: JQuery<HTMLElement>) {
    return elemsIn.filter(function () {
      return isKendoWidget(this);
    });
  }
  function overrideFunction(fun: string) {
    let oldFun = (<any>jQuery).fn[fun];
    (<any>jQuery).fn[fun] = function () {
      let kendos = filterKendos(this.find('*'));

      if (kendos.length === 0 && filterKendos(this).length === 0) {
        return oldFun.apply(this, arguments);
      }

      kendos.each(function () {
        if (!$(this).attr('id'))
          $(this).attr('id', genWidgetId());
      });
      let jqObj = this.clone(true);
      const args = arguments;

      while (kendos.length > 0) {
        let elem = (<any>kendos).splice(0, 1);
        const newElem = genKendoWidget(elem);
        jqObj.find('#' + $(elem).attr('id')).replaceWith(newElem);
      }
      const widgets = genKendoWidgets(jqObj);
      oldFun.apply(widgets, args);
      initWidgets();
      initHybridUI(jqObj);
      return widgets;
    }
  }

  ['appendTo', 'prependTo', 'insertBefore', 'insertAfter'].forEach(fun => {
    overrideFunction(fun);
  });
  function getUrl(file: string): string {
    return $('script[src*="kendo-core-components"]')
      .attr('src')
      .replace(/(dist|out)\/.*/, file);
  }
  function loadKendoTags() {
    $.ajax({
      type: 'GET',
      url: getUrl('assets/components/tags.json'),
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
  function addCascadeListener(data: { parentId: string, parentValField: string, childId: string, tagName: string }) {
    const jqName = tagToJqName(data.tagName);
    const parent = $(`#${data.parentId}`).data(jqName);
    parent.setOptions({
      change:
        function () {
          const child = $(`#${data.childId}`).data(jqName);
          child.enable();
          child.dataSource.filter({
            field: data.parentValField,
            value: myEval(this.value()),
            operator: "eq"
          });
        }
    })

  }
  function getCascadeData() {
    const children = $('*')
      .find('[cascade-from]');
    const data = children.map(function () {
      let pid = $(this).attr('cascade-from');
      try {
        pid = myEval(pid);
      } catch (e) {
      }
      return {
        parentId: pid,
        parentValField: $(`#${pid}`).attr('data-value-field'),
        childId: $(this).attr('id'),
        tagName: this.nodeName
      };
    });
    return data;
  }


  loadKendoTags();
  isHybridUI = checkHybridUI();
  const cascadeData = getCascadeData();
  let kendos = filterKendos($('*'));
  while (kendos.length > 0) {
    let elem = (<any>kendos).splice(0, 1);

    genKendoWidget(elem);
    kendos = filterKendos($('*'));
  }

  initWidgets();
  initHybridUI(kendos);

  cascadeData.each(function () {
    addCascadeListener(this);
  });
});
