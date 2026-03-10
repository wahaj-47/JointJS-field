(function ($, Drupal, once) {
  Drupal.behaviors.jointjsFormatter = {
    attach: function (context, settings) {
      once('jointjs-view', '.jointjs-view', context).forEach(function (element) {

        // Custom Node shape (same markup as editor)
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

        // Paper with built-in dot grid and transparent background so grid shows
        const paper = new joint.dia.Paper({
          el: element,
          model: graph,
          gridSize: 10,
          width: $(element).width(),
          height: $(element).height(),
          cellViewNamespace: namespace,
          interactive: false,
          background: { color: 'transparent' },
          drawGrid: { name: 'dot', args: { size: 10, color: '#e0e0e0' } }
        });

        // Ensure the grid is drawn
        if (typeof paper.drawBackground === 'function') {
          paper.drawBackground();
        }

        // Helper: clamp
        function clamp(num, min, max) {
          return Math.min(Math.max(num, min), max);
        }

        // Helper: grid size and snapping
        function gridSize() {
          return (paper && paper.options && paper.options.gridSize) ? paper.options.gridSize : 10;
        }
        function snapToGrid(x, y) {
          const g = gridSize();
          return {
            x: Math.round(x / g) * g,
            y: Math.round(y / g) * g
          };
        }

        // Upgrade legacy element to Node (preserve size)
        function upgradeLegacyNode(node, content, textOnlyMode) {
          const oldSize = node.size();

          node.set('type', 'Node');
          node.set('markup', Node.prototype.markup);

          const defaultAttrs = JSON.parse(JSON.stringify(Node.prototype.defaults.attrs || Node.prototype.defaults && Node.prototype.defaults.attrs || {}));
          node.set('attrs', defaultAttrs);

          node.attr(['htmlContent', 'html'], content || '');
          node.attr(['body', 'fill'], textOnlyMode ? 'transparent' : '#F5F5F5');
          node.attr(['body', 'stroke'], textOnlyMode ? 'transparent' : 'black');

          node.resize(oldSize.width, oldSize.height);
        }

        // Load diagram data from data-diagram attribute (base64 encoded JSON)
        let raw = $(element).data("diagram");

        if (typeof raw === 'string' && raw.trim() !== '') {
          try {
            const decoded = atob(raw);
            raw = JSON.parse(decoded);
          } catch (e) {
            console.error("Viewer diagram decode/parse error:", e, raw);
            raw = null;
          }
        }

        if (raw && typeof raw === 'object') {
          graph.fromJSON(raw);
        }

        // After loading, upgrade legacy nodes and stabilize layout
        // Give the browser a short moment to finish foreignObject layout, then re-measure and snap.
        setTimeout(function () {
          try {
            // Defensive: ensure viewer container visible
            element.style.visibility = 'visible';
            if (paper && paper.el) paper.el.style.visibility = 'visible';
          } catch (e) {}

          graph.getElements().forEach(function (el) {
            // Upgrade legacy shapes to Node if needed
            if (el.prop('type') !== 'Node') {
              upgradeLegacyNode(
                el,
                el.attr(['label', 'text']) || el.attr(['htmlContent', 'html']) || '',
                el.attr(['body', 'stroke']) === 'transparent'
              );
            }

            // Force attr re-apply to refresh view
            el.set('attrs', JSON.parse(JSON.stringify(el.get('attrs'))));

            // Re-apply size to trigger foreignObject reflow (round sizes)
            const size = el.size();
            const w = Math.round(size.width);
            const h = Math.round(size.height);
            el.resize(w, h);

            // Snap position to grid
            const p = el.position();
            const s = snapToGrid(p.x, p.y);
            el.position(s.x, s.y);
          });

          // Redraw background (grid)
          if (typeof paper.drawBackground === 'function') {
            paper.drawBackground();
          }
        }, 120);

        // Fit content after stabilization (small delay to avoid jumping)
        setTimeout(function () {
          try {
            paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });
          } catch (e) {}
        }, 200);

        // Zoom handlers
        const zoomStep = 0.1;
        const minZoom = 0.5;
        const maxZoom = 2;

        paper.on("blank:mousewheel", function (e, x, y, delta) {
          e.preventDefault();
          const { sx: sx0 } = paper.scale();
          paper.scaleUniformAtPoint(clamp(sx0 + zoomStep * delta, minZoom, maxZoom), { x, y });
        });

        paper.on('paper:pinch', function (evt, x, y, sx) {
          evt.preventDefault();
          const { sx: sx0 } = paper.scale();
          paper.scaleUniformAtPoint(clamp(sx0 * sx, minZoom, maxZoom), { x, y });
        });

        // Panning variables
        const panStart = { x: 0, y: 0 };
        const paperStart = { x: 0, y: 0 };
        let isPanning = false;

        paper.on('blank:pointerdown', function (e) {
          panStart.x = e.clientX;
          panStart.y = e.clientY;
          const translate = paper.translate();
          paperStart.x = translate.tx;
          paperStart.y = translate.ty;
          isPanning = true;
          $(element).css({ cursor: "grabbing" });
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
          $(element).css({ cursor: "grab" });
        });

        // Resize handling
        $(window).on("resize", function () {
          paper.setDimensions($(element).parent().width(), $(element).parent().height());
          paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });
        });

        // Download/export button (unchanged logic but keep transformToFitContent calls)
        $('.jointjs-download-btn').on('click', function () {
          paper.transformToFitContent({ verticalAlign: 'top', horizontalAlign: 'left', padding: 20 });
          const scaleFactor = 3;
          const bbox = paper.getContentBBox();
          const width = bbox.width * scaleFactor;
          const height = bbox.height * scaleFactor;

          const svgData = new XMLSerializer().serializeToString(paper.svg);
          const svgDataBase64 = btoa(unescape(encodeURIComponent(svgData)));
          const svgDataUrl = `data:image/svg+xml;charset=utf-8;base64,${svgDataBase64}`;

          const image = new Image();
          image.src = svgDataUrl;

          image.addEventListener('load', () => {
            const canvas = document.createElement('canvas');
            canvas.width = width + 40;
            canvas.height = height + 40;

            const context = canvas.getContext('2d');
            context.fillStyle = "white";
            context.fillRect(0, 0, width, height);

            context.drawImage(image, 0, 0, (width - 40) * scaleFactor, (height - 40) * scaleFactor);

            const link = document.createElement('a');
            link.download = 'diagram.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });
          });
        });

      });
    }
  };
})(jQuery, Drupal, once);