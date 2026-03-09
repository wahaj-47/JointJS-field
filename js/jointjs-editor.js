(function ($, Drupal, once) {

  function isBase64(str) {
    if (typeof str !== 'string') return false;
    try {
      const cleaned = str.replace(/\s/g, '');
      return btoa(atob(cleaned)) === cleaned;
    } catch (e) {
      return false;
    }
  }

  Drupal.behaviors.jointjsEditor = {
    attach: function (context, settings) {
      once('jointjs-editor', '.jointjs-editor', context).forEach(function (element) {

        // 🔥 Scope to this field instance (single-value field)
        const hiddenField = $(element)
          .closest('.field--type-jointjs-field.field--name-field-diagram')
          .find('.jointjs-data')
          .first();

        const editorId = $(element).attr('id');
        const fieldWrapper = $(element).closest('.field--type-jointjs-field.field--name-field-diagram');

        const nodeWizard = fieldWrapper.find('#node-wizard');
        const labelField = fieldWrapper.find('textarea.label-input');
        const textOnly = fieldWrapper.find('.text-only');
        const createButton = fieldWrapper.find('.create-button');
        const updateButton = fieldWrapper.find('.update-button');
        const diagramData = hiddenField.val();

        let ckEditorInstance;

        // CKEditor instance
        setTimeout(() => {
          const ckEditorId = labelField.data('ckeditor5-id');
          if (!ckEditorId) return;
          ckEditorInstance = Drupal.CKEditor5Instances.get(String(ckEditorId));
          if (!ckEditorInstance) return;

          ckEditorInstance.keystrokes.set('Esc', (_, cancel) => {
            hideTools();
            cancel();
          });
        }, 0);

        // Node definition
        const Node = joint.dia.Element.define('Node', {
          attrs: {
            body: {
              width: 'calc(w)',
              height: 'calc(h)',
              fill: '#F5F5F5',
              stroke: 'black',
              strokeWidth: 2,
              rx: 4,
            },
            foreignObject: {
              width: 'calc(w-12)',
              height: 'calc(h-12)',
              x: 6,
              y: 6
            },
            htmlContent: {
              html: '<p>Placeholder content</p>'
            }
          },
        }, {
          markup: joint.util.svg/* xml */`
            <rect @selector="body"/>
            <foreignObject @selector="foreignObject" style="text-align: center;">
              <div xmlns="http://www.w3.org/1999/xhtml" @selector="htmlContent" class="node-div"></div>
            </foreignObject>
          `
        });

        const namespace = { ...joint.shapes, Node };

        const graph = new joint.dia.Graph({}, { cellNamespace: namespace });

        const defaultLink = new joint.shapes.standard.Link({
          attrs: {
            line: {
              stroke: 'black',
              strokeWidth: 2,
              targetMarker: { type: 'none' }
            }
          }
        });

        const paper = new joint.dia.Paper({
          el: document.getElementById(editorId),
          model: graph,
          gridSize: 10,
          height: 800,
          background: { color: '#F5F5F5' },
          cellViewNamespace: namespace,
          defaultLink: defaultLink,
          snapLabel: true,
          interactive: { labelMove: true }
        });

        // Load existing diagram (base64 or raw JSON)
        if (diagramData && typeof diagramData === 'string') {
          let raw = null;

          if (isBase64(diagramData)) {
            try {
              raw = JSON.parse(atob(diagramData));
            } catch (e) {
              console.error('Base64 decode failed:', e);
            }
          }

          if (!raw) {
            try {
              raw = JSON.parse(diagramData);
            } catch (e) {
              console.error('Raw JSON parse failed:', e);
            }
          }

          if (raw) {
            graph.fromJSON(raw);
            graph.getElements().forEach(addElementTools);
            graph.getLinks().forEach(addLinkTools);
            paper.transformToFitContent({
              verticalAlign: 'middle',
              horizontalAlign: 'middle'
            });
          }
        }

        // Graph change events
        graph.on('change', updateHiddenInput);
        graph.on('add', function (cell) {
          updateHiddenInput();
          if (cell.isLink()) addLinkTools(cell);
        });
        graph.on('remove', updateHiddenInput);

        // Wizard buttons
        createButton.on('click', function (e) {
          e.preventDefault();
          if (!ckEditorInstance) return;
          createNode(
            ckEditorInstance.getData(),
            nodeWizard.data('x'),
            nodeWizard.data('y'),
            textOnly.is(':checked')
          );
        });

        updateButton.on('click', function (e) {
          e.preventDefault();
          if (!ckEditorInstance) return;
          updateNode(
            nodeWizard.data('node'),
            ckEditorInstance.getData(),
            textOnly.is(':checked')
          );
        });

        // Zoom + pan
        const zoomStep = 0.1;
        const minZoom = 0.5;
        const maxZoom = 2;

        paper.on('blank:mousewheel', function (e, x, y, delta) {
          e.preventDefault();
          const { sx: sx0 } = paper.scale();
          paper.scaleUniformAtPoint(
            Math.min(Math.max(sx0 + zoomStep * delta, minZoom), maxZoom),
            { x, y }
          );
        });

        paper.on('paper:pinch', function (evt, x, y, sx) {
          evt.preventDefault();
          const { sx: sx0 } = paper.scale();
          paper.scaleUniformAtPoint(
            Math.min(Math.max(sx0 * sx, minZoom), maxZoom),
            { x, y }
          );
        });

        let isPanning = false;
        const panStart = { x: 0, y: 0 };
        const paperStart = { x: 0, y: 0 };

        paper.on('blank:pointerdown', function (e) {
          hideTools();
          panStart.x = e.clientX;
          panStart.y = e.clientY;
          const translate = paper.translate();
          paperStart.x = translate.tx;
          paperStart.y = translate.ty;
          isPanning = true;
        });

        paper.on('blank:pointermove', function (e) {
          if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            paper.translate(paperStart.x + dx, paperStart.y + dy);
          }
        });

        paper.on('blank:pointerup', function () {
          isPanning = false;
        });

        // Node creation/editing
        paper.on('blank:pointerdblclick', function (e, x, y) {
          if (!ckEditorInstance) return;

          const clientCoords = paper.localToClientPoint(x, y);

          nodeWizard.css({
            top: clientCoords.y + window.scrollY + 'px',
            left: clientCoords.x + window.scrollX + 'px',
            display: 'block'
          });

          nodeWizard.data('x', x);
          nodeWizard.data('y', y);
          ckEditorInstance.focus();
        });

        paper.on('element:pointerclick', function (elementView) {
          hideTools();
          elementView.showTools();
        });

        paper.on('link:pointerclick', function (linkView) {
          hideTools();
          linkView.showTools();
        });

        paper.on('element:pointerdblclick', function (elementView, e, x, y) {
          if (!ckEditorInstance) return;

          const element = elementView.model;
          const clientCoords = paper.localToClientPoint(x, y);

          createButton.hide();
          updateButton.show();

          nodeWizard.css({
            top: clientCoords.y + window.scrollY + 'px',
            left: clientCoords.x + window.scrollX + 'px',
            display: 'block'
          });

          nodeWizard.data('node', element);

          if (element.prop('type') !== 'Node') {
            ckEditorInstance.setData(element.attr(['label', 'text']));
          } else {
            ckEditorInstance.setData(element.attr(['htmlContent', 'html']));
          }

          textOnly.prop('checked', element.attr(['body', 'stroke']) === 'transparent');
          ckEditorInstance.focus();
        });

        // Utilities
        function getContentSize(body) {
          const measureDiv = fieldWrapper.find('#label-measure');
          measureDiv.html(body);
          return {
            width: measureDiv.outerWidth(),
            height: measureDiv.outerHeight()
          };
        }

        function hideTools() {
          paper.hideTools();
          if (ckEditorInstance) ckEditorInstance.setData('');
          textOnly.prop('checked', false);
          nodeWizard.hide();
          createButton.show();
          updateButton.hide();
        }

        function createNode(content, x, y, textOnlyMode = false) {
          const node = new Node();
          const { width, height } = getContentSize(content);

          node.position(x, y);
          node.resize(width + 24, height);

          node.attr(['htmlContent', 'html'], content);
          node.attr(['body', 'fill'], textOnlyMode ? 'transparent' : '#F5F5F5');
          node.attr(['body', 'stroke'], textOnlyMode ? 'transparent' : 'black');

          node.addTo(graph);
          addElementTools(node);
          hideTools();
          updateHiddenInput();
          return node;
        }

        function updateNode(node, content, textOnlyMode) {
          if (node.prop('type') !== 'Node') {
            const pos = node.position();
            createNode(content, pos.x, pos.y, textOnlyMode);
            node.remove();
            return;
          }

          const { width, height } = getContentSize(content);

          node.attr(['htmlContent', 'html'], content);
          node.attr(['body', 'fill'], textOnlyMode ? 'transparent' : '#F5F5F5');
          node.attr(['body', 'stroke'], textOnlyMode ? 'transparent' : 'black');
          node.prop('size/width', width + 24);
          node.prop('size/height', height);

          hideTools();
          updateHiddenInput();
        }

        // Save graph → base64
        function updateHiddenInput() {
          const json = JSON.stringify(graph.toJSON());
          hiddenField.val(btoa(json));
        }

        // Tools
        function addElementTools(element) {
          const elementView = element.findView(paper);

          const RemoveButton = new joint.elementTools.Remove();
          const ConnectButton = new joint.elementTools.Connect({
            x: '100%',
            y: '100%',
            magnet: 'body'
          });

          const CrossLinesButton = new joint.elementTools.Button({
            markup: [{
              tagName: 'circle',
              selector: 'button',
              attributes: { r: 7, fill: 'white', cursor: 'pointer' }
            }, {
              tagName: 'path',
              selector: 'icon',
              attributes: {
                d: 'M -4 -4 L 4 4 M -4 4 L 4 -4',
                fill: 'none',
                stroke: 'gray',
                'stroke-width': 1,
                'pointer-events': 'none'
              }
            }],
            x: '100%',
            y: 0,
            action: function () {
              const element = elementView.model;
              let size = element.getBBox();
              size = size.scale(1.2, 1.2, size.center());

              const lineOne = new joint.shapes.standard.Link();
              const lineTwo = new joint.shapes.standard.Link();

              const config = {
                line: {
                  stroke: 'gray',
                  'stroke-width': 2,
                  'stroke-opacity': 0.5,
                  targetMarker: { type: 'none' }
                }
              };

              lineOne.prop('source', size.topLeft());
              lineOne.prop('target', size.bottomRight());
              lineOne.attr(config);

              lineTwo.prop('source', size.topRight());
              lineTwo.prop('target', size.bottomLeft());
              lineTwo.attr(config);

              lineOne.addTo(graph);
              lineTwo.addTo(graph);
            }
          });

          const toolsView = new joint.dia.ToolsView({
            name: 'basic-tools',
            tools: [RemoveButton, ConnectButton, CrossLinesButton]
          });

          elementView.addTools(toolsView);
          elementView.hideTools();
        }

        function addLinkTools(link) {
          const linkView = link.findView(paper);

          const RemoveButton = new joint.linkTools.Remove({ distance: '50%', offset: 10 });
          const VerticesTool = new joint.linkTools.Vertices();
          const SegmentsTool = new joint.linkTools.Segments();

          const SourceArrowTool = new joint.linkTools.Button({
            markup: [{
              tagName: 'circle',
              selector: 'button',
              attributes: { r: 7, fill: '#003ecc', cursor: 'pointer' }
            }],
            distance: '10%',
            offset: -10,
            action: function () {
              const current = linkView.model.attr('line/sourceMarker');
              linkView.model.attr('line/sourceMarker',
                current && current.type === 'path'
                  ? { type: 'none' }
                  : { type: 'path', d: 'M 10 -5 0 0 10 5 Z', fill: 'black' }
              );
            }
          });

          const TargetArrowTool = new joint.linkTools.Button({
            markup: [{
              tagName: 'circle',
              selector: 'button',
              attributes: { r: 7, fill: '#003ecc', cursor: 'pointer' }
            }],
            distance: '90%',
            offset: 10,
            action: function () {
              const current = linkView.model.attr('line/targetMarker');
              linkView.model.attr('line/targetMarker',
                current && current.type === 'path'
                  ? { type: 'none' }
                  : { type: 'path', d: 'M 10 -5 0 0 10 5 Z', fill: 'black' }
              );
            }
          });

          const DashedTool = new joint.linkTools.Button({
            markup: [{
              tagName: 'circle',
              selector: 'button',
              attributes: { r: 7, fill: '#3498DB', cursor: 'pointer' }
            }],
            distance: '50%',
            offset: -10,
            action: function () {
              const current = linkView.model.attr('line/strokeDasharray');
              linkView.model.attr('line/strokeDasharray', current === '5, 5' ? null : '5, 5');
            }
          });

          const toolsView = new joint.dia.ToolsView({
            name: 'basic-tools',
            tools: [
              RemoveButton,
              VerticesTool,
              SegmentsTool,
              SourceArrowTool,
              TargetArrowTool,
              DashedTool
            ]
          });

          linkView.addTools(toolsView);
          linkView.hideTools();
        }

      });
    }
  };

})(jQuery, Drupal, once);