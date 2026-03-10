(function ($, Drupal, once) {

  Drupal.behaviors.jointjsEditor = {
    attach: function (context, settings) {

      once('jointjs-editor', '.jointjs-editor', context).forEach(function (element) {

        // ------------------------------------------------------------
        // DOM references
        // ------------------------------------------------------------
        const editorId = $(element).attr('id');

        const encodedField = $('.jointjs-data');
        const decodedField = $('.jointjs-decoded');

        const unlockButton = $('.jointjs-json-unlock');
        const lockButton = $('.jointjs-json-lock');
        const warningContainer = $('.jointjs-json-warning');

        const gridToggle = $('.jointjs-grid-toggle'); // NEW

        const nodeWizard = $('#node-wizard');
        const labelField = $('textarea.label-input');
        const textOnly = $('.text-only');
        const createButton = $('.create-button');
        const updateButton = $('.update-button');

        let ckEditorInstance;
        let jsonEditingEnabled = false;
        let manualEditTimer = null;

        // ------------------------------------------------------------
        // CKEditor init
        // ------------------------------------------------------------
        setTimeout(() => {
          const ckEditorId = labelField.data('ckeditor5-id');
          ckEditorInstance = Drupal.CKEditor5Instances.get(String(ckEditorId));

          ckEditorInstance.keystrokes.set('Esc', (_, cancel) => {
            hideTools();
            cancel();
          });
        }, 0);

        // ------------------------------------------------------------
        // Base64 helpers
        // ------------------------------------------------------------
        function encodeBase64(str) {
          return window.btoa(unescape(encodeURIComponent(str)));
        }

        function decodeBase64(str) {
          return decodeURIComponent(escape(window.atob(str)));
        }

        // ------------------------------------------------------------
        // Custom Node shape
        // ------------------------------------------------------------
        const Node = joint.dia.Element.define('Node', {
          attrs: {
            body: {
              magnet: true,
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

        // ------------------------------------------------------------
        // Graph + Paper
        // ------------------------------------------------------------
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
          background: { color: '#fafafa' }, // will be overridden by grid toggle
          cellViewNamespace: namespace,
          defaultLink: defaultLink,
          snapLabels: true,
          interactive: { labelMove: true }
        });

        // ------------------------------------------------------------
        // DOT GRID TOGGLE (FULLY WORKING)
        // ------------------------------------------------------------
        function applyGrid(enabled) {
          if (enabled) {
            // Add CSS grid to container
            $(element).addClass('jointjs-dot-grid');

            // Make SVG background transparent so grid shows through
            paper.options.background.color = 'transparent';
            paper.drawBackground();
          } else {
            $(element).removeClass('jointjs-dot-grid');

            // Restore solid background
            paper.options.background.color = '#fafafa';
            paper.drawBackground();
          }
        }

        // Initialize
        applyGrid(gridToggle.is(':checked'));

        // Toggle
        gridToggle.on('change', function () {
          applyGrid($(this).is(':checked'));
        });

        // ------------------------------------------------------------
        // PAN (click + drag)
        // ------------------------------------------------------------
        let panning = false;
        let lastPos = null;

        paper.on('blank:pointerdown', function (evt) {
          panning = true;
          lastPos = { x: evt.clientX, y: evt.clientY };
        });

        paper.on('blank:pointermove', function (evt) {
          if (!panning) return;

          const dx = evt.clientX - lastPos.x;
          const dy = evt.clientY - lastPos.y;

          const current = paper.translate();
          paper.translate(current.tx + dx, current.ty + dy);

          lastPos = { x: evt.clientX, y: evt.clientY };
        });

        paper.on('blank:pointerup', function () {
          panning = false;
        });

        // ------------------------------------------------------------
        // ZOOM (scroll wheel)
        // ------------------------------------------------------------
        paper.el.addEventListener('wheel', function (evt) {
          evt.preventDefault();

          const oldScale = paper.scale().sx;
          const delta = evt.deltaY < 0 ? 0.1 : -0.1;
          const newScale = Math.max(0.2, Math.min(3, oldScale + delta));

          const rect = paper.el.getBoundingClientRect();
          const offsetX = evt.clientX - rect.left;
          const offsetY = evt.clientY - rect.top;

          paper.scale(newScale, newScale, offsetX, offsetY);
        }, { passive: false });

        // ------------------------------------------------------------
        // Show tools on hover
        // ------------------------------------------------------------
        paper.on('element:mouseenter', function (view) {
          view.showTools();
        });

        paper.on('element:mouseleave', function (view) {
          view.hideTools();
        });

        // ------------------------------------------------------------
        // Graph → JSON/base64 sync
        // ------------------------------------------------------------
        graph.on('change add remove', function () {
          updateHiddenInput();
        });

        function updateHiddenInput() {
          const json = JSON.stringify(graph.toJSON(), null, 2);

          if (!jsonEditingEnabled || !decodedField.is(':focus')) {
            decodedField.val(json);
          }

          encodedField.val(encodeBase64(json));
        }

        // ------------------------------------------------------------
        // Textarea → graph (manual JSON editing)
        // ------------------------------------------------------------
        decodedField.on('input', function () {
          if (!jsonEditingEnabled) return;

          clearTimeout(manualEditTimer);
          manualEditTimer = setTimeout(applyJsonFromTextarea, 400);
        });

        function applyJsonFromTextarea() {
          const text = decodedField.val();

          try {
            const json = JSON.parse(text);

            graph.fromJSON(json);

            graph.getElements().forEach(function (element) {
              if (element.prop('type') !== 'Node') {
                upgradeLegacyNode(
                  element,
                  element.attr(['label', 'text']) || element.attr(['htmlContent', 'html']) || '',
                  element.attr(['body', 'stroke']) === 'transparent'
                );
              }
              addElementTools(element);
            });

            graph.getLinks().forEach(addLinkTools);

            encodedField.val(encodeBase64(text));
          } catch (e) {
            console.warn('Invalid JSON in textarea:', e);
          }
        }

        // ------------------------------------------------------------
        // Unlock / lock JSON editing (B2-1)
        // ------------------------------------------------------------
        function setJsonEditing(enabled) {
          jsonEditingEnabled = enabled;

          if (enabled) {
            decodedField.prop('readonly', false);
            unlockButton.hide();
            lockButton.show();
            warningContainer.hide();
          } else {
            decodedField.prop('readonly', true);
            lockButton.hide();
            unlockButton.show();
            warningContainer.hide();
          }
        }

        setJsonEditing(false);

        unlockButton.on('click', function (e) {
          e.preventDefault();
          warningContainer.show();
        });

        warningContainer.on('click', '.jointjs-json-confirm', function (e) {
          e.preventDefault();
          setJsonEditing(true);
        });

        warningContainer.on('click', '.jointjs-json-cancel', function (e) {
          e.preventDefault();
          warningContainer.hide();
        });

        lockButton.on('click', function (e) {
          e.preventDefault();
          setJsonEditing(false);
        });

        // ------------------------------------------------------------
        // Size measurement helper
        // ------------------------------------------------------------
        function getContentSize(body) {
          const measureDiv = $('#label-measure');
          measureDiv.html(body);
          return {
            width: measureDiv.outerWidth(),
            height: measureDiv.outerHeight()
          };
        }

        // ------------------------------------------------------------
        // Node creation
        // ------------------------------------------------------------
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

          return node;
        }

        // ------------------------------------------------------------
        // Legacy upgrade (in place, with size preservation)
        // ------------------------------------------------------------
        function upgradeLegacyNode(node, content, textOnlyMode) {

          const oldSize = node.size();

          node.set('type', 'Node');
          node.set('markup', Node.prototype.markup);

          const defaultAttrs = JSON.parse(JSON.stringify(Node.prototype.defaults.attrs));
          node.set('attrs', defaultAttrs);

          node.attr(['htmlContent', 'html'], content);
          node.attr(['body', 'fill'], textOnlyMode ? 'transparent' : '#F5F5F5');
          node.attr(['body', 'stroke'], textOnlyMode ? 'transparent' : 'black');

          node.resize(oldSize.width, oldSize.height);

          addElementTools(node);
        }

        // ------------------------------------------------------------
        // Node update
        // ------------------------------------------------------------
        function updateNode(node, content, textOnlyMode) {
          if (node.prop('type') !== 'Node') {
            upgradeLegacyNode(node, content, textOnlyMode);
            hideTools();
            return;
          }

          const { width, height } = getContentSize(content);

          node.attr(['htmlContent', 'html'], content);
          node.attr(['body', 'fill'], textOnlyMode ? 'transparent' : '#F5F5F5');
          node.attr(['body', 'stroke'], textOnlyMode ? 'transparent' : 'black');

          node.prop('size/width', width + 24);
          node.prop('size/height', height);

          hideTools();
        }

        // ------------------------------------------------------------
        // Node wizard UI
        // ------------------------------------------------------------
        function hideTools() {
          paper.hideTools();
          if (ckEditorInstance) ckEditorInstance.setData('');
          textOnly.prop('checked', false);
          nodeWizard.hide();
          createButton.show();
          updateButton.hide();
        }

        paper.on('blank:pointerdblclick', function (evt, x, y) {
          const client = paper.localToClientPoint(x, y);

          nodeWizard.css({
            top: client.y + window.scrollY + 'px',
            left: client.x + window.scrollX + 'px',
            display: 'block'
          });

          nodeWizard.data('x', x);
          nodeWizard.data('y', y);

          ckEditorInstance.focus();
        });

        paper.on('element:pointerdblclick', function (elementView, evt, x, y) {
          const element = elementView.model;
          const client = paper.localToClientPoint(x, y);

          createButton.hide();
          updateButton.show();

          nodeWizard.css({
            top: client.y + window.scrollY + 'px',
            left: client.x + window.scrollX + 'px',
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

        createButton.on('click', function () {
          createNode(
            ckEditorInstance.getData(),
            nodeWizard.data('x'),
            nodeWizard.data('y'),
            textOnly.is(':checked')
          );
        });

        updateButton.on('click', function () {
          updateNode(
            nodeWizard.data('node'),
            ckEditorInstance.getData(),
            textOnly.is(':checked')
          );
        });

        // ------------------------------------------------------------
        // Element + link tools
        // ------------------------------------------------------------
        function addElementTools(element) {
          const view = element.findView(paper);

          const RemoveButton = new joint.elementTools.Remove();
          const ConnectButton = new joint.elementTools.Connect({
            x: '100%',
            y: '100%',
            magnet: 'body'
          });

          const tools = new joint.dia.ToolsView({
            tools: [RemoveButton, ConnectButton]
          });

          view.addTools(tools);
          view.hideTools();
        }

        function addLinkTools(link) {
          const view = link.findView(paper);

          const RemoveButton = new joint.linkTools.Remove({ distance: '50%', offset: 10 });
          const VerticesTool = new joint.linkTools.Vertices();
          const SegmentsTool = new joint.linkTools.Segments();

          const tools = new joint.dia.ToolsView({
            tools: [RemoveButton, VerticesTool, SegmentsTool]
          });

          view.addTools(tools);
          view.hideTools();
        }

        // ------------------------------------------------------------
        // Load existing data + auto-upgrade
        // ------------------------------------------------------------
        (function loadInitialData() {
          const encodedValue = encodedField.val();

          if (!encodedValue) return;

          let jsonString = encodedValue.trim();
          const looksLikeJson =
            jsonString.startsWith('{') ||
            jsonString.startsWith('[');

          if (!looksLikeJson) {
            try {
              jsonString = decodeBase64(jsonString);
            } catch (e) {
              console.error('Base64 decode failed, using raw string.', e);
            }
          }

          decodedField.val(jsonString);

          try {
            graph.fromJSON(JSON.parse(jsonString));
          } catch (e) {
            console.error('Invalid JSON in diagram field.', e);
          }

          graph.getElements().forEach(function (element) {
            if (element.prop('type') !== 'Node') {
              upgradeLegacyNode(
                element,
                element.attr(['label', 'text']) || element.attr(['htmlContent', 'html']) || '',
                element.attr(['body', 'stroke']) === 'transparent'
              );
            } else {
              addElementTools(element);
            }
          });

          graph.getLinks().forEach(addLinkTools);
        })();

      });
    }
  };

})(jQuery, Drupal, once);